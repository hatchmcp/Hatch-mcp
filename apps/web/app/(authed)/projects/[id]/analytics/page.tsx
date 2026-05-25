'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { startOfDay } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { MetricCard, MetricCardSkeleton } from '@/components/metric-card'
import { BarChart, type BarChartBucket } from '@/components/bar-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useProject } from '@/hooks/use-projects'
import { useUsage } from '@/hooks/use-usage'
import { HostedRuntimeNotice } from '@/components/hosted-runtime-notice'
import { formatCount } from '@/lib/format'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { UsageResponse } from '@/types/api'

const RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

export default function AnalyticsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id

  const { data: projectData } = useProject(projectId)
  const project = projectData?.project

  const [days, setDays] = useState<number>(7)
  const { data, isLoading, isError, error } = useUsage(projectId, days)

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Analytics'}
        description="Calls, errors, latency"
        actions={<RangePicker value={days} onChange={setDays} />}
      />

      <HostedRuntimeNotice projectId={projectId} />

      {isLoading && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-[240px] rounded-md" />
          <Skeleton className="h-[180px] rounded-md" />
        </div>
      )}

      {isError && (
        <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
          <p className="text-error font-medium mb-1">Could not load analytics</p>
          <p className="text-text-secondary">
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {!isLoading && !isError && data && <Body data={data} days={days} />}
    </div>
  )
}

/* ─────────────────────────── Range picker ─────────────────────────── */

function RangePicker({
  value,
  onChange,
}: {
  value: number
  onChange: (days: number) => void
}) {
  return (
    <div className="inline-flex border border-border rounded-sm overflow-hidden bg-surface">
      {RANGES.map((r) => (
        <button
          key={r.label}
          type="button"
          onClick={() => onChange(r.days)}
          className={cn(
            'h-8 px-3 text-[11px] font-mono uppercase tracking-wider border-r border-border last:border-r-0 transition-colors',
            value === r.days
              ? 'bg-surface-2 text-text-primary'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────── Body ─────────────────────────── */

function Body({ data, days }: { data: UsageResponse; days: number }) {
  const totalCalls = num(data.summary?.total_calls ?? 0)
  const errorCalls = num(data.summary?.error_calls ?? 0)
  const avgLatency = num(data.summary?.avg_latency_ms ?? 0)
  const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0
  const topTool = data.topTools?.[0] ?? null

  // Roll hourly into daily for ranges > 7 days; otherwise show hourly directly
  const chartBuckets = useMemo<BarChartBucket[]>(() => {
    const hourly = data.hourly ?? []
    if (hourly.length === 0) return []

    const rolled = days > 7
    if (!rolled) {
      return hourly.map((h) => ({
        ts: new Date(h.hour),
        value: num(h.total_calls),
        errorValue: num(h.error_calls),
      }))
    }

    // Daily roll-up
    const byDay = new Map<number, BarChartBucket>()
    for (const h of hourly) {
      const day = startOfDay(new Date(h.hour)).getTime()
      const existing = byDay.get(day) ?? { ts: new Date(day), value: 0, errorValue: 0 }
      existing.value += num(h.total_calls)
      existing.errorValue = (existing.errorValue ?? 0) + num(h.error_calls)
      byDay.set(day, existing)
    }
    return Array.from(byDay.values()).sort((a, b) => a.ts.getTime() - b.ts.getTime())
  }, [data.hourly, days])

  // No data path
  const empty = totalCalls === 0 && chartBuckets.length === 0
  if (empty) {
    return (
      <EmptyState
        bracketArt={`┌──────────────┐
│  no calls    │
└──────────────┘`}
        title="No usage yet"
        description="Once your MCP server gets called, calls, errors, and latency will show up here."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Metric grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total calls"
          value={formatCount(totalCalls)}
          delta={`last ${days}d`}
        />
        <MetricCard
          label="Error rate"
          value={`${errorRate.toFixed(errorRate < 1 ? 2 : 1)}%`}
          tone={errorRate > 5 ? 'error' : errorRate > 1 ? 'warning' : 'default'}
          delta={`${errorCalls} failed`}
        />
        <MetricCard
          label="Avg latency"
          value={`${Math.round(avgLatency)}ms`}
          tone={avgLatency > 1000 ? 'warning' : 'default'}
          delta={data.hourly[0]?.p95_latency_ms != null ? `p95 in chart` : undefined}
        />
        <MetricCard
          label="Top tool"
          value={topTool?.tool_name ?? '—'}
          tone="muted"
          delta={topTool ? `${formatCount(num(topTool.calls))} calls` : undefined}
        />
      </div>

      {/* Chart */}
      <section>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1">
          Calls over time
        </h3>
        <BarChart buckets={chartBuckets} />
      </section>

      {/* Top tools */}
      {data.topTools && data.topTools.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1">
            Top tools
          </h3>
          <div className="border border-border rounded-md bg-surface overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_140px_120px] items-center gap-3 px-4 py-2 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              <span>Tool</span>
              <span className="text-right">Calls</span>
              <span className="text-right">Avg latency</span>
              <span className="text-right">Errors</span>
            </div>
            {data.topTools.map((t, i) => {
              const errs = num(t.errors)
              const calls = num(t.calls)
              const errPct = calls > 0 ? (errs / calls) * 100 : 0
              return (
                <div
                  key={t.tool_name}
                  className={cn(
                    'grid grid-cols-[1fr_120px_140px_120px] items-center gap-3 px-4 py-2.5 text-sm',
                    i < data.topTools.length - 1 && 'border-b border-border'
                  )}
                >
                  <span className="font-mono text-xs text-text-primary truncate">
                    {t.tool_name}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-text-primary">
                    {formatCount(calls)}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-text-secondary">
                    {Math.round(num(t.avg_latency_ms))}ms
                  </span>
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      errs === 0
                        ? 'text-text-tertiary'
                        : errPct > 5
                          ? 'text-error'
                          : 'text-warning'
                    )}
                  >
                    {errs}
                    {errs > 0 && (
                      <span className="text-text-quaternary ml-1">
                        ({errPct.toFixed(errPct < 1 ? 2 : 1)}%)
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent errors */}
      {data.recentErrors && data.recentErrors.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1 flex items-center gap-1.5">
            <AlertTriangle className="size-3" />
            Recent errors
          </h3>
          <div className="border border-border rounded-md bg-surface overflow-hidden">
            {data.recentErrors.map((err, i) => (
              <div
                key={i}
                className={cn(
                  'grid grid-cols-[1fr_60px_180px_auto] items-center gap-3 px-4 py-2 text-sm',
                  i < data.recentErrors.length - 1 && 'border-b border-border'
                )}
              >
                <span className="font-mono text-xs text-text-primary truncate">
                  {err.tool_name}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums text-right',
                    err.status_code >= 500 ? 'text-error' : 'text-warning'
                  )}
                >
                  {err.status_code}
                </span>
                <span className="font-mono text-[11px] text-text-tertiary truncate">
                  {err.error_class ?? '—'}
                </span>
                <span className="font-mono text-[11px] text-text-tertiary tabular-nums whitespace-nowrap">
                  {timeAgo(err.created_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : parseFloat(v) || 0
}
