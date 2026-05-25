import { Octokit } from '@octokit/rest'
import { PermanentError } from '../runner.js'

export interface PushOptions {
  /** OAuth access token (or fine-grained PAT) with `repo` scope */
  token: string
  /** Repo URL (https://github.com/<owner>/<name>) or owner/name */
  repo: string
  /** Branch to push to. Created if it doesn't exist. */
  branch: string
  /** Commit message */
  commitMessage: string
  /** Optional subfolder to nest all generated files inside (e.g. "mcp"). */
  subfolder?: string
  /** path → file contents (paths are relative to subfolder if set) */
  files: Record<string, string>
}

export interface PushResult {
  owner: string
  repo: string
  branch: string
  commitSha: string
  commitUrl: string
  treeUrl: string
}

/**
 * Push a file map to a GitHub repo as a single commit. Uses the Git Data
 * API (blob → tree → commit → ref) so 50+ files become one commit with
 * one round trip per blob.
 *
 * The repo must already exist. We don't create it for them — that keeps
 * the required PAT scope small (no "Administration" permission needed).
 */
export async function pushToGitHub(opts: PushOptions): Promise<PushResult> {
  const { token, branch, commitMessage } = opts
  const { owner, repo } = parseRepo(opts.repo)

  const octokit = new Octokit({ auth: token })

  // Apply subfolder prefix to every file path. Strip leading/trailing slashes
  // so "mcp", "/mcp", "mcp/" all behave the same.
  const cleanSubfolder = opts.subfolder?.replace(/^\/+|\/+$/g, '') ?? ''
  const prefix = cleanSubfolder ? `${cleanSubfolder}/` : ''
  const files: Record<string, string> = {}
  for (const [path, content] of Object.entries(opts.files)) {
    files[`${prefix}${path}`] = content
  }

  // 1. Resolve the parent commit — branch head if it exists, else the repo's default branch head
  //
  // Status codes we treat as "no parent yet":
  //   404 → branch doesn't exist (but the repo might still have other branches)
  //   409 → "Git Repository is empty" — repo has zero commits at all
  // Everything else is a real error (auth, repo missing, network).
  let parentSha: string | null = null
  try {
    const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
    parentSha = ref.data.object.sha
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status !== 404 && status !== 409) throw asPermanent(err, owner, repo)
    // Try the repo's default branch HEAD; if that also 404/409s, the repo
    // really is empty and we'll write a root commit.
    try {
      const repoInfo = await octokit.repos.get({ owner, repo })
      const defaultBranch = repoInfo.data.default_branch
      const defaultRef = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
      })
      parentSha = defaultRef.data.object.sha
    } catch (err2: unknown) {
      const s2 = (err2 as { status?: number }).status
      if (s2 === 404 || s2 === 409) {
        // Empty repo with no commits — `parentSha = null` is the right thing
        // to pass to createCommit (parents: []) which writes a root commit.
        parentSha = null
      } else {
        throw asPermanent(err2, owner, repo)
      }
    }
  }

  // Empty-repo special case: the Git Data API (blobs/trees/commits) returns
  // 409 "Git Repository is empty" until the repo has been initialized with at
  // least one commit. The Contents API is the only way to write that first
  // file — it auto-initializes the repo and creates the branch. So for empty
  // repos we use Contents API end to end (one PUT per file = one commit per
  // file). Slower than the Git Data path but the only path that works.
  if (parentSha === null) {
    return await pushViaContentsApi({
      octokit,
      owner,
      repo,
      branch,
      commitMessage,
      files,
    })
  }

  // 2. Create a blob for each file. Each call returns a SHA we use in the tree.
  const tree: Array<{
    path: string
    mode: '100644'
    type: 'blob'
    sha: string
  }> = []

  for (const [path, content] of Object.entries(files)) {
    try {
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(content, 'utf8').toString('base64'),
        encoding: 'base64',
      })
      tree.push({ path, mode: '100644', type: 'blob', sha: blob.data.sha })
    } catch (err) {
      throw asPermanent(err, owner, repo, `creating blob for ${path}`)
    }
  }

  // 3. Create a tree off the parent (so existing repo files survive — we
  //    only override the paths we generated)
  let treeSha: string
  try {
    const treeRes = await octokit.git.createTree({
      owner,
      repo,
      tree,
      ...(parentSha ? { base_tree: parentSha } : {}),
    })
    treeSha = treeRes.data.sha
  } catch (err) {
    throw asPermanent(err, owner, repo, 'creating tree')
  }

  // 4. Create the commit
  let commitSha: string
  try {
    const commitRes = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: treeSha,
      parents: parentSha ? [parentSha] : [],
    })
    commitSha = commitRes.data.sha
  } catch (err) {
    throw asPermanent(err, owner, repo, 'creating commit')
  }

  // 5. Update or create the branch ref to point at the new commit
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commitSha,
      force: false,
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404 || status === 422) {
      // Ref doesn't exist yet — create it
      try {
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: commitSha,
        })
      } catch (err2) {
        throw asPermanent(err2, owner, repo, `creating branch ${branch}`)
      }
    } else {
      throw asPermanent(err, owner, repo, `updating branch ${branch}`)
    }
  }

  return {
    owner,
    repo,
    branch,
    commitSha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
    treeUrl: `https://github.com/${owner}/${repo}/tree/${branch}`,
  }
}

