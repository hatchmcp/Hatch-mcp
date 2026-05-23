import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPI, OpenAPIV3, OpenAPIV2 } from 'openapi-types'
import { PermanentError } from '../runner.js'
import type { ExtractedEndpoint } from '@hatchmcp/shared'

// OpenAPI input skips Claude entirely — the spec is the ground truth
export async function parseOpenApi(urlOrPath: string): Promise<{
  endpoints: ExtractedEndpoint[]
  baseUrl: string | null
  authMethods: string[]
}> {
  let api: OpenAPI.Document
  try {
    api = await SwaggerParser.dereference(urlOrPath)
  } catch (err) {
    throw new PermanentError(`Failed to parse OpenAPI spec at ${urlOrPath}: ${String(err)}`)
  }

  const endpoints: ExtractedEndpoint[] = []

  if (isV3(api)) {
    return parseV3(api, urlOrPath)
  } else if (isV2(api)) {
    return parseV2(api, urlOrPath)
  }

  throw new PermanentError('Unsupported OpenAPI version — expected 2.x or 3.x')
}

// Resolve a server URL that may be relative (e.g. "/api/v3") against the URL
// the spec was fetched from. Petstore3, GitHub's spec, and many others
// declare relative servers so we have to do this work — otherwise the runtime
// gets a useless path with no host and every tool call 404s.
function resolveBase(serverUrl: string | null, sourceUrl: string): string | null {
  if (!serverUrl) return null
  if (/^https?:\/\//i.test(serverUrl)) return serverUrl
  try {
    return new URL(serverUrl, sourceUrl).toString().replace(/\/$/, '')
  } catch {
    return serverUrl
  }
}

function isV3(api: OpenAPI.Document): api is OpenAPIV3.Document {
  return (api as OpenAPIV3.Document).openapi?.startsWith('3') ?? false
}

function isV2(api: OpenAPI.Document): api is OpenAPIV2.Document {
  return (api as OpenAPIV2.Document).swagger?.startsWith('2') ?? false
}

function parseV3(api: OpenAPIV3.Document, sourceUrl: string): { endpoints: ExtractedEndpoint[]; baseUrl: string | null; authMethods: string[] } {
  const endpoints: ExtractedEndpoint[] = []
  const baseUrl = resolveBase(api.servers?.[0]?.url ?? null, sourceUrl)
  const authMethods = detectAuthMethodsV3(api)

  const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue

    for (const method of METHODS) {
      const op = pathItem[method] as OpenAPIV3.OperationObject | undefined
      if (!op) continue

      const parameters = parseParametersV3(op.parameters as OpenAPIV3.ParameterObject[] | undefined)
      const bodyParams = parseRequestBodyV3(op.requestBody as OpenAPIV3.RequestBodyObject | undefined)

      endpoints.push({
        method: method.toUpperCase() as ExtractedEndpoint['method'],
        path: normalizePath(path),
        summary: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
        parameters: [...parameters, ...bodyParams],
        request_body_schema: extractBodySchemaV3(op.requestBody as OpenAPIV3.RequestBodyObject | undefined),
        response_example: extractResponseExampleV3(op.responses),
        auth_required: op.security !== undefined ? op.security.length > 0 : null,
        confidence: 'high',
      })
    }
  }

  return { endpoints, baseUrl, authMethods }
}

function parseV2(api: OpenAPIV2.Document, sourceUrl: string): { endpoints: ExtractedEndpoint[]; baseUrl: string | null; authMethods: string[] } {
  const endpoints: ExtractedEndpoint[] = []
  const scheme = api.schemes?.[0] ?? 'https'
  // If host is missing, fall back to deriving from the spec URL (e.g. swagger v2
  // specs hosted next to the API root).
  const baseUrl = api.host
    ? `${scheme}://${api.host}${api.basePath ?? ''}`
    : resolveBase(api.basePath ?? null, sourceUrl)
  const authMethods: string[] = []

  const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    for (const method of METHODS) {
      const op = (pathItem as Record<string, unknown>)[method] as OpenAPIV2.OperationObject | undefined
      if (!op) continue

      const parameters = (op.parameters ?? []) as OpenAPIV2.Parameter[]
      const parsed = parameters.map((p) => ({
        name: p.name,
        in: (p.in === 'formData' ? 'body' : p.in) as 'path' | 'query' | 'body' | 'header',
        type: (p as OpenAPIV2.InBodyParameterObject & { type?: string }).type ?? 'string' as 'string',
        required: p.required ?? false,
        description: p.description ?? null,
      }))

      endpoints.push({
        method: method.toUpperCase() as ExtractedEndpoint['method'],
        path: normalizePath(path),
        summary: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
        parameters: parsed,
        confidence: 'high',
      })
    }
  }

  return { endpoints, baseUrl, authMethods }
}

function parseParametersV3(params?: OpenAPIV3.ParameterObject[]) {
  return (params ?? []).map((p) => ({
    name: p.name,
    in: p.in as 'path' | 'query' | 'header',
    type: (p.schema as OpenAPIV3.SchemaObject)?.type ?? 'string' as 'string',
    required: p.required ?? false,
    description: p.description ?? null,
  }))
}

function parseRequestBodyV3(body?: OpenAPIV3.RequestBodyObject) {
  if (!body) return []
  const schema = (body.content?.['application/json']?.schema as OpenAPIV3.SchemaObject) ?? {}
  const properties = schema.properties ?? {}
  const required = schema.required ?? []

  return Object.entries(properties).map(([name, prop]) => ({
    name,
    in: 'body' as const,
    type: ((prop as OpenAPIV3.SchemaObject).type ?? 'string') as 'string',
    required: required.includes(name),
    description: (prop as OpenAPIV3.SchemaObject).description ?? null,
  }))
}

function extractBodySchemaV3(body?: OpenAPIV3.RequestBodyObject): Record<string, unknown> | null {
  if (!body) return null
  return (body.content?.['application/json']?.schema as Record<string, unknown>) ?? null
}

function extractResponseExampleV3(
  responses?: OpenAPIV3.ResponsesObject
): Record<string, unknown> | null {
  if (!responses) return null
  const ok = responses['200'] ?? responses['201']
  if (!ok) return null
  const content = (ok as OpenAPIV3.ResponseObject).content?.['application/json']
  return (content?.example as Record<string, unknown>) ?? null
}

function detectAuthMethodsV3(api: OpenAPIV3.Document): string[] {
  const schemes = api.components?.securitySchemes ?? {}
  return Object.values(schemes).map((s) => {
    const scheme = s as OpenAPIV3.SecuritySchemeObject
    if (scheme.type === 'http' && scheme.scheme === 'bearer') return 'bearer'
    if (scheme.type === 'apiKey') return 'api_key_header'
    if (scheme.type === 'oauth2') return 'oauth2'
    return 'unknown'
  })
}

function normalizePath(p: string): string {
  // Convert {param} style (OpenAPI) — already canonical
  return p.replace(/:([a-zA-Z_]+)/g, '{$1}')
}
