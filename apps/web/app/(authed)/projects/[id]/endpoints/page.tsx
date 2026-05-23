'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Filter,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/page-header'
import { MethodChip } from '@/components/method-chip'
import { ConfidenceDot } from '@/components/confidence-dot'
import { JobBanner } from '@/components/job-banner'
import { EmptyState } from '@/components/empty-state'
import { useProject, useStartIngest } from '@/hooks/use-projects'
import { useEndpoints, useUpdateEndpoints, endpointsKey } from '@/hooks/use-endpoints'
import { useGenerate, mcpServerKey } from '@/hooks/use-mcp-server'
import { useJobStream } from '@/hooks/use-job-stream'
import { useJobRail } from '@/components/job-rail-context'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { AuthType, Endpoint, EndpointUpdate, HttpMethod } from '@/types/api'

const ALL_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const AUTH_OPTIONS: { value: AuthType; label: string; hint?: string }[] = [
  { value: 'bearer', label: 'Bearer token', hint: 'Authorization: Bearer <token>' },
  { value: 'api_key_header', label: 'API key (header)', hint: 'Custom header like X-API-Key' },
  { value: 'api_key_query', label: 'API key (query)', hint: '?api_key=...' },
  { value: 'basic', label: 'HTTP Basic', hint: 'Username + password' },
  { value: 'oauth2_client_credentials', label: 'OAuth2 client credentials' },
  { value: 'none', label: 'No auth', hint: 'Public endpoints' },
]

