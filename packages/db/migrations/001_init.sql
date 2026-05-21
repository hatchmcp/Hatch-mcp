-- Foundation: companies and users mirroring Supabase auth

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  plan                TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'pro', 'enterprise')),
  monthly_call_limit  INT  NOT NULL DEFAULT 10000,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mirrors supabase auth.users — id comes from Supabase JWT sub claim
CREATE TABLE users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  company_id  UUID REFERENCES companies (id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'owner'
                CHECK (role IN ('owner', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON users (company_id);

-- Auto-update updated_at on any table that has it
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
