import type { McpConfig } from '@hatchmcp/shared'

// Generates a Markdown reference page for a deployed MCP server.
// Served at {subdomain}.mcp.hatch.dev/docs
export function generateDocsMarkdown(config: McpConfig, subdomain: string): string {
  const lines: string[] = [
    `# ${config.server_name}`,
    '',
    config.server_description,
    '',
    `**Base URL:** \`${subdomain}.mcp.hatch.dev\``,
    '',
    '## Tools',
    '',
  ]

  for (const tool of config.tools) {
    lines.push(`### \`${tool.name}\``)
    lines.push('')
    lines.push(tool.description)
    lines.push('')

    const props = Object.entries(tool.input_schema.properties)
    if (props.length > 0) {
      lines.push('| Input | Type | Required | Description |')
      lines.push('|-------|------|----------|-------------|')
      for (const [name, schema] of props) {
        const s = schema as Record<string, unknown>
        const req = tool.input_schema.required.includes(name) ? '✓' : ''
        lines.push(`| \`${name}\` | ${s['type'] ?? 'any'} | ${req} | ${s['description'] ?? ''} |`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
