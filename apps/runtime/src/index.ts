import { createServer } from './server.js'
import { runtimeConfig } from './config.js'
import { logger } from './lib/logger.js'
import { pool, startConfigListener, stopConfigListener } from './routing/config-loader.js'
import { startUsageMeter, stopUsageMeter } from './limits/usage-meter.js'

async function main() {
  // Verify DB before accepting connections
  try {
    await pool.query('SELECT 1')
    logger.info('Database connected')
  } catch (err) {
    logger.error('Database connection failed', { err: String(err) })
    process.exit(1)
  }

  await startConfigListener()
  startUsageMeter()

  const app = createServer()

  try {
    const address = await app.listen({
      port: runtimeConfig.PORT,
      host: '0.0.0.0',
    })
    logger.info('MCP runtime started', { address, env: runtimeConfig.NODE_ENV })
  } catch (err) {
    logger.error('Failed to start server', { err: String(err) })
    process.exit(1)
  }

  async function shutdown(signal: string) {
    logger.info(`${signal} — shutting down runtime`)
    await app.close()
    stopUsageMeter()
    await stopConfigListener()
    await pool.end()
    logger.info('Runtime shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Fatal runtime error:', err)
  process.exit(1)
})
