-- Per-request telemetry and hourly rollups for billing / analytics

CREATE TABLE usage_events (
  id             BIGSERIAL PRIMARY KEY,
  mcp_server_id  UUID NOT NULL REFERENCES mcp_servers (id) ON DELETE CASCADE,
  deployment_id  UUID REFERENCES deployments (id),
  tool_name      TEXT,
  status_code    INT,
  latency_ms     INT,
  error_class    TEXT,
  consumer_id    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON usage_events (mcp_server_id, created_at DESC);
CREATE INDEX ON usage_events (created_at DESC) WHERE status_code >= 400;

-- Hourly aggregates computed by a cron job (or on-demand)
CREATE TABLE usage_rollups_hourly (
  mcp_server_id  UUID NOT NULL REFERENCES mcp_servers (id) ON DELETE CASCADE,
  hour           TIMESTAMPTZ NOT NULL,
  total_calls    INT NOT NULL DEFAULT 0,
  error_calls    INT NOT NULL DEFAULT 0,
  p95_latency_ms INT,
  PRIMARY KEY (mcp_server_id, hour)
);

-- Runtime-side per-tenant counters flushed every 60 s to avoid per-row write pressure
CREATE TABLE usage_counters (
  tenant_slug  TEXT NOT NULL,
  hour         TIMESTAMPTZ NOT NULL,
  calls        INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_slug, hour)
);
