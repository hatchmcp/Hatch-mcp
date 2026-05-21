import type { McpConfig } from '@hatchmcp/shared'

// Generates a simple Markdown reference doc for a deployed MCP server
export function generateDocsMarkdown(config: McpConfig, subdomain: string): string {
  const lines: string[] = [
    `# ${config.server_name}`,
    '',
    config.server_description,
    '',
    `**Endpoint:** \`${subdomain}.mcp.hatch.dev\``,
    '',
    `## Authentication`,
    '',
    formatAuthSection(config),
    '',
    `## Tools`,
    '',
  ]

  for (const tool of config.tools) {
    lines.push(`### \`${tool.name}\``)
    lines.push('')
    lines.push(tool.description)
    lines.push('')

    if (Object.keys(tool.input_schema.properties).length > 0) {
      lines.push('**Inputs:**')
      lines.push('')
      lines.push('| Name | Type | Required | Description |')
      lines.push('|------|------|----------|-------------|')

      for (const [name, prop] of Object.entries(tool.input_schema.properties)) {
        const p = prop as Record<string, unknown>
        const required = tool.input_schema.required.includes(name) ? '✓' : ''
        const desc = (p.description as string) ?? ''
        lines.push(`| \`${name}\` | ${p.type ?? 'string'} | ${required} | ${desc} |`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

function formatAuthSection(config: McpConfig): string {
  const { type, user_must_provide } = config.auth_config
  const keys = user_must_provide.length > 0 ? user_must_provide.map((k) => `\`${k}\``).join(', ') : 'none'

  const descriptions: Record<string, string> = {
    bearer: 'Bearer token in Authorization header',
    api_key_header: 'API key in a request header',
    api_key_query: 'API key as a query parameter',
    basic: 'HTTP Basic authentication',
    oauth2_client_credentials: 'OAuth 2.0 client credentials flow',
    none: 'No authentication required',
  }

  return `**Type:** ${descriptions[type] ?? type}\n**Required secrets:** ${keys}`
}
