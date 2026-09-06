const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimit");
const { healthCheck } = require("./config/db");

const authRoutes = require("./modules/auth/authRoutes");
const patientsRoutes = require("./modules/patients/patientsRoutes");
const professionalsRoutes = require("./modules/professionals/professionalsRoutes");
const matchingRoutes = require("./modules/matching/matchingRoutes");
const appointmentsRoutes = require("./modules/appointments/appointmentsRoutes");
const feedRoutes = require("./modules/feed/feedRoutes");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(apiLimiter);

app.get("/health", async (req, res) => {
  try {
    await healthCheck();
    res.json({ ok: true, databases: ["patients_db", "professionals_db", "platform_db"] });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/professionals", professionalsRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/feed", feedRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler — never leaks stack traces or raw DB
// errors to the client; those go to the server log only.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? "Something went wrong. Please try again." : err.message;
  res.status(status).json({ error: message });
});

module.exports = app;
