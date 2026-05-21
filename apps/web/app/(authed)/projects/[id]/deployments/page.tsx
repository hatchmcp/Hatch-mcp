'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Undo2, Rocket, ArrowRight, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { useProject } from '@/hooks/use-projects'
import { useDeployments, useRollback } from '@/hooks/use-deployments'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { Deployment, DeploymentStatus } from '@/types/api'

export default function DeploymentsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const { data, isLoading, isError, error } = useDeployments(projectId)
  const rollback = useRollback(projectId)

  const deployments = data?.deployments ?? []
  const active = useMemo(
    () => deployments.find((d) => d.status === 'active') ?? null,
    [deployments]
  )
  const previous = useMemo(
    () => deployments.filter((d) => d.status === 'rolled_back')[0] ?? null,
    [deployments]
  )

  function confirmRollback() {
    if (!previous) return
    toast(`Roll back v${active?.version_number} → v${previous.version_number}?`, {
      description: 'The runtime cache is invalidated immediately on the rollback.',
      action: {
        label: 'Roll back',
        onClick: () =>
          rollback.mutate(undefined, {
            onSuccess: () =>
              toast.success(`Rolled back to v${previous.version_number}`),
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : 'Rollback failed'),
          }),
      },
      duration: 6000,
    })
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Deployments'}
        description={
          active
            ? `Currently live · v${active.version_number} · ${timeAgo(active.deployed_at)}`
            : `${deployments.length} total`
        }
        actions={
          <>
            <Button asChild variant="secondary" size="md">
              <Link href={`/projects/${projectId}/deploy`}>
                <Rocket />
                Deploy
              </Link>
            </Button>
            {active && previous && (
              <Button
                size="md"
                variant="danger"
                onClick={confirmRollback}
                disabled={rollback.isPending}
              >
                <Undo2 />
                Roll back to v{previous.version_number}
              </Button>
            )}
          </>
        }
      />

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
          <p className="text-error font-medium mb-1">Could not load deployments</p>
          <p className="text-text-secondary">
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {!isLoading && !isError && deployments.length === 0 && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no deploys  │
└──────────────┘`}
          title="No deployments yet"
          description="Once you deploy your MCP config it'll appear here with version history and rollback."
          action={
            <Button asChild>
              <Link href={`/projects/${projectId}/deploy`}>
                Go to deploy
                <ArrowRight />
              </Link>
            </Button>
          }
        />
      )}

      {deployments.length > 0 && (
        <ol className="space-y-2">
          {deployments.map((d) => (
            <DeploymentRow key={d.id} deployment={d} />
          ))}
        </ol>
      )}
    </div>
  )
}

/* ─────────────────────────── Row ─────────────────────────── */

const statusTone: Record<DeploymentStatus, { dot: string; label: string; text: string }> = {
  active: { dot: 'bg-accent', label: 'CURRENT', text: 'text-accent' },
  rolled_back: { dot: 'bg-text-tertiary', label: 'ROLLED BACK', text: 'text-text-tertiary' },
  failed: { dot: 'bg-error', label: 'FAILED', text: 'text-error' },
  degraded: { dot: 'bg-warning', label: 'DEGRADED', text: 'text-warning' },
  pending: { dot: 'bg-warning', label: 'PENDING', text: 'text-warning' },
}

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const tone = statusTone[deployment.status]
  const isActive = deployment.status === 'active'

  return (
    <li
      className={cn(
        'relative border rounded-md bg-surface px-4 py-3.5 flex items-center gap-4 transition-colors',
        isActive ? 'border-accent/30' : 'border-border hover:border-border-strong'
      )}
    >
      {/* Left accent stripe for active */}
      {isActive && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent rounded-r"
          aria-hidden
        />
      )}

      {/* Version chip */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', tone.dot)} />
        <span className="font-mono text-sm text-text-primary tabular-nums">
          v{deployment.version_number}
        </span>
      </div>

      {/* Status */}
      <span
        className={cn(
          'text-[10px] font-mono uppercase tracking-wider',
          tone.text
        )}
      >
        {tone.label}
      </span>

      {/* Time */}
      <span
        className="font-mono text-[11px] text-text-tertiary tabular-nums"
        title={new Date(deployment.deployed_at).toLocaleString()}
      >
        {timeAgo(deployment.deployed_at)}
      </span>

      {/* Rolled-back-at */}
      {deployment.rolled_back_at && (
        <span className="font-mono text-[11px] text-text-quaternary">
          (rolled back {timeAgo(deployment.rolled_back_at)})
        </span>
      )}

      {/* Health */}
      {deployment.health_status && (
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider',
            deployment.health_status === 'healthy' && 'text-accent',
            deployment.health_status === 'degraded' && 'text-warning',
            deployment.health_status === 'unhealthy' && 'text-error'
          )}
        >
          <Activity className="size-3" />
          {deployment.health_status}
          {deployment.last_health_check && (
            <span className="text-text-quaternary normal-case tracking-normal ml-1">
              · checked {timeAgo(deployment.last_health_check)}
            </span>
          )}
        </span>
      )}
    </li>
  )
}
