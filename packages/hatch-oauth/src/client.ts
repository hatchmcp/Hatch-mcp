import type {
  HatchOAuthOptions,
  TokenStore,
  StoredHatchToken,
  StoreTokenInput,
  StoreTokenResult,
  ExchangeResult,
  ConnectUrlOptions,
  CompanyMetadata,
  SessionSummary,
} from './types.js'
import { buildMiddleware, type MiddlewareOptions } from './middleware.js'
import {
  HatchOAuthError,
  HatchOAuthConfigError,
  HatchOAuthNetworkError,
  HatchOAuthReconnectRequired,
  HatchOAuthForbidden,
  HatchOAuthRateLimited,
  HatchOAuthValidationError,
  HatchOAuthServerError,
} from './errors.js'

const DEFAULT_BASE_URL = 'https://hatchmcp.com'
const DEFAULT_TIMEOUT = 15_000

/* ─────────────────────────── In-memory store (default) ─────────────────────────── */

class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, StoredHatchToken>()

  async get(userId: string) {
    return this.map.get(userId) ?? null
  }

  async set(userId: string, value: StoredHatchToken) {
    this.map.set(userId, value)
  }

  async delete(userId: string) {
    this.map.delete(userId)
  }
}

/* ─────────────────────────── Main client ─────────────────────────── */

export class HatchOAuth {
  readonly clientId: string
  readonly baseUrl: string
  readonly timeoutMs: number
  private readonly clientSecret?: string
  private readonly store: TokenStore
  private readonly log: (event: string, data: Record<string, unknown>) => void

  constructor(options: HatchOAuthOptions) {
    if (!options.clientId) {
      throw new HatchOAuthConfigError('clientId is required')
    }
    this.clientId = options.clientId
    this.clientSecret = options.clientSecret
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
    this.store = options.tokenStore ?? new InMemoryTokenStore()

    if (options.debug === true) {
      this.log = (event, data) => console.debug(`[hatch-oauth] ${event}`, data)
    } else if (typeof options.debug === 'function') {
      this.log = options.debug
    } else {
      this.log = () => undefined
    }
  }

  /* ─────────────────────────── Connect URL ─────────────────────────── */

  /**
   * Build the URL to send the end-user to start the Connect flow.
   * Uses the public client_id — no secret needed here.
   */
  getConnectUrl(options: ConnectUrlOptions = {}): string {
    const params = new URLSearchParams({ client_id: this.clientId })
    if (options.redirectUri) params.set('redirect_uri', options.redirectUri)
    if (options.state) params.set('state', options.state)
    return `${this.baseUrl}/oauth/connect/${encodeURIComponent(this.clientId)}?${params.toString()}`
  }

  /**
   * Fetch the public metadata about a company (for rendering a Connect
   * page yourself instead of using the Hatch-hosted one).
   */
  async getCompanyMetadata(slug: string): Promise<CompanyMetadata> {
    const res = await this.request<{ company: CompanyMetadata }>(
      'GET',
      `/api/v1/oauth/connect/${encodeURIComponent(slug)}`,
      undefined,
      { auth: 'none' }
    )
    return res.company
  }

  /* ─────────────────────────── Company-side: store + lookup ─────────────────────────── */

  /**
   * Hand the upstream real token to Hatch in exchange for a hatch_token.
   * Call this from your backend AFTER the user logs in (e.g. inside your
   * Supabase auth callback). If a TokenStore is configured, the returned
   * hatch_token is persisted by user_id automatically.
   */
  async storeToken(input: StoreTokenInput): Promise<StoreTokenResult> {
    this.requireSecret('storeToken')

    const body = {
      user_id: input.user_id,
      real_token: input.real_token,
      expires_at:
        input.expires_at instanceof Date
          ? input.expires_at.toISOString()
          : input.expires_at ?? null,
      scopes: input.scopes ?? [],
      metadata: input.metadata,
      state: input.state,
    }
    const result = await this.request<StoreTokenResult>(
      'POST',
      '/api/v1/oauth/store-token',
      body,
      { auth: 'basic' }
    )

    await this.store.set(input.user_id, {
      hatch_token: result.hatch_token,
      expires_at: result.expires_at,
      session_id: result.session_id,
    })

    this.log('storeToken', { user_id: input.user_id, session_id: result.session_id })
    return result
  }

  /**
   * Get the upstream real token for a user. Looks up the hatch_token from
   * the TokenStore, exchanges it for a real token, transparently rotates
   * the hatch_token if the broker says so.
   *
   * Throws HatchOAuthReconnectRequired if the user has no session or
   * their session was revoked — surface that to the user with a fresh
   * connect URL.
   */
  async getToken(userId: string): Promise<string> {
    const stored = await this.store.get(userId)
    if (!stored) {
      throw new HatchOAuthReconnectRequired(
        `No hatch_token stored for user "${userId}". Send them through getConnectUrl().`
      )
    }
    const result = await this.exchangeToken(stored.hatch_token)

    // Rotate transparently
    if (result.rotated_hatch_token) {
      await this.store.set(userId, {
        hatch_token: result.rotated_hatch_token,
        expires_at: result.rotated_expires_at ?? null,
        session_id: result.session_id,
      })
      this.log('rotated', { user_id: userId, session_id: result.session_id })
    }

    return result.real_token
  }

  /* ─────────────────────────── MCP-side: raw exchange ─────────────────────────── */

  /**
   * Exchange a hatch_token for the upstream real token. Use this in your
   * MCP server, where the hatch_token lives in env and isn't tied to any
   * stored userId mapping.
   */
  async exchangeToken(
    hatchToken: string,
    options?: { toolName?: string }
  ): Promise<ExchangeResult> {
    if (!hatchToken) {
      throw new HatchOAuthReconnectRequired('No hatch_token provided')
    }
    return this.request<ExchangeResult>(
      'POST',
      '/api/v1/oauth/exchange',
      { hatch_token: hatchToken, tool_name: options?.toolName },
      { auth: 'none' }
    )
  }

