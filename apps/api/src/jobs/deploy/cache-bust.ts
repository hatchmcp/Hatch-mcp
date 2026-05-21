import { pool } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'

// Tells all runtime instances to evict this tenant's config from their LRU cache.
// After this, the next request to {subdomain}.mcp.hatch.dev will load the new version.
export async function burstConfigCache(subdomain: string): Promise<void> {
  await pool.query(`SELECT pg_notify('config_invalidate', $1)`, [subdomain])
  logger.info('Config cache invalidated', { subdomain })
}
