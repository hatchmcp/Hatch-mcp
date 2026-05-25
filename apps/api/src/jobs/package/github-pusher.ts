import { Octokit } from '@octokit/rest'
import { PermanentError } from '../runner.js'

export interface PushOptions {
  /** GitHub Personal Access Token (fine-grained PAT with Contents: Read & Write) */
  token: string
  /** Repo URL (https://github.com/<owner>/<name>) or owner/name */
  repo: string
  /** Branch to push to. Created if it doesn't exist. */
  branch: string
  /** Commit message */
  commitMessage: string
  /** path → file contents */
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
  const { token, branch, commitMessage, files } = opts
  const { owner, repo } = parseRepo(opts.repo)

  const octokit = new Octokit({ auth: token })

  // 1. Resolve the parent commit — branch head if it exists, else the repo's default branch head
  let parentSha: string | null = null
  try {
    const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
    parentSha = ref.data.object.sha
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status !== 404) throw asPermanent(err, owner, repo)
    // Branch doesn't exist — fall back to default branch
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
      if (s2 === 404) {
        // Empty repo with no commits — `parentSha = null` is the right thing
        // to pass to createCommit (parents: []).
        parentSha = null
      } else {
        throw asPermanent(err2, owner, repo)
      }
    }
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
