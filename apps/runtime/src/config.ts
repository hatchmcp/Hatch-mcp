import dotenv from 'dotenv'
import path from 'node:path'
import { z } from 'zod'

// CWD = apps/runtime when run via workspace — root .env is two levels up
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: false })

const RuntimeConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Must match the key used by the API to encrypt secrets
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters'),

  // The MCP hosting domain — subdomains are {slug}.{MCP_DOMAIN}
  MCP_DOMAIN: z.string().default('mcp.hatch.dev'),

  // CORS origins allowed to talk to the runtime (comma-separated)
  CORS_ORIGINS: z.string().default('*'),
})

function parseConfig() {
  const result = RuntimeConfigSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid runtime configuration:\n${issues}`)
  }
  return result.data
}

export const runtimeConfig = parseConfig()
