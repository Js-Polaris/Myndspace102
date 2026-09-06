const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { audit } = require("../audit/auditLog");
const svc = require("./patientsService");

const router = express.Router();

// Every route below first resolves "my" patient row from the JWT's
// user id — a patient can never pass someone else's patientId and
// read their data (no IDOR route param for patient-owned resources).
async function loadOwnPatient(req, res, next) {
  const patient = await svc.getPatientByUserId(req.user.id);
  if (!patient) return res.status(404).json({ error: "Patient profile not found" });
  req.patient = patient;
  next();
}

router.use(requireAuth, requireRole("patient"), loadOwnPatient);

router.get("/me", async (req, res, next) => {
  try {
    const concerns = await svc.getConcerns(req.patient.id);
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "patient.read_self", resource: `patients:${req.patient.id}`, ipAddress: req.ip });
    res.json({ ...req.patient, concerns });
  } catch (err) { next(err); }
});

router.get("/matches", async (req, res, next) => {
  try {
    res.json(await svc.getMatchResults(req.patient.id));
  } catch (err) { next(err); }
});

const moodSchema = z.object({ moodValue: z.number().int().min(1).max(5), note: z.string().max(2000).optional() });
router.post("/mood", validate(moodSchema), async (req, res, next) => {
  try {
    const entry = await svc.addMoodEntry(req.patient.id, req.body);
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "mood.create", resource: `mood_entries:${entry.id}`, ipAddress: req.ip });
    res.status(201).json(entry);
  } catch (err) { next(err); }
});
router.get("/mood", async (req, res, next) => {
  try {
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "mood.list_self", resource: `patients:${req.patient.id}`, ipAddress: req.ip });
    res.json(await svc.listMoodEntries(req.patient.id));
  } catch (err) { next(err); }
});

const journalSchema = z.object({ title: z.string().max(200).optional(), body: z.string().min(1).max(20000) });
router.post("/journal", validate(journalSchema), async (req, res, next) => {
  try {
    const entry = await svc.addJournalEntry(req.patient.id, req.body);
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "journal.create", resource: `journal_entries:${entry.id}`, ipAddress: req.ip });
    res.status(201).json(entry);
  } catch (err) { next(err); }
});
router.get("/journal", async (req, res, next) => {
  try {
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "journal.list_self", resource: `patients:${req.patient.id}`, ipAddress: req.ip });
    res.json(await svc.listJournalEntries(req.patient.id));
  } catch (err) { next(err); }
});

module.exports = router;
