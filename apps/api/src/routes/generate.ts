import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { getMcpServer } from '../services/deploy.service.js'
import { query, queryOne, execute } from '../lib/db.js'
import { runJob } from '../jobs/runner.js'
import { generateMcpConfig } from '../jobs/generate/generator.js'
import { HttpError } from '../middleware/error.js'
import type { EndpointRow } from '@hatchmcp/shared'

const router = Router({ mergeParams: true })

const GenerateSchema = z.object({
  auth_type: z.enum(['bearer', 'api_key_header', 'api_key_query', 'basic', 'oauth2_client_credentials', 'none']),
  base_api_url: z.string().url().optional(),
})

// POST /projects/:id/generate — kick off MCP config generation
router.post('/generate', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const { auth_type, base_api_url } = GenerateSchema.parse(req.body)

  // Load selected endpoints
  const endpoints = await query<EndpointRow>(
    `SELECT * FROM endpoints WHERE project_id = $1 AND selected = TRUE`,
    [project.id]
  )
  if (endpoints.length === 0) {
    throw new HttpError(422, 'No endpoints selected. Select at least one endpoint to generate.')
  }

  const baseUrl = base_api_url ?? project.base_api_url
  if (!baseUrl) throw new HttpError(422, 'base_api_url is required')

  const [job] = await query<{ id: string }>(
    `INSERT INTO jobs (project_id, type, status) VALUES ($1, 'generate', 'queued') RETURNING id`,
    [project.id]
  )

  runJob(job.id, async (ctx) => {
    await ctx.progress(5, 'Starting generation')

    const config = await generateMcpConfig({
      projectName: project.name,
      baseUrl,
      authType: auth_type,
      endpoints,
      ctx,
      jobId: job.id,
    })

    await ctx.progress(95, 'Saving config')

    // Get the mcp_server record created at project creation time
    const mcpServer = await getMcpServer(project.id)

    // Bump version number and save the new config
    const lastVersion = await queryOne<{ version_number: number }>(
      `SELECT version_number FROM mcp_server_versions WHERE mcp_server_id = $1 ORDER BY version_number DESC LIMIT 1`,
      [mcpServer.id]
    )
    const versionNumber = (lastVersion?.version_number ?? 0) + 1

    const [version] = await query<{ id: string }>(
      `INSERT INTO mcp_server_versions (mcp_server_id, version_number, config)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [mcpServer.id, versionNumber, JSON.stringify(config)]
    )

    // Promote the freshly-generated version to current so Tools + Deploy can read it.
    // (Deploy creates its own version row on top of this one when it ships.)
    await execute(
      `UPDATE mcp_servers
         SET current_version_id = $1,
             status = 'draft',
             updated_at = now()
       WHERE id = $2`,
      [version.id, mcpServer.id]
    )

    return { tool_count: config.tools.length, version_number: versionNumber }
  })

  res.status(202).json({ job_id: job.id })
})

// GET /projects/:id/mcp-server — get the current MCP config
router.get('/mcp-server', auth, async (req, res) => {
  await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(req.params.id)

  if (!mcpServer.current_version_id) {
    throw new HttpError(404, 'No MCP config generated yet')
  }

  const version = await queryOne(
    `SELECT * FROM mcp_server_versions WHERE id = $1`,
    [mcpServer.current_version_id]
  )

  res.json({ mcp_server: mcpServer, version })
})

export default router
