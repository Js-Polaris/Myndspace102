-- platform_db
-- Everything that either spans both patients and professionals
-- (appointments, payments, the feed) or is security-critical and
-- benefits from being isolated with its own tighter access policy
-- (auth credentials, sessions, audit log). Kept separate from PHI
-- so a bug or breach in the scheduling/auth layer does not by itself
-- expose journal or mood content, and vice versa.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('patient','professional','admin');

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,       -- bcrypt, cost 12
  role              user_role NOT NULL,
  mfa_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_enc    BYTEA,               -- TOTP secret, AES-256-GCM encrypted
  mfa_iv            BYTEA,
  mfa_tag           BYTEA,
  failed_logins     INT NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh tokens are stored hashed (never the raw token) and are
-- individually revocable, which is what lets "sign out this device"
-- in the Security tab actually do something.
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_label     TEXT,
  ip_address       INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  revoked_at       TIMESTAMPTZ
);

CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL,   -- logical FK -> patients_db.patients.id
  professional_id  UUID NOT NULL,   -- logical FK -> professionals_db.professionals.id
  mode             TEXT NOT NULL CHECK (mode IN ('online','physical')),
  scheduled_start  TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending_payment'
                     CHECK (status IN ('pending_payment','confirmed','cancelled','completed')),
  amount_ugx       INT NOT NULL,
  video_room_token TEXT,             -- issued only once status = confirmed and mode = online
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No card or mobile-money numbers ever live here. `provider_ref` is the
-- opaque transaction id handed back by the payment gateway (Flutterwave/
-- Stripe/MTN/Airtel); Tend never touches raw PANs (PCI SAQ-A scope).
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  method          TEXT NOT NULL CHECK (method IN ('card','momo')),
  provider        TEXT NOT NULL,          -- 'flutterwave', 'stripe', 'mtn', 'airtel'
  provider_ref    TEXT NOT NULL UNIQUE,
  amount_ugx      INT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('initiated','succeeded','failed','refunded')),
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feed_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL,  -- logical FK -> professionals_db.professionals.id
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  tag             TEXT NOT NULL DEFAULT 'Tip',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only. Every read or write of PHI-adjacent records should write
-- one row here. Never updated or deleted by the application (only by a
-- retention job, and even then archived rather than dropped).
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_user_id UUID,
  actor_role   TEXT,
  action       TEXT NOT NULL,        -- e.g. 'journal.read', 'appointment.create'
  resource     TEXT NOT NULL,        -- e.g. 'journal_entries:<id>'
  ip_address   INET,
  metadata     JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set when a patient's onboarding urgency is 'urgent' or a risk keyword
-- is flagged. Routed to a human reviewer — the system never contacts
-- next-of-kin automatically.
CREATE TABLE risk_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL,
  source       TEXT NOT NULL,        -- 'onboarding', 'journal', 'mood'
  reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appt_patient ON appointments(patient_id);
CREATE INDEX idx_appt_pro ON appointments(professional_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;
