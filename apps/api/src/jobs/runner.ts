import pLimit from 'p-limit'
import { execute } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { config } from '../config.js'
import type { JobContext, LogLevel } from '@hatchmcp/shared'

// Global concurrency cap — shared across all in-flight jobs in this process
const limiter = pLimit(config.JOB_CONCURRENCY)

export class PermanentError extends Error {
  readonly permanent = true
  constructor(message: string) {
    super(message)
    this.name = 'PermanentError'
  }
}

function makeJobContext(jobId: string): JobContext {
  const log = logger.child({ jobId })

  return {
    async progress(percent: number, step: string) {
      await execute(
        `UPDATE jobs SET progress = $1, current_step = $2 WHERE id = $3`,
        [percent, step, jobId]
      )
      log.info(step, { percent })
    },

    async log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
      await execute(
        `INSERT INTO job_logs (job_id, level, message, meta) VALUES ($1, $2, $3, $4)`,
        [jobId, level, message, meta ? JSON.stringify(meta) : null]
      )
    },
  }
}

// No-op in pooler mode — job bus uses polling instead of pg_notify
async function pgNotify(_jobId: string, _payload: Record<string, unknown>): Promise<void> {}

// Fire-and-forget — do NOT await from the request handler.
// Returns immediately; job runs inside the p-limit slot.
export function runJob<T>(
  jobId: string,
  fn: (ctx: JobContext) => Promise<T>
): void {
  limiter(async () => {
    await execute(
      `UPDATE jobs SET status = 'running', started_at = now(), heartbeat_at = now() WHERE id = $1`,
      [jobId]
    )

    const ctx = makeJobContext(jobId)

    // Heartbeat every 10 s so the reaper knows this job is alive
    const heartbeat = setInterval(async () => {
      try {
        await execute(`UPDATE jobs SET heartbeat_at = now() WHERE id = $1`, [jobId])
      } catch {
        // Non-fatal — reaper will clean up if heartbeats stop
      }
    }, 10_000)

    try {
      const result = await fn(ctx)

      await execute(
        `UPDATE jobs SET status = 'succeeded', finished_at = now(), result = $1, progress = 100 WHERE id = $2`,
        [JSON.stringify(result), jobId]
      )
      await pgNotify(jobId, { type: 'done', jobId, result })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const permanent = (err as { permanent?: boolean }).permanent === true

      await execute(
        `UPDATE jobs SET status = 'failed', finished_at = now(), error = $1 WHERE id = $2`,
        [error.message, jobId]
      )
      await pgNotify(jobId, { type: 'failed', jobId, error: error.message, permanent })

      logger.error('Job failed', { jobId, error: error.message, permanent })
    } finally {
      clearInterval(heartbeat)
    }
  }).catch((err) => {
    // p-limit itself threw (should not happen) — log and move on
    logger.error('p-limit error', { jobId, err: String(err) })
  })
}
