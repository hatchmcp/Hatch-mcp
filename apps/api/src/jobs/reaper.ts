import { execute } from '../lib/db.js'
import { logger } from '../lib/logger.js'

let reaperTimer: NodeJS.Timeout | null = null

// Runs every 30 s. Any job whose heartbeat is older than 60 s is marked failed —
// that means its process crashed or was killed. The 90 s total window (30 s poll
// + 60 s grace) gives running jobs enough runway while catching dead ones quickly.
export function startReaper(): void {
  reaperTimer = setInterval(async () => {
    try {
      const result = await execute(`
        UPDATE jobs
        SET
          status       = 'failed',
          finished_at  = now(),
          error        = 'Job stalled — process restarted. Please retry.'
        WHERE
          status        = 'running'
          AND heartbeat_at < now() - INTERVAL '60 seconds'
      `)
      void result
    } catch (err) {
      logger.error('Reaper query failed', { err: String(err) })
    }
  }, 30_000)

  logger.info('Job reaper started')
}

export function stopReaper(): void {
  if (reaperTimer) {
    clearInterval(reaperTimer)
    reaperTimer = null
  }
}
