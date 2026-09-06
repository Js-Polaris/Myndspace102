const express = require("express");
const { requireAuth, requireRole } = require("../../middleware/auth");
const svc = require("./professionalsService");

const router = express.Router();

// Public-ish directory (still requires a logged-in user, but any role) —
// only fields safe to expose are selected in the service query.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const list = await svc.listActiveProfessionals();
    res.json(list.map((p) => ({
      id: p.id, name: p.full_name, title: p.title, yearsExperience: p.years_experience,
      bio: p.bio, hourlyRateUgx: p.hourly_rate_ugx, modes: p.modes, rating: p.rating,
      sessionsCompleted: p.sessions_completed, specialties: p.specialties,
    })));
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, requireRole("professional"), async (req, res, next) => {
  try {
    const pro = await svc.getProfessionalByUserId(req.user.id);
    if (!pro) return res.status(404).json({ error: "Professional profile not found" });
    res.json(pro);
  } catch (err) { next(err); }
});

module.exports = router;
