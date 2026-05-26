// Response shapes from apps/api — keep these in sync with the route handlers.

export type SourceType = 'github' | 'openapi' | 'postman' | 'docs' | 'paste'
export type Plan = 'free' | 'pro' | 'enterprise'
export type ProjectStatus = 'draft' | 'testing' | 'deployed' | 'disabled'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type Confidence = 'high' | 'medium' | 'low'
export type AuthType =
  | 'bearer'
  | 'api_key_header'
  | 'api_key_query'
  | 'basic'
  | 'oauth2_client_credentials'
  | 'none'
export type JobType = 'ingest' | 'extract' | 'generate' | 'test' | 'deploy' | 'full_pipeline'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface User {
  id: string
  email: string
  company_id: string
  role: 'owner' | 'member'
  company_name: string
  company_slug: string
  plan: Plan
  created_at: string
}

export interface Project {
  id: string
  company_id: string
  name: string
  slug: string
  source_type: SourceType
  source_url: string | null
  source_ref: string | null
  base_api_url: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface MeResponse {
  user: User
}

export interface ProjectsListResponse {
  projects: Project[]
}

export interface ProjectResponse {
  project: Project
}

/* ─────────────────────────── Endpoints ─────────────────────────── */

export interface EndpointParameter {
  name: string
  in: 'path' | 'query' | 'body' | 'header'
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  required: boolean
  description?: string | null
}

export interface Endpoint {
  id: string
  project_id: string
  method: HttpMethod
  path: string
  summary: string | null
  parameters: EndpointParameter[]
  request_body: Record<string, unknown> | null
  response_example: Record<string, unknown> | null
  auth_required: boolean | null
  source_file: string | null
  source_line: number | null
  confidence: Confidence
  selected: boolean
  llm_name: string | null
  llm_description: string | null
  created_at: string
}

export interface EndpointsListResponse {
  endpoints: Endpoint[]
}

export interface EndpointUpdate {
  id: string
  selected?: boolean
  llm_name?: string
  llm_description?: string
}

/* ─────────────────────────── Jobs ─────────────────────────── */

export interface ActivityJob extends Job {
  project_name: string
  project_slug: string
}

export interface AuthTestResult {
  ok: boolean
  status: number
  message: string
  latency_ms: number
}

export interface ToolSimulatorResult {
  tool_name: string
  success: boolean
  statusCode: number
  data: unknown
  latencyMs: number
}

export interface Job {
  id: string
  project_id: string
  type: JobType
  status: JobStatus
  progress: number
  current_step: string | null
  result: unknown | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  heartbeat_at: string | null
  created_at: string
}

export interface JobLog {
  id: number
  job_id: string
  level: LogLevel
  message: string
  meta?: Record<string, unknown> | null
  created_at: string
}

export interface JobResponse {
  job: Job & { logs: JobLog[] | null }
}

// Snapshot payload — initial event sent on connect with full current job state
export interface JobSnapshot {
  id: string
  status: JobStatus
  progress: number
  current_step: string | null
  result: unknown | null
  error: string | null
}

// Events emitted on /jobs/:id/stream — matches apps/api/src/routes/jobs.ts shape
export type JobStreamEvent =
  | ({ type: 'snapshot'; jobId: string } & JobSnapshot)
  | { type: 'progress'; jobId: string; percent: number; step: string | null }
  | { type: 'log'; jobId: string; level: LogLevel; message: string }
  | { type: 'done'; jobId: string; result: unknown }
  | { type: 'failed'; jobId: string; error: string; permanent: boolean }

/* ─────────────────────────── MCP server / tools ─────────────────────────── */

export interface McpAuthConfig {
  type: AuthType
  header_name?: string | null
  header_prefix?: string | null
  query_param?: string | null
  user_must_provide: string[]
}

export interface McpToolHttp {
  method: HttpMethod
  url_template: string
  headers_template?: Record<string, string> | null
  query_template?: Record<string, string> | null
  body_template?: Record<string, unknown> | string | null
}

export interface McpToolResponse {
  success_codes: number[]
  error_codes?: Record<string, string> | null
  transform?: string | null
}

export interface McpToolInputSchema {
  type: 'object'
  properties: Record<string, Record<string, unknown>>
  required: string[]
  additionalProperties: false
}

export interface McpTool {
  name: string
  description: string
  input_schema: McpToolInputSchema
  http: McpToolHttp
  response: McpToolResponse
}

export interface McpConfig {
  server_name: string
  server_description: string
  auth_config: McpAuthConfig
  env: { BASE_URL: string }
  tools: McpTool[]
}

export interface McpServerVersion {
  id: string
  mcp_server_id: string
  version_number: number
  config: McpConfig
  created_at: string
}

export interface McpServer {
  id: string
  project_id: string
  current_version_id: string | null
  subdomain: string
  status: ProjectStatus
  created_at: string
  updated_at: string
  // Only the hint (last 4 chars) is ever returned by the API; the plaintext
  // key is only surfaced inside the deploy job result or the rotate response.
  runtime_key_hint: string | null
  runtime_key_rotated_at: string | null
}

export interface RuntimeKeyRotateResponse {
  runtime_key: string
  runtime_key_hint: string
  rotated_at: string
}

export interface DeployJobResult {
  deploymentId: string
  versionId: string
  versionNumber: number
  subdomain: string
  // Populated only on the FIRST deploy for an MCP server — never on subsequent
  // deploys. After this single moment the plaintext is gone forever; rotate
  // for a new one.
  runtime_key?: string
  runtime_key_hint?: string
}

export interface McpServerResponse {
  mcp_server: McpServer
  version: McpServerVersion
}

/* ─────────────────────────── Deployments ─────────────────────────── */

export type DeploymentStatus = 'pending' | 'active' | 'rolled_back' | 'failed' | 'degraded'
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | null

export interface Deployment {
  id: string
  mcp_server_id: string
  version_id: string
  version_number: number
  status: DeploymentStatus
  deployed_by: string | null
  deployed_at: string
  rolled_back_at: string | null
  last_health_check: string | null
  health_status: HealthStatus
}

export interface DeploymentsListResponse {
  deployments: Deployment[]
}

/* ─────────────────────────── Usage / Analytics ─────────────────────────── */

export interface UsageSummary {
  // pg returns COUNT(*) as a string, AVG(...)::INT as a string or number — accept both
  total_calls: string | number
  error_calls: string | number
  avg_latency_ms: string | number | null
}

export interface UsageTopTool {
  tool_name: string
  calls: string | number
  avg_latency_ms: string | number | null
  errors: string | number
}

export interface UsageRecentError {
  tool_name: string
  status_code: number
  error_class: string | null
  created_at: string
}

export interface UsageHourlyBucket {
  hour: string
  total_calls: string | number
  error_calls: string | number
  p95_latency_ms: string | number | null
}

export interface UsageResponse {
  summary: UsageSummary
  topTools: UsageTopTool[]
  recentErrors: UsageRecentError[]
  hourly: UsageHourlyBucket[]
}

/* ─────────────────────────── OAuth apps (hatch-oauth) ─────────────────────────── */

export interface OAuthApp {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  client_id: string
  callback_url: string
  scopes: string[]
  created_at: string
  updated_at: string
  connect_url: string
  session_count?: number
  active_session_count?: number
  last_used_at?: string | null
}

export interface OAuthAppListResponse {
  apps: OAuthApp[]
}

export interface OAuthAppResponse {
  app: OAuthApp
}

export interface CreateOAuthAppInput {
  name: string
  slug: string
  callback_url: string
  description?: string
  logo_url?: string
  scopes?: string[]
}

export interface CreateOAuthAppResponse {
  id: string
  name: string
  slug: string
  client_id: string
  /** Plaintext — shown ONCE. Stored hashed thereafter. */
  client_secret: string
  callback_url: string
  scopes: string[]
  connect_url: string
}

export interface RotateOAuthSecretResponse {
  client_secret: string
  client_secret_hint: string
  rotated_at: string
}

export interface OAuthAppSession {
  id: string
  user_id: string
  scopes: string[]
  revoked: boolean
  revoked_at: string | null
  real_token_expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  last_used_at: string | null
  access_count: number
}

export interface OAuthAppSessionsResponse {
  sessions: OAuthAppSession[]
}

export interface OAuthAccessLogEntry {
  id: string
  session_id: string
  user_id: string
  ip_address: string | null
  user_agent: string | null
  tool_name: string | null
  accessed_at: string
}

export interface OAuthAccessLogResponse {
  log: OAuthAccessLogEntry[]
  limit: number
  offset: number
}

export interface UpdateOAuthAppInput {
  name?: string
  description?: string | null
  logo_url?: string | null
  callback_url?: string
  scopes?: string[]
}

/* ─────────────────────────── Test report ─────────────────────────── */

export interface TestReport {
  schemaValid: boolean
  schemaIssues: { toolName: string; issue: string }[]
  toolResults: { toolName: string; status: 'passed' | 'failed'; error?: string }[]
  passed: boolean
}
