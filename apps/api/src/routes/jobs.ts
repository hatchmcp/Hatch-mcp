import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { query, queryOne } from '../lib/db.js'
import { jobBus } from '../jobs/notify-bus.js'
import { HttpError } from '../middleware/error.js'

const router = Router()

router.get('/:jobId', auth, async (req, res) => {
  const job = await queryOne(
    `SELECT j.*, array_agg(row_to_json(l) ORDER BY l.created_at) FILTER (WHERE l.id IS NOT NULL) AS logs
     FROM jobs j
     LEFT JOIN job_logs l ON l.job_id = j.id
     WHERE j.id = $1
     GROUP BY j.id`,
    [req.params.jobId]
  )
  if (!job) throw new HttpError(404, 'Job not found')
  res.json({ job })
})

// GET /jobs/:jobId/stream — SSE for live job progress
router.get('/:jobId/stream', auth, async (req, res) => {
  const { jobId } = req.params

  // Verify the job exists
  const job = await queryOne(
    `SELECT id, status, progress, current_step, result, error FROM jobs WHERE id = $1`,
    [jobId]
  )
  if (!job) throw new HttpError(404, 'Job not found')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable Nginx buffering

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Send current state immediately so clients don't wait for the first event
  send({ type: 'snapshot', jobId, ...job })

  // If already terminal, close the stream
  if (job.status === 'succeeded' || job.status === 'failed') {
    res.end()
    return
  }

  // Subscribe to future updates via the job bus
  const handler = (data: unknown) => send(data)
  jobBus.on(`job:${jobId}`, handler)

  // Keep-alive ping every 30 s (proxies and load balancers drop idle SSE)
  const ping = setInterval(() => res.write(': ping\n\n'), 30_000)

  req.on('close', () => {
    jobBus.off(`job:${jobId}`, handler)
    clearInterval(ping)
  })
})

// GET /projects/:id/jobs — list jobs for a project
router.get('/projects/:projectId/jobs', auth, async (req, res) => {
  const jobs = await query(
    `SELECT id, type, status, progress, current_step, error, started_at, finished_at, created_at
     FROM jobs
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.params.projectId]
  )
  res.json({ jobs })
})

export default router
