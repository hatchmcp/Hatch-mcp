import { defineConfig } from 'vitest/config'

const encryptionKey = 'a'.repeat(64)

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/apps/web/**', '**/dist/**'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/hatch_test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      ENCRYPTION_KEY: encryptionKey,
    },
  },
})
