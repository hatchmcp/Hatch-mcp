import type { McpTool } from '@hatchmcp/shared'

// Generates plausible mock values from a JSON Schema property descriptor.
// This avoids the @faker-js/faker dependency while staying deterministic.
function mockValue(schema: Record<string, unknown>): unknown {
  const type = schema.type as string | undefined
  const format = schema.format as string | undefined
  const enumValues = schema.enum as unknown[] | undefined

  if (enumValues?.length) return enumValues[0]

  switch (type) {
    case 'string':
      if (format === 'email') return 'test@example.com'
      if (format === 'date-time') return new Date().toISOString()
      if (format === 'date') return '2024-01-01'
      if (format === 'uuid') return '00000000-0000-0000-0000-000000000001'
      if (format === 'uri') return 'https://example.com'
      return 'test-value'

    case 'number':
    case 'integer':
      return 1

    case 'boolean':
      return true

    case 'array':
      return []

    case 'object':
      return {}

    default:
      return 'test-value'
  }
}

// Generates a mock input object for a tool using the input_schema
export function generateMockInputs(tool: McpTool): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [name, propSchema] of Object.entries(tool.input_schema.properties)) {
    // Only required params for mock — optional ones might cause issues
    if (tool.input_schema.required.includes(name)) {
      result[name] = mockValue(propSchema as Record<string, unknown>)
    }
  }

  return result
}
