# Hatch

Turn any API into a hosted MCP server. Paste a GitHub repo, an OpenAPI spec, or a Postman collection — Hatch extracts every endpoint, generates typed MCP tools with Claude, runs a dry-run test suite, and deploys to `{slug}.mcp.hatch.dev` for instant connection from Claude Desktop, Cursor, or any MCP client.

```
┌─────────────────┐       ┌──────────────────┐       ┌────────────────────┐
│  apps/web       │ HTTP  │  apps/api        │  pg   │  Supabase Postgres │
│  Next.js 15     │──────▶│  Express + jobs  │──────▶│  + pgsodium        │
│  dashboard      │       │  (in-process)    │       │                    │
└─────────────────┘       └────────┬─────────┘       └──────────┬─────────┘
        ⌘K + SSE                   │ Claude API                │
                                   ▼                            │
                          ┌──────────────────┐                  │
                          │  Anthropic       │                  │ same db
                          │  (extract/gen)   │                  │
                          └──────────────────┘                  │
                                                                ▼
                          ┌──────────────────┐         ┌────────────────┐
   MCP client  ◀── SSE ──│  apps/runtime    │◀── conf │  mcp_servers   │
   (Claude Desktop,       │  Fastify         │         │  + versions    │
   Cursor)                │  multi-tenant    │         │  + secrets     │
                          └──────────────────┘         └────────────────┘
                          {subdomain}.mcp.hatch.dev
```

## Stack

- **apps/api** — Express + in-process job runner (`p-limit`, heartbeat, reaper), SSE-streamed job progress, Anthropic SDK for extraction + generation
- **apps/runtime** — Fastify multi-tenant MCP host with subdomain routing, LRU config cache, in-process rate limiting + usage metering
- **apps/web** — Next.js 15 App Router · React 19 · Tailwind v4 (CSS-var tokens) · shadcn primitives · TanStack Query · Supabase auth · custom fetch-based SSE consumer · cmdk command palette · Radix Dialog/DropdownMenu
- **packages/shared** — Zod schemas shared across services (endpoint, MCP tool/config, job)
- **packages/db** — Six SQL migrations (companies/users, endpoints, mcp_servers + versions + secrets, deployments, usage_events, jobs)

Hosted infra: Supabase Postgres (transaction pooler), Anthropic Claude, Railway (wildcard subdomain DNS), Cloudflare (TLS).

## Project structure

```
apps/
  api/        Express API + in-process job runner
  runtime/    Fastify multi-tenant MCP host
  web/        Next.js dashboard
packages/
  db/         SQL migrations + dev seed
  shared/     Zod schemas + types
.env.example  Root env template (API + runtime share this)
```

## Quickstart

```bash
# 1. Clone + install (npm workspaces)
git clone https://github.com/hatchmcp/Hatch-mcp.git
cd Hatch-mcp
npm install

# 2. Provision a Supabase project, then run the migrations
#    packages/db/migrations/001_init.sql → 006_jobs.sql

# 3. Configure env vars (root .env for api + runtime)
cp .env.example .env
#    Fill in:
#    - DATABASE_URL          (Supabase pooler connection string)
#    - SUPABASE_URL          + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
#    - ANTHROPIC_API_KEY     (required for extract/generate)
#    - ENCRYPTION_KEY        (64 hex chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
#    - GITHUB_APP_*          (optional, for GitHub source ingestion)

# 4. Configure the web app
cp apps/web/.env.example apps/web/.env.local
#    Fill in:
#    - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - NEXT_PUBLIC_API_URL=http://localhost:5000

# 5. Start the three services in separate terminals
npm run dev:api        # Express on :5000
npm run dev:runtime    # Fastify on :8080
npm run dev:web        # Next.js on :3000
```

Visit http://localhost:3000 → sign in with GitHub or email magic link → create your first project.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev:api` | Start the API in watch mode (`tsx watch`) |
| `npm run dev:runtime` | Start the MCP runtime in watch mode |
| `npm run dev:web` | Start the Next.js dashboard |
| `npm run build --workspace=apps/web` | Production build of the dashboard |
| `npm run typecheck --workspace=apps/web` | TypeScript check, no emit |
| `npm test` | Run Vitest unit tests (shared, exec, api) |
| `npm run test:watch` | Vitest in watch mode |

## How the pipeline runs

1. **Ingest** — Fetch GitHub tarball via Octokit, parse OpenAPI spec, parse Postman collection, or convert docs HTML → Markdown via Turndown
2. **Extract** — Chunk source (30KB/chunk, max 8 chunks/project, packed by directory). One Claude call per chunk, 4 concurrent. Strict JSON, Zod-validated, one retry on parse failure. "Possibly missed" second pass.
3. **Select** — User toggles endpoints to include (bulk select, filters by method, search). PATCH persists `selected` flag.
4. **Generate** — One Claude call per tool for ≥15 endpoints, parallelized. Auto-fix loop feeds Zod errors back to Claude (up to 2 retries).
5. **Test** — Schema validation (AJV compile all input_schemas) + dry-run via MSW HTTP mocks with faker inputs. No prod credentials needed.
6. **Deploy** — Atomic DB transaction (new version + mark old rolled_back + bump `current_version_id`) + cache bust on the runtime.

Each step is a job tracked in the `jobs` table. The frontend subscribes via SSE on `/api/v1/jobs/:id/stream` and renders progress in a sticky right-side **JobProgressRail** that follows the user across pages.

## API surface (used by the web app)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/me` | Current user + workspace |
| `GET` `POST` `PUT` `DELETE` | `/api/v1/projects[/:id]` | Project CRUD (+ update name, description, base URL) |
| `GET` `PATCH` | `/api/v1/projects/:id/endpoints` | List + bulk update selection |
| `POST` | `/api/v1/projects/:id/ingest` | Kick ingest job |
| `POST` `GET` | `/api/v1/projects/:id/{generate,mcp-server}` | Generate config / read current version |
| `POST` | `/api/v1/projects/:id/test` | Run test pipeline |
| `POST` | `/api/v1/projects/:id/auth/test` | Probe auth credentials against base API |
| `POST` | `/api/v1/projects/:id/tests/run-tool` | Live try-it-now tool call (simulator) |
| `GET` | `/api/v1/activity` | Workspace activity feed (last 50 jobs) |
| `POST` | `/api/v1/projects/:id/deploy` | Deploy with encrypted secrets |
| `GET` `POST` | `/api/v1/projects/:id/{deployments,rollback}` | History + rollback |
| `GET` | `/api/v1/projects/:id/usage?days=N` | Summary + top tools + recent errors + hourly buckets |
| `GET` | `/api/v1/jobs/:id` | Job snapshot + logs |
| `GET` | `/api/v1/jobs/:id/stream` | **SSE** — live progress |
| `GET` | `/api/v1/jobs/projects/:id/jobs` | Last 50 jobs for a project |

## Status

**Frontend is launch-ready.** All workspace + project routes resolve to real pages, the full ingest → extract → generate → test → deploy flow is wired with live SSE in the job rail, ⌘K command palette works, mobile users get a friendly fallback, and there's a custom 404 + error boundary.

Remaining gaps (workspace admin still placeholder in the UI):

- **Workspace endpoints** for Members / API keys / webhooks (settings placeholders)

## License

Proprietary — all rights reserved.
