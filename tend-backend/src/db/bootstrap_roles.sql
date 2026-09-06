-- Run once, as a Postgres superuser, before the per-database migrations.
-- Replace the demo passwords before using anywhere but a laptop.

CREATE ROLE tend_patients_svc LOGIN PASSWORD 'patients_pw_demo';
CREATE ROLE tend_professionals_svc LOGIN PASSWORD 'professionals_pw_demo';
CREATE ROLE tend_platform_svc LOGIN PASSWORD 'platform_pw_demo';

CREATE DATABASE patients_db OWNER tend_patients_svc;
CREATE DATABASE professionals_db OWNER tend_professionals_svc;
CREATE DATABASE platform_db OWNER tend_platform_svc;
