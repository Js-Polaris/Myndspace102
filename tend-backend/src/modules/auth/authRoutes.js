const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { authLimiter } = require("../../middleware/rateLimit");
const auth = require("./authService");
const { createPatientRecord, getConcerns } = require("../patients/patientsService");
const { createProfessionalRecord } = require("../professionals/professionalsService");
const { runMatching } = require("../matching/matchingService");
const { audit } = require("../audit/auditLog");

const router = express.Router();

const passwordRule = z.string().min(10, "Use at least 10 characters").regex(/[0-9]/, "Include at least one number");

const registerPatientSchema = z.object({
  email: z.string().email(),
  password: passwordRule,
  fullName: z.string().min(2),
  phone: z.string().min(7),
  dateOfBirth: z.string(), // ISO date
  gender: z.string().optional(),
  concerns: z.array(z.string()).min(1),
  modePref: z.enum(["online", "physical", "either"]).default("either"),
  urgency: z.enum(["routine", "soon", "urgent"]).default("routine"),
  nextOfKin: z.tuple([
    z.object({ name: z.string().min(2), relation: z.string().min(2), phone: z.string().min(7) }),
    z.object({ name: z.string().min(2), relation: z.string().min(2), phone: z.string().min(7) }),
  ]),
});

const registerProfessionalSchema = z.object({
  email: z.string().email(),
  password: passwordRule,
  fullName: z.string().min(2),
  title: z.string().min(2),
  licenseNumber: z.string().min(3),
  yearsExperience: z.number().int().min(0).default(0),
  bio: z.string().optional(),
  hourlyRateUgx: z.number().int().positive(),
  modes: z.array(z.enum(["online", "physical"])).min(1),
  specialties: z.array(z.string()).min(1),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string(), mfaToken: z.string().optional() });
const refreshSchema = z.object({ refreshToken: z.string() });

// Registering writes to TWO databases (platform_db.users, then
// patients_db/professionals_db). Postgres can't give us a single
// cross-database transaction, so we do a compensating action: if the
// second write fails, we delete the just-created user rather than
// leave an orphaned, password-having account with no profile.
router.post("/register/patient", authLimiter, validate(registerPatientSchema), async (req, res, next) => {
  try {
    const user = await auth.createUser({ email: req.body.email, password: req.body.password, role: "patient" });
    try {
      const patient = await createPatientRecord(user.id, req.body);
      await audit({ actorUserId: user.id, actorRole: "patient", action: "patient.register", resource: `patients:${patient.id}`, ipAddress: req.ip });
      // Auto-match to the top 3 professionals immediately on signup.
      const matches = await runMatching(patient, req.body.concerns, req.body.modePref);
      const accessToken = auth.issueAccessToken(user);
      const refreshToken = await auth.issueRefreshToken(user, { deviceLabel: req.headers["user-agent"], ipAddress: req.ip });
      res.status(201).json({ user, patient, matches, accessToken, refreshToken });
    } catch (inner) {
      await require("../../config/db").platformPool.query("DELETE FROM users WHERE id = $1", [user.id]);
      throw inner;
    }
  } catch (err) { next(err); }
});

router.post("/register/professional", authLimiter, validate(registerProfessionalSchema), async (req, res, next) => {
  try {
    const user = await auth.createUser({ email: req.body.email, password: req.body.password, role: "professional" });
    try {
      const professional = await createProfessionalRecord(user.id, req.body);
      await audit({ actorUserId: user.id, actorRole: "professional", action: "professional.register", resource: `professionals:${professional.id}`, ipAddress: req.ip });
      const accessToken = auth.issueAccessToken(user);
      const refreshToken = await auth.issueRefreshToken(user, { deviceLabel: req.headers["user-agent"], ipAddress: req.ip });
      res.status(201).json({ user, professional, accessToken, refreshToken });
    } catch (inner) {
      await require("../../config/db").platformPool.query("DELETE FROM users WHERE id = $1", [user.id]);
      throw inner;
    }
  } catch (err) { next(err); }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await auth.verifyPassword({ email: req.body.email, password: req.body.password });
    if (!result.ok) {
      const msg = result.reason === "locked"
        ? "Account temporarily locked after repeated failed attempts. Try again later."
        : "Incorrect email or password.";
      await audit({ action: "auth.login_failed", resource: `users:email:${req.body.email}`, ipAddress: req.ip, metadata: { reason: result.reason } });
      return res.status(401).json({ error: msg });
    }
    const user = result.user;

    if (user.mfa_enabled) {
      if (!req.body.mfaToken) return res.status(401).json({ error: "MFA token required", mfaRequired: true });
      const valid = await auth.verifyMfaToken(user.id, req.body.mfaToken);
      if (!valid) return res.status(401).json({ error: "Invalid MFA code" });
    }

    const accessToken = auth.issueAccessToken(user);
    const refreshToken = await auth.issueRefreshToken(user, { deviceLabel: req.headers["user-agent"], ipAddress: req.ip });
    await audit({ actorUserId: user.id, actorRole: user.role, action: "auth.login_success", resource: `users:${user.id}`, ipAddress: req.ip });
    res.json({ accessToken, refreshToken, role: user.role, userId: user.id });
  } catch (err) { next(err); }
});

router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await auth.rotateRefreshToken(req.body.refreshToken);
    res.json(tokens);
  } catch (err) { next(err); }
});

router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    res.json(await auth.listSessions(req.user.id));
  } catch (err) { next(err); }
});

router.post("/sessions/:id/revoke", requireAuth, async (req, res, next) => {
  try {
    await auth.revokeSession(req.params.id, req.user.id);
    await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "auth.session_revoked", resource: `sessions:${req.params.id}`, ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post("/mfa/enroll", requireAuth, async (req, res, next) => {
  try {
    res.json(await auth.enrollMfa(req.user.id));
  } catch (err) { next(err); }
});

router.post("/mfa/confirm", requireAuth, validate(z.object({ token: z.string() })), async (req, res, next) => {
  try {
    const ok = await auth.confirmMfa(req.user.id, req.body.token);
    if (!ok) return res.status(400).json({ error: "Invalid code" });
    await audit({ actorUserId: req.user.id, actorRole: req.user.role, action: "auth.mfa_enabled", resource: `users:${req.user.id}`, ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
