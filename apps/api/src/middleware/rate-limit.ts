import type { Request, Response, NextFunction } from 'express'

interface Bucket {
  tokens: number
  refilledAt: number
}

// Simple in-process token-bucket rate limiter for API routes.
// For the MCP runtime, per-tenant limiting lives in apps/runtime/src/limits/.
const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 120  // requests per window per user

function refill(bucket: Bucket): void {
  const now = Date.now()
  const elapsed = now - bucket.refilledAt
  if (elapsed >= WINDOW_MS) {
    bucket.tokens = MAX_REQUESTS
    bucket.refilledAt = now
  }
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  // Key by authenticated user if available, otherwise by IP
  const key = (req as { userId?: string }).userId ?? req.ip ?? 'unknown'

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: MAX_REQUESTS, refilledAt: Date.now() }
    buckets.set(key, bucket)
  }

  refill(bucket)

  if (bucket.tokens < 1) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' })
    return
  }

  bucket.tokens -= 1
  next()
}
