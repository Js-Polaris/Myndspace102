-- professionals_db
-- Owns everything about a certified professional: identity, licensing
-- verification, specialties, availability, and their feed posts.
-- Does NOT contain any patient PHI. A professional row is linked to
-- platform_db.users by user_id (UUID), never by foreign key across
-- databases (Postgres cannot enforce cross-database FKs) — referential
-- integrity across DBs is enforced in the application layer instead.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE professionals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE, -- FK (logical) -> platform_db.users.id
  full_name         TEXT NOT NULL,
  title             TEXT NOT NULL,
  license_number    TEXT NOT NULL UNIQUE,
  license_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  license_verified_at TIMESTAMPTZ,
  years_experience  INT NOT NULL DEFAULT 0,
  bio               TEXT,
  hourly_rate_ugx   INT NOT NULL,
  modes             TEXT[] NOT NULL DEFAULT '{}', -- 'online','physical'
  rating            NUMERIC(2,1) NOT NULL DEFAULT 0,
  sessions_completed INT NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE, -- deactivated professionals stop matching
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE professional_specialties (
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  specialty       TEXT NOT NULL,
  PRIMARY KEY (professional_id, specialty)
);

CREATE TABLE professional_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL,          -- e.g. 'degree', 'license', 'certification'
  issuer          TEXT NOT NULL,
  document_ref    TEXT NOT NULL,          -- pointer to a document in encrypted object storage, never the file itself
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by     TEXT,                   -- admin/reviewer identifier
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE availability_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('online','physical')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_professionals_active ON professionals(active);
CREATE INDEX idx_spec_lookup ON professional_specialties(specialty);
