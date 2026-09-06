require("dotenv").config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || "development",

  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret_change_me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me"),
  accessTokenTtl: "15m",
  refreshTokenTtlDays: 30,

  // Field-level encryption key for PHI columns (next-of-kin, journal, mood
  // notes, MFA secrets). 32 raw bytes, base64-encoded. In production this
  // comes from a KMS/secrets manager, never a checked-in .env file.
  fieldEncryptionKey: required(
    "FIELD_ENCRYPTION_KEY",
    "9x1b6m3v0k8e2c5s7f0j4d3a1z9y7t5r6u3q0w2n4h1p6b8g0="
  ),

  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000").split(","),

  db: {
    patients: {
      user: process.env.PATIENTS_DB_USER || "tend_patients_svc",
      password: process.env.PATIENTS_DB_PASSWORD || "patients_pw_demo",
      host: process.env.DB_HOST || "127.0.0.1",
      port: process.env.DB_PORT || 5432,
      database: "patients_db",
    },
    professionals: {
      user: process.env.PROFESSIONALS_DB_USER || "tend_professionals_svc",
      password: process.env.PROFESSIONALS_DB_PASSWORD || "professionals_pw_demo",
      host: process.env.DB_HOST || "127.0.0.1",
      port: process.env.DB_PORT || 5432,
      database: "professionals_db",
    },
    platform: {
      user: process.env.PLATFORM_DB_USER || "tend_platform_svc",
      password: process.env.PLATFORM_DB_PASSWORD || "platform_pw_demo",
      host: process.env.DB_HOST || "127.0.0.1",
      port: process.env.DB_PORT || 5432,
      database: "platform_db",
    },
  },
};
