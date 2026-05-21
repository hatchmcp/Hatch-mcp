import pLimit from 'p-limit'
import { callClaude, parseClaudeJson } from '../../lib/claude.js'
import { logger } from '../../lib/logger.js'
import { ExtractionResponseSchema } from '@hatchmcp/shared'
import type { ExtractedEndpoint } from '@hatchmcp/shared'
import type { JobContext } from '@hatchmcp/shared'
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompts.js'
import { buildMissedPassPrompt } from './missed-pass.js'
import type { Chunk } from './chunker.js'

// Max 4 parallel Claude calls (Anthropic rate limits)
const claudeLimiter = pLimit(4)

export async function extractAllChunks(
  chunks: Chunk[],
  projectName: string,
  ctx: JobContext,
  jobId: string
): Promise<ExtractedEndpoint[]> {
  const allEndpoints: ExtractedEndpoint[] = []
  const log = logger.child({ jobId })

  // Process chunks in parallel (up to 4 concurrent) with dedup context
  const tasks = chunks.map((chunk) =>
    claudeLimiter(async () => {
      log.info('Extracting chunk', { chunk: chunk.index, total: chunk.total })

      let raw: string
      try {
        raw = await callClaude({
          system: EXTRACTION_SYSTEM_PROMPT,
          user: buildExtractionUserPrompt({
            projectName,
            chunkIndex: chunk.index,
            chunkTotal: chunk.total,
            fileType: 'source',
            alreadyExtracted: allEndpoints,
            chunkContent: chunk.content,
          }),
          temperature: 0,
          jobId,
        })
      } catch (err) {
        await ctx.log('warn', `Chunk ${chunk.index} failed`, { error: String(err) })
        return []
      }

      return parseAndValidateExtraction(raw, chunk.index, ctx, jobId)
    })
  )

  const results = await Promise.all(tasks)
  for (const batch of results) allEndpoints.push(...batch)

  return deduplicate(allEndpoints)
}

async function parseAndValidateExtraction(
  raw: string,
  chunkIndex: number,
  ctx: JobContext,
  jobId: string
): Promise<ExtractedEndpoint[]> {
  let parsed: unknown
  try {
    parsed = parseClaudeJson(raw)
  } catch {
    // One retry with a corrective prompt
    try {
      const corrected = await callClaude({
        system: EXTRACTION_SYSTEM_PROMPT,
        user: `Your previous output was not valid JSON. Output ONLY the JSON object matching the schema. Previous output:\n${raw}`,
        temperature: 0,
        jobId,
      })
      parsed = parseClaudeJson(corrected)
    } catch (retryErr) {
      await ctx.log('warn', `Chunk ${chunkIndex} JSON parse failed after retry`, { error: String(retryErr) })
      return []
    }
  }

  const result = ExtractionResponseSchema.safeParse(parsed)
  if (!result.success) {
    await ctx.log('warn', `Chunk ${chunkIndex} schema validation failed`, {
      issues: result.error.issues.slice(0, 5),
    })
    // Still return whatever endpoints we can extract, relaxing validation
    return ((parsed as { endpoints?: unknown[] })?.endpoints ?? []) as ExtractedEndpoint[]
  }

  return result.data.endpoints
}

// Second pass — ask Claude if any obvious endpoints were missed
export async function runMissedPass(
  chunks: Chunk[],
  extracted: ExtractedEndpoint[],
  projectName: string,
  ctx: JobContext,
  jobId: string
): Promise<ExtractedEndpoint[]> {
  if (extracted.length === 0) return []

  const fileIndex = chunks.flatMap((c) => c.files).join('\n')
  const extractedPaths = extracted.map((e) => `${e.method} ${e.path}`)

  try {
    const raw = await callClaude({
      system: EXTRACTION_SYSTEM_PROMPT,
      user: buildMissedPassPrompt({ projectName, fileIndex, extractedPaths }),
      temperature: 0,
      jobId,
    })
    const additional = await parseAndValidateExtraction(raw, -1, ctx, jobId)
    // Mark missed endpoints as low confidence
    return additional.map((e) => ({ ...e, confidence: 'low' as const }))
  } catch (err) {
    await ctx.log('debug', 'Missed-pass failed (non-critical)', { error: String(err) })
    return []
  }
}

function deduplicate(endpoints: ExtractedEndpoint[]): ExtractedEndpoint[] {
  const seen = new Map<string, ExtractedEndpoint>()
  for (const ep of endpoints) {
    const key = `${ep.method}:${ep.path}`
    const existing = seen.get(key)
    // Keep whichever has higher confidence
    if (!existing || confidenceRank(ep.confidence) > confidenceRank(existing.confidence)) {
      seen.set(key, ep)
    }
  }
  return Array.from(seen.values())
}

function confidenceRank(c: 'high' | 'medium' | 'low'): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1
}
