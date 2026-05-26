import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { HatchOAuth } from './client.js'
import type { ValidatedRequest } from './types.js'
import { HatchOAuthError, HatchOAuthReconnectRequired } from './errors.js'

/**
 * Decorate Express's Request with the validated hatch session.
 * Routes downstream of `hatch.middleware()` can do `req.hatch.real_token`.
 */
declare module 'express-serve-static-core' {
  interface Request {
    hatch?: ValidatedRequest
  }
}

export interface MiddlewareOptions {
  /**
   * When true, requests without a valid hatch_token still call next() —
   * `req.hatch` will be undefined and the route handler decides what to
   * do. Defaults to false (return 401 immediately).
   */
  optional?: boolean

  /**
   * Custom error formatter. Default sends `{ error: message }` plus the
   * Hatch connect URL when reconnect is required.
   */
  onError?: (err: HatchOAuthError, req: Request, res: Response, next: NextFunction) => void

  /**
   * Pass-through to /oauth/exchange — surfaces the tool name in the audit
   * log. Default reads `req.headers['x-hatch-tool']`.
   */
  toolName?: string | ((req: Request) => string | undefined)
}

/**
 * Build an Express middleware that validates incoming hatch_tokens.
 *
 *   const hatch = new HatchOAuth({ clientId, clientSecret })
 *   app.use('/api', hatch.middleware())
 *
 *   app.get('/api/me', (req, res) => {
 *     // req.hatch.real_token is the upstream API token for this user
 *     // req.hatch.user_id is whatever you passed when storing
 *     res.json({ user: req.hatch!.user_id })
 *   })
 */
export function buildMiddleware(
  client: HatchOAuth,
  opts: MiddlewareOptions = {}
): RequestHandler {
  return async (req, res, next) => {
    try {
      const headers = req.headers as Record<string, string | string[] | undefined>
      const token = extractAuthHeader(headers)

      if (!token) {
        if (opts.optional) return next()
        throw new HatchOAuthReconnectRequired(
          'Missing hatch_token (Authorization: Hatch <token>)'
        )
      }

      const toolName =
        typeof opts.toolName === 'function'
          ? opts.toolName(req)
          : opts.toolName ??
            (typeof headers['x-hatch-tool'] === 'string'
              ? (headers['x-hatch-tool'] as string)
              : undefined)

      const result = await client.exchangeToken(token, { toolName })

      req.hatch = {
        user_id: result.user_id,
        session_id: result.session_id,
        scopes: result.scopes,
        metadata: result.metadata,
        real_token: result.real_token,
      }

      next()
    } catch (err) {
      const error =
        err instanceof HatchOAuthError
          ? err
          : new HatchOAuthError(err instanceof Error ? err.message : String(err))

      if (opts.onError) {
        opts.onError(error, req, res, next)
        return
      }
      defaultErrorResponse(client, error, res)
    }
  }
}

function defaultErrorResponse(client: HatchOAuth, err: HatchOAuthError, res: Response): void {
  const status = err.status ?? 500
  const body: Record<string, unknown> = { error: err.message, code: err.code }
  if (err instanceof HatchOAuthReconnectRequired) {
    body.reconnect_url = client.getConnectUrl()
  }
  res.status(status).json(body)
}

function extractAuthHeader(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const x = headers['x-hatch-token']
  if (typeof x === 'string') return x.trim()
  if (Array.isArray(x) && x[0]) return x[0]!.trim()

  const a = headers['authorization']
  const value = typeof a === 'string' ? a : Array.isArray(a) ? a[0] : undefined
  if (!value) return null
  const m = value.match(/^(?:Hatch|Bearer)\s+(\S+)/i)
  return m ? m[1]! : null
}
