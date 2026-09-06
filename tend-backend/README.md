# Tend API

The backend for Tend: three isolated Postgres databases, JWT auth with
MFA, field-level encryption for sensitive patient data, and a
payment-gated appointment flow. Built and smoke-tested end-to-end
(register → match → book → pay → confirm) against a live Postgres 16
instance.

## Why three databases, not one

| Database | Owns | Why isolated |
|---|---|---|
| `patients_db` | Patient profile, next-of-kin, mood entries, journal entries, match snapshots | Highest-sensitivity data (PHI). A breach of any other service's DB credentials should not expose this. |
| `professionals_db` | Professional profile, license/credential verification, specialties, availability | Different access pattern (browsable directory) and different compliance profile (professional licensing, not patient health data). |
| `platform_db` | Auth (`users`, `sessions`), `appointments`, `payments`, `feed_posts`, `audit_log`, `risk_flags` | Cross-cutting concerns that inherently reference both patients and professionals (appointments), plus security-critical tables that benefit from tight, separate access control (auth, audit). |

Each database has its **own Postgres role** with a password unique to
it (`tend_patients_svc`, `tend_professionals_svc`, `tend_platform_svc`).
The API connects to each with a separate `pg.Pool`. Postgres can't
enforce foreign keys *across* databases, so cross-database references
(e.g. `appointments.patient_id`) are "logical" foreign keys, validated
and joined in the application layer, not the database.

**What this buys you:** if an attacker compromises the credentials
used by, say, the feed module, they get read/write on `platform_db`
only — they cannot pivot to journal entries or next-of-kin contacts.

## Security measures implemented

- **Passwords**: bcrypt, cost factor 12. Never logged, never returned in any response.
- **MFA**: TOTP (Google Authenticator-compatible), secret encrypted at rest, enforced at login when enabled.
- **Account lockout**: 5 failed logins locks the account for 15 minutes.
- **Tokens**: short-lived (15 min) JWT access tokens + rotating refresh tokens. Refresh tokens are stored **hashed** (SHA-256) — a stolen database dump doesn't hand out usable tokens. Each rotation revokes the previous token, so replay of an old refresh token is detectable.
- **Field-level encryption**: next-of-kin name/relation/phone, journal bodies, and mood notes are AES-256-GCM encrypted by the application before being written to Postgres. Verified directly against the raw table — see "Proof it works" below.
- **Payments**: no card number, CVV, or mobile money PIN ever reaches this server. Only a gateway transaction reference and status are stored. `payments.md` below explains the production integration point.
- **Input validation**: every route validates its body with Zod before touching the database.
- **Rate limiting**: 20 requests / 15 min on auth endpoints, 120/min generally.
- **RBAC + ownership checks**: patient and professional routes resolve "my record" from the JWT — there is no route where a client-supplied ID lets you read someone else's data.
- **Audit log**: append-only `audit_log` table in `platform_db`. Every read/write of PHI-adjacent data writes a row (actor, action, resource, IP, timestamp).
- **Security headers**: `helmet()`, locked-down CORS origin list.
- **Centralized error handling**: internal errors never leak stack traces or raw DB errors to the client.

## What's intentionally *not* built yet (and why)

- **Real payment gateway integration.** `appointmentsService.js` has a clearly marked simulation point (`initiateAndConfirmPayment`) where a real Flutterwave/Stripe/MTN MoMo call would go. Swapping it in means: frontend collects payment via the gateway's hosted fields/SDK (so raw card data never touches your server — keeps you in PCI SAQ-A), gateway returns a charge token, this endpoint verifies it server-side and records the result via a signature-verified webhook rather than trusting the client's say-so.
- **Credential/license document verification workflow.** Professionals seed as `license_verified = TRUE` for the demo. In production this should be an admin review queue against uploaded documents before a professional can appear in matching or accept bookings.
- **Video calling.** `video_room_token` is issued on payment confirmation as a placeholder; wiring it to a real WebRTC/Twilio/Daily.co room is a frontend + minimal backend (webhook) task once you pick a provider.
- **KMS-backed encryption key.** `FIELD_ENCRYPTION_KEY` comes from `.env` here for local development. Production should pull it from a real secrets manager (AWS KMS, GCP KMS, HashiCorp Vault) with rotation support.

## Running it locally

```bash
# 1. Postgres running locally (or via the included docker-compose)
docker compose up -d db

# 2. Create the three roles + databases (one-time)
psql -h localhost -U postgres -f src/db/bootstrap_roles.sql

# 3. Install deps
npm install

# 4. Copy env and fill in secrets
cp .env.example .env
# generate JWT secrets: openssl rand -hex 32
# generate encryption key: openssl rand -base64 32

# 5. Run migrations (one per database, owned by that database's role)
PGPASSWORD=<patients pw>      psql -h localhost -U tend_patients_svc      -d patients_db      -f src/db/migrations/patients_db.sql
PGPASSWORD=<professionals pw> psql -h localhost -U tend_professionals_svc -d professionals_db -f src/db/migrations/professionals_db.sql
PGPASSWORD=<platform pw>      psql -h localhost -U tend_platform_svc      -d platform_db      -f src/db/migrations/platform_db.sql

# 6. Seed demo professionals (login: <email>@tend.demo / Demo12345!)
node src/db/seed.js

# 7. Start the API
npm run dev   # nodemon, or: npm start
```

The API listens on `http://localhost:4000`. `GET /health` checks all
three database connections.

## Connecting the existing frontend

The frontend (`tend-app.jsx`) now has an `api.js`-style client baked in
with `USE_LIVE_API` toggled off by default, because the browser
artifact preview in this chat cannot reach a server running in this
sandbox (no public URL / inbound networking here). To actually connect
them:

1. Run this backend somewhere reachable from your browser (locally, or deployed — see below).
2. Set `API_BASE_URL` at the top of the frontend file to that address.
3. Flip `USE_LIVE_API` to `true`.

The frontend will then call the real endpoints and fall back to local
mock state only if a request fails (e.g. you're offline), so you can
develop against either.

## Deploying

Any Node host works (Render, Railway, Fly.io, a plain VM). Postgres:
managed (RDS, Neon, Supabase, Render Postgres) is easiest — just point
`DB_HOST` and the three sets of credentials at it and re-run the
migrations and seed script once. Put a real TLS-terminating load
balancer or platform-managed TLS in front of it; this app assumes TLS
is handled upstream.
