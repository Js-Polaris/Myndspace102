const express = require("express");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { getPatientByUserId, getConcerns } = require("../patients/patientsService");
const { runMatching } = require("./matchingService");
const { audit } = require("../audit/auditLog");

const router = express.Router();

router.post("/run", requireAuth, requireRole("patient"), async (req, res, next) => {
  try {
    const patient = await getPatientByUserId(req.user.id);
    if (!patient) return res.status(404).json({ error: "Patient profile not found" });
    const concerns = await getConcerns(patient.id);
    const results = await runMatching(patient, concerns, patient.mode_pref);
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "matching.run", resource: `patients:${patient.id}`, ipAddress: req.ip });
    res.json(results);
  } catch (err) { next(err); }
});

module.exports = router;
