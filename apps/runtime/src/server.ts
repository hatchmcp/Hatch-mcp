import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createHash, timingSafeEqual } from 'crypto'
import { runtimeConfig } from './config.js'
import { registerSseTransport } from './mcp/transport-sse.js'
import { registerHttpTransport } from './mcp/transport-http.js'
import { loadConfig } from './routing/config-loader.js'
import { extractSubdomain } from './routing/subdomain.js'
import { logger } from './lib/logger.js'
import { pool } from './routing/config-loader.js'

// Paths that don't require the tenant's runtime key — health probes and public docs
const PUBLIC_PATHS = new Set(['/health', '/health/'])
function isPublicPath(url: string): boolean {
  // Strip query string
  const path = url.split('?')[0]
  if (PUBLIC_PATHS.has(path)) return true
  if (path === '/docs' || path.startsWith('/docs/')) return true
  return false
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export function createServer() {
  const app = Fastify({
    logger: false, // We use our own structured logger
    trustProxy: true, // Railway / Cloudflare set X-Forwarded-For
  })

  app.register(cors, {
    origin: runtimeConfig.CORS_ORIGINS === '*' ? true : runtimeConfig.CORS_ORIGINS.split(','),
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  // Tenant auth: every MCP route requires `Authorization: Bearer <runtime-key>`.
  // Fail-closed — a deployed MCP server with no key set returns 503 until the
  // owner rotates one from the dashboard.
  app.addHook('preHandler', async (req, reply) => {
    if (isPublicPath(req.url)) return

    const subdomain = extractSubdomain(req.headers.host)
    if (!subdomain) return // let the route return 400 with its own copy

    const entry = await loadConfig(subdomain).catch(() => null)
    if (!entry) return // no deployment yet — route will 404; cheaper than failing here

    if (!entry.runtimeKeyHash) {
      reply.status(503).send({
        error:
          'Runtime auth key not configured. Open the project in the Hatch dashboard and rotate the runtime key.',
      })
      return reply
    }

    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      reply
        .status(401)
        .header('WWW-Authenticate', 'Bearer realm="hatch"')
        .send({ error: 'Missing Authorization: Bearer <hatch_runtime_key>' })
      return reply
    }

    const providedHash = sha256Hex(header.slice(7).trim())
    const a = Buffer.from(providedHash, 'hex')
    const b = Buffer.from(entry.runtimeKeyHash, 'hex')

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      reply
        .status(401)
        .header('WWW-Authenticate', 'Bearer realm="hatch", error="invalid_token"')
        .send({ error: 'Invalid runtime key' })
      return reply
    }
    // Authenticated — fall through to the route handler
  })

  // Register MCP transports
  registerSseTransport(app)
  registerHttpTransport(app)

  // Health check — pinged by Railway and Better Stack
  app.get('/health', async (req, reply) => {
    const subdomain = extractSubdomain(req.headers.host)
    const result: Record<string, unknown> = {
      status: 'ok',
      ts: new Date().toISOString(),
    }

    if (subdomain) {
      const entry = await loadConfig(subdomain).catch(() => null)
      result['tenant'] = subdomain
      result['deployed'] = entry !== null

      // Update last_health_check on the active deployment for monitoring
      if (entry) {
        pool.query(
          `UPDATE deployments d SET last_health_check = now(), health_status = 'healthy'
           FROM mcp_servers s
           WHERE d.mcp_server_id = s.id AND s.subdomain = $1 AND d.status = 'active'`,
          [subdomain]
        ).catch(() => undefined)
      }
    }

    reply.send(result)
  })

  // Docs endpoint — returns Markdown reference for the deployed MCP
  app.get('/docs', async (req, reply) => {
    const subdomain = extractSubdomain(req.headers.host)
    if (!subdomain) {
      reply.status(400).send({ error: 'Invalid subdomain' })
      return
    }

    const entry = await loadConfig(subdomain)
    if (!entry) {
      reply.status(404).send({ error: 'No deployed MCP server found' })
      return
    }

    const { generateDocsMarkdown } = await import('./lib/docs.js')
    const markdown = generateDocsMarkdown(entry.config, subdomain)

    if (req.headers.accept?.includes('text/html')) {
      reply.type('text/markdown').send(markdown)
    } else {
      reply.type('text/markdown').send(markdown)
    }
  })

  app.setErrorHandler((err, req, reply) => {
    logger.error('Fastify error', {
      err: err.message,
      path: req.url,
      method: req.method,
    })
    reply.status(err.statusCode ?? 500).send({
      error: err.message ?? 'Internal server error',
    })
  })

  return app
}
