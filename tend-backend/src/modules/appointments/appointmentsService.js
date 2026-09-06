const { platformPool } = require("../../config/db");
const crypto = require("crypto");
const { getProfessionalById } = require("../professionals/professionalsService");

async function createAppointment({ patientId, professionalId, mode, scheduledStart }) {
  const professional = await getProfessionalById(professionalId);
  if (!professional || !professional.active || !professional.license_verified) {
    const err = new Error("Professional is not available for booking");
    err.status = 400;
    throw err;
  }
  if (!professional.modes.includes(mode)) {
    const err = new Error(`This professional does not offer ${mode} sessions`);
    err.status = 400;
    throw err;
  }

  const { rows } = await platformPool.query(
    `INSERT INTO appointments (patient_id, professional_id, mode, scheduled_start, amount_ugx, status)
     VALUES ($1,$2,$3,$4,$5,'pending_payment') RETURNING *`,
    [patientId, professionalId, mode, scheduledStart, professional.hourly_rate_ugx]
  );
  return rows[0];
}

// Simulates calling a payment gateway (Flutterwave for card + MTN/Airtel
// Money, or Stripe). No PAN or mobile-money PIN ever reaches this
// server: in production, the frontend would collect payment details
// through the gateway's own hosted field/SDK and hand Tend back only a
// short-lived charge token, which is what would be sent here instead
// of `method`. This function stands in for that round trip.
async function initiateAndConfirmPayment(appointment, method) {
  const providerRef = "sim_" + crypto.randomUUID();
  const provider = method === "card" ? "flutterwave" : "mtn";

  await platformPool.query(
    `INSERT INTO payments (appointment_id, method, provider, provider_ref, amount_ugx, status, webhook_verified)
     VALUES ($1,$2,$3,$4,$5,'succeeded', TRUE)`,
    [appointment.id, method, provider, providerRef, appointment.amount_ugx]
  );

  const videoRoomToken = appointment.mode === "online" ? "room_" + crypto.randomUUID() : null;

  const { rows } = await platformPool.query(
    `UPDATE appointments SET status = 'confirmed', video_room_token = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [videoRoomToken, appointment.id]
  );
  return rows[0];
}

async function getAppointment(id) {
  const { rows } = await platformPool.query("SELECT * FROM appointments WHERE id = $1", [id]);
  return rows[0] || null;
}

async function listForPatient(patientId) {
  const { rows } = await platformPool.query(
    "SELECT * FROM appointments WHERE patient_id = $1 ORDER BY scheduled_start DESC", [patientId]
  );
  return rows;
}

async function listForProfessional(professionalId) {
  const { rows } = await platformPool.query(
    "SELECT * FROM appointments WHERE professional_id = $1 AND status = 'confirmed' ORDER BY scheduled_start", [professionalId]
  );
  return rows;
}

module.exports = { createAppointment, initiateAndConfirmPayment, getAppointment, listForPatient, listForProfessional };
