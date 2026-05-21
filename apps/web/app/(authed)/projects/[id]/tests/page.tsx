'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  TestTube,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { JobBanner } from '@/components/job-banner'
import { EmptyState } from '@/components/empty-state'
import { useProject } from '@/hooks/use-projects'
import { useMcpServer, useRunTests } from '@/hooks/use-mcp-server'
import { useJobStream } from '@/hooks/use-job-stream'
import { useJobRail } from '@/components/job-rail-context'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { TestReport } from '@/types/api'

export default function TestsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const { data: mcpServer, isLoading: mcpLoading } = useMcpServer(projectId)
  const runTests = useRunTests(projectId)
  const jobRail = useJobRail()

  const jobState = useJobStream(jobId)

  const report = useMemo<TestReport | null>(() => {
    if (jobState.status === 'succeeded' && jobState.result && typeof jobState.result === 'object') {
      return jobState.result as TestReport
    }
    return null
  }, [jobState.status, jobState.result])

  async function handleRun() {
    try {
      const { job_id } = await runTests.mutateAsync()
      jobRail.start(job_id, { label: 'Running tests', kind: 'test' })
      router.replace(`/projects/${projectId}/tests?job=${job_id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start tests')
    }
  }

  const hasConfig = !!mcpServer
  const running = !!jobId && (jobState.status === 'running' || jobState.status === 'queued' || jobState.status === 'pending')

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Tests'}
        description={hasConfig ? `Schema + dry-run on v${mcpServer.version.version_number}` : project?.source_url ?? undefined}
        actions={
          <Button
            size="md"
            onClick={handleRun}
            disabled={!hasConfig || runTests.isPending || running}
          >
            {running ? (
              <>
                <Loader2 className="animate-spin" />
                Testing
              </>
            ) : (
              <>
                <TestTube />
                {report ? 'Run tests again' : 'Run tests'}
              </>
            )}
          </Button>
        }
      />

      {jobId && (
        <JobBanner
          state={jobState}
          jobId={jobId}
          label="Running test pipeline"
          onDismiss={() => router.replace(`/projects/${projectId}/tests`)}
        />
      )}

      {/* Body states */}
      {!mcpLoading && !hasConfig && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no config   │
└──────────────┘`}
          title="Generate the MCP config first"
          description="Tests run against the latest generated config. Head to Tools to generate one."
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

      {hasConfig && !jobId && !report && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no runs     │
└──────────────┘`}
          title="No test runs yet"
          description="Tests validate every tool's input schema and run a dry-run against an HTTP mock. No production credentials needed."
          action={
            <Button onClick={handleRun} disabled={runTests.isPending}>
              <TestTube />
              Run tests
            </Button>
          }
        />
      )}

      {report && <TestReportView report={report} />}
    </div>
  )
}

/* ─────────────────────────── Report view ─────────────────────────── */

function TestReportView({ report }: { report: TestReport }) {
  const passing = report.toolResults.filter((r) => r.status === 'passed').length
  const failing = report.toolResults.filter((r) => r.status === 'failed').length

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div
        className={cn(
          'border rounded-md px-5 py-4 grid grid-cols-[auto_1fr_auto_auto_auto] gap-6 items-center',
          report.passed ? 'border-accent/30 bg-accent/5' : 'border-error/30 bg-error/5'
        )}
      >
        {report.passed ? (
          <CheckCircle2 className="size-5 text-accent" />
        ) : (
          <XCircle className="size-5 text-error" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">
            {report.passed ? 'All tests passed' : 'Some tests failed'}
          </p>
          <p className="text-[11px] text-text-tertiary font-mono">
            Schema validation {report.schemaValid ? 'passed' : `· ${report.schemaIssues.length} issues`}
          </p>
        </div>

        <Stat label="Passing" value={String(passing)} tone="success" />
        <Stat label="Failing" value={String(failing)} tone={failing > 0 ? 'error' : 'muted'} />
        <Stat label="Total" value={String(report.toolResults.length)} tone="muted" />
      </div>

      {/* Schema issues */}
      {report.schemaIssues.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1">
            Schema issues
          </h3>
          <div className="border border-border rounded-md bg-surface overflow-hidden">
            {report.schemaIssues.map((issue, i) => (
              <div
                key={`${issue.toolName}-${i}`}
                className={cn(
                  'flex items-start gap-3 px-4 py-2.5 text-sm',
                  i < report.schemaIssues.length - 1 && 'border-b border-border'
                )}
              >
                <XCircle className="size-3.5 text-error shrink-0 mt-0.5" />
                <span className="font-mono text-xs text-text-primary w-[200px] shrink-0 truncate">
                  {issue.toolName}
                </span>
                <span className="text-xs text-text-secondary flex-1">{issue.issue}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-tool results */}
      <section>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1">
          Tool results
        </h3>
        <div className="border border-border rounded-md bg-surface overflow-hidden">
          {report.toolResults.map((result, i) => (
            <ResultRow
              key={`${result.toolName}-${i}`}
              result={result}
              isLast={i === report.toolResults.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function ResultRow({
  result,
  isLast,
}: {
  result: TestReport['toolResults'][number]
  isLast: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasError = result.status === 'failed' && result.error

  return (
    <div className={cn(!isLast && 'border-b border-border')}>
      <button
        type="button"
        onClick={() => hasError && setOpen((v) => !v)}
        disabled={!hasError}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
          hasError && 'hover:bg-surface-2 cursor-pointer'
        )}
      >
        {result.status === 'passed' ? (
          <CheckCircle2 className="size-3.5 text-accent shrink-0" />
        ) : (
          <XCircle className="size-3.5 text-error shrink-0" />
        )}
        <span className="font-mono text-xs text-text-primary truncate">
          {result.toolName}
        </span>
        <span
          className={cn(
            'ml-auto text-[10px] font-mono uppercase tracking-wider',
            result.status === 'passed' ? 'text-accent' : 'text-error'
          )}
        >
          {result.status}
        </span>
        {hasError && (
          <ChevronRight
            className={cn(
              'size-3 text-text-tertiary transition-transform',
              open && 'rotate-90'
            )}
          />
        )}
      </button>

      {hasError && open && (
        <div className="px-4 pb-3 -mt-1">
          <div className="font-mono text-[11px] text-error bg-error/5 border border-error/15 rounded-sm px-3 py-2 leading-relaxed whitespace-pre-wrap break-words">
            {result.error}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'error' | 'muted'
}) {
  const colorClass =
    tone === 'success'
      ? 'text-accent'
      : tone === 'error'
        ? 'text-error'
        : 'text-text-primary'
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </p>
      <p className={`text-base font-mono tabular-nums font-semibold ${colorClass}`}>
        {value}
      </p>
    </div>
  )
}
