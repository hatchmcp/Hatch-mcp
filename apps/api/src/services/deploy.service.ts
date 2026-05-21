import { queryOne, query } from '../lib/db.js'
import { HttpError } from '../middleware/error.js'

interface McpServerRow {
  id: string
  project_id: string
  current_version_id: string | null
  subdomain: string
  status: string
}

interface DeploymentRow {
  id: string
  mcp_server_id: string
  version_id: string
  status: string
  deployed_at: Date
  rolled_back_at: Date | null
  last_health_check: Date | null
  health_status: string | null
}

export async function getMcpServer(projectId: string): Promise<McpServerRow> {
  const row = await queryOne<McpServerRow>(
    `SELECT * FROM mcp_servers WHERE project_id = $1`,
    [projectId]
  )
  if (!row) throw new HttpError(404, 'MCP server not found — generate first')
  return row
}

export async function listDeployments(mcpServerId: string): Promise<DeploymentRow[]> {
  return query<DeploymentRow>(
    `SELECT d.*, v.version_number
     FROM deployments d
     JOIN mcp_server_versions v ON v.id = d.version_id
     WHERE d.mcp_server_id = $1
     ORDER BY d.deployed_at DESC
     LIMIT 20`,
    [mcpServerId]
  )
}

export async function getActiveConfig(mcpServerId: string): Promise<Record<string, unknown> | null> {
  const row = await queryOne<{ config: Record<string, unknown> }>(
    `SELECT v.config
     FROM mcp_server_versions v
     JOIN mcp_servers s ON s.current_version_id = v.id
     WHERE s.id = $1`,
    [mcpServerId]
  )
  return row?.config ?? null
}
