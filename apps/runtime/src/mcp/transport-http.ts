import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { loadConfig } from '../routing/config-loader.js'
import { extractSubdomain } from '../routing/subdomain.js'
import { handleMcpMessage } from './protocol.js'
import { enforceRateLimit, RateLimitError } from '../limits/rate-limit.js'
import { logger } from '../lib/logger.js'

// Streamlined HTTP transport — single POST per JSON-RPC message.
// Simpler than SSE for clients that don't need streaming progress.
// Mounted at /http for clients that prefer it over /sse + /messages.
export function registerHttpTransport(app: FastifyInstance): void {
  app.post('/http', async (req: FastifyRequest, reply: FastifyReply) => {
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

    try {
      enforceRateLimit(subdomain, 'free')
    } catch (err) {
      if (err instanceof RateLimitError) {
        reply.status(429).send({ error: err.message })
        return
      }
      throw err
    }

    const message = req.body as {
      jsonrpc: '2.0'
      id: string | number | null
      method: string
      params?: Record<string, unknown>
    }

    logger.debug('HTTP transport request', { subdomain, method: message.method })

    const response = await handleMcpMessage(message, entry.config, entry.secrets, subdomain)
    reply.send(response)
  })
}
