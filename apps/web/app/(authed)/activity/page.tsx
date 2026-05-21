'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Activity as ActivityIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useProjects } from '@/hooks/use-projects'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Job, JobType, JobStatus, Project } from '@/types/api'

const JOB_VERB: Record<JobType, string> = {
  ingest: 'Ingested',
  extract: 'Extracted endpoints',
  generate: 'Generated MCP tools',
  test: 'Ran tests',
  deploy: 'Deployed',
  full_pipeline: 'Ran full pipeline',
}

const JOB_TONE: Record<JobType, string> = {
  ingest: 'text-method-get',
  extract: 'text-method-get',
  generate: 'text-accent',
  test: 'text-method-patch',
  deploy: 'text-accent',
  full_pipeline: 'text-text-secondary',
}

function pageForJob(type: JobType, projectId: string): string {
  switch (type) {
    case 'ingest':
    case 'extract':
      return `/projects/${projectId}/endpoints`
    case 'generate':
      return `/projects/${projectId}/tools`
    case 'test':
      return `/projects/${projectId}/tests`
    case 'deploy':
      return `/projects/${projectId}/deploy`
    default:
      return `/projects/${projectId}/endpoints`
  }
}

type JobWithProject = Job & { project: Project }

export default function ActivityPage() {
  const { data: projectsData, isLoading: projectsLoading } = useProjects()
  const projects = useMemo(() => projectsData?.projects ?? [], [projectsData])

  // Parallel-fetch jobs for every project — TanStack Query dedupes + caches
  const jobsQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ['jobs', p.id],
      queryFn: () => api.get<{ jobs: Job[] }>(`/jobs/projects/${p.id}/jobs`),
      staleTime: 20_000,
    })),
  })

  const allLoading = projectsLoading || jobsQueries.some((q) => q.isLoading)

  const events = useMemo<JobWithProject[]>(() => {
    const flat: JobWithProject[] = []
    projects.forEach((p, i) => {
      const jobs = jobsQueries[i]?.data?.jobs ?? []
      for (const j of jobs) flat.push({ ...j, project: p })
    })
    flat.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    return flat.slice(0, 50)
  }, [projects, jobsQueries.map((q) => q.dataUpdatedAt).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <PageHeader
        title="Activity"
        description="Recent jobs across the workspace"
      />

      {allLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      )}

      {!allLoading && events.length === 0 && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no events   │
└──────────────┘`}
          title="No activity yet"
          description="Once you start ingesting, generating, testing, or deploying, the last 50 events across all your projects will show up here."
        />
      )}

      {events.length > 0 && (
        <ol className="space-y-1.5">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ol>
      )}
    </div>
  )
}

/* ─────────────────────────── Event row ─────────────────────────── */

function EventRow({ event }: { event: JobWithProject }) {
  const verb = JOB_VERB[event.type] ?? event.type
  const tone = JOB_TONE[event.type] ?? 'text-text-secondary'
  const href = pageForJob(event.type, event.project.id)

  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 border border-border rounded-sm bg-surface',
          'hover:bg-surface-2 hover:border-border-strong transition-colors group'
        )}
      >
        <StatusIcon status={event.status} />

        <span className={cn('text-xs font-mono uppercase tracking-wider shrink-0', tone)}>
          {verb}
        </span>

        <span className="text-sm text-text-primary truncate flex-1">
          {event.project.name}
        </span>

        <span
          className="font-mono text-[11px] text-text-tertiary tabular-nums whitespace-nowrap"
          title={new Date(event.created_at).toLocaleString()}
        >
          {timeAgo(event.created_at)}
        </span>

        <ChevronRight className="size-3 text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </li>
  )
}

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className="size-3.5 text-accent shrink-0" />
    case 'failed':
      return <XCircle className="size-3.5 text-error shrink-0" />
    case 'running':
    case 'queued':
      return <Loader2 className="size-3.5 text-warning shrink-0 animate-spin" />
    default:
      return <ActivityIcon className="size-3.5 text-text-tertiary shrink-0" />
  }
}
