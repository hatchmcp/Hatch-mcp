import type { McpAuthConfig } from '@hatchmcp/shared'

// Builds auth-related headers and/or query params from the decrypted secrets
export function buildAuthVars(
  authConfig: McpAuthConfig,
  secrets: Record<string, string>
): Record<string, string> {
  // Returns a flat map used in template substitution as ${auth.KEY}
  switch (authConfig.type) {
    case 'bearer':
      return { token: secrets['token'] ?? '' }

    case 'api_key_header':
    case 'api_key_query':
      return { api_key: secrets['api_key'] ?? '' }

    case 'basic': {
      const user = secrets['username'] ?? ''
      const pass = secrets['password'] ?? ''
      return {
        username: user,
        password: pass,
        // Pre-encode for convenience: ${auth.encoded}
        encoded: Buffer.from(`${user}:${pass}`).toString('base64'),
      }
    }

    case 'oauth2_client_credentials':
      return { access_token: secrets['access_token'] ?? '' }

    default:
      return {}
  }
}

// Returns request headers that must be added for this auth type
export function buildAuthHeaders(
  authConfig: McpAuthConfig,
  authVars: Record<string, string>
): Record<string, string> {
  switch (authConfig.type) {
    case 'bearer':
      return { Authorization: `${authConfig.header_prefix ?? 'Bearer '}${authVars['token']}` }

    case 'api_key_header':
      return { [authConfig.header_name ?? 'X-API-Key']: authVars['api_key'] ?? '' }

    case 'basic':
      return { Authorization: `Basic ${authVars['encoded']}` }

    case 'oauth2_client_credentials':
      return { Authorization: `Bearer ${authVars['access_token']}` }

    default:
      return {}
  }
}

// Returns query params that must be added for this auth type
export function buildAuthQuery(
  authConfig: McpAuthConfig,
  authVars: Record<string, string>
): Record<string, string> {
  if (authConfig.type === 'api_key_query') {
    return { [authConfig.query_param ?? 'api_key']: authVars['api_key'] ?? '' }
  }
  return {}
}
