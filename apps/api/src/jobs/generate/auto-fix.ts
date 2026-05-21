import { callClaude, parseClaudeJson } from '../../lib/claude.js'
import { McpToolSchema } from '@hatchmcp/shared'
import type { McpTool } from '@hatchmcp/shared'
import { GENERATION_SYSTEM_PROMPT } from './prompts.js'
import { logger } from '../../lib/logger.js'

const MAX_FIX_ATTEMPTS = 2

// Generates a single MCP tool, retrying up to MAX_FIX_ATTEMPTS times with
// Zod validation errors fed back to Claude if the output is invalid.
export async function generateToolWithFix(
  userPrompt: string,
  jobId: string,
  attempt = 0,
  previousRaw?: string,
  previousErrors?: string
): Promise<McpTool> {
  let systemPrompt = GENERATION_SYSTEM_PROMPT

  // On retries, append the corrective context so Claude understands what went wrong
  if (previousRaw && previousErrors) {
    systemPrompt += `\n\nYour previous output failed validation:\n${previousErrors}\n\nPrevious output:\n${previousRaw}\n\nOutput ONLY the corrected JSON for the same tool.`
  }

  const raw = await callClaude({ system: systemPrompt, user: userPrompt, temperature: 0.2, jobId })

  let parsed: unknown
  try {
    parsed = parseClaudeJson(raw)
  } catch (parseErr) {
    if (attempt >= MAX_FIX_ATTEMPTS) {
      throw new Error(`Tool JSON parse failed after ${attempt + 1} attempts: ${String(parseErr)}`)
    }
    logger.warn('Tool JSON parse failed, retrying', { attempt, jobId })
    return generateToolWithFix(userPrompt, jobId, attempt + 1, raw, `JSON parse error: ${String(parseErr)}`)
  }

  const result = McpToolSchema.safeParse(parsed)
  if (result.success) return result.data

  if (attempt >= MAX_FIX_ATTEMPTS) {
    throw new Error(
      `Tool schema validation failed after ${attempt + 1} attempts: ${result.error.issues.map((i) => i.message).join(', ')}`
    )
  }

  const errorSummary = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('\n')

  logger.warn('Tool schema invalid, retrying', { attempt, jobId, errors: errorSummary })
  return generateToolWithFix(userPrompt, jobId, attempt + 1, raw, errorSummary)
}
