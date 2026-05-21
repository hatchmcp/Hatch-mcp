import { EventEmitter } from 'node:events'
import { query } from '../lib/db.js'
import { logger } from '../lib/logger.js'

// Single EventEmitter that fans out job updates to all SSE subscribers.
// Uses polling instead of PG LISTEN/NOTIFY because we connect via Supabase's
// transaction pooler (port 6543) which does not support LISTEN.
export const jobBus = new EventEmitter()
jobBus.setMaxListeners(0)

let pollTimer: NodeJS.Timeout | null = null

// Track the last seen log id per job so we only emit new entries
const lastSeenLog = new Map<string, number>()

export async function startJobBus(): Promise<void> {
  pollTimer = setInterval(async () => {
    try {
      // Emit progress for every active job
      const runningJobs = await query<{
        id: string; status: string; progress: number; current_step: string | null; error: string | null
      }>(
        `SELECT id, status, progress, current_step, error FROM jobs WHERE status IN ('queued','running')`
      )

      for (const job of runningJobs) {
        jobBus.emit(`job:${job.id}`, {
          type: 'progress',
          jobId: job.id,
          percent: job.progress,
          step: job.current_step,
        })

        // Stream new log lines since last poll
        const since = lastSeenLog.get(job.id) ?? 0
        const logs = await query<{ id: number; level: string; message: string }>(
          `SELECT id, level, message FROM job_logs WHERE job_id = $1 AND id > $2 ORDER BY id`,
          [job.id, since]
        )
        for (const log of logs) {
          jobBus.emit(`job:${job.id}`, { type: 'log', jobId: job.id, level: log.level, message: log.message })
          lastSeenLog.set(job.id, log.id)
        }
      }

      // Emit terminal events for jobs that finished in the last 10 s
      const finished = await query<{ id: string; status: string; result: unknown; error: string | null }>(
        `SELECT id, status, result, error FROM jobs
         WHERE status IN ('succeeded','failed')
           AND finished_at > now() - INTERVAL '10 seconds'`
      )
      for (const job of finished) {
        jobBus.emit(`job:${job.id}`, {
          type: job.status === 'succeeded' ? 'done' : 'failed',
          jobId: job.id,
          result: job.result,
          error: job.error,
          permanent: false,
        })
        lastSeenLog.delete(job.id)
      }
    } catch (err) {
      logger.warn('Job bus poll error', { err: String(err) })
    }
  }, 2_000)

  logger.info('Job bus started (polling mode — Supabase pooler connection)')
}

export async function stopJobBus(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
