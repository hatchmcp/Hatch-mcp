import { runSchemaValidation } from './schema-validator.js'
import { dryRunConfig } from './dry-runner.js'
import { callClaude, parseClaudeJson } from '../../lib/claude.js'
import { McpToolSchema } from '@hatchmcp/shared'
import type { McpConfig, McpTool } from '@hatchmcp/shared'
import type { JobContext } from '@hatchmcp/shared'
import { GENERATION_SYSTEM_PROMPT } from '../generate/prompts.js'
import { logger } from '../../lib/logger.js'

export interface TestReport {
  schemaValid: boolean
  schemaIssues: { toolName: string; issue: string }[]
  toolResults: { toolName: string; status: 'passed' | 'failed'; error?: string }[]
  passed: boolean
}

export async function runTestPipeline(
  config: McpConfig,
  ctx: JobContext,
  jobId: string
): Promise<TestReport> {
  await ctx.progress(10, 'Running schema validation')

  const schemaResult = runSchemaValidation(config.tools)
  if (schemaResult.issues.length > 0) {
    await ctx.log('warn', 'Schema validation issues found', { count: schemaResult.issues.length })
  }

  await ctx.progress(40, 'Running dry-run validation')
  const toolResults = await dryRunConfig(config)

  const allPassed = schemaResult.passed && toolResults.every((r) => r.status === 'passed')

  return {
    schemaValid: schemaResult.passed,
    schemaIssues: schemaResult.issues,
    toolResults,
    passed: allPassed,
  }
}

// Auto-fix a single failing tool — feeds its error back to Claude
export async function autoFixTool(
  tool: McpTool,
  error: string,
  config: McpConfig,
  jobId: string,
  attempt = 0
): Promise<{ tool: McpTool; status: 'fixed' | 'failed'; error?: string }> {
  const MAX_FIX_ATTEMPTS = 3
  if (attempt >= MAX_FIX_ATTEMPTS) {
    return { tool, status: 'failed', error }
  }

  const log = logger.child({ jobId, tool: tool.name, attempt })
  log.info('Auto-fixing tool')

  const fixPrompt = `This MCP tool config failed validation:\n\nError: ${error}\n\nTool:\n${JSON.stringify(tool, null, 2)}\n\nFix the issue and output ONLY the corrected JSON for this one tool.`

  let raw: string
  try {
    raw = await callClaude({ system: GENERATION_SYSTEM_PROMPT, user: fixPrompt, temperature: 0.1, jobId })
  } catch (err) {
    return autoFixTool(tool, error, config, jobId, attempt + 1)
  }

  let fixed: McpTool
  try {
    const parsed = parseClaudeJson(raw)
    const result = McpToolSchema.safeParse(parsed)
    if (!result.success) throw new Error(result.error.message)
    fixed = result.data
  } catch (parseErr) {
    return autoFixTool(tool, String(parseErr), config, jobId, attempt + 1)
  }

  // Test the fixed tool
  const testConfig = { ...config, tools: [fixed] }
  const testResults = await dryRunConfig(testConfig)
  const testResult = testResults[0]

  if (testResult?.status === 'passed') {
    log.info('Auto-fix succeeded')
    return { tool: fixed, status: 'fixed' }
  }

  return autoFixTool(fixed, testResult?.error ?? 'unknown error', config, jobId, attempt + 1)
}
