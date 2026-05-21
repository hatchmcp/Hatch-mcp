import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { getMcpServer } from '../services/deploy.service.js'
import { query } from '../lib/db.js'

const router = Router({ mergeParams: true })

router.get('/', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)

  const days = parseInt(String(req.query.days ?? '7'), 10)

  const [summary, topTools, recentErrors, hourly] = await Promise.all([
    // Overall summary for the period
    query<{ total_calls: string; error_calls: string; avg_latency_ms: string }>(
      `SELECT
         COUNT(*) AS total_calls,
         COUNT(*) FILTER (WHERE status_code >= 400) AS error_calls,
         AVG(latency_ms)::INT AS avg_latency_ms
       FROM usage_events
       WHERE mcp_server_id = $1
         AND created_at >= now() - ($2 || ' days')::INTERVAL`,
      [mcpServer.id, days]
    ),

    // Top tools by call count
    query(
      `SELECT tool_name, COUNT(*) AS calls,
              AVG(latency_ms)::INT AS avg_latency_ms,
              COUNT(*) FILTER (WHERE status_code >= 400) AS errors
       FROM usage_events
       WHERE mcp_server_id = $1 AND created_at >= now() - ($2 || ' days')::INTERVAL
       GROUP BY tool_name
       ORDER BY calls DESC
       LIMIT 10`,
      [mcpServer.id, days]
    ),

    // Recent errors
    query(
      `SELECT tool_name, status_code, error_class, created_at
       FROM usage_events
       WHERE mcp_server_id = $1 AND status_code >= 400
       ORDER BY created_at DESC
       LIMIT 20`,
      [mcpServer.id]
    ),

    // Hourly breakdown for charts
    query(
      `SELECT hour, total_calls, error_calls, p95_latency_ms
       FROM usage_rollups_hourly
       WHERE mcp_server_id = $1 AND hour >= now() - ($2 || ' days')::INTERVAL
       ORDER BY hour ASC`,
      [mcpServer.id, days]
    ),
  ])

  res.json({ summary: summary[0], topTools, recentErrors, hourly })
})

export default router
