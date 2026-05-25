import dotenv from 'dotenv'
import path from 'node:path'
import { z } from 'zod'

// When run via npm workspace, CWD = apps/api — root .env is two levels up
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: false })

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),

  // Postgres (Supabase-hosted)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Supabase project credentials
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),
  // Which Claude model to use for extraction (temp=0) and generation (temp=0.2)
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-6'),

  // GitHub App (optional — only needed for GitHub source type)
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // GitHub OAuth App — register at github.com/settings/applications/new with
  // callback `{API_BASE_URL}/api/v1/oauth/github/callback`. With this set,
  // users get a one-click "Connect GitHub" button on Export and never have
  // to paste a PAT.
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),

  // Public-facing URLs — used to construct redirects back to the dashboard
  // after the OAuth dance, and the callback URL registered with GitHub.
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  API_BASE_URL: z.string().default('http://localhost:5000'),

  // AES-256-GCM key for encrypting tenant secrets (64 hex chars = 32 bytes)
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters'),

  // How many jobs can run concurrently inside this process
  JOB_CONCURRENCY: z.coerce.number().int().min(1).default(4),

  // CORS origin — set to your frontend URL in production
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

function parseConfig() {
  const result = ConfigSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return result.data
}

export const config = parseConfig()
export type Config = z.infer<typeof ConfigSchema>
