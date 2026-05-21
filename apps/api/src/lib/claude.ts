import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'
import { withRetry } from './retry.js'
import { logger } from './logger.js'

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })

export interface ClaudeCallOptions {
  system: string
  user: string
  temperature?: number
  maxTokens?: number
  /** Job ID for log correlation */
  jobId?: string
}

// Single Claude call — retries on 429/5xx, returns raw text.
// Callers are responsible for JSON parsing and Zod validation.
export async function callClaude(opts: ClaudeCallOptions): Promise<string> {
  const { system, user, temperature = 0, maxTokens = 8096, jobId } = opts

  const result = await withRetry(
    async () => {
      const message = await client.messages.create({
        model: config.CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      })

      const block = message.content[0]
      if (!block || block.type !== 'text') {
        throw new Error('Claude returned no text content')
      }
      return block.text
    },
    {
      retries: 3,
      // Retry on rate-limit and server errors; surface others immediately
      shouldRetry: (err) => {
        if (err instanceof Anthropic.RateLimitError) return true
        if (err instanceof Anthropic.APIError && err.status >= 500) return true
        return false
      },
      onRetry: (attempt, delay, err) => {
        logger.warn('Claude call failed, retrying', { attempt, delay, error: err.message, jobId })
      },
    }
  )

  return result
}

// Parse and return JSON from Claude, stripping any accidental markdown fences
export function parseClaudeJson<T>(raw: string): T {
  // Strip ```json ... ``` or ``` ... ``` wrappers Claude sometimes emits
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(stripped) as T
}
