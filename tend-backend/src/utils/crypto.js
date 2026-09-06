const crypto = require("crypto");
const env = require("../config/env");

const key = crypto.createHash("sha256").update(env.fieldEncryptionKey).digest(); // 32 bytes

/**
 * Encrypt a plaintext string for storage in a BYTEA column.
 * Returns { ciphertext, iv, authTag } as Buffers — store all three.
 * AES-256-GCM gives us confidentiality + integrity (tamper detection):
 * a modified ciphertext or wrong key fails to decrypt rather than
 * silently returning garbage.
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptField(ciphertext, iv, authTag) {
  if (!ciphertext) return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

module.exports = { encryptField, decryptField, sha256Hex };
