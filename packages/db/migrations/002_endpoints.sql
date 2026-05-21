-- Projects and extracted API endpoints

CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  source_type  TEXT NOT NULL
                 CHECK (source_type IN ('github', 'openapi', 'postman', 'docs', 'paste')),
  source_url   TEXT,
  source_ref   TEXT,
  base_api_url TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

CREATE INDEX ON projects (company_id);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE endpoints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  method            TEXT NOT NULL
                      CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  path              TEXT NOT NULL,
  summary           TEXT,
  parameters        JSONB NOT NULL DEFAULT '[]',
  request_body      JSONB,
  response_example  JSONB,
  auth_required     BOOLEAN DEFAULT TRUE,
  source_file       TEXT,
  source_line       INT,
  confidence        TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  selected          BOOLEAN NOT NULL DEFAULT TRUE,
  llm_name          TEXT,
  llm_description   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, method, path)
);

CREATE INDEX ON endpoints (project_id);
CREATE INDEX ON endpoints (project_id, selected) WHERE selected = TRUE;
