import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import { loadConfig } from '../routing/config-loader.js'
import { extractSubdomain } from '../routing/subdomain.js'
import { handleMcpMessage } from './protocol.js'
import { enforceRateLimit, RateLimitError } from '../limits/rate-limit.js'
import { recordUsageEvent } from '../limits/usage-meter.js'
import { logger } from '../lib/logger.js'
import type { McpConfig } from '@hatchmcp/shared'
import { pool } from '../routing/config-loader.js'

interface Session {
  subdomain: string
  config: McpConfig
  secrets: Record<string, string>
  reply: FastifyReply
}

const sessions = new Map<string, Session>()

// GET /sse — client connects, server sends SSE events
// POST /messages?sessionId={id} — client sends JSON-RPC, server responds via SSE
export function registerSseTransport(app: FastifyInstance): void {
  app.get('/sse', async (req: FastifyRequest, reply: FastifyReply) => {
    const subdomain = extractSubdomain(req.headers.host)
    if (!subdomain) {
      reply.status(400).send({ error: 'Invalid subdomain' })
      return
    }

    const entry = await loadConfig(subdomain)
    if (!entry) {
      reply.status(404).send({ error: `No deployed MCP server found for ${subdomain}` })
      return
    }

    const sessionId = randomUUID()
    sessions.set(sessionId, { subdomain, config: entry.config, secrets: entry.secrets, reply })

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')

    // Send endpoint URL — MCP spec requires this as the first event
    const messagesUrl = `/messages?sessionId=${sessionId}`
    reply.raw.write(`event: endpoint\ndata: ${messagesUrl}\n\n`)

    // Keep-alive ping every 30 s
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 30_000)

    req.raw.on('close', () => {
      clearInterval(ping)
      sessions.delete(sessionId)
      logger.debug('SSE session closed', { sessionId, subdomain })
    })

    logger.info('SSE session opened', { sessionId, subdomain })
  })

  app.post('/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = (req.query as Record<string, string>)['sessionId']
    const session = sessions.get(sessionId)

    if (!session) {
      reply.status(404).send({ error: 'Session not found' })
      return
    }

    const { subdomain, config, secrets } = session

    // Rate limiting
    try {
      enforceRateLimit(subdomain, 'free') // Plan is resolved from config in future
    } catch (err) {
      if (err instanceof RateLimitError) {
        reply.status(429).send({ error: err.message })
        return
      }
      throw err
    }

    const message = req.body as { jsonrpc: '2.0'; id: string | number | null; method: string; params?: Record<string, unknown> }

    const activeDeployment = await pool.query<{ id: string; mcp_server_id: string }>(
      `SELECT d.id, d.mcp_server_id FROM deployments d
       JOIN mcp_servers s ON s.id = d.mcp_server_id
       WHERE s.subdomain = $1 AND d.status = 'active'
       LIMIT 1`,
      [subdomain]
    )
    const deployment = activeDeployment.rows[0]

    const response = await handleMcpMessage(message, config, secrets, subdomain)

    // Record usage for tool calls
    if (message.method === 'tools/call' && deployment) {
      const toolName = (message.params?.['name'] as string) ?? 'unknown'
      const isError = (response.result as { isError?: boolean })?.isError === true

      recordUsageEvent({
        mcpServerId: deployment.mcp_server_id,
        deploymentId: deployment.id,
        toolName,
        statusCode: isError ? 500 : 200,
        latencyMs: 0, // Captured inside executeToolCall; tracked separately
        consumerId: req.headers['x-consumer-id'] as string | undefined,
      }).catch(() => undefined)
    }

    // Send response as SSE message on the session stream
    session.reply.raw.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`)

    // Return 202 — actual response goes over SSE
    reply.status(202).send()
  })
}
