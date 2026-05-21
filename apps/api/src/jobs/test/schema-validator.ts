import type { McpTool } from '@hatchmcp/shared'

interface ValidationIssue {
  toolName: string
  issue: string
}

// Deterministic schema validation — no Claude, no network calls.
// Runs before the dry-run to catch structural problems early.
export function validateToolSchemas(tools: McpTool[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const names = new Set<string>()

  for (const tool of tools) {
    if (names.has(tool.name)) {
      issues.push({ toolName: tool.name, issue: 'Duplicate tool name' })
    }
    names.add(tool.name)

    if (tool.name.length > 64) {
      issues.push({ toolName: tool.name, issue: `Name exceeds 64 characters (${tool.name.length})` })
    }

    // Verify url_template starts with ${env.BASE_URL}
    if (!tool.http.url_template.startsWith('${env.BASE_URL}')) {
      issues.push({ toolName: tool.name, issue: 'url_template must start with ${env.BASE_URL}' })
    }

    // Check all required inputs are referenced somewhere in the templates
    const templateBlob = JSON.stringify(tool.http)
    for (const req of tool.input_schema.required) {
      if (!templateBlob.includes(`\${input.${req}}`)) {
        issues.push({ toolName: tool.name, issue: `Required input "${req}" is never used in http templates` })
      }
    }

    // Check for unresolved template variables
    const unresolved = templateBlob.match(/\$\{(?!env\.|input\.|auth\.)[^}]+\}/g)
    if (unresolved?.length) {
      issues.push({ toolName: tool.name, issue: `Unknown template variables: ${unresolved.join(', ')}` })
    }

    // Every path param in url_template must be a required input
    const pathParams = tool.http.url_template.match(/\$\{input\.([^}]+)\}/g) ?? []
    for (const pp of pathParams) {
      const paramName = pp.slice('${input.'.length, -1)
      if (!tool.input_schema.required.includes(paramName)) {
        issues.push({ toolName: tool.name, issue: `Path param "${paramName}" must be required` })
      }
    }

    // Validate success_codes are valid HTTP status codes
    for (const code of tool.response.success_codes) {
      if (code < 100 || code > 599) {
        issues.push({ toolName: tool.name, issue: `Invalid success code: ${code}` })
      }
    }
  }

  return issues
}

export interface SchemaValidationResult {
  passed: boolean
  issues: ValidationIssue[]
}

export function runSchemaValidation(tools: McpTool[]): SchemaValidationResult {
  const issues = validateToolSchemas(tools)
  return { passed: issues.length === 0, issues }
}
