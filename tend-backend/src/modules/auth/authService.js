const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { authenticator } = require("otplib");
const { platformPool } = require("../../config/db");
const { encryptField, decryptField, sha256Hex } = require("../../utils/crypto");
const env = require("../../config/env");

const BCRYPT_ROUNDS = 12;

async function createUser({ email, password, role }) {
  const existing = await platformPool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) {
    const err = new Error("An account with this email already exists");
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { rows } = await platformPool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
     RETURNING id, email, role`,
    [email, passwordHash, role]
  );
  return rows[0];
}

async function verifyPassword({ email, password }) {
  const { rows } = await platformPool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user) return { ok: false, reason: "invalid_credentials" };

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { ok: false, reason: "locked" };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const failed = user.failed_logins + 1;
    const lock = failed >= 5;
    await platformPool.query(
      `UPDATE users SET failed_logins = $1, locked_until = $2 WHERE id = $3`,
      [lock ? 0 : failed, lock ? new Date(Date.now() + 15 * 60 * 1000) : null, user.id]
    );
    return { ok: false, reason: lock ? "locked" : "invalid_credentials" };
  }

  await platformPool.query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [user.id]);
  return { ok: true, user };
}

function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: env.accessTokenTtl });
}

async function issueRefreshToken(user, { deviceLabel, ipAddress }) {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await platformPool.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, device_label, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, sha256Hex(raw), deviceLabel || "Unknown device", ipAddress || null, expiresAt]
  );
  return raw;
}

async function rotateRefreshToken(rawToken) {
  const hash = sha256Hex(rawToken);
  const { rows } = await platformPool.query(
    `SELECT s.*, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hash]
  );
  const session = rows[0];
  if (!session) {
    const err = new Error("Refresh token invalid or expired");
    err.status = 401;
    throw err;
  }
  // Revoke the old token immediately (rotation) — if it's ever replayed
  // after this point, that's a signal of token theft.
  await platformPool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.id]);
  const user = { id: session.user_id, role: session.role };
  const newAccess = issueAccessToken(user);
  const newRefresh = await issueRefreshToken(user, { deviceLabel: session.device_label, ipAddress: session.ip_address });
  return { accessToken: newAccess, refreshToken: newRefresh };
}

async function revokeSession(sessionId, userId) {
  await platformPool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2", [sessionId, userId]);
}

async function listSessions(userId) {
  const { rows } = await platformPool.query(
    `SELECT id, device_label, ip_address, created_at, expires_at, revoked_at
     FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

/* ---- TOTP-based MFA (e.g. Google Authenticator / Authy) ---- */

async function enrollMfa(userId) {
  const secret = authenticator.generateSecret();
  const enc = encryptField(secret);
  await platformPool.query(
    `UPDATE users SET mfa_secret_enc = $1, mfa_iv = $2, mfa_tag = $3 WHERE id = $4`,
    [enc.ciphertext, enc.iv, enc.authTag, userId]
  );
  return { secret, otpauthUrl: authenticator.keyuri(userId, "Tend", secret) };
}

async function confirmMfa(userId, token) {
  const { rows } = await platformPool.query("SELECT mfa_secret_enc, mfa_iv, mfa_tag FROM users WHERE id = $1", [userId]);
  const row = rows[0];
  if (!row?.mfa_secret_enc) return false;
  const secret = decryptField(row.mfa_secret_enc, row.mfa_iv, row.mfa_tag);
  const valid = authenticator.check(token, secret);
  if (valid) await platformPool.query("UPDATE users SET mfa_enabled = TRUE WHERE id = $1", [userId]);
  return valid;
}

async function verifyMfaToken(userId, token) {
  const { rows } = await platformPool.query("SELECT mfa_secret_enc, mfa_iv, mfa_tag FROM users WHERE id = $1", [userId]);
  const row = rows[0];
  if (!row?.mfa_secret_enc) return false;
  const secret = decryptField(row.mfa_secret_enc, row.mfa_iv, row.mfa_tag);
  return authenticator.check(token, secret);
}

module.exports = {
  createUser, verifyPassword, issueAccessToken, issueRefreshToken,
  rotateRefreshToken, revokeSession, listSessions,
  enrollMfa, confirmMfa, verifyMfaToken,
};