  /* ─────────────────────────── Revocation ─────────────────────────── */

  /**
   * Revoke a session. Pass `{ hatchToken }` if you only have the token, or
   * `{ userId }` if you're the company backend cleaning up after a user
   * disconnects (requires clientSecret).
   */
  async revoke(input: { hatchToken: string } | { userId: string }): Promise<void> {
    if ('hatchToken' in input) {
      await this.request(
        'POST',
        '/api/v1/oauth/revoke',
        { hatch_token: input.hatchToken },
        { auth: 'none', allowEmpty: true }
      )
      this.log('revoke (by token)', {})
      return
    }

    this.requireSecret('revoke({ userId })')
    await this.request(
      'POST',
      '/api/v1/oauth/revoke',
      { user_id: input.userId },
      { auth: 'basic', allowEmpty: true }
    )
    await this.store.delete(input.userId)
    this.log('revoke (by user)', { user_id: input.userId })
  }

  /* ─────────────────────────── Sessions ─────────────────────────── */

  /**
   * List the company's connected users. Requires clientSecret.
   */
  async listSessions(opts: { limit?: number } = {}): Promise<SessionSummary[]> {
    this.requireSecret('listSessions')
    const qs = opts.limit ? `?limit=${opts.limit}` : ''
    const res = await this.request<{ sessions: SessionSummary[] }>(
      'GET',
      `/api/v1/oauth/sessions${qs}`,
      undefined,
      { auth: 'basic' }
    )
    return res.sessions
  }

  /* ─────────────────────────── Request inbound validation ─────────────────────────── */

  /**
   * Pull the hatch_token from an incoming request (Authorization: Hatch
   * <token> or X-Hatch-Token header), exchange it, return the validated
   * user info + real upstream token. Use this in raw HTTP handlers — for
   * Express, prefer `middleware()`.
   */
  async validateRequest(req: {
    headers?: Record<string, string | string[] | undefined>
  }): Promise<ExchangeResult> {
    const token = extractTokenFromHeaders(req.headers ?? {})
    if (!token) {
      throw new HatchOAuthReconnectRequired(
        'Missing hatch_token — expected Authorization: Hatch <token> or X-Hatch-Token'
      )
    }
    return this.exchangeToken(token)
  }

  /**
   * Build an Express middleware that validates inbound hatch_tokens and
   * attaches the result to `req.hatch`.
   *
   *   const hatch = new HatchOAuth({ clientId, clientSecret })
   *   app.use('/api', hatch.middleware())
   *
   * Express is a peer dep — the middleware function returned is just a
   * `(req, res, next) => void` and works with any Connect-compatible
   * server. Without Express installed at all, the runtime types degrade
   * to the basic shape and the function still runs.
   */
  middleware(opts?: MiddlewareOptions) {
    return buildMiddleware(this, opts)
  }

  /* ─────────────────────────── Internals ─────────────────────────── */

  private requireSecret(op: string): void {
    if (!this.clientSecret) {
      throw new HatchOAuthConfigError(
        `${op} requires clientSecret. Set it when constructing HatchOAuth — it's the value you got from /oauth/register.`
      )
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    opts: { auth: 'basic' | 'none'; allowEmpty?: boolean }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = { 'content-type': 'application/json' }

    if (opts.auth === 'basic') {
      const cred = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      headers['authorization'] = `Basic ${cred}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      throw new HatchOAuthNetworkError(
        `Network error calling ${method} ${path}: ${err instanceof Error ? err.message : String(err)}`,
        err
      )
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 204) {
      return undefined as T
    }

    let payload: unknown = null
    const text = await res.text().catch(() => '')
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { error: text }
      }
    }
    const errorMessage =
      (payload as { error?: string } | null)?.error ?? `HTTP ${res.status}`

    if (res.ok) return (payload as T) ?? (opts.allowEmpty ? (undefined as T) : ({} as T))

    if (res.status === 401) {
      throw new HatchOAuthReconnectRequired(errorMessage)
    }
    if (res.status === 403) {
      throw new HatchOAuthForbidden(errorMessage)
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || undefined
      throw new HatchOAuthRateLimited(errorMessage, retryAfter)
    }
    if (res.status >= 400 && res.status < 500) {
      throw new HatchOAuthValidationError(errorMessage, res.status)
    }
    throw new HatchOAuthServerError(errorMessage, res.status)
  }
}

/* ─────────────────────────── Helpers ─────────────────────────── */

export function extractTokenFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const xHatch = pickString(headers['x-hatch-token']) ?? pickString(headers['X-Hatch-Token'])
  if (xHatch) return xHatch.trim()

  const authz =
    pickString(headers['authorization']) ?? pickString(headers['Authorization'])
  if (!authz) return null

  // Accept "Hatch <token>" and "Bearer hk_<token>" — Bearer is convenient
  // since most HTTP clients have first-class support for it
  const match = authz.match(/^(?:Hatch|Bearer)\s+(\S+)/i)
  return match ? match[1]! : null
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.length > 0) return v[0]
  return undefined
}

// Public re-export so callers can plug their own DB
export { InMemoryTokenStore }
// Surface the error classes
export {
  HatchOAuthError,
  HatchOAuthConfigError,
  HatchOAuthNetworkError,
  HatchOAuthReconnectRequired,
  HatchOAuthForbidden,
  HatchOAuthRateLimited,
  HatchOAuthValidationError,
  HatchOAuthServerError,
}
