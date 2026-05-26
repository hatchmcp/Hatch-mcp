/**
 * Public types for `hatch-oauth`.
 * Stable surface — anything not exported from index.ts is internal.
 */

export interface HatchOAuthOptions {
  /** Public client ID, e.g. "hco_abc…". From /oauth/register. */
  clientId: string

  /**
   * Plaintext client secret, e.g. "hcs_…". Shown once on register.
   * Required for company-side operations (storeToken, revoke, listSessions).
   * Optional for MCP-side operations (exchangeToken, getRealToken).
   */
  clientSecret?: string

  /**
   * Base URL of HatchMCP. Defaults to https://hatchmcp.com.
   * Use http://localhost:5000 against a local dev API.
   */
  baseUrl?: string

  /**
   * Custom request timeout in ms. Default 15000.
   */
  timeoutMs?: number

  /**
   * Optional persistent store for hatch_tokens (per end-user).
   * If provided, storeToken() upserts here, getToken() reads here.
   * Without one, the SDK still works — the caller just has to persist
   * the returned hatch_token themselves.
   */
  tokenStore?: TokenStore

  /**
   * If true, every request + response is logged via `console.debug`.
   * Set to a function to plug into your own logger.
   */
  debug?: boolean | ((event: string, data: Record<string, unknown>) => void)
}

/**
 * Persistence interface for the hatch_token <-> userId mapping on the
 * company side. Implement against your DB of choice.
 */
export interface TokenStore {
  get(userId: string): Promise<StoredHatchToken | null>
  set(userId: string, value: StoredHatchToken): Promise<void>
  delete(userId: string): Promise<void>
}

export interface StoredHatchToken {
  hatch_token: string
  expires_at: string | null
  session_id?: string
}

/* ─────────────────────────── Request / response shapes ─────────────────────────── */

export interface StoreTokenInput {
  /** Your end-user identifier (Supabase auth id, etc.). Opaque to Hatch. */
  user_id: string
  /** The upstream OAuth/API token Hatch should hold on the user's behalf. */
  real_token: string
  /** Optional — when the real token expires. */
  expires_at?: Date | string | null
  /** Optional — scopes granted, for the company's audit / display. */
  scopes?: string[]
  /** Optional — arbitrary metadata returned in /sessions and /exchange. */
  metadata?: Record<string, unknown>
  /**
   * Optional — the CSRF state from a Connect page round-trip.
   * If present, the broker consumes it (single-use, 10 min TTL).
   */
  state?: string
}

export interface StoreTokenResult {
  hatch_token: string
  expires_at: string
  session_id: string
}

export interface ExchangeResult {
  real_token: string
  user_id: string
  session_id: string
  expires_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
  /**
   * Populated only when the broker rotated the hatch_token (lazy — fires
   * when the token is within 7 days of expiry). The SDK persists this
   * automatically when a TokenStore is configured.
   */
  rotated_hatch_token?: string
  rotated_expires_at?: string
}

export interface ConnectUrlOptions {
  /** Where the user should land after Connect completes. */
  redirectUri?: string
  /** CSRF token your app should verify on the way back. */
  state?: string
}

export interface CompanyMetadata {
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  scopes: string[]
}

export interface SessionSummary {
  id: string
  user_id: string
  scopes: string[]
  revoked: boolean
  revoked_at: string | null
  real_token_expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  last_used_at: string | null
  access_count: number
}

export interface ValidatedRequest {
  user_id: string
  session_id: string
  scopes: string[]
  metadata: Record<string, unknown>
  /** The real upstream token. Use this to make the upstream API call. */
  real_token: string
}
