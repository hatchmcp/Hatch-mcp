import pLimit from 'p-limit'
import { generateToolWithFix } from './auto-fix.js'
import { buildAuthConfig } from './auth-mapper.js'
import { buildGenerationUserPrompt } from './prompts.js'
import { McpConfigSchema } from '@hatchmcp/shared'
import type { EndpointRow, McpConfig, McpTool } from '@hatchmcp/shared'
import type { JobContext } from '@hatchmcp/shared'
import { logger } from '../../lib/logger.js'

// Max 4 concurrent tool-generation calls (Anthropic rate limits)
const genLimiter = pLimit(4)

export async function generateMcpConfig(opts: {
  projectName: string
  baseUrl: string
  authType: string
  endpoints: EndpointRow[]
  ctx: JobContext
  jobId: string
}): Promise<McpConfig> {
  const { projectName, baseUrl, authType, endpoints, ctx, jobId } = opts
  const log = logger.child({ jobId })

  const authConfig = buildAuthConfig(authType)

  log.info('Generating MCP tools', { count: endpoints.length, authType })

  const toolTasks = endpoints.map((ep, i) =>
    genLimiter(async (): Promise<McpTool | null> => {
      const userPrompt = buildGenerationUserPrompt({ endpoint: ep, baseUrl, authHint: authType })

      try {
        const tool = await generateToolWithFix(userPrompt, jobId)
        await ctx.progress(
          Math.round(10 + (i / endpoints.length) * 80),
          `Generated tool: ${tool.name}`
        )
        return tool
      } catch (err) {
        await ctx.log('warn', `Failed to generate tool for ${ep.method} ${ep.path}`, { error: String(err) })
        return null
      }
    })
  )

  const results = await Promise.all(toolTasks)
  const tools = results.filter((t): t is McpTool => t !== null)

  const serverSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const config: McpConfig = {
    server_name: `${serverSlug}-mcp`,
    server_description: `MCP server for ${projectName} API`,
    auth_config: authConfig,
    env: { BASE_URL: baseUrl },
    tools,
  }

  // Validate the assembled config — this should always pass since each tool was validated
  const parsed = McpConfigSchema.safeParse(config)
  if (!parsed.success) {
    throw new Error(`Generated config failed schema validation: ${parsed.error.message}`)
  }

  log.info('MCP config generated', { tools: tools.length })
  return parsed.data
}
