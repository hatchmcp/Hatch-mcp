import { logger } from '../lib/logger.js'

interface RateLimit { rpm: number; rps: number; monthly_calls: number }
interface Bucket { tokens: number; refilledAt: number; consumed: number }

const LIMITS: Record<string, RateLimit> = {
  free:       { rpm: 60,   rps: 5,   monthly_calls: 10_000 },
  pro:        { rpm: 600,  rps: 50,  monthly_calls: 500_000 },
  enterprise: { rpm: 6000, rps: 500, monthly_calls: 10_000_000 },
}

const buckets = new Map<string, Bucket>()

function getBucket(tenant: string, plan: string): Bucket {
  const limit = LIMITS[plan] ?? LIMITS['free']!
  let bucket = buckets.get(tenant)
  if (!bucket) {
    bucket = { tokens: limit.rpm, refilledAt: Date.now(), consumed: 0 }
    buckets.set(tenant, bucket)
  }
  return bucket
}

function refill(bucket: Bucket, limit: RateLimit): void {
  const now = Date.now()
  const elapsedMs = now - bucket.refilledAt
  // Refill proportionally to elapsed time (token bucket)
  const tokensToAdd = Math.floor((elapsedMs / 60_000) * limit.rpm)
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(limit.rpm, bucket.tokens + tokensToAdd)
    bucket.refilledAt = now
  }
}

export class RateLimitError extends Error {
  readonly statusCode = 429
  constructor(rpm: number) {
    super(`Rate limit exceeded. Max ${rpm} requests per minute.`)
    this.name = 'RateLimitError'
  }
}

export function enforceRateLimit(tenant: string, plan: string): void {
  const limit = LIMITS[plan] ?? LIMITS['free']!
  const bucket = getBucket(tenant, plan)
  refill(bucket, limit)

  if (bucket.tokens < 1) {
    throw new RateLimitError(limit.rpm)
  }

  bucket.tokens -= 1
  bucket.consumed += 1
}

// Returns all tenant buckets with pending consumed counts (for flush)
export function drainConsumed(): Map<string, number> {
  const result = new Map<string, number>()
  for (const [tenant, bucket] of buckets) {
    if (bucket.consumed > 0) {
      result.set(tenant, bucket.consumed)
      bucket.consumed = 0
    }
  }
  return result
}
