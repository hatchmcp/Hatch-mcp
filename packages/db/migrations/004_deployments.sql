-- Deployment records with health tracking and rollback support

CREATE TABLE deployments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id      UUID NOT NULL REFERENCES mcp_servers (id) ON DELETE CASCADE,
  version_id         UUID NOT NULL REFERENCES mcp_server_versions (id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'rolled_back', 'failed', 'degraded')),
  deployed_by        UUID REFERENCES users (id),
  deployed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at     TIMESTAMPTZ,
  last_health_check  TIMESTAMPTZ,
  health_status      TEXT
);

CREATE INDEX ON deployments (mcp_server_id, status);
-- Fast lookup for active deployment per server
CREATE INDEX ON deployments (mcp_server_id) WHERE status = 'active';
