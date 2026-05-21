import { z } from 'zod'

export const ParameterSchema = z.object({
  name: z.string(),
  in: z.enum(['path', 'query', 'body', 'header']),
  type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
  required: z.boolean(),
  description: z.string().nullable().optional(),
  example: z.unknown().optional(),
})

export const ExtractedEndpointSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  path: z.string(),
  summary: z.string().max(120),
  parameters: z.array(ParameterSchema),
  // Zod v4: z.record requires both key and value schemas
  request_body_schema: z.record(z.string(), z.unknown()).nullable().optional(),
  response_example: z.record(z.string(), z.unknown()).nullable().optional(),
  auth_required: z.boolean().nullable().optional(),
  source_file: z.string().nullable().optional(),
  source_line: z.number().int().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const EndpointRowSchema = ExtractedEndpointSchema.extend({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  selected: z.boolean().default(true),
  llm_name: z.string().nullable().optional(),
  llm_description: z.string().nullable().optional(),
  created_at: z.coerce.date(),
})

export const ExtractionResponseSchema = z.object({
  framework_detected: z.enum([
    'express', 'fastify', 'koa', 'hapi', 'nestjs',
    'fastapi', 'django', 'flask', 'rails', 'spring',
    'openapi', 'postman', 'docs', 'unknown',
  ]),
  base_url_hint: z.string().nullable().optional(),
  auth_methods_detected: z.array(
    z.enum(['bearer', 'api_key_header', 'api_key_query', 'basic', 'oauth2', 'session', 'none'])
  ),
  endpoints: z.array(ExtractedEndpointSchema),
  extraction_confidence: z.enum(['high', 'medium', 'low']),
  possibly_missed: z.array(z.string()),
})

export type Parameter = z.infer<typeof ParameterSchema>
export type ExtractedEndpoint = z.infer<typeof ExtractedEndpointSchema>
export type EndpointRow = z.infer<typeof EndpointRowSchema>
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>
