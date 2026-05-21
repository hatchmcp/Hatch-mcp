import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { getMcpServer, listDeployments, getActiveConfig } from '../services/deploy.service.js'
import { query, execute } from '../lib/db.js'
import { runJob } from '../jobs/runner.js'
import { deployConfig, rollbackDeployment } from '../jobs/deploy/deployer.js'
import { runTestPipeline } from '../jobs/test/runner.js'
import { encrypt } from '../lib/crypto.js'
import { McpConfigSchema } from '@hatchmcp/shared'
import { HttpError } from '../middleware/error.js'

const router = Router({ mergeParams: true })

const SecretsSchema = z.record(z.string())

// POST /projects/:id/test — run schema + dry-run validation
router.post('/test', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)
  const configData = await getActiveConfig(mcpServer.id)

  if (!configData) throw new HttpError(404, 'No generated config found. Run /generate first.')

  const config = McpConfigSchema.parse(configData)

  const [job] = await query<{ id: string }>(
    `INSERT INTO jobs (project_id, type, status) VALUES ($1, 'test', 'queued') RETURNING id`,
    [project.id]
  )

  runJob(job.id, async (ctx) => {
    const report = await runTestPipeline(config, ctx, job.id)
    await ctx.progress(100, 'Test complete')
    return report
  })

  res.status(202).json({ job_id: job.id })
})

// POST /projects/:id/deploy — deploy current config to *.mcp.hatch.dev
router.post('/deploy', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)
  const configData = await getActiveConfig(mcpServer.id)

  if (!configData) throw new HttpError(404, 'No generated config found. Run /generate first.')

  // Optional: save secrets the user provided
  const secrets = req.body.secrets ? SecretsSchema.parse(req.body.secrets) : {}

  const [job] = await query<{ id: string }>(
    `INSERT INTO jobs (project_id, type, status) VALUES ($1, 'deploy', 'queued') RETURNING id`,
    [project.id]
  )

  runJob(job.id, async (ctx) => {
    await ctx.progress(10, 'Storing secrets')

    // Encrypt and upsert each secret
    for (const [key, value] of Object.entries(secrets)) {
      const { ciphertext, nonce } = encrypt(value)
      await execute(
        `INSERT INTO mcp_server_secrets (mcp_server_id, key, ciphertext, nonce)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (mcp_server_id, key)
         DO UPDATE SET ciphertext = EXCLUDED.ciphertext, nonce = EXCLUDED.nonce`,
        [mcpServer.id, key, ciphertext, nonce]
      )
    }

    await ctx.progress(50, 'Deploying config')

    const config = McpConfigSchema.parse(configData)
    const result = await deployConfig({
      mcpServerId: mcpServer.id,
      subdomain: mcpServer.subdomain,
      config,
      deployedBy: req.userId,
    })

    await ctx.progress(100, 'Deployed')
    return result
  })

  res.status(202).json({ job_id: job.id })
})

// GET /projects/:id/deployments
router.get('/deployments', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)
  const deployments = await listDeployments(mcpServer.id)
  res.json({ deployments })
})

// POST /projects/:id/rollback
router.post('/rollback', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)

  const result = await rollbackDeployment({
    mcpServerId: mcpServer.id,
    subdomain: mcpServer.subdomain,
  })

  res.json({ message: 'Rolled back successfully', ...result })
})

export default router
