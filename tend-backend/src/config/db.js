const { Pool } = require("pg");
const env = require("./env");

// Three separate connection pools, each authenticating as a distinct,
// least-privilege Postgres role. A vulnerability in, say, the feed
// module can only ever reach platform_db's user — it has no
// credentials that would let it touch patients_db at all.
const patientsPool = new Pool(env.db.patients);
const professionalsPool = new Pool(env.db.professionals);
const platformPool = new Pool(env.db.platform);

async function healthCheck() {
  await Promise.all([
    patientsPool.query("SELECT 1"),
    professionalsPool.query("SELECT 1"),
    platformPool.query("SELECT 1"),
  ]);
}

module.exports = { patientsPool, professionalsPool, platformPool, healthCheck };
