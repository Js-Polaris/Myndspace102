const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { getPatientByUserId } = require("../patients/patientsService");
const { getProfessionalByUserId } = require("../professionals/professionalsService");
const svc = require("./appointmentsService");
const { audit } = require("../audit/auditLog");

const router = express.Router();

const createSchema = z.object({
  professionalId: z.string().uuid(),
  mode: z.enum(["online", "physical"]),
  scheduledStart: z.string(), // ISO datetime
});

router.post("/", requireAuth, requireRole("patient"), validate(createSchema), async (req, res, next) => {
  try {
    const patient = await getPatientByUserId(req.user.id);
    if (!patient) return res.status(404).json({ error: "Patient profile not found" });
    const appt = await svc.createAppointment({ patientId: patient.id, ...req.body });
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "appointment.create", resource: `appointments:${appt.id}`, ipAddress: req.ip });
    res.status(201).json(appt);
  } catch (err) { next(err); }
});

const paySchema = z.object({ method: z.enum(["card", "momo"]) });

// This is the enforcement point for "appointments only confirm once
// paid": status starts at pending_payment from creation and only this
// route (backed by a successful gateway response) can flip it. A
// patient cannot PATCH status directly — there is no such route.
router.post("/:id/pay", requireAuth, requireRole("patient"), validate(paySchema), async (req, res, next) => {
  try {
    const patient = await getPatientByUserId(req.user.id);
    const appt = await svc.getAppointment(req.params.id);
    if (!appt || appt.patient_id !== patient.id) return res.status(404).json({ error: "Appointment not found" });
    if (appt.status !== "pending_payment") return res.status(409).json({ error: `Appointment is already ${appt.status}` });

    const confirmed = await svc.initiateAndConfirmPayment(appt, req.body.method);
    await audit({ actorUserId: req.user.id, actorRole: "patient", action: "appointment.paid", resource: `appointments:${appt.id}`, ipAddress: req.ip, metadata: { method: req.body.method } });
    res.json(confirmed);
  } catch (err) { next(err); }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "patient") {
      const patient = await getPatientByUserId(req.user.id);
      return res.json(patient ? await svc.listForPatient(patient.id) : []);
    }
    if (req.user.role === "professional") {
      const pro = await getProfessionalByUserId(req.user.id);
      return res.json(pro ? await svc.listForProfessional(pro.id) : []);
    }
    res.json([]);
  } catch (err) { next(err); }
});

module.exports = router;
