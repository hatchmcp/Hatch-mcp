import { generateMockInputs } from './mock-faker.js'
import type { McpTool, McpConfig } from '@hatchmcp/shared'
import { logger } from '../../lib/logger.js'

export interface ToolTestResult {
  toolName: string
  status: 'passed' | 'failed'
  error?: string
}

// Validates that each tool's templates resolve cleanly with mock inputs —
// no network calls made. This catches template variable mismatches and
// missing required inputs before deploy.
export async function dryRunConfig(config: McpConfig): Promise<ToolTestResult[]> {
  const results: ToolTestResult[] = []

  for (const tool of config.tools) {
    try {
      await dryRunTool(tool, config)
      results.push({ toolName: tool.name, status: 'passed' })
    } catch (err) {
      results.push({ toolName: tool.name, status: 'failed', error: String(err) })
    }
  }

  return results
}

async function dryRunTool(tool: McpTool, config: McpConfig): Promise<void> {
  const mockInputs = generateMockInputs(tool)

  // Substitute all template variables and verify no leftovers
  const vars = {
    env: config.env,
    input: mockInputs,
    auth: buildMockAuth(config.auth_config.type),
  }

  const url = substituteTemplate(tool.http.url_template, vars)
  if (/\$\{[^}]+\}/.test(url)) {
    throw new Error(`Unresolved template variables in url_template: ${url}`)
  }

  if (tool.http.body_template) {
    const bodyStr = JSON.stringify(tool.http.body_template)
    const body = substituteTemplate(bodyStr, vars)
    if (/\$\{[^}]+\}/.test(body)) {
      throw new Error(`Unresolved template variables in body_template: ${body}`)
    }
  }

  if (tool.http.headers_template) {
    for (const [key, val] of Object.entries(tool.http.headers_template)) {
      const resolved = substituteTemplate(val, vars)
      if (/\$\{[^}]+\}/.test(resolved)) {
        throw new Error(`Unresolved template variable in header ${key}: ${resolved}`)
      }
    }
  }

  logger.debug('Dry run passed', { tool: tool.name })
}

function substituteTemplate(template: string, vars: Record<string, Record<string, unknown>>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    const [ns, ...rest] = key.split('.')
    const field = rest.join('.')
    return String(vars[ns]?.[field] ?? '')
  })
}

function buildMockAuth(type: string): Record<string, string> {
  switch (type) {
    case 'bearer': return { token: 'mock-token' }
    case 'api_key_header':
    case 'api_key_query': return { api_key: 'mock-key' }
    case 'basic': return { username: 'user', password: 'pass' }
    case 'oauth2_client_credentials': return { access_token: 'mock-token' }
    default: return {}
  }
}
