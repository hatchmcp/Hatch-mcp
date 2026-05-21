import pg from 'pg'
import { config } from '../config.js'
import { logger } from './logger.js'

const { Pool } = pg

// Main connection pool — used for all regular queries
// SSL is required for Supabase remote connections
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  logger.error('Unexpected pg pool error', { err: err.message })
})

// Typed query helpers so callers don't work with raw QueryResult
// No extends constraint — callers pass concrete interface types
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export async function execute(sql: string, params?: unknown[]): Promise<void> {
  await pool.query(sql, params)
}

// Acquire a dedicated client for LISTEN/NOTIFY — callers must release it
export async function createDedicatedClient(): Promise<pg.PoolClient> {
  return pool.connect()
}