async function pushViaContentsApi(args: {
  octokit: Octokit
  owner: string
  repo: string
  branch: string
  commitMessage: string
  files: Record<string, string>
}): Promise<PushResult> {
  const { octokit, owner, repo, branch, commitMessage, files } = args
  const entries = Object.entries(files)

  let lastCommitSha = ''
  let i = 0
  for (const [path, content] of entries) {
    i++
    const message =
      entries.length === 1
        ? commitMessage
        : `${commitMessage} (${i}/${entries.length}: ${path})`
    try {
      const res = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
      })
      lastCommitSha = res.data.commit?.sha ?? lastCommitSha
    } catch (err) {
      throw asPermanent(err, owner, repo, `creating ${path}`)
    }
  }

  return {
    owner,
    repo,
    branch,
    commitSha: lastCommitSha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${lastCommitSha}`,
    treeUrl: `https://github.com/${owner}/${repo}/tree/${branch}`,
  }
}

function parseRepo(input: string): { owner: string; repo: string } {
  const trimmed = input.trim().replace(/\.git$/, '')
  // Accepts: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const match = trimmed.match(/(?:github\.com[/:])?([^/\s]+)\/([^/\s]+)$/i)
  if (!match) {
    throw new PermanentError(
      `Invalid repo: "${input}". Expected "owner/name" or "https://github.com/owner/name".`
    )
  }
  return { owner: match[1], repo: match[2] }
}

function asPermanent(
  err: unknown,
  owner: string,
  repo: string,
  context?: string
): PermanentError {
  const status = (err as { status?: number }).status
  const ghMessage =
    (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
    (err as { message?: string }).message ??
    'GitHub API error'
  const where = context ? ` (while ${context})` : ''

  if (status === 404) return new PermanentError(`Repo ${owner}/${repo} not found, or your GitHub account doesn't have access${where}`)
  if (status === 401) return new PermanentError(`GitHub auth failed — try Disconnect + Connect again${where}`)
  if (status === 403) return new PermanentError(`Permission denied writing to ${owner}/${repo}. Make sure you have write access${where}`)
  if (status === 422) return new PermanentError(`GitHub rejected the request: ${ghMessage}${where}`)
  if (status != null) return new PermanentError(`GitHub HTTP ${status}: ${ghMessage}${where}`)
  return new PermanentError(`GitHub API: ${ghMessage}${where}`)
}
