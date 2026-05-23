import { LRUCache } from 'lru-cache'
import pg from 'pg'
import { runtimeConfig } from '../config.js'
import { decryptSecret } from '../lib/secrets.js'
import { logger } from '../lib/logger.js'
import type { McpConfig } from '@hatchmcp/shared'

const { Pool } = pg

export const pool = new Pool({
  connectionString: runtimeConfig.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  ssl: { rejectUnauthorized: false },
})

export interface ConfigEntry {
  config: McpConfig
  secrets: Record<string, string>
  runtimeKeyHash: string | null
}

// LRU cache keyed by subdomain — ~50 KB per config, 1000 tenants ≈ 50 MB
const configCache = new LRUCache<string, ConfigEntry>({
  max: 1000,
  ttl: 60_000, // 1-minute safety-net TTL — PG NOTIFY handles invalidation proactively
})

let listenClient: pg.PoolClient | null = null

// Subscribe to config_invalidate channel so all runtime instances bust their cache
// when the API deploys a new version.
export async function startConfigListener(): Promise<void> {
  listenClient = await pool.connect()
  await listenClient.query('LISTEN config_invalidate')
  logger.info('Listening for config invalidation events')

  listenClient.on('notification', (msg) => {
    if (msg.payload) {
      configCache.delete(msg.payload)
      logger.info('Config cache evicted', { subdomain: msg.payload })
    }
  })

  listenClient.on('error', async (err) => {
    logger.error('Config listener error, reconnecting', { err: err.message })
    listenClient?.release()
    listenClient = null
    await new Promise((r) => setTimeout(r, 5_000))
    await startConfigListener()
  })
}

export async function stopConfigListener(): Promise<void> {
  listenClient?.release()
  listenClient = null
}

// Load config for a tenant — returns null if no active deployment exists
export async function loadConfig(subdomain: string): Promise<ConfigEntry | null> {
  const cached = configCache.get(subdomain)
  if (cached) return cached

  const result = await pool.query<{
    config: McpConfig
    server_id: string
    runtime_key_hash: string | null
  }>(
    `SELECT v.config,
            s.id AS server_id,
            s.runtime_key_hash
     FROM mcp_servers s
     JOIN mcp_server_versions v ON v.id = s.current_version_id
     JOIN deployments d ON d.mcp_server_id = s.id AND d.status = 'active'
     WHERE s.subdomain = $1
     LIMIT 1`,
    [subdomain]
  )

  if (result.rows.length === 0) return null

  const { config, server_id, runtime_key_hash } = result.rows[0]

  // Load and decrypt all secrets for this server
  const secretRows = await pool.query<{ key: string; ciphertext: string; nonce: string }>(
    `SELECT key, ciphertext, nonce FROM mcp_server_secrets WHERE mcp_server_id = $1`,
    [server_id]
  )

  const secrets: Record<string, string> = {}
  for (const row of secretRows.rows) {
    try {
      secrets[row.key] = decryptSecret(row.ciphertext, row.nonce)
    } catch (err) {
      logger.warn('Failed to decrypt secret', { key: row.key, subdomain, err: String(err) })
    }
  }

  const entry: ConfigEntry = { config, secrets, runtimeKeyHash: runtime_key_hash }
  configCache.set(subdomain, entry)
  return entry
}
