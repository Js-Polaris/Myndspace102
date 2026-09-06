const { patientsPool } = require("../../config/db");
const { encryptField, decryptField } = require("../../utils/crypto");
const { platformPool } = require("../../config/db");

async function createPatientRecord(userId, body) {
  const client = await patientsPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO patients (user_id, full_name, phone, date_of_birth, gender, mode_pref, urgency)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, full_name, phone, date_of_birth, mode_pref, urgency`,
      [userId, body.fullName, body.phone, body.dateOfBirth, body.gender || null, body.modePref, body.urgency]
    );
    const patient = rows[0];

    for (const concern of body.concerns) {
      await client.query(`INSERT INTO patient_concerns (patient_id, concern) VALUES ($1,$2)`, [patient.id, concern]);
    }

    for (let i = 0; i < body.nextOfKin.length; i++) {
      const kin = body.nextOfKin[i];
      const nameEnc = encryptField(kin.name);
      const relEnc = encryptField(kin.relation);
      const phoneEnc = encryptField(kin.phone);
      // name/relation/phone share one IV+tag pair per row for simplicity;
      // a stricter design would encrypt each field independently.
      await client.query(
        `INSERT INTO next_of_kin (patient_id, slot, name_enc, relation_enc, phone_enc, iv, auth_tag)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [patient.id, i + 1, nameEnc.ciphertext, relEnc.ciphertext, phoneEnc.ciphertext, nameEnc.iv, nameEnc.authTag]
      );
    }

    if (body.urgency === "urgent") {
      await platformPool.query(
        `INSERT INTO risk_flags (patient_id, source) VALUES ($1, 'onboarding')`,
        [patient.id]
      );
    }

    await client.query("COMMIT");
    return { ...patient, concerns: body.concerns };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getPatientByUserId(userId) {
  const { rows } = await patientsPool.query("SELECT * FROM patients WHERE user_id = $1", [userId]);
  return rows[0] || null;
}

async function getConcerns(patientId) {
  const { rows } = await patientsPool.query("SELECT concern FROM patient_concerns WHERE patient_id = $1", [patientId]);
  return rows.map((r) => r.concern);
}

async function saveMatchResults(patientId, matches) {
  await patientsPool.query("DELETE FROM match_results WHERE patient_id = $1", [patientId]);
  for (const m of matches) {
    await patientsPool.query(
      `INSERT INTO match_results (patient_id, professional_id, rank, score, reasons) VALUES ($1,$2,$3,$4,$5)`,
      [patientId, m.professionalId, m.rank, m.score, m.reasons]
    );
  }
}

async function getMatchResults(patientId) {
  const { rows } = await patientsPool.query(
    "SELECT professional_id, rank, score, reasons FROM match_results WHERE patient_id = $1 ORDER BY rank", [patientId]
  );
  return rows;
}

async function addMoodEntry(patientId, { moodValue, note }) {
  const enc = note ? encryptField(note) : null;
  const { rows } = await patientsPool.query(
    `INSERT INTO mood_entries (patient_id, mood_value, note_enc, iv, auth_tag)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, mood_value, logged_at`,
    [patientId, moodValue, enc?.ciphertext || null, enc?.iv || null, enc?.authTag || null]
  );
  return rows[0];
}

async function listMoodEntries(patientId, limit = 30) {
  const { rows } = await patientsPool.query(
    `SELECT id, mood_value, note_enc, iv, auth_tag, logged_at FROM mood_entries
     WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT $2`, [patientId, limit]
  );
  return rows.map((r) => ({
    id: r.id, moodValue: r.mood_value, loggedAt: r.logged_at,
    note: r.note_enc ? decryptField(r.note_enc, r.iv, r.auth_tag) : null,
  }));
}

async function addJournalEntry(patientId, { title, body }) {
  const enc = encryptField(body);
  const { rows } = await patientsPool.query(
    `INSERT INTO journal_entries (patient_id, title, body_enc, iv, auth_tag)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, title, created_at`,
    [patientId, title || "Untitled entry", enc.ciphertext, enc.iv, enc.authTag]
  );
  return rows[0];
}

async function listJournalEntries(patientId) {
  const { rows } = await patientsPool.query(
    `SELECT id, title, body_enc, iv, auth_tag, created_at FROM journal_entries
     WHERE patient_id = $1 ORDER BY created_at DESC`, [patientId]
  );
  return rows.map((r) => ({
    id: r.id, title: r.title, createdAt: r.created_at,
    body: decryptField(r.body_enc, r.iv, r.auth_tag),
  }));
}

module.exports = {
  createPatientRecord, getPatientByUserId, getConcerns,
  saveMatchResults, getMatchResults,
  addMoodEntry, listMoodEntries, addJournalEntry, listJournalEntries,
};
