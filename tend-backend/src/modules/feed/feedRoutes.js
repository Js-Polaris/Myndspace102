const express = require("express");
const { z } = require("zod");
const { validate } = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { platformPool } = require("../../config/db");
const { getProfessionalByUserId } = require("../professionals/professionalsService");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await platformPool.query("SELECT * FROM feed_posts ORDER BY created_at DESC LIMIT 50");
    res.json(rows);
  } catch (err) { next(err); }
});

const postSchema = z.object({ title: z.string().min(1).max(150), body: z.string().min(1).max(3000), tag: z.enum(["Tip", "Exercise", "Reflection"]).default("Tip") });

router.post("/", requireAuth, requireRole("professional"), validate(postSchema), async (req, res, next) => {
  try {
    const pro = await getProfessionalByUserId(req.user.id);
    if (!pro) return res.status(404).json({ error: "Professional profile not found" });
    const { rows } = await platformPool.query(
      `INSERT INTO feed_posts (professional_id, title, body, tag) VALUES ($1,$2,$3,$4) RETURNING *`,
      [pro.id, req.body.title, req.body.body, req.body.tag]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
