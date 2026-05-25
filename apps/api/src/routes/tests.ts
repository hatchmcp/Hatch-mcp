import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { getMcpServer, getActiveConfig } from '../services/deploy.service.js'
import { testAuth } from '../services/auth-test.service.js'
import { McpConfigSchema } from '@hatchmcp/shared'
import { executeToolCall } from '@hatchmcp/exec'
import { HttpError } from '../middleware/error.js'

const router = Router({ mergeParams: true })

const AuthTestSchema = z.object({
  auth_type: z.enum([
    'bearer',
    'api_key_header',
    'api_key_query',
    'basic',
    'oauth2_client_credentials',
    'none',
  ]),
  base_api_url: z.string().url(),
  secrets: z.record(z.string()).default({}),
})

const RunToolSchema = z.object({
  tool_name: z.string().min(1),
  inputs: z.record(z.unknown()).default({}),
  secrets: z.record(z.string()).default({}),
})

// POST /projects/:id/auth/test — probe credentials against the base API
router.post('/auth/test', auth, async (req, res) => {
  await getProject(req.params.id, req.companyId)
  const body = AuthTestSchema.parse(req.body)

  if (body.auth_type === 'none') {
    const axios = (await import('axios')).default
    const start = Date.now()
    const probe = await axios.get(body.base_api_url, {
      timeout: 12_000,
      validateStatus: () => true,
      maxRedirects: 3,
    })
    const ok = probe.status < 500 && probe.status !== 401 && probe.status !== 403
    res.json({
      ok,
      status: probe.status,
      message: ok ? `Probe succeeded with HTTP ${probe.status}` : `Probe failed (${probe.status})`,
      latency_ms: Date.now() - start,
    })
    return
  }

  const result = await testAuth({
    authType: body.auth_type,
    baseUrl: body.base_api_url,
    secrets: body.secrets,
  })
  res.json(result)
})

// POST /projects/:id/tests/run-tool — live call for the try-it-now simulator
router.post('/tests/run-tool', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const body = RunToolSchema.parse(req.body)

  const mcpServer = await getMcpServer(project.id)
  const configData = await getActiveConfig(mcpServer.id)
  if (!configData) throw new HttpError(404, 'No generated config found. Run /generate first.')

  const config = McpConfigSchema.parse(configData)
  const tool = config.tools.find((t) => t.name === body.tool_name)
  if (!tool) throw new HttpError(404, `Tool not found: ${body.tool_name}`)

  const result = await executeToolCall(tool, body.inputs, config, body.secrets)
  res.json({
    tool_name: body.tool_name,
    ...result,
  })
})

export default router
