-- In-process job queue: state, progress, logs, and heartbeat for reaper

CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  type          TEXT NOT NULL
                  CHECK (type IN ('ingest','extract','generate','test','deploy','full_pipeline')),
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  progress      INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_step  TEXT,
  result        JSONB,
  error         TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  -- Updated every 10 s while running; reaper marks stalled if older than 60 s
  heartbeat_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON jobs (project_id, created_at DESC);
CREATE INDEX ON jobs (status) WHERE status IN ('queued', 'running');
-- Reaper scans only running jobs
CREATE INDEX ON jobs (heartbeat_at) WHERE status = 'running';

CREATE TABLE job_logs (
  id         BIGSERIAL PRIMARY KEY,
  job_id     UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  level      TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message    TEXT NOT NULL,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON job_logs (job_id, created_at);
