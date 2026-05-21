import { Router } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import { query, queryOne } from '../lib/db.js'
import { runJob } from '../jobs/runner.js'
import { fetchAndScoreRepo, parseGitHubUrl } from '../jobs/ingest/github.js'
import { buildChunks } from '../jobs/extract/chunker.js'
import { extractAllChunks, runMissedPass } from '../jobs/extract/extractor.js'
import { rankFiles } from '../jobs/ingest/file-scorer.js'
import { execute } from '../lib/db.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const router = Router()

// Verify GitHub HMAC signature on incoming webhook payloads
function verifyGitHubSignature(payload: Buffer, signature: string): boolean {
  if (!config.GITHUB_WEBHOOK_SECRET) return false
  const expected = `sha256=${createHmac('sha256', config.GITHUB_WEBHOOK_SECRET).update(payload).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// POST /webhooks/github — triggered by GitHub App when a PR or push happens
router.post('/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  const rawBody = req.body as Buffer

  if (!signature || !verifyGitHubSignature(rawBody, signature)) {
    logger.warn('Invalid GitHub webhook signature')
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  const event = req.headers['x-github-event'] as string
  if (event !== 'push') {
    res.status(200).json({ ignored: true })
    return
  }

  let payload: { repository?: { html_url?: string }; ref?: string }
  try {
    payload = JSON.parse(rawBody.toString())
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' })
    return
  }

  const repoUrl = payload.repository?.html_url
  if (!repoUrl) {
    res.status(200).json({ ignored: true })
    return
  }

  // Find any projects using this repo
  const projects = await query<{ id: string; name: string }>(
    `SELECT id, name FROM projects WHERE source_url ILIKE $1 AND source_type = 'github'`,
    [`%${repoUrl}%`]
  )

  if (projects.length === 0) {
    res.status(200).json({ ignored: true })
    return
  }

  logger.info('GitHub push webhook — re-ingesting projects', { count: projects.length, repo: repoUrl })
  res.status(202).json({ triggered: projects.length })

  // Kick off re-ingest for each project asynchronously
  for (const project of projects) {
    const [job] = await query<{ id: string }>(
      `INSERT INTO jobs (project_id, type, status) VALUES ($1, 'ingest', 'queued') RETURNING id`,
      [project.id]
    )

    const source = parseGitHubUrl(repoUrl)

    runJob(job.id, async (ctx) => {
      await ctx.progress(10, 'Fetching repo')
      const files = await fetchAndScoreRepo(source)
      const ranked = rankFiles(files)

      await ctx.progress(40, 'Chunking files')
      const chunks = buildChunks(ranked)

      await ctx.progress(60, 'Extracting endpoints')
      const endpoints = await extractAllChunks(chunks, project.name, ctx, job.id)

      const missed = await runMissedPass(chunks, endpoints, project.name, ctx, job.id)
      const all = [...endpoints, ...missed]

      await ctx.progress(90, 'Saving endpoints')

      // Clear stale endpoints and replace with fresh extraction
      await execute(`DELETE FROM endpoints WHERE project_id = $1`, [project.id])
      for (const ep of all) {
        await execute(
          `INSERT INTO endpoints (project_id, method, path, summary, parameters, request_body, response_example, auth_required, source_file, source_line, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (project_id, method, path) DO UPDATE
           SET summary = EXCLUDED.summary, parameters = EXCLUDED.parameters, confidence = EXCLUDED.confidence`,
          [
            project.id, ep.method, ep.path, ep.summary,
            JSON.stringify(ep.parameters), JSON.stringify(ep.request_body_schema ?? null),
            JSON.stringify(ep.response_example ?? null), ep.auth_required ?? true,
            ep.source_file ?? null, ep.source_line ?? null, ep.confidence,
          ]
        )
      }

      return { endpoint_count: all.length }
    })
  }
})

// POST /auth/callback — Supabase auth webhook (creates user + company on first sign-in)
router.post('/auth/callback', async (req, res) => {
  const { type, record } = req.body as { type: string; record: { id: string; email: string } }

  if (type !== 'INSERT' || !record?.id || !record?.email) {
    res.status(200).json({ ok: true })
    return
  }

  const existing = await queryOne('SELECT id FROM users WHERE id = $1', [record.id])
  if (existing) {
    res.status(200).json({ ok: true })
    return
  }

  // Auto-create a company for the first user from this email domain
  const domain = record.email.split('@')[1] ?? 'unknown'
  const companySlug = domain.replace(/\./g, '-').slice(0, 40) + `-${Date.now()}`

  const [company] = await query<{ id: string }>(
    `INSERT INTO companies (name, slug) VALUES ($1, $2) RETURNING id`,
    [domain, companySlug]
  )

  await execute(
    `INSERT INTO users (id, email, company_id) VALUES ($1, $2, $3)`,
    [record.id, record.email, company.id]
  )

  logger.info('New user onboarded', { userId: record.id, companyId: company.id })
  res.status(200).json({ ok: true })
})

export default router
