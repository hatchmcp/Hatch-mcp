import type { ExtractedEndpoint } from '@hatchmcp/shared'

export const EXTRACTION_SYSTEM_PROMPT = `You are an API endpoint extraction specialist. You receive source code or API documentation and extract every HTTP endpoint exposed by the application. You output ONLY a JSON object matching the schema below — no prose, no markdown fences, no explanation. If you cannot extract anything, output an empty endpoints array.

OUTPUT SCHEMA (strict JSON):
{
  "framework_detected": "express" | "fastify" | "koa" | "hapi" | "nestjs" | "fastapi" | "django" | "flask" | "rails" | "spring" | "openapi" | "postman" | "docs" | "unknown",
  "base_url_hint": string | null,
  "auth_methods_detected": Array<"bearer" | "api_key_header" | "api_key_query" | "basic" | "oauth2" | "session" | "none">,
  "endpoints": Array<{
    "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
    "path": string,
    "summary": string,
    "parameters": Array<{
      "name": string,
      "in": "path" | "query" | "body" | "header",
      "type": "string" | "number" | "integer" | "boolean" | "array" | "object",
      "required": boolean,
      "description": string | null,
      "example": any | null
    }>,
    "request_body_schema": object | null,
    "response_example": object | null,
    "auth_required": boolean | null,
    "source_file": string | null,
    "source_line": number | null,
    "confidence": "high" | "medium" | "low"
  }>,
  "extraction_confidence": "high" | "medium" | "low",
  "possibly_missed": string[]
}

RULES:
1. Normalize all path params to {name} regardless of source style.
2. For mounted routers, emit the FULL mounted path. If unresolvable, confidence="low".
3. Deduplicate identical (method, path) pairs; keep highest-confidence.
4. Include middleware-protected endpoints.
5. Skip static file serving, health checks (/health, /ping), and framework internals.
6. For OpenAPI/Swagger input: use the spec as ground truth.
7. For Postman: each request = one endpoint; folder names → summary prefix.
8. For Markdown: emit only when you see explicit METHOD + PATH together.
9. NEVER hallucinate parameters. Unsure → required=false, confidence="medium".
10. No endpoints → endpoints=[] — do NOT explain.`

export function buildExtractionUserPrompt(opts: {
  projectName: string
  chunkIndex: number
  chunkTotal: number
  fileType: string
  alreadyExtracted: ExtractedEndpoint[]
  chunkContent: string
}): string {
  const { projectName, chunkIndex, chunkTotal, fileType, alreadyExtracted, chunkContent } = opts

  const dedupContext =
    alreadyExtracted.length > 0
      ? `Already extracted in earlier chunks (skip these): ${alreadyExtracted.map((e) => `${e.method} ${e.path}`).join(', ')}`
      : 'No endpoints extracted yet.'

  return `DEDUPLICATION CONTEXT:
${dedupContext}

INPUT METADATA:
- Project: ${projectName}
- Chunk: ${chunkIndex} of ${chunkTotal}
- Detected file type: ${fileType}

[CONTENT START]
${chunkContent}
[CONTENT END]`
}

export function buildMissedPassUserPrompt(opts: {
  projectName: string
  fileIndex: string
  extractedPaths: string[]
}): string {
  const { projectName, fileIndex, extractedPaths } = opts
  return `Project: ${projectName}
Already extracted: ${extractedPaths.join(', ')}

File index:
${fileIndex}

List any obvious API endpoints in the file index that are NOT in the already-extracted list. Reply with the same JSON schema — only include endpoints you are confident are missing. If nothing is missing, return endpoints=[].`
}
