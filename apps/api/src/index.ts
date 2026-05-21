import { createApp } from './app.js'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { pool } from './lib/db.js'
import { startJobBus, stopJobBus } from './jobs/notify-bus.js'
import { startReaper, stopReaper } from './jobs/reaper.js'

async function main() {
  // Verify DB connectivity before accepting requests
  try {
    await pool.query('SELECT 1')
    logger.info('Database connected')
  } catch (err) {
    logger.error('Database connection failed', { err: String(err) })
    process.exit(1)
  }

  // Start background services
  await startJobBus()
  startReaper()

  const app = createApp()
  const server = app.listen(config.PORT, () => {
    logger.info('API server started', { port: config.PORT, env: config.NODE_ENV })
  })

  // Graceful shutdown — finish in-flight requests before exiting
  async function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down`)

    server.close(async () => {
      stopReaper()
      await stopJobBus()
      await pool.end()
      logger.info('Shutdown complete')
      process.exit(0)
    })

    // Force exit after 30 s if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 30_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
