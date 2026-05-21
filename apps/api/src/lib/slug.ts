import { randomBytes } from 'crypto'

// Converts an arbitrary string to a URL-safe slug
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Generates a unique project slug: "{name}-{4 random hex chars}"
export function generateProjectSlug(name: string): string {
  const base = toSlug(name) || 'project'
  const suffix = randomBytes(2).toString('hex')
  return `${base}-${suffix}`
}

// Generates a subdomain for the MCP runtime: same format as project slug
export function generateSubdomain(name: string): string {
  return generateProjectSlug(name)
}
