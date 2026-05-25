import vm from 'node:vm'

const TRANSFORM_TIMEOUT_MS = 100

export function applyTransform(response: unknown, transformExpr: string | null | undefined): unknown {
  if (!transformExpr) return response

  try {
    return vm.runInNewContext(transformExpr, { response }, { timeout: TRANSFORM_TIMEOUT_MS })
  } catch {
    return response
  }
}