export default function EndpointsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const jobId = searchParams.get('job')

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const { data, isLoading, isError, error } = useEndpoints(projectId)
  const endpoints = useMemo(() => data?.endpoints ?? [], [data])

  const updateEndpoints = useUpdateEndpoints(projectId)
  const startIngest = useStartIngest()
  const generate = useGenerate(projectId)
  const jobRail = useJobRail()

  // Filter / search state (local — could move to URL later)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<Set<HttpMethod>>(new Set())
  const [selectedOnly, setSelectedOnly] = useState(false)

  // Inline base URL editor — shown when missing or relative, since github/docs
  // ingest can't detect it and openapi sometimes returns a relative path.
  const projectBaseUrl = project?.base_api_url ?? ''
  const baseUrlMissing =
    !projectBaseUrl || !/^https?:\/\//i.test(projectBaseUrl)
  const [baseUrlInput, setBaseUrlInput] = useState(projectBaseUrl)
  // Keep the input in sync if the project record updates (e.g. after a generate)
  useEffect(() => setBaseUrlInput(projectBaseUrl), [projectBaseUrl])

  const filtered = useMemo(() => {
    return endpoints.filter((e) => {
      if (methodFilter.size > 0 && !methodFilter.has(e.method)) return false
      if (selectedOnly && !e.selected) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${e.method} ${e.path} ${e.summary ?? ''} ${e.llm_name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [endpoints, methodFilter, selectedOnly, search])

  const selectedCount = endpoints.filter((e) => e.selected).length
  const lowConfidenceCount = endpoints.filter((e) => e.confidence === 'low').length

  // Stream the active job (if any). On terminal events refresh endpoints + mcp-server.
  const jobState = useJobStream(jobId, {
    onDone: () => {
      qc.invalidateQueries({ queryKey: endpointsKey(projectId) })
      qc.invalidateQueries({ queryKey: mcpServerKey(projectId) })
    },
    onProgress: (percent) => {
      // Refresh the endpoints table every ~10% so rows appear live during ingest
      if (percent > 0 && percent % 10 < 3) {
        qc.invalidateQueries({ queryKey: endpointsKey(projectId) })
      }
    },
  })

  // After a generate job finishes, route to /tools where the result lives
  useEffect(() => {
    if (jobState.status === 'succeeded' && jobId) {
      // We don't know what job type it was from the stream — check if mcp-server now exists
      const isGenerate = jobState.result && typeof jobState.result === 'object'
        && 'tool_count' in (jobState.result as Record<string, unknown>)
      if (isGenerate) {
        router.replace(`/projects/${projectId}/tools`)
      }
    }
  }, [jobState.status, jobState.result, jobId, projectId, router])

  function clearJobFromUrl() {
    router.replace(`/projects/${projectId}/endpoints`)
  }

  function toggleEndpoint(ep: Endpoint, next: boolean) {
    updateEndpoints.mutate([{ id: ep.id, selected: next }])
  }

  function bulkToggle(next: boolean) {
    const updates: EndpointUpdate[] = filtered
      .filter((e) => e.selected !== next)
      .map((e) => ({ id: e.id, selected: next }))
    if (updates.length === 0) return
    updateEndpoints.mutate(updates)
  }

  function toggleMethod(m: HttpMethod) {
    setMethodFilter((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  async function handleReingest() {
    try {
      const { job_id } = await startIngest.mutateAsync(projectId)
      jobRail.start(job_id, { label: 'Re-ingesting source', kind: 'ingest' })
      router.replace(`/projects/${projectId}/endpoints?job=${job_id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Re-ingest failed')
    }
  }

  async function handleGenerate(authType: AuthType) {
    if (selectedCount === 0) {
      toast.error('Select at least one endpoint first')
      return
    }

    const supplied = baseUrlInput.trim()
    if (!supplied && baseUrlMissing) {
      toast.error('Set a base API URL above first — it tells the runtime where to call.')
      return
    }
    if (supplied && !/^https?:\/\//i.test(supplied)) {
      toast.error('Base URL must start with http:// or https://')
      return
    }

    try {
      const { job_id } = await generate.mutateAsync({
        auth_type: authType,
        // Only pass an override when it differs from what's on the project
        base_api_url: supplied !== projectBaseUrl ? supplied : undefined,
      })
      jobRail.start(job_id, { label: 'Generating MCP tools', kind: 'generate' })
      router.replace(`/projects/${projectId}/endpoints?job=${job_id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generate failed')
    }
  }

  // Select-all checkbox state for the visible (filtered) rows
  const visibleSelectedCount = filtered.filter((e) => e.selected).length
  const allChecked = filtered.length > 0 && visibleSelectedCount === filtered.length
  const someChecked = visibleSelectedCount > 0 && visibleSelectedCount < filtered.length
  const selectAllState: boolean | 'indeterminate' = allChecked
    ? true
    : someChecked
      ? 'indeterminate'
      : false

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Endpoints'}
        description={project?.source_url ?? undefined}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={handleReingest}
              disabled={startIngest.isPending || !!jobId}
            >
              <RefreshCw className={cn(startIngest.isPending && 'animate-spin')} />
              Re-ingest
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="md"
                  disabled={generate.isPending || !!jobId || selectedCount === 0}
                >
                  <Sparkles />
                  Generate MCP
                  <span className="font-mono text-[10px] opacity-70 ml-1">
                    {selectedCount} selected
                  </span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[260px]">
                <DropdownMenuLabel>Pick auth type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AUTH_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => handleGenerate(opt.value)}
                    className="flex-col items-start gap-0.5 py-2"
                  >
                    <span>{opt.label}</span>
                    {opt.hint && (
                      <span className="text-[11px] text-text-tertiary font-mono">
                        {opt.hint}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Active job banner */}
      {jobId && (
        <JobBanner
          state={jobState}
          jobId={jobId}
          label={
            jobState.step?.toLowerCase().includes('generat')
              ? 'Generating MCP tools'
              : 'Ingesting source'
          }
          onDismiss={clearJobFromUrl}
        />
      )}

      {/* Base URL prompt — required by /generate, can't be auto-detected for
          github/docs sources, and openapi specs sometimes only declare a
          relative server. Show inline so the user fixes it without leaving
          the page. */}
      {endpoints.length > 0 && baseUrlMissing && (
        <div className="border border-warning/30 bg-warning/5 rounded-md px-4 py-3 mb-4 flex items-start gap-3">
          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary mb-0.5">
              Set the base API URL
            </p>
            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
              The runtime needs a fully-qualified host to call when Claude invokes a
              tool. We couldn&apos;t auto-detect one from your source.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="https://api.example.com"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                className="font-mono text-xs h-9 max-w-[440px]"
              />
              <span className="text-[11px] text-text-tertiary font-mono">
                saved on Generate
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters row */}
      {endpoints.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
            <Input
              type="search"
              placeholder="Filter routes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 w-[260px] text-xs"
            />
          </div>

          <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary font-mono uppercase tracking-wider ml-2">
            <Filter className="size-3" />
            Method
          </span>
          <div className="flex items-center gap-1">
            {ALL_METHODS.map((m) => {
              const on = methodFilter.has(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={cn(
                    'h-7 px-2 rounded-sm border text-[11px] font-mono font-medium transition-colors',
                    on
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface text-text-tertiary hover:border-border-strong hover:text-text-secondary'
                  )}
                >
                  {m}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setSelectedOnly((v) => !v)}
            className={cn(
              'h-7 px-2.5 rounded-sm border text-xs transition-colors ml-2',
              selectedOnly
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
            )}
          >
            Selected only
          </button>

          {(methodFilter.size > 0 || selectedOnly || search) && (
            <button
              type="button"
              onClick={() => {
                setMethodFilter(new Set())
                setSelectedOnly(false)
                setSearch('')
              }}
              className="text-[11px] text-text-tertiary hover:text-text-secondary font-mono ml-1"
            >
              clear
            </button>
          )}

          <span className="ml-auto text-[11px] text-text-tertiary font-mono tabular-nums">
            <span className="text-text-primary">{endpoints.length}</span> endpoints ·{' '}
            <span className="text-text-primary">{selectedCount}</span> selected
            {lowConfidenceCount > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="text-error">{lowConfidenceCount}</span> low
              </>
            )}
            {filtered.length !== endpoints.length && (
              <>
                {' '}·{' '}
                <span className="text-text-secondary">{filtered.length}</span> shown
              </>
            )}
          </span>
        </div>
      )}

      {/* Body states */}
      {isLoading && <TableSkeleton />}

      {isError && (
        <ErrorBox
          message={
            error instanceof ApiError ? error.message : 'Could not load endpoints'
          }
        />
      )}

      {!isLoading && !isError && endpoints.length === 0 && !jobId && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no routes   │
└──────────────┘`}
          title="No endpoints extracted yet"
          description="Run ingestion to extract endpoints from the source."
          action={
            <Button onClick={handleReingest} disabled={startIngest.isPending}>
              <RefreshCw className={cn(startIngest.isPending && 'animate-spin')} />
              Start ingestion
            </Button>
          }
        />
      )}

      {!isLoading && !isError && endpoints.length === 0 && jobId && (
        <div className="border border-border rounded-md bg-surface py-12 text-center">
          <p className="text-sm text-text-secondary">
            Endpoints will stream in as they&apos;re extracted…
          </p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && endpoints.length > 0 && (
        <div className="border border-border rounded-md bg-surface py-12 text-center">
          <p className="text-sm text-text-secondary">No routes match the current filters</p>
        </div>
      )}

      {filtered.length > 0 && (
        <EndpointTable
          rows={filtered}
          selectAllState={selectAllState}
          onSelectAll={(next) => bulkToggle(next)}
          onToggleRow={toggleEndpoint}
        />
      )}
    </div>
  )
}

/* ─────────────────────────── Table ─────────────────────────── */

function EndpointTable({
  rows,
  selectAllState,
  onSelectAll,
  onToggleRow,
}: {
  rows: Endpoint[]
  selectAllState: boolean | 'indeterminate'
  onSelectAll: (next: boolean) => void
  onToggleRow: (ep: Endpoint, next: boolean) => void
}) {
  return (
    <div className="border border-border rounded-md bg-surface overflow-hidden">
      {/* Header row */}
      <div
        className={cn(
          'grid items-center gap-3 px-3.5 py-2.5 border-b border-border bg-surface-2',
          'grid-cols-[14px_56px_minmax(220px,1.4fr)_minmax(120px,2fr)_64px_minmax(120px,1fr)]'
        )}
      >
        <Checkbox
          checked={selectAllState}
          onCheckedChange={(next) => onSelectAll(next === true ? true : selectAllState !== true)}
          aria-label="Select all visible"
        />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Method
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Path
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Summary
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary text-center">
          Conf
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Source
        </span>
      </div>

      {/* Body rows */}
      {rows.map((ep, i) => (
        <Row
          key={ep.id}
          ep={ep}
          isLast={i === rows.length - 1}
          onToggle={(next) => onToggleRow(ep, next)}
        />
      ))}
    </div>
  )
}

function Row({
  ep,
  isLast,
  onToggle,
}: {
  ep: Endpoint
  isLast: boolean
  onToggle: (next: boolean) => void
}) {
  // Highlight {placeholders} in the path
  const segments = ep.path.split(/(\{[^}]+\})/)

  return (
    <div
      className={cn(
        'grid items-center gap-3 px-3.5 py-2.5 text-sm transition-colors group',
        !isLast && 'border-b border-border',
        'hover:bg-surface-2',
        'grid-cols-[14px_56px_minmax(220px,1.4fr)_minmax(120px,2fr)_64px_minmax(120px,1fr)]'
      )}
    >
      <Checkbox
        checked={ep.selected}
        onCheckedChange={onToggle}
        aria-label={`Toggle ${ep.method} ${ep.path}`}
      />

      <MethodChip method={ep.method} />

      <span className="font-mono text-xs text-text-primary truncate">
        {segments.map((s, i) =>
          s.startsWith('{') ? (
            <span key={i} className="text-warning">
              {s}
            </span>
          ) : (
            <span key={i}>{s}</span>
          )
        )}
      </span>

      <span className="text-xs text-text-secondary truncate">
        {ep.summary ?? <span className="text-text-quaternary">—</span>}
      </span>

      <span className="flex justify-center">
        <ConfidenceDot confidence={ep.confidence} />
      </span>

      <span className="font-mono text-[11px] text-text-tertiary truncate">
        {ep.source_file ? (
          <>
            {ep.source_file}
            {ep.source_line != null && <span className="text-text-quaternary">:{ep.source_line}</span>}
          </>
        ) : (
          <span className="text-text-quaternary">—</span>
        )}
      </span>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="border border-border rounded-md bg-surface overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'grid items-center gap-3 px-3.5 py-3',
            'grid-cols-[14px_56px_1fr_1fr_24px_120px]',
            i < 5 && 'border-b border-border'
          )}
        >
          <Skeleton className="size-3" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="size-1.5 rounded-full justify-self-center" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
      <p className="text-error font-medium mb-1">Failed to load endpoints</p>
      <p className="text-text-secondary">{message}</p>
    </div>
  )
}
