const { professionalsPool } = require("../../config/db");

async function createProfessionalRecord(userId, body) {
  const client = await professionalsPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO professionals (user_id, full_name, title, license_number, years_experience, bio, hourly_rate_ugx, modes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, full_name, title, license_number, years_experience, hourly_rate_ugx, modes`,
      [userId, body.fullName, body.title, body.licenseNumber, body.yearsExperience || 0, body.bio || null, body.hourlyRateUgx, body.modes]
    );
    const professional = rows[0];
    for (const specialty of body.specialties) {
      await client.query(`INSERT INTO professional_specialties (professional_id, specialty) VALUES ($1,$2)`, [professional.id, specialty]);
    }
    await client.query("COMMIT");
    // license_verified starts FALSE: a real deployment gates this behind
    // an admin/back-office review of uploaded credentials before the
    // professional appears in matching or the public directory.
    return { ...professional, specialties: body.specialties, licenseVerified: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getProfessionalByUserId(userId) {
  const { rows } = await professionalsPool.query("SELECT * FROM professionals WHERE user_id = $1", [userId]);
  return rows[0] || null;
}

async function getProfessionalById(id) {
  const { rows } = await professionalsPool.query("SELECT * FROM professionals WHERE id = $1", [id]);
  return rows[0] || null;
}

async function listActiveProfessionals() {
  const { rows } = await professionalsPool.query(
    `SELECT p.*, COALESCE(array_agg(s.specialty) FILTER (WHERE s.specialty IS NOT NULL), '{}') AS specialties
     FROM professionals p LEFT JOIN professional_specialties s ON s.professional_id = p.id
     WHERE p.active = TRUE AND p.license_verified = TRUE
     GROUP BY p.id ORDER BY p.rating DESC`
  );
  return rows;
}

// Demo-only helper: in production a verification workflow (admin review
// of uploaded documents) flips this, never a self-service call.
async function markVerifiedForDemo(id) {
  await professionalsPool.query("UPDATE professionals SET license_verified = TRUE, license_verified_at = now() WHERE id = $1", [id]);
}

module.exports = { createProfessionalRecord, getProfessionalByUserId, getProfessionalById, listActiveProfessionals, markVerifiedForDemo };
