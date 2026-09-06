const { platformPool } = require("../../config/db");

/**
 * Records who touched what. Called from every route that reads or
 * writes PHI-adjacent data (journal, mood, next-of-kin, appointments).
 * Fire-and-forget by design — a logging failure should never block the
 * user's actual request, but it is awaited here so failures surface in
 * server logs during development instead of vanishing silently.
 */
async function audit({ actorUserId, actorRole, action, resource, ipAddress, metadata }) {
  try {
    await platformPool.query(
      `INSERT INTO audit_log (actor_user_id, actor_role, action, resource, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorUserId || null, actorRole || null, action, resource, ipAddress || null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error("[audit] failed to write audit log:", err.message);
  }
}

module.exports = { audit };
