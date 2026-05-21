import vm from 'node:vm'
import { logger } from '../lib/logger.js'

const TRANSFORM_TIMEOUT_MS = 100

// Executes an optional transform expression against the raw API response.
// The expression runs in a VM sandbox with only `response` in scope.
// Non-null transform should only appear for complex response reshaping —
// the vast majority of tools will have transform: null.
export function applyTransform(response: unknown, transformExpr: string | null | undefined): unknown {
  if (!transformExpr) return response

  try {
    const result = vm.runInNewContext(
      transformExpr,
      { response },
      { timeout: TRANSFORM_TIMEOUT_MS }
    )
    return result
  } catch (err) {
    // Swallow transform errors — return the raw response rather than failing the call
    logger.warn('Transform expression failed, returning raw response', { err: String(err) })
    return response
  }
}
