-- MCP server configs, versioning, and encrypted secrets

CREATE TABLE mcp_servers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL UNIQUE REFERENCES projects (id) ON DELETE CASCADE,
  current_version_id UUID,              -- FK added below after versions table exists
  subdomain          TEXT UNIQUE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'testing', 'deployed', 'disabled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER mcp_servers_updated_at
  BEFORE UPDATE ON mcp_servers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE mcp_server_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id   UUID NOT NULL REFERENCES mcp_servers (id) ON DELETE CASCADE,
  version_number  INT NOT NULL,
  config          JSONB NOT NULL,
  generated_by    TEXT NOT NULL DEFAULT 'claude',
  generation_meta JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mcp_server_id, version_number)
);

CREATE INDEX ON mcp_server_versions (mcp_server_id);

-- Back-fill the FK now that versions table exists
ALTER TABLE mcp_servers
  ADD CONSTRAINT mcp_servers_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES mcp_server_versions (id)
  DEFERRABLE INITIALLY DEFERRED;

-- Secrets encrypted at the application layer with AES-256-GCM
-- ciphertext and nonce are stored as hex strings
CREATE TABLE mcp_server_secrets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id  UUID NOT NULL REFERENCES mcp_servers (id) ON DELETE CASCADE,
  key            TEXT NOT NULL,
  ciphertext     TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mcp_server_id, key)
);

CREATE INDEX ON mcp_server_secrets (mcp_server_id);
