import { pool } from '../routing/config-loader.js'
import { drainConsumed } from './rate-limit.js'
import { logger } from '../lib/logger.js'

let flushTimer: NodeJS.Timeout | null = null

// Logs a single tool call event to usage_events for analytics
export async function recordUsageEvent(opts: {
  mcpServerId: string
  deploymentId: string
  toolName: string
  statusCode: number
  latencyMs: number
  errorClass?: string
  consumerId?: string
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO usage_events (mcp_server_id, deployment_id, tool_name, status_code, latency_ms, error_class, consumer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.mcpServerId,
        opts.deploymentId,
        opts.toolName,
        opts.statusCode,
        opts.latencyMs,
        opts.errorClass ?? null,
        opts.consumerId ?? null,
      ]
    )
  } catch (err) {
    // Non-fatal — don't let telemetry failures break tool calls
    logger.warn('Failed to record usage event', { err: String(err) })
  }
}

// Flushes in-process tenant counters to Postgres every 60 s.
// Loses at most 60 s of counts on crash — acceptable for billing rollups.
async function flushCounters(): Promise<void> {
  const consumed = drainConsumed()
  if (consumed.size === 0) return

  for (const [tenant, calls] of consumed) {
    try {
      await pool.query(
        `INSERT INTO usage_counters (tenant_slug, hour, calls)
         VALUES ($1, date_trunc('hour', now()), $2)
         ON CONFLICT (tenant_slug, hour)
         DO UPDATE SET calls = usage_counters.calls + EXCLUDED.calls`,
        [tenant, calls]
      )
    } catch (err) {
      logger.warn('Failed to flush usage counter', { tenant, err: String(err) })
    }
  }
}

export function startUsageMeter(): void {
  flushTimer = setInterval(() => {
    flushCounters().catch((err) => logger.error('Usage flush error', { err: String(err) }))
  }, 60_000)
  logger.info('Usage meter started (60s flush interval)')
}

export function stopUsageMeter(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  // Final flush on shutdown
  flushCounters().catch(() => undefined)
}
