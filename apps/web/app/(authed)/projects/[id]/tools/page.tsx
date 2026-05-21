'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  RefreshCw,
  Sparkles,
  TestTube,
  Search,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ToolCard } from '@/components/tool-card'
import { EmptyState } from '@/components/empty-state'
import { JobBanner } from '@/components/job-banner'
import { useProject } from '@/hooks/use-projects'
import { useMcpServer, useGenerate, mcpServerKey } from '@/hooks/use-mcp-server'
import { useJobStream } from '@/hooks/use-job-stream'
import { timeAgo } from '@/lib/format'
import { ApiError } from '@/lib/api'
import type { AuthType } from '@/types/api'

const AUTH_OPTIONS: { value: AuthType; label: string; hint?: string }[] = [
  { value: 'bearer', label: 'Bearer token' },
  { value: 'api_key_header', label: 'API key (header)' },
  { value: 'api_key_query', label: 'API key (query)' },
  { value: 'basic', label: 'HTTP Basic' },
  { value: 'oauth2_client_credentials', label: 'OAuth2 client credentials' },
  { value: 'none', label: 'No auth' },
]

export default function ToolsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const jobId = searchParams.get('job')

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const { data, isLoading, isError, error } = useMcpServer(projectId)
  const generate = useGenerate(projectId)

  const [search, setSearch] = useState('')

  const tools = useMemo(() => data?.version.config.tools ?? [], [data])
  const filtered = useMemo(() => {
    if (!search) return tools
    const q = search.toLowerCase()
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.http.url_template.toLowerCase().includes(q)
    )
  }, [tools, search])

  const jobState = useJobStream(jobId, {
    onDone: () => {
      qc.invalidateQueries({ queryKey: mcpServerKey(projectId) })
      // Strip ?job= after a short pause so the success banner is visible briefly
      setTimeout(() => router.replace(`/projects/${projectId}/tools`), 1200)
    },
  })

  async function handleGenerate(authType: AuthType) {
    try {
      const { job_id } = await generate.mutateAsync({ auth_type: authType })
      router.replace(`/projects/${projectId}/tools?job=${job_id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generate failed')
    }
  }

  const hasConfig = !!data
  const version = data?.version
  const config = version?.config

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Tools'}
        description={
          hasConfig
            ? `v${version?.version_number} · ${timeAgo(version!.created_at)}`
            : project?.source_url ?? undefined
        }
        actions={
          <>
            {hasConfig && (
              <Button asChild variant="secondary" size="md">
                <Link href={`/projects/${projectId}/tests`}>
                  <TestTube />
                  Run tests
                </Link>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="md" disabled={generate.isPending || !!jobId}>
                  {hasConfig ? (
                    <>
                      <RefreshCw className={generate.isPending ? 'animate-spin' : ''} />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles />
                      Generate
                    </>
                  )}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[240px]">
                <DropdownMenuLabel>Pick auth type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AUTH_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => handleGenerate(opt.value)}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {jobId && (
        <JobBanner
          state={jobState}
          jobId={jobId}
          label="Generating MCP tools"
          onDismiss={() => router.replace(`/projects/${projectId}/tools`)}
        />
      )}

      {/* Body */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
          <p className="text-error font-medium mb-1">Could not load generated config</p>
          <p className="text-text-secondary">
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {!isLoading && !isError && !hasConfig && !jobId && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  <tools/>    │
└──────────────┘`}
          title="No MCP config generated yet"
          description="Pick the auth type your API uses, then generate. Selected endpoints from the Endpoints page become typed MCP tools."
          action={
            <Button asChild>
              <Link href={`/projects/${projectId}/endpoints`}>
                Go to endpoints
                <ArrowRight />
              </Link>
            </Button>
          }
        />
      )}

      {/* Server overview strip */}
      {hasConfig && config && (
        <div className="border border-border rounded-md bg-surface px-5 py-4 mb-5 grid grid-cols-[1fr_auto_auto_auto] gap-6 items-center">
          <div className="min-w-0">
            <p className="font-mono text-sm text-text-primary truncate">
              {config.server_name}
            </p>
            <p className="text-xs text-text-tertiary truncate">{config.server_description}</p>
          </div>
          <Stat label="Tools" value={String(config.tools.length)} />
          <Stat label="Auth" value={config.auth_config.type} mono />
          <Stat label="Base URL" value={config.env.BASE_URL} mono dim />
        </div>
      )}

      {/* Filter + count */}
      {hasConfig && tools.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
            <Input
              type="search"
              placeholder="Filter tools…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 w-[260px] text-xs"
            />
          </div>
          <span className="ml-auto text-[11px] text-text-tertiary font-mono tabular-nums">
            <span className="text-text-primary">{tools.length}</span> tools
            {filtered.length !== tools.length && (
              <>
                {' '}·{' '}
                <span className="text-text-secondary">{filtered.length}</span> shown
              </>
            )}
          </span>
        </div>
      )}

      {hasConfig && filtered.length === 0 && tools.length > 0 && (
        <div className="border border-border rounded-md bg-surface py-12 text-center">
          <p className="text-sm text-text-secondary">No tools match the filter</p>
        </div>
      )}

      {/* Tool cards */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((tool, i) => (
            <ToolCard key={tool.name} tool={tool} defaultOpen={i === 0 && tools.length <= 3} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  mono,
  dim,
}: {
  label: string
  value: string
  mono?: boolean
  dim?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm tabular-nums ${mono ? 'font-mono' : ''} ${
          dim ? 'text-text-secondary' : 'text-text-primary'
        } truncate max-w-[220px]`}
      >
        {value}
      </p>
    </div>
  )
}
