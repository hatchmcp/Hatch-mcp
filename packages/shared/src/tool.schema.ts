import { z } from 'zod'

// JSON Schema property descriptor — open-ended, Zod v4 requires explicit key type in z.record()
const JsonSchemaPropertySchema = z.record(z.string(), z.unknown())

export const McpAuthConfigSchema = z.object({
  type: z.enum(['bearer', 'api_key_header', 'api_key_query', 'basic', 'oauth2_client_credentials', 'none']),
  header_name: z.string().nullable().optional(),
  header_prefix: z.string().nullable().optional(),
  query_param: z.string().nullable().optional(),
  user_must_provide: z.array(z.string()),
})

export const McpToolHttpSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url_template: z.string(),
  headers_template: z.record(z.string(), z.string()).nullable().optional(),
  query_template: z.record(z.string(), z.string()).nullable().optional(),
  body_template: z.union([z.record(z.string(), z.unknown()), z.string()]).nullable().optional(),
})

export const McpToolResponseSchema = z.object({
  success_codes: z.array(z.number().int()),
  error_codes: z.record(z.string(), z.string()).nullable().optional(),
  transform: z.string().nullable().optional(),
})

export const McpToolSchema = z.object({
  name: z.string().max(64).regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case'),
  description: z.string().min(1),
  input_schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), JsonSchemaPropertySchema),
    required: z.array(z.string()),
    additionalProperties: z.literal(false),
  }),
  http: McpToolHttpSchema,
  response: McpToolResponseSchema,
})

export const McpConfigSchema = z.object({
  server_name: z.string(),
  server_description: z.string(),
  auth_config: McpAuthConfigSchema,
  env: z.object({ BASE_URL: z.string() }),
  tools: z.array(McpToolSchema),
})

export const GeneratedToolSchema = McpToolSchema

export type McpAuthConfig = z.infer<typeof McpAuthConfigSchema>
export type McpToolHttp = z.infer<typeof McpToolHttpSchema>
export type McpToolResponse = z.infer<typeof McpToolResponseSchema>
export type McpTool = z.infer<typeof McpToolSchema>
export type McpConfig = z.infer<typeof McpConfigSchema>
export type GeneratedTool = z.infer<typeof GeneratedToolSchema>
