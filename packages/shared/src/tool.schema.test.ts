import { describe, expect, it } from 'vitest'
import { McpToolSchema } from './tool.schema.js'

describe('McpToolSchema', () => {
  const validTool = {
    name: 'list_items',
    description: 'List items',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'integer', description: 'Max rows' },
      },
      required: [] as string[],
      additionalProperties: false as const,
    },
    http: {
      method: 'GET' as const,
      url_template: '${env.BASE_URL}/items',
    },
    response: {
      success_codes: [200],
      error_codes: null,
      transform: null,
    },
  }

  it('accepts a minimal valid tool', () => {
    expect(McpToolSchema.safeParse(validTool).success).toBe(true)
  })

  it('rejects invalid tool names', () => {
    const result = McpToolSchema.safeParse({ ...validTool, name: 'List-Items' })
    expect(result.success).toBe(false)
  })
})
