import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { query, execute } from '../lib/db.js'
import { runJob } from '../jobs/runner.js'
import { fetchAndScoreRepo, parseGitHubUrl } from '../jobs/ingest/github.js'
import { parseOpenApi } from '../jobs/ingest/openapi.js'
import { parsePostmanCollection } from '../jobs/ingest/postman.js'
import { fetchDocsAsMarkdown } from '../jobs/ingest/docs.js'
import { rankFiles, scoreFile } from '../jobs/ingest/file-scorer.js'
import { buildChunks } from '../jobs/extract/chunker.js'
import { extractAllChunks, runMissedPass } from '../jobs/extract/extractor.js'
import { HttpError } from '../middleware/error.js'

const router = Router({ mergeParams: true })

// POST /projects/:id/ingest
router.post('/', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)

  const [job] = await query<{ id: string }>(
    `INSERT INTO jobs (project_id, type, status) VALUES ($1, 'ingest', 'queued') RETURNING id`,
    [project.id]
  )

  runJob(job.id, async (ctx) => {
    const { source_type, source_url, name, base_api_url } = project

    let endpoints: Awaited<ReturnType<typeof extractAllChunks>> = []

    if (source_type === 'openapi') {
      if (!source_url) throw new HttpError(422, 'source_url is required for openapi source type')
      await ctx.progress(20, 'Parsing OpenAPI spec')
      const { endpoints: parsed, baseUrl } = await parseOpenApi(source_url)

      // Upsert base_api_url from spec if not already set
      if (baseUrl && !base_api_url) {
        await execute(`UPDATE projects SET base_api_url = $1 WHERE id = $2`, [baseUrl, project.id])
      }

      endpoints = parsed as typeof endpoints

    } else if (source_type === 'github') {
      if (!source_url) throw new HttpError(422, 'source_url is required for github source type')
      await ctx.progress(10, 'Fetching repository')
      const source = parseGitHubUrl(source_url)
      const files = await fetchAndScoreRepo(source)
      const ranked = rankFiles(files)

      await ctx.progress(40, 'Chunking source files')
      const chunks = buildChunks(ranked)

      await ctx.progress(60, 'Extracting endpoints with Claude')
      endpoints = await extractAllChunks(chunks, name, ctx, job.id)

      await ctx.progress(85, 'Running missed-endpoint pass')
      const missed = await runMissedPass(chunks, endpoints, name, ctx, job.id)
      endpoints = [...endpoints, ...missed]

    } else if (source_type === 'postman') {
      if (!source_url && !req.body?.collection) {
        throw new HttpError(422, 'source_url or collection body required for postman source type')
      }
      await ctx.progress(30, 'Parsing Postman collection')

      let collectionJson: unknown
      if (source_url) {
        const { default: axios } = await import('axios')
        const { data } = await axios.get(source_url, { timeout: 10_000 })
        collectionJson = data
      } else {
        collectionJson = req.body.collection
      }

      endpoints = parsePostmanCollection(collectionJson) as typeof endpoints

    } else if (source_type === 'docs') {
      if (!source_url) throw new HttpError(422, 'source_url is required for docs source type')
      await ctx.progress(20, 'Fetching documentation')
      const markdown = await fetchDocsAsMarkdown(source_url)

      const fakeFile = [{ filePath: 'docs.md', content: markdown, score: scoreFile('docs.md', markdown) }]
      const chunks = buildChunks(fakeFile)

      await ctx.progress(50, 'Extracting endpoints from docs')
      endpoints = await extractAllChunks(chunks, name, ctx, job.id)

    } else if (source_type === 'paste') {
      // Raw paste stored in source_url as the content itself
      const content = source_url ?? ''
      const fakeFile = [{ filePath: 'paste.txt', content, score: 10 }]
      const chunks = buildChunks(fakeFile)
      endpoints = await extractAllChunks(chunks, name, ctx, job.id)

    } else {
      throw new HttpError(422, `Unsupported source_type: ${source_type}`)
    }

    await ctx.progress(95, `Saving ${endpoints.length} endpoints`)

    // Upsert endpoints — preserve existing llm_name / llm_description edits
    for (const ep of endpoints) {
      await execute(
        `INSERT INTO endpoints
           (project_id, method, path, summary, parameters, request_body, response_example, auth_required, source_file, source_line, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (project_id, method, path) DO UPDATE
         SET summary = EXCLUDED.summary,
             parameters = EXCLUDED.parameters,
             request_body = EXCLUDED.request_body,
             response_example = EXCLUDED.response_example,
             confidence = EXCLUDED.confidence`,
        [
          project.id, ep.method, ep.path, ep.summary,
          JSON.stringify(ep.parameters),
          JSON.stringify(ep.request_body_schema ?? null),
          JSON.stringify(ep.response_example ?? null),
          ep.auth_required ?? true,
          ep.source_file ?? null,
          ep.source_line ?? null,
          ep.confidence,
        ]
      )
    }

    return { endpoint_count: endpoints.length }
  })

  res.status(202).json({ job_id: job.id })
})

export default router
