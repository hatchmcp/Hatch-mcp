'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Rocket,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  History,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { JobBanner } from '@/components/job-banner'
import { EmptyState } from '@/components/empty-state'
import { SecretInput } from '@/components/secret-input'
import { InstallSnippet } from '@/components/install-snippet'
import { KeyRevealCard } from '@/components/key-reveal-card'
import { HostedRuntimeNotice } from '@/components/hosted-runtime-notice'
import { useProject } from '@/hooks/use-projects'
import { useMcpServer, mcpServerKey } from '@/hooks/use-mcp-server'
import { useDeployments, useDeploy, deploymentsKey } from '@/hooks/use-deployments'
import { useJobStream } from '@/hooks/use-job-stream'
import { useJobRail } from '@/components/job-rail-context'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { DeployJobResult } from '@/types/api'

const MCP_DOMAIN = process.env.NEXT_PUBLIC_MCP_DOMAIN ?? 'mcp.hatch.dev'

const AUTH_LABELS: Record<string, string> = {
  bearer: 'Bearer token',
  api_key_header: 'API key (header)',
  api_key_query: 'API key (query)',
  basic: 'HTTP Basic',
  oauth2_client_credentials: 'OAuth2 client credentials',
  none: 'No auth',
}

export default function DeployPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const jobId = searchParams.get('job')

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const { data: mcpServer, isLoading: mcpLoading } = useMcpServer(projectId)
  const { data: deploymentsData } = useDeployments(projectId)
  const deployments = deploymentsData?.deployments ?? []
  const activeDeployment = deployments.find((d) => d.status === 'active') ?? null

  const deploy = useDeploy(projectId)
  const jobRail = useJobRail()

  const config = mcpServer?.version.config
  const requiredSecrets = config?.auth_config.user_must_provide ?? []

  const [secrets, setSecrets] = useState<Record<string, string>>({})

  // One-time runtime-key plaintext (only set after the deploy job's `done`
  // event includes one — i.e. the very first deploy minted a key). Stays in
  // local state until the user dismisses it; never goes to sessionStorage.
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  // Reset secrets when the required-keys list changes
  useEffect(() => {
    setSecrets((prev) => {
      const next: Record<string, string> = {}
      for (const k of requiredSecrets) next[k] = prev[k] ?? ''
      return next
    })
  }, [requiredSecrets.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const jobState = useJobStream(jobId, {
    onDone: (result) => {
      qc.invalidateQueries({ queryKey: deploymentsKey(projectId) })
      qc.invalidateQueries({ queryKey: mcpServerKey(projectId) })
      // Wipe entered secrets after a successful deploy — they're sensitive
      setSecrets((prev) => {
        const blank: Record<string, string> = {}
        for (const k of Object.keys(prev)) blank[k] = ''
        return blank
      })

      // First deploy mints the runtime auth key. Surface it once.
      const deployResult = result as DeployJobResult | undefined
      if (deployResult?.runtime_key) setRevealedKey(deployResult.runtime_key)
    },
  })

  async function handleDeploy() {
    // Only send non-empty secret values — empty fields mean "keep what's already stored"
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(secrets)) {
      if (v.trim()) payload[k] = v
    }

    // First deploy MUST receive all required secrets
    if (!activeDeployment && requiredSecrets.length > 0) {
      const missing = requiredSecrets.filter((k) => !payload[k])
      if (missing.length > 0) {
        toast.error(`Missing: ${missing.join(', ')}`)
        return
      }
    }

    try {
      const { job_id } = await deploy.mutateAsync(payload)
      jobRail.start(job_id, {
        label: activeDeployment ? `Redeploying v${nextVersion}` : `Deploying v${nextVersion}`,
        kind: 'deploy',
      })
      router.replace(`/projects/${projectId}/deploy?job=${job_id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Deploy failed')
    }
  }

  const running =
    !!jobId &&
    (jobState.status === 'running' ||
      jobState.status === 'queued' ||
      jobState.status === 'pending')
  const nextVersion = (mcpServer?.version.version_number ?? 0) + 1

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Deploy'}
        description={
          activeDeployment
            ? `Live · v${activeDeployment.version_number} · deployed ${timeAgo(activeDeployment.deployed_at)}`
            : 'Ship the MCP server'
        }
        actions={
          deployments.length > 0 ? (
            <Button asChild variant="secondary" size="md">
              <Link href={`/projects/${projectId}/deployments`}>
                <History />
                Deployments
              </Link>
            </Button>
          ) : null
        }
      />

      <HostedRuntimeNotice projectId={projectId} />

      {jobId && (
        <JobBanner
          state={jobState}
          jobId={jobId}
          label={activeDeployment ? `Redeploying v${nextVersion}` : `Deploying v${nextVersion}`}
          onDismiss={() => router.replace(`/projects/${projectId}/deploy`)}
        />
      )}

      {/* Loading skeleton */}
      {mcpLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      )}

      {/* No config yet */}
      {!mcpLoading && !mcpServer && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no config   │
└──────────────┘`}
          title="Generate the MCP config first"
          description="The deploy step needs a generated config. Head to Tools to create one."
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

      {/* Reveal-once card for the newly-minted runtime key (first deploy only) */}
      {revealedKey && (
        <div className="mb-5">
          <KeyRevealCard
            title="New runtime key — save it now"
            description="Paste this into your MCP client config. Hatch only stores its hash — you cannot retrieve it later. To get a new one, rotate from Project Settings."
            plaintext={revealedKey}
            onDismiss={() => setRevealedKey(null)}
          />
        </div>
      )}

      {/* Active install snippet (when there's a live deployment and we're not mid-deploy) */}
      {mcpServer && activeDeployment && !running && (
        <div className="mb-6">
          <InstallSnippet
            serverName={config!.server_name}
            subdomain={mcpServer.mcp_server.subdomain}
            domain={MCP_DOMAIN}
            runtimeKey={revealedKey ?? undefined}
            runtimeKeyHint={mcpServer.mcp_server.runtime_key_hint}
          />
        </div>
      )}

      {/* Pre-deploy / re-deploy panel */}
      {mcpServer && config && (
        <div className="border border-border rounded-md bg-surface overflow-hidden">
          {/* Header strip */}
          <div className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              {activeDeployment ? 'Redeploy current config' : 'Pre-deploy checklist'}
            </span>
            <span className="font-mono text-[11px] text-text-tertiary">
              {activeDeployment ? `v${activeDeployment.version_number} → v${nextVersion}` : `v${nextVersion}`}
            </span>
          </div>

          {/* Checklist */}
          <dl className="divide-y divide-border">
            <ChecklistRow
              label="Subdomain"
              tone={activeDeployment ? 'success' : 'success'}
              statusText={activeDeployment ? 'live' : 'available'}
            >
              <span className="font-mono">
                {mcpServer.mcp_server.subdomain}.{MCP_DOMAIN}
              </span>
            </ChecklistRow>

            <ChecklistRow label="Auth" tone="success" statusText="ready">
              <span className="font-mono">{AUTH_LABELS[config.auth_config.type] ?? config.auth_config.type}</span>
            </ChecklistRow>

            <ChecklistRow label="Tools" tone="muted">
              <span className="font-mono">{config.tools.length}</span>
            </ChecklistRow>

            <ChecklistRow label="Base URL" tone="muted">
              <span className="font-mono text-text-secondary truncate">{config.env.BASE_URL}</span>
            </ChecklistRow>
          </dl>

          {/* Secrets */}
          {requiredSecrets.length > 0 && (
            <div className="border-t border-border px-5 py-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Secrets
                </h3>
                {activeDeployment && (
                  <span className="text-[11px] text-text-tertiary">
                    Leave blank to keep what&apos;s already stored
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {requiredSecrets.map((key) => (
                  <div key={key}>
                    <label className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-1.5 block">
                      {key}
                    </label>
                    <SecretInput
                      placeholder={activeDeployment ? '••••••' : 'Paste value'}
                      value={secrets[key] ?? ''}
                      onChange={(e) =>
                        setSecrets((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer action */}
          <div className="border-t border-border px-5 py-4 flex items-center justify-between">
            <p className="text-[11px] text-text-tertiary">
              {activeDeployment
                ? `Redeploying will create v${nextVersion} and mark v${activeDeployment.version_number} rolled back.`
                : `Deploys atomically — invalidates the runtime cache once the DB transaction commits.`}
            </p>
            <Button onClick={handleDeploy} disabled={running || deploy.isPending}>
              {running || deploy.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deploying
                </>
              ) : (
                <>
                  <Rocket />
                  {activeDeployment ? `Redeploy v${nextVersion}` : `Deploy v${nextVersion}`}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Checklist row ─────────────────────────── */

function ChecklistRow({
  label,
  tone,
  statusText,
  children,
}: {
  label: string
  tone: 'success' | 'warning' | 'error' | 'muted'
  statusText?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr_auto] gap-4 items-center px-5 py-3">
      <dt className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="text-sm text-text-primary truncate min-w-0">{children}</dd>
      {statusText && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider',
            tone === 'success' && 'text-accent',
            tone === 'warning' && 'text-warning',
            tone === 'error' && 'text-error',
            tone === 'muted' && 'text-text-tertiary'
          )}
        >
          {tone === 'success' && <CheckCircle2 className="size-3" />}
          {tone === 'warning' && <AlertCircle className="size-3" />}
          {tone === 'error' && <AlertCircle className="size-3" />}
          {statusText}
        </span>
      )}
    </div>
  )
}
