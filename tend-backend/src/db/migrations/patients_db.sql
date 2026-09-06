-- patients_db
-- Owns everything about a patient: profile, next-of-kin, mood entries,
-- journal entries, and the matching snapshot from signup.
-- Columns suffixed _enc hold AES-256-GCM ciphertext encrypted by the
-- application (utils/crypto.js) before it ever reaches Postgres — the
-- database never sees plaintext for these fields, so a DB-level leak
-- or a lost backup does not expose next-of-kin contacts, mood notes,
-- or journal contents.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE, -- FK (logical) -> platform_db.users.id
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  date_of_birth   DATE NOT NULL,
  gender          TEXT,
  mode_pref       TEXT NOT NULL DEFAULT 'either' CHECK (mode_pref IN ('online','physical','either')),
  urgency         TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine','soon','urgent')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_concerns (
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  concern    TEXT NOT NULL,
  PRIMARY KEY (patient_id, concern)
);

-- Encrypted: contact details of the two required next-of-kin.
CREATE TABLE next_of_kin (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  slot         INT NOT NULL CHECK (slot IN (1,2)),
  name_enc     BYTEA NOT NULL,
  relation_enc BYTEA NOT NULL,
  phone_enc    BYTEA NOT NULL,
  iv           BYTEA NOT NULL,
  auth_tag     BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, slot)
);

-- Snapshot of the matching result computed at signup (and re-runnable later).
CREATE TABLE match_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL, -- logical FK -> professionals_db.professionals.id
  rank            INT NOT NULL,
  score           NUMERIC(5,2) NOT NULL,
  reasons         TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mood_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  mood_value  INT NOT NULL CHECK (mood_value BETWEEN 1 AND 5),
  note_enc    BYTEA,
  iv          BYTEA,
  auth_tag    BYTEA,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Encrypted: free-text journal content.
CREATE TABLE journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled entry',
  body_enc    BYTEA NOT NULL,
  iv          BYTEA NOT NULL,
  auth_tag    BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mood_patient ON mood_entries(patient_id, logged_at DESC);
CREATE INDEX idx_journal_patient ON journal_entries(patient_id, created_at DESC);
CREATE INDEX idx_match_patient ON match_results(patient_id, rank);
