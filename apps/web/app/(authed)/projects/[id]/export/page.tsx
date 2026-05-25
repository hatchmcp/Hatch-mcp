'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Download,
  Github,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Info,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/avatar'
import { useProject } from '@/hooks/use-projects'
import { useMcpServer } from '@/hooks/use-mcp-server'
import { downloadProjectZip, usePushToGitHub, type PushResult } from '@/hooks/use-export'
import {
  useGithubConnection,
  useStartGithubOAuth,
  useDisconnectGithub,
} from '@/hooks/use-github'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'

export default function ExportPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const { data: mcpServer, isLoading: mcpLoading } = useMcpServer(projectId)
  const config = mcpServer?.version.config
  const hasConfig = !!config

  // OAuth round-trip — GitHub bounces back to ?github_connected=<login> or
  // ?github_error=<reason>. Surface and strip the query so it doesn't linger.
  useEffect(() => {
    const connected = searchParams.get('github_connected')
    const error = searchParams.get('github_error')
    if (connected) {
      toast.success(`Connected as @${connected}`)
      router.replace(`/projects/${projectId}/export`)
    } else if (error) {
      toast.error(`GitHub connect failed: ${error.replace(/_/g, ' ')}`)
      router.replace(`/projects/${projectId}/export`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Export'}
        description={
          hasConfig
            ? `Take your generated MCP server — download as a zip or push to GitHub`
            : project?.source_url ?? undefined
        }
      />

      {mcpLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[280px] rounded-md" />
          <Skeleton className="h-[320px] rounded-md" />
        </div>
      )}

      {!mcpLoading && !hasConfig && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no config   │
└──────────────┘`}
          title="Generate the MCP config first"
          description="Export packages the generated tools as a standalone Node project. Head to Tools, pick an auth type, and generate."
          action={
            <Button asChild>
              <Link href={`/projects/${projectId}/tools`}>
                Go to tools
                <ArrowRight />
              </Link>
            </Button>
          }
        />
      )}

      {hasConfig && (
        <>
          {/* Summary strip */}
          <div className="border border-border rounded-md bg-surface px-5 py-3 mb-5 grid grid-cols-[1fr_auto_auto] gap-6 items-center">
            <div className="min-w-0">
              <p className="font-mono text-sm text-text-primary truncate">
                {config!.server_name}
              </p>
              <p className="text-[11px] text-text-tertiary truncate">
                v{mcpServer!.version.version_number}
              </p>
            </div>
            <Stat label="Tools" value={String(config!.tools.length)} />
            <Stat label="Auth" value={config!.auth_config.type} mono />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DownloadCard projectId={projectId} filename={`${project?.slug ?? 'mcp-server'}.zip`} />
            <GithubPushCard projectId={projectId} />
          </div>

          {/* What's in the zip */}
          <section className="mt-6">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1">
              What you get
            </h3>
            <ul className="border border-border rounded-md bg-surface divide-y divide-border text-xs font-mono">
              <FileRow path="package.json" note="@modelcontextprotocol/sdk + axios + dotenv" />
              <FileRow path="tsconfig.json" note="strict, ESM, target ES2022" />
              <FileRow path="README.md" note="setup + Claude Desktop config snippet" />
              <FileRow path=".env.example" note="BASE_URL + secrets the user must provide" />
              <FileRow path="src/index.ts" note="MCP server bootstrapping (stdio transport)" />
              <FileRow path="src/tools.ts" note={`${config!.tools.length} tool definitions + handlers`} />
              <FileRow path="src/lib/http.ts" note={`fetch wrapper, ${config!.auth_config.type} auth injection`} />
              <FileRow path="claude_desktop_config.json.example" note="paste-ready Claude config" />
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────── Download card ─────────────────────────── */

function DownloadCard({ projectId, filename }: { projectId: string; filename: string }) {
  const [downloading, setDownloading] = useState(false)
  const [lastDownloadedAt, setLastDownloadedAt] = useState<number | null>(null)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadProjectZip(projectId, filename)
      setLastDownloadedAt(Date.now())
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden flex flex-col">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center gap-2">
        <Download className="size-3.5 text-text-tertiary" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Download as ZIP
        </span>
      </header>

      <div className="px-5 py-5 flex-1 flex flex-col">
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          Grab a self-contained Node project. Extract, <span className="font-mono text-text-primary">npm install</span>, then point Claude Desktop at <span className="font-mono text-text-primary">dist/index.js</span>.
        </p>

        <div className="border border-border bg-bg rounded-sm px-3 py-2.5 mb-5 font-mono text-xs text-text-tertiary space-y-0.5">
          <div>$ unzip {filename}</div>
          <div>$ cd {filename.replace(/\.zip$/, '')}</div>
          <div>$ npm install && npm run build</div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-[11px] font-mono text-text-tertiary">
            {lastDownloadedAt
              ? `last downloaded ${new Date(lastDownloadedAt).toLocaleTimeString()}`
              : 'no downloads yet'}
          </span>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Download />
                Download .zip
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── GitHub push card ─────────────────────────── */

function GithubPushCard({ projectId }: { projectId: string }) {
  const push = usePushToGitHub(projectId)
  const { data: connection, isLoading: connLoading } = useGithubConnection()
  const startOAuth = useStartGithubOAuth()
  const disconnect = useDisconnectGithub()

  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [commitMessage, setCommitMessage] = useState('Initial commit from Hatch')
  const [result, setResult] = useState<PushResult | null>(null)

  const isConnected = connection?.connected === true
  const isConfigured = connection?.configured === true

  async function handleConnect() {
    try {
      await startOAuth.mutateAsync(`/projects/${projectId}/export`)
      // mutation navigates the window; never reaches here
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start GitHub OAuth')
    }
  }

  function confirmDisconnect() {
    toast('Disconnect GitHub?', {
      description: `Sign out of @${connection?.github_login} on this Hatch account. You can reconnect at any time.`,
      action: {
        label: 'Disconnect',
        onClick: () =>
          disconnect.mutate(undefined, {
            onSuccess: () => toast.success('Disconnected'),
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : 'Could not disconnect'),
          }),
      },
      duration: 6000,
    })
  }

  async function handlePush(e: React.FormEvent) {
    e.preventDefault()
    if (!isConnected) return

    const trimmedRepo = repo.trim()
    if (!trimmedRepo) {
      toast.error('Enter a repo (owner/name or full URL)')
      return
    }

    try {
      const res = await push.mutateAsync({
        repo: trimmedRepo,
        branch: branch.trim() || 'main',
        commit_message: commitMessage.trim() || 'Initial commit from Hatch',
      })
      setResult(res)
      toast.success(`Pushed to ${res.owner}/${res.repo}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Push failed')
    }
  }

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden flex flex-col">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center gap-2">
        <Github className="size-3.5 text-text-tertiary" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Push to GitHub
        </span>
      </header>

      {/* Loading the connection status */}
      {connLoading && (
        <div className="px-5 py-5 flex-1 flex items-center justify-center">
          <Loader2 className="size-4 text-text-tertiary animate-spin" />
        </div>
      )}

      {/* OAuth isn't configured on the server */}
      {!connLoading && !isConfigured && (
        <div className="px-5 py-5 flex-1 flex flex-col">
          <div className="border border-warning/20 bg-warning/5 rounded-sm px-3 py-2.5 text-xs text-text-secondary leading-relaxed">
            <p className="text-text-primary font-medium mb-1">GitHub OAuth not configured</p>
            <p>
              The Hatch admin needs to register a GitHub OAuth App and set{' '}
              <span className="font-mono">GITHUB_OAUTH_CLIENT_ID</span> and{' '}
              <span className="font-mono">GITHUB_OAUTH_CLIENT_SECRET</span> in the API env.
              Until then, download the zip and push it manually.
            </p>
          </div>
        </div>
      )}

      {/* OAuth configured but user not connected */}
      {!connLoading && isConfigured && !isConnected && (
        <div className="px-5 py-5 flex-1 flex flex-col">
          <p className="text-sm text-text-secondary leading-relaxed mb-5">
            Connect GitHub once and Hatch can push directly to any repo you have write access
            to. Standard GitHub OAuth — no PATs to manage. You can disconnect at any time.
          </p>

          <ul className="border border-border bg-bg rounded-sm divide-y divide-border text-xs text-text-secondary mb-5">
            <CheckItem>One click — uses your real GitHub identity</CheckItem>
            <CheckItem>Token stored encrypted, revocable from GitHub Settings</CheckItem>
            <CheckItem>
              Scope: <span className="font-mono">repo</span> · needed to write code to your repos
            </CheckItem>
          </ul>

          <div className="mt-auto flex justify-end">
            <Button onClick={handleConnect} disabled={startOAuth.isPending}>
              {startOAuth.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Redirecting…
                </>
              ) : (
                <>
                  <Github />
                  Connect GitHub
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Connected — show the push form */}
      {!connLoading && isConnected && (
        <>
          <div className="px-5 py-3 border-b border-border bg-bg flex items-center gap-3">
            <Avatar seed={connection!.github_login ?? 'github'} size={26} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">
                @{connection!.github_login}
              </p>
              <p className="text-[11px] font-mono text-text-tertiary">
                connected · scope {connection!.scopes ?? 'repo'}
              </p>
            </div>
            <button
              type="button"
              onClick={confirmDisconnect}
              disabled={disconnect.isPending}
              className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="size-3" />
              Disconnect
            </button>
          </div>

          <form onSubmit={handlePush} className="px-5 py-5 space-y-3.5 flex-1 flex flex-col">
            <Field label="Repository" hint="owner/name or full URL — repo must already exist">
              <Input
                type="text"
                placeholder={`${connection!.github_login}/my-mcp-server`}
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="font-mono text-xs"
                disabled={push.isPending}
                autoComplete="off"
              />
            </Field>

            <div className="grid grid-cols-[1fr_1.6fr] gap-3">
              <Field label="Branch">
                <Input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="font-mono text-xs"
                  disabled={push.isPending}
                  autoComplete="off"
                />
              </Field>
              <Field label="Commit message">
                <Input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="text-xs"
                  disabled={push.isPending}
                />
              </Field>
            </div>

            <div className="mt-auto pt-2 flex items-center justify-end">
              <Button type="submit" disabled={push.isPending || !repo.trim()}>
                {push.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Pushing…
                  </>
                ) : (
                  <>
                    <Github />
                    Push to GitHub
                  </>
                )}
              </Button>
            </div>
          </form>

          {result && (
            <div className="px-5 py-3 border-t border-accent/20 bg-accent/5 flex items-center gap-2.5">
              <CheckCircle2 className="size-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-primary">
                  Pushed {result.file_count} files to{' '}
                  <span className="font-mono">
                    {result.owner}/{result.repo}
                  </span>{' '}
                  · branch <span className="font-mono">{result.branch}</span>
                </p>
              </div>
              <a
                href={result.tree_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:text-accent-deep transition-colors"
              >
                View
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ─────────────────────────── Bits ─────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1.5 block">{label}</label>
      {children}
      {hint && (
        <p className="text-[11px] text-text-tertiary mt-1.5 flex items-start gap-1.5">
          <Info className="size-3 shrink-0 mt-px" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  )
}

function FileRow({ path, note }: { path: string; note: string }) {
  return (
    <li className="grid grid-cols-[220px_1fr] gap-4 items-center px-4 py-2">
      <span className="text-text-primary truncate">{path}</span>
      <span className="text-text-tertiary truncate">{note}</span>
    </li>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 px-3 py-2">
      <CheckCircle2 className="size-3 text-accent shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </p>
      <p className={cn('text-sm tabular-nums text-text-primary', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  )
}
