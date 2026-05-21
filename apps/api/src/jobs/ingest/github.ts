import { Octokit } from '@octokit/rest'
import * as tar from 'tar'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { scoreFile } from './file-scorer.js'
import type { ScoredFile } from './file-scorer.js'
import { PermanentError } from '../runner.js'
import { config } from '../../config.js'

const MAX_COMPRESSED_BYTES = 100 * 1024 * 1024 // 100 MB (GitHub's tarball cap)

// Text file extensions to read — binary files are skipped
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.java', '.php', '.rs',
  '.json', '.yaml', '.yml', '.toml',
])

export interface GitHubSource {
  owner: string
  repo: string
  ref?: string
}

// Parses a GitHub URL like https://github.com/owner/repo[/tree/ref]
export function parseGitHubUrl(url: string): GitHubSource {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?(?:\.git)?(?:\/.*)?$/)
  if (!match) throw new PermanentError(`Not a valid GitHub URL: ${url}`)
  return { owner: match[1], repo: match[2], ref: match[3] ?? 'HEAD' }
}

export async function fetchAndScoreRepo(source: GitHubSource): Promise<ScoredFile[]> {
  if (!config.GITHUB_APP_PRIVATE_KEY) {
    throw new PermanentError('GitHub integration not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.')
  }

  const octokit = new Octokit({ auth: config.GITHUB_APP_PRIVATE_KEY })

  let tarballData: Buffer
  try {
    const { data } = await octokit.repos.downloadTarballArchive({
      owner: source.owner,
      repo: source.repo,
      ref: source.ref ?? 'HEAD',
    }) as { data: ArrayBuffer }

    tarballData = Buffer.from(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e.status === 404) throw new PermanentError(`Repository ${source.owner}/${source.repo} not found or is private.`)
    if (e.status === 403) throw new PermanentError(`No access to ${source.owner}/${source.repo}. Install the GitHub App first.`)
    throw err
  }

  if (tarballData.length > MAX_COMPRESSED_BYTES) {
    throw new PermanentError(
      `Repository tarball exceeds 100 MB. For large monorepos, specify a subpath in the URL.`
    )
  }

  const tmpDir = path.join(os.tmpdir(), `hatch-${source.owner}-${source.repo}-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    await pipeline(
      Readable.from(tarballData),
      tar.x({ cwd: tmpDir, strip: 1 })
    )

    return await collectScoredFiles(tmpDir)
  } finally {
    // Best-effort cleanup — don't block on errors
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function collectScoredFiles(dir: string): Promise<ScoredFile[]> {
  const results: ScoredFile[] = []
  await walkDir(dir, dir, results)
  return results
}

async function walkDir(root: string, current: string, results: ScoredFile[]): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true })

  for (const entry of entries) {
    const full = path.join(current, entry.name)
    const relative = path.relative(root, full).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      // Skip hidden dirs and common non-source dirs
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', '__pycache__', '.git'].includes(entry.name)) {
        continue
      }
      await walkDir(root, full, results)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!TEXT_EXTENSIONS.has(ext)) continue

      try {
        const content = await fs.readFile(full, 'utf8')
        const score = scoreFile(relative, content)
        if (score > 0) results.push({ filePath: relative, content, score })
      } catch {
        // Binary or unreadable file — skip silently
      }
    }
  }
}
