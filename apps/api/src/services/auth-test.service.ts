import axios from 'axios'
import { buildAuthConfig } from '../jobs/generate/auth-mapper.js'
import { buildAuthHeaders, buildAuthQuery, buildAuthVars } from '@hatchmcp/exec'
import type { McpAuthConfig } from '@hatchmcp/shared'

type AuthType = McpAuthConfig['type']

const PROBE_TIMEOUT_MS = 12_000

export interface AuthTestResult {
  ok: boolean
  status: number
  message: string
  latency_ms: number
}

function requiredSecrets(authType: AuthType): string[] {
  switch (authType) {
    case 'bearer':
      return ['token']
    case 'api_key_header':
    case 'api_key_query':
      return ['api_key']
    case 'basic':
      return ['username', 'password']
    case 'oauth2_client_credentials':
      return ['client_id', 'client_secret', 'token_url']
    default:
      return []
  }
}

export function validateAuthSecrets(authType: AuthType, secrets: Record<string, string>): void {
  for (const key of requiredSecrets(authType)) {
    if (!secrets[key]?.trim()) {
      throw new Error(`Missing required secret: ${key}`)
    }
  }
}

export async function testAuth(opts: {
  authType: AuthType
  baseUrl: string
  secrets: Record<string, string>
}): Promise<AuthTestResult> {
  const { authType, baseUrl, secrets } = opts
  validateAuthSecrets(authType, secrets)

  const start = Date.now()
  const authConfig = buildAuthConfig(authType)

  if (authType === 'oauth2_client_credentials') {
    const tokenUrl = secrets['token_url']!
    const res = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: secrets['client_id']!,
        client_secret: secrets['client_secret']!,
      }),
      {
        timeout: PROBE_TIMEOUT_MS,
        validateStatus: () => true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    )
    const latency_ms = Date.now() - start
    const hasToken =
      res.status >= 200 &&
      res.status < 300 &&
      typeof res.data === 'object' &&
      res.data !== null &&
      'access_token' in res.data
    return {
      ok: hasToken,
      status: res.status,
      message: hasToken
        ? 'Token endpoint returned an access_token'
        : `Token request failed (${res.status})`,
      latency_ms,
    }
  }

  const authVars = buildAuthVars(authConfig, secrets)
  const headers = buildAuthHeaders(authConfig, authVars)
  const params = buildAuthQuery(authConfig, authVars)

  const res = await axios.get(baseUrl, {
    timeout: PROBE_TIMEOUT_MS,
    validateStatus: () => true,
    headers,
    params,
    maxRedirects: 3,
  })

  const latency_ms = Date.now() - start
  const ok = res.status !== 401 && res.status !== 403 && res.status < 500

  return {
    ok,
    status: res.status,
    message: ok
      ? `Probe succeeded with HTTP ${res.status}`
      : res.status === 401 || res.status === 403
        ? 'Credentials rejected (401/403)'
        : `Upstream error (${res.status})`,
    latency_ms,
  }
}
