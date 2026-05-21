import { runtimeConfig } from '../config.js'

// Extracts the tenant slug from the Host header.
// Production: "acme-api.mcp.hatch.dev" → "acme-api"
// Local dev:  "acme-api.mcp.lvh.me"   → "acme-api"
export function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null

  const domain = runtimeConfig.MCP_DOMAIN
  // Strip port if present (e.g. "acme-api.mcp.hatch.dev:8080")
  const hostWithoutPort = host.split(':')[0] ?? host

  if (!hostWithoutPort.endsWith(`.${domain}`)) return null

  const subdomain = hostWithoutPort.slice(0, -`.${domain}`.length)
  // Validate slug format: lowercase alphanumeric + hyphens
  if (!/^[a-z0-9][a-z0-9-]*$/.test(subdomain)) return null

  return subdomain
}
