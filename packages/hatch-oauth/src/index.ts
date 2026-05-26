/**
 * hatch-oauth — drop-in OAuth broker for MCP servers.
 * See README for the full flow.
 *
 *   import { HatchOAuth } from 'hatch-oauth'
 *   const hatch = new HatchOAuth({ clientId, clientSecret })
 */
export { HatchOAuth, InMemoryTokenStore, extractTokenFromHeaders } from './client.js'
export { buildMiddleware } from './middleware.js'
export type { MiddlewareOptions } from './middleware.js'

export type {
  HatchOAuthOptions,
  TokenStore,
  StoredHatchToken,
  StoreTokenInput,
  StoreTokenResult,
  ExchangeResult,
  ConnectUrlOptions,
  CompanyMetadata,
  SessionSummary,
  ValidatedRequest,
} from './types.js'

export {
  HatchOAuthError,
  HatchOAuthConfigError,
  HatchOAuthNetworkError,
  HatchOAuthReconnectRequired,
  HatchOAuthForbidden,
  HatchOAuthRateLimited,
  HatchOAuthValidationError,
  HatchOAuthServerError,
} from './errors.js'
