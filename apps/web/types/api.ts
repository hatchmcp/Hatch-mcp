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

/* ─────────────────────────── Test report ─────────────────────────── */

export interface TestReport {
  schemaValid: boolean
  schemaIssues: { toolName: string; issue: string }[]
  toolResults: { toolName: string; status: 'passed' | 'failed'; error?: string }[]
  passed: boolean
}
