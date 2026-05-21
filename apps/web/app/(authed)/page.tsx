'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, MoreHorizontal, Search, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useProjects, useDeleteProject } from '@/hooks/use-projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { StatusDot } from '@/components/status-dot'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { timeAgo } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Project, SourceType } from '@/types/api'

const sourceLabels: Record<SourceType, string> = {
  github: 'GitHub',
  openapi: 'OpenAPI',
  postman: 'Postman',
  docs: 'Docs',
  paste: 'Paste',
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useProjects()
  const [search, setSearch] = useState('')

  const projects = data?.projects ?? []
  const filtered = search
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase())
      )
    : projects

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight mb-0.5">Projects</h1>
          <p className="text-xs text-text-tertiary font-mono">
            {isLoading ? '—' : `${projects.length} total`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
            <Input
              type="search"
              placeholder="Filter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 w-[220px] text-xs"
              disabled={isLoading || projects.length === 0}
            />
          </div>
          <Button asChild size="md">
            <Link href="/new">
              <Plus />
              New project
            </Link>
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading && <ProjectListSkeleton />}

      {isError && (
        <ErrorBox
          message={
            error instanceof ApiError
              ? error.message
              : 'Could not load projects. Is the API running?'
          }
        />
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          bracketArt={`┌──────────────┐
│   <API/>     │
└──────────────┘`}
          title="No projects yet"
          description="Connect a GitHub repo, OpenAPI spec, or Postman collection to generate your first MCP server."
          action={
            <Button asChild>
              <Link href="/new">
                <Plus />
                Connect your first API
              </Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && projects.length > 0 && filtered.length === 0 && (
        <div className="border border-border rounded-md bg-surface py-12 text-center">
          <p className="text-sm text-text-secondary">
            No projects match{' '}
            <span className="font-mono text-text-primary">&quot;{search}&quot;</span>
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="border border-border rounded-md bg-surface overflow-hidden">
          {filtered.map((project, i) => (
            <ProjectRow
              key={project.id}
              project={project}
              isLast={i === filtered.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project, isLast }: { project: Project; isLast: boolean }) {
  const deleteProject = useDeleteProject()

  function confirmDelete() {
    toast(`Delete ${project.name}?`, {
      description: 'This permanently removes the project and all its endpoints.',
      action: {
        label: 'Delete',
        onClick: () =>
          deleteProject.mutate(project.id, {
            onSuccess: () => toast.success(`Deleted ${project.name}`),
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : 'Delete failed'),
          }),
      },
      duration: 6000,
    })
  }

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3.5 transition-colors group',
        !isLast && 'border-b border-border',
        'hover:bg-surface-2'
      )}
    >
      {/* Status dot — neutral for now; later: deployed=success, draft=muted, etc. */}
      <StatusDot tone="muted" />

      {/* Name + meta */}
      <Link href={`/projects/${project.id}/endpoints`} className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-sm font-medium text-text-primary truncate">
            {project.name}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-px border border-border rounded-[3px] text-text-tertiary">
            {sourceLabels[project.source_type]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          {project.source_url && (
            <span className="font-mono truncate max-w-[420px]">
              {project.source_url.replace(/^https?:\/\//, '')}
            </span>
          )}
          {project.description && !project.source_url && (
            <span className="truncate">{project.description}</span>
          )}
        </div>
      </Link>

      {/* Time */}
      <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">
        {timeAgo(project.created_at)}
      </span>

      {/* Context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-7 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label="Project actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/projects/${project.id}/endpoints`}>
              <ExternalLink className="size-3.5" />
              Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={confirmDelete} danger>
            <Trash2 className="size-3.5" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ProjectListSkeleton() {
  return (
    <div className="border border-border rounded-md bg-surface overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3.5',
            i < 2 && 'border-b border-border'
          )}
        >
          <Skeleton className="w-1.5 h-1.5 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
      <p className="text-error font-medium mb-1">Failed to load projects</p>
      <p className="text-text-secondary">{message}</p>
    </div>
  )
}
