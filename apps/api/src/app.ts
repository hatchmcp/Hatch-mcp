import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { requestLog } from './middleware/request-log.js'
import { rateLimit } from './middleware/rate-limit.js'
import { errorHandler } from './middleware/error.js'

import projectsRouter from './routes/projects.js'
import endpointsRouter from './routes/endpoints.js'
import jobsRouter from './routes/jobs.js'
import ingestRouter from './routes/ingest.js'
import generateRouter from './routes/generate.js'
import deployRouter from './routes/deploy.js'
import exportRouter from './routes/export.js'
import analyticsRouter from './routes/analytics.js'
import webhooksRouter from './routes/webhooks.js'
import activityRouter from './routes/activity.js'
import testsRouter from './routes/tests.js'

export function createApp() {
  const app = express()

  // Parse raw body for webhook HMAC verification before JSON parsing
  app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }))
  app.use(express.json({ limit: '5mb' }))

  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }))
  app.use(requestLog)
  app.use('/api/v1', rateLimit)

  // Public endpoints (no auth middleware here — each route handles it)
  app.use('/api/v1/webhooks', webhooksRouter)

  // Authenticated API routes
  app.use('/api/v1/projects', projectsRouter)
  app.use('/api/v1/projects/:id/endpoints', endpointsRouter)
  app.use('/api/v1/projects/:id/ingest', ingestRouter)
  app.use('/api/v1/projects/:id', generateRouter)
  app.use('/api/v1/projects/:id', deployRouter)
  app.use('/api/v1/projects/:id', exportRouter)
  app.use('/api/v1/projects/:id/usage', analyticsRouter)
  app.use('/api/v1/projects/:id', testsRouter)
  app.use('/api/v1/activity', activityRouter)
  app.use('/api/v1/jobs', jobsRouter)

  // Health check — used by Railway and Better Stack uptime monitors
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() })
  })

  // Current user endpoint
  app.get('/api/v1/me', async (req, res, next) => {
    try {
      const { auth } = await import('./middleware/auth.js')
      // Inline auth — just reuse middleware manually
      await new Promise<void>((resolve, reject) => {
        auth(req, res, (err?: unknown) => (err ? reject(err) : resolve()))
      })
      const { queryOne } = await import('./lib/db.js')
      const user = await queryOne(
        `SELECT u.*, c.name AS company_name, c.slug AS company_slug, c.plan
         FROM users u JOIN companies c ON c.id = u.company_id
         WHERE u.id = $1`,
        [req.userId]
      )
      res.json({ user })
    } catch (err) {
      next(err)
    }
  })

  app.use(errorHandler)

  return app
}
