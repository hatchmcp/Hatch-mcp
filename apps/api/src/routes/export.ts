import { Router } from 'express'
import { z } from 'zod'
import archiver from 'archiver'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { getMcpServer, getActiveConfig } from '../services/deploy.service.js'
import { generateMcpServerCode } from '../jobs/package/code-generator.js'
import { pushToGitHub } from '../jobs/package/github-pusher.js'
import { McpConfigSchema } from '@hatchmcp/shared'
import { HttpError } from '../middleware/error.js'
import { logger } from '../lib/logger.js'

const router = Router({ mergeParams: true })

// GET /projects/:id/export.zip — streams a standalone MCP server codebase.
// The user runs `npm install && npm run build && node dist/index.js` after
// extracting the zip; Claude Desktop spawns that node process over stdio.
router.get('/export.zip', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)
  const rawConfig = await getActiveConfig(mcpServer.id)
  if (!rawConfig) {
    throw new HttpError(404, 'No MCP config generated yet. Run Generate first.')
  }
  const config = McpConfigSchema.parse(rawConfig)

  const fileMap = generateMcpServerCode(config, { slug: project.slug })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${project.slug}.zip"`
  )

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', (err) => {
    logger.error('Zip stream error', { err: err.message, projectId: project.id })
    res.status(500).end()
  })

  archive.pipe(res)

  // Nest everything under <slug>/ so unzip gives a clean folder
  for (const [path, content] of Object.entries(fileMap)) {
    archive.append(content, { name: `${project.slug}/${path}` })
  }

  await archive.finalize()
})

const PushSchema = z.object({
  repo: z.string().min(1, 'Repo is required (owner/name or full URL)'),
  token: z.string().min(1, 'GitHub PAT is required'),
  branch: z.string().min(1).default('main'),
  commit_message: z.string().min(1).max(500).default('Initial commit from Hatch'),
})

// POST /projects/:id/push-to-github — synchronously pushes the generated
// code to the user's repo as a single commit. Returns the commit URL.
//
// We don't store the PAT — it's used inline and discarded. For a longer-
// lived integration we'd add a GitHub OAuth flow, but PAT-per-push keeps
// the trust model minimal: Hatch never holds a token that can write to
// the user's repos.
router.post('/push-to-github', auth, async (req, res) => {
  const body = PushSchema.parse(req.body)

  const project = await getProject(req.params.id, req.companyId)
  const mcpServer = await getMcpServer(project.id)
  const rawConfig = await getActiveConfig(mcpServer.id)
  if (!rawConfig) {
    throw new HttpError(404, 'No MCP config generated yet. Run Generate first.')
  }
  const config = McpConfigSchema.parse(rawConfig)

  const fileMap = generateMcpServerCode(config, { slug: project.slug })

  const result = await pushToGitHub({
    token: body.token,
    repo: body.repo,
    branch: body.branch,
    commitMessage: body.commit_message,
    files: fileMap,
  })

  logger.info('Pushed to GitHub', {
    projectId: project.id,
    repo: `${result.owner}/${result.repo}`,
    branch: result.branch,
    commitSha: result.commitSha,
    fileCount: Object.keys(fileMap).length,
  })

  res.json({
    owner: result.owner,
    repo: result.repo,
    branch: result.branch,
    commit_sha: result.commitSha,
    commit_url: result.commitUrl,
    tree_url: result.treeUrl,
    file_count: Object.keys(fileMap).length,
  })
})

export default router
