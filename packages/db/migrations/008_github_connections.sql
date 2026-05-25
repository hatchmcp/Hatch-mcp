-- Per-user GitHub OAuth connection. We store one access token per Hatch user.
-- Token ciphertext + nonce match the AES-256-GCM scheme used by
-- mcp_server_secrets (apps/api/src/lib/crypto.ts).

CREATE TABLE user_github_connections (
  user_id                  UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  github_login             TEXT NOT NULL,
  github_user_id           BIGINT,
  access_token_ciphertext  TEXT NOT NULL,
  access_token_nonce       TEXT NOT NULL,
  scopes                   TEXT,
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON user_github_connections (github_login);
