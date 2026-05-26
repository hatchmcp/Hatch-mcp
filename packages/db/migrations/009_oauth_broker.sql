-- HatchMCP OAuth broker — lets companies install `hatch-oauth` into their
-- backend and outsource the "user token in Claude config" problem to us.
-- See packages/hatch-oauth/README.md for the full flow.

-- A company that registered an "app" on HatchMCP.
CREATE TABLE hatch_oauth_companies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,           -- shows in connect URL: /oauth/connect/<slug>
  description          TEXT,
  logo_url             TEXT,
  client_id            TEXT UNIQUE NOT NULL,           -- public, e.g. "hco_abcdef…"
  client_secret_hash   TEXT NOT NULL,                  -- bcrypt; plaintext shown once on register
  callback_url         TEXT NOT NULL,                  -- where to send the user after store-token
  scopes               TEXT[] NOT NULL DEFAULT '{}',   -- human-readable permissions for the consent screen
  -- The Hatch user (workspace owner) who registered this app
  owner_user_id        UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON hatch_oauth_companies (client_id);
CREATE INDEX ON hatch_oauth_companies (owner_user_id);

CREATE TRIGGER hatch_oauth_companies_updated_at
  BEFORE UPDATE ON hatch_oauth_companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- One row per (company, end_user_id). When the company calls /oauth/store-token
-- for the same user twice, we upsert.
CREATE TABLE hatch_oauth_sessions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES hatch_oauth_companies (id) ON DELETE CASCADE,
  -- Opaque, controlled by the company — could be a Supabase auth id, a uuid,
  -- whatever. We don't try to interpret it.
  user_id                  TEXT NOT NULL,
  -- Token ciphertext + nonce match AES-256-GCM scheme in apps/api/src/lib/crypto.ts
  encrypted_real_token     TEXT NOT NULL,
  real_token_nonce         TEXT NOT NULL,
  real_token_expires_at    TIMESTAMPTZ,                -- null = unknown/never
  real_token_scopes        TEXT[] NOT NULL DEFAULT '{}',
  -- Metadata the company can stash and read back on session list
  metadata                 JSONB NOT NULL DEFAULT '{}'::JSONB,
  revoked_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at             TIMESTAMPTZ,
  UNIQUE (company_id, user_id)
);

CREATE INDEX ON hatch_oauth_sessions (company_id);
CREATE INDEX ON hatch_oauth_sessions (revoked_at) WHERE revoked_at IS NULL;


-- Append-only audit log — every /oauth/exchange call writes one row.
-- We deliberately don't store the hatch_token itself (it's a signed JWT;
-- session_id + company_id are enough for forensics).
CREATE TABLE hatch_oauth_access_log (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES hatch_oauth_sessions (id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES hatch_oauth_companies (id) ON DELETE CASCADE,
  ip_address  INET,
  user_agent  TEXT,
  tool_name   TEXT,                          -- optional context the SDK can attach
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON hatch_oauth_access_log (company_id, accessed_at DESC);
CREATE INDEX ON hatch_oauth_access_log (session_id, accessed_at DESC);


-- Short-lived state nonces used by the consent page → company login → callback
-- dance. 10-minute TTL. Reaped by /oauth/connect when state is consumed.
CREATE TABLE hatch_oauth_connect_states (
  state        TEXT PRIMARY KEY,
  company_id   UUID NOT NULL REFERENCES hatch_oauth_companies (id) ON DELETE CASCADE,
  redirect_to  TEXT NOT NULL,                -- where to bounce the user after success (Claude install handoff URL)
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON hatch_oauth_connect_states (expires_at);
