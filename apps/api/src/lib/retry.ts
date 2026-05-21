export interface RetryOptions {
  retries: number
  /** Base delay in ms; actual delay = baseDelay * 4^attempt */
  baseDelay?: number
  shouldRetry?: (err: Error) => boolean
  onRetry?: (attempt: number, delayMs: number, err: Error) => void
}

// Exponential backoff: 4s → 16s → 64s (base 4s, exponent 4^attempt)
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const { retries, baseDelay = 4000, shouldRetry = () => true, onRetry } = opts

  let lastErr: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))

      const isLast = attempt === retries
      if (isLast || !shouldRetry(lastErr)) throw lastErr

      const delay = baseDelay * Math.pow(4, attempt)
      onRetry?.(attempt + 1, delay, lastErr)
      await sleep(delay)
    }
  }

  throw lastErr
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
