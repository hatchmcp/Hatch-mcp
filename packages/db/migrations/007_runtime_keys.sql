-- Per-tenant runtime auth key for the MCP server.
-- Stored as SHA-256 hex of a 256-bit random secret; plaintext is returned to the
-- user exactly once (on deploy or rotate). `runtime_key_hint` keeps the last 4
-- visible chars so the dashboard can render `hk_••••••WXYZ`.

ALTER TABLE mcp_servers
  ADD COLUMN runtime_key_hash       TEXT,
  ADD COLUMN runtime_key_hint       TEXT,
  ADD COLUMN runtime_key_rotated_at TIMESTAMPTZ;

CREATE INDEX ON mcp_servers (runtime_key_hash);
