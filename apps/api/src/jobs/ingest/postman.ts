import { PermanentError } from '../runner.js'
import type { ExtractedEndpoint } from '@hatchmcp/shared'

// Postman Collection v2.1 shape (only the fields we use)
interface PostmanCollection {
  info?: { name?: string }
  item?: PostmanItem[]
}

interface PostmanItem {
  name?: string
  item?: PostmanItem[]           // folder
  request?: PostmanRequest
}

interface PostmanRequest {
  method?: string
  url?: { raw?: string; path?: string[] } | string
  body?: { raw?: string }
  description?: string
}

export function parsePostmanCollection(json: unknown, folderPrefix = ''): ExtractedEndpoint[] {
  const col = json as PostmanCollection
  if (!col.item || !Array.isArray(col.item)) {
    throw new PermanentError('Invalid Postman collection — missing item array')
  }
  return flattenItems(col.item, folderPrefix)
}

function flattenItems(items: PostmanItem[], prefix: string): ExtractedEndpoint[] {
  const endpoints: ExtractedEndpoint[] = []

  for (const item of items) {
    if (item.item && Array.isArray(item.item)) {
      // Folder — recurse
      const folderName = item.name ?? ''
      endpoints.push(...flattenItems(item.item, prefix ? `${prefix}/${folderName}` : folderName))
      continue
    }

    const req = item.request
    if (!req) continue

    const method = (req.method ?? 'GET').toUpperCase()
    if (!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(method)) continue

    const rawUrl = typeof req.url === 'string' ? req.url : req.url?.raw ?? ''
    const path = extractPath(rawUrl)

    const summaryBase = item.name ?? `${method} ${path}`
    const summary = prefix ? `${prefix} / ${summaryBase}` : summaryBase

    // Try to parse body params from JSON raw body
    let bodyParams: ExtractedEndpoint['parameters'] = []
    if (req.body?.raw) {
      try {
        const parsed = JSON.parse(req.body.raw) as Record<string, unknown>
        bodyParams = Object.keys(parsed).map((k) => ({
          name: k,
          in: 'body' as const,
          type: inferType(parsed[k]) as 'string',
          required: false,
          description: null,
        }))
      } catch {
        // Non-JSON body — skip
      }
    }

    endpoints.push({
      method: method as ExtractedEndpoint['method'],
      path: normalizePath(path),
      summary: summary.slice(0, 120),
      parameters: bodyParams,
      confidence: 'high',
    })
  }

  return endpoints
}

function extractPath(rawUrl: string): string {
  try {
    // Strip protocol + host to get path
    const u = new URL(rawUrl.replace(/\{\{[^}]+\}\}/g, 'example'))
    return u.pathname
  } catch {
    // Fallback: take the part after the third slash
    const parts = rawUrl.split('/')
    return '/' + parts.slice(3).join('/')
  }
}

function normalizePath(p: string): string {
  // Convert Postman :param and {{param}} styles to {param}
  return p
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
    .replace(/\{\{([^}]+)\}\}/g, '{$1}')
}

function inferType(value: unknown): string {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object' && value !== null) return 'object'
  return 'string'
}
