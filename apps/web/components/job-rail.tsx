'use client'

import { useEffect, useRef } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useJobRail } from '@/components/job-rail-context'
import { useJobStream } from '@/hooks/use-job-stream'
import { cn } from '@/lib/utils'

export function JobRail() {
  const { activeJob, expanded, toggleExpanded, dismiss } = useJobRail()

  // Subscribe to the active job's SSE — hook tolerates undefined and tears down on change
  const state = useJobStream(activeJob?.id, {
    onDone: () => scheduleAutoDismiss(),
  })

  // Auto-dismiss 3s after success
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleAutoDismiss() {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(() => dismiss(), 3000)
  }
  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [])

  if (!activeJob) return null

  const running =
    state.status === 'running' ||
    state.status === 'queued' ||
    state.status === 'pending'
  const done = state.status === 'succeeded'
  const failed = state.status === 'failed'

  /* ─────────────────────────── Chip mode ─────────────────────────── */
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          'fixed bottom-4 right-4 z-30 inline-flex items-center gap-2.5 h-9 px-3.5 rounded-full border bg-surface-3 shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-colors',
          running && 'border-warning/40 hover:border-warning/60',
          done && 'border-accent/40 hover:border-accent/60',
          failed && 'border-error/40 hover:border-error/60'
        )}
      >
        <StatusIcon running={running} done={done} failed={failed} />
        <span className="text-xs text-text-primary font-medium">{activeJob.label}</span>
        {running && (
          <span className="font-mono text-[11px] text-text-tertiary tabular-nums">
            {state.progress}%
          </span>
        )}
      </button>
    )
  }

  /* ─────────────────────────── Expanded panel ─────────────────────────── */
  return (
    <aside
      className="fixed top-12 bottom-0 right-0 w-[320px] border-l border-border bg-surface z-20 flex flex-col"
      aria-label="Job progress"
    >
      {/* Header */}
      <header className="px-4 py-3 border-b border-border flex items-start gap-3">
        <StatusIcon running={running} done={done} failed={failed} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-medium text-text-primary truncate">
              {failed ? `${activeJob.label} failed` : done ? `${activeJob.label} done` : activeJob.label}
            </p>
            {running && (
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums">
                {state.progress}%
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-text-tertiary truncate mt-0.5">
            {failed ? state.error : state.step ?? `job ${activeJob.id.slice(0, 8)}`}
          </p>
        </div>

        <div className="flex items-center gap-0.5 -mr-1 -mt-0.5">
          <button
            type="button"
            onClick={toggleExpanded}
            title="Minimize"
            aria-label="Minimize"
            className="size-7 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            title="Dismiss"
            aria-label="Dismiss"
            className="size-7 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-[3px] bg-bg relative">
        <div
          className={cn(
            'h-full transition-[width] duration-500 ease-out',
            running && 'bg-warning',
            done && 'bg-accent',
            failed && 'bg-error'
          )}
          style={{ width: `${Math.max(state.progress, done ? 100 : 2)}%` }}
        />
      </div>

      {/* Log stream */}
      <LogStream logs={state.logs} />
    </aside>
  )
}

function StatusIcon({
  running,
  done,
  failed,
}: {
  running: boolean
  done: boolean
  failed: boolean
}) {
  if (failed) return <AlertTriangle className="size-4 text-error shrink-0" />
  if (done) return <CheckCircle2 className="size-4 text-accent shrink-0" />
  if (running) return <Loader2 className="size-4 text-warning shrink-0 animate-spin" />
  return <Loader2 className="size-4 text-text-tertiary shrink-0 animate-spin" />
}

/* ─────────────────────────── Log stream ─────────────────────────── */

const levelClass: Record<string, string> = {
  info: 'text-text-secondary',
  debug: 'text-text-tertiary',
  warn: 'text-warning',
  error: 'text-error',
}

function LogStream({
  logs,
}: {
  logs: { id: number; level: string; message: string }[]
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const userScrolledRef = useRef(false)

  // Auto-scroll to bottom unless the user has scrolled up
  useEffect(() => {
    const el = scrollRef.current
    if (!el || userScrolledRef.current) return
    el.scrollTop = el.scrollHeight
  }, [logs.length])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    userScrolledRef.current = !atBottom
  }

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] font-mono text-text-tertiary">
        waiting for logs…
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed bg-bg"
    >
      {logs.map((log) => (
        <div key={log.id} className="flex gap-2 py-px">
          <span className={cn('shrink-0', levelClass[log.level] ?? 'text-text-secondary')}>
            {log.level === 'error' ? '✗' : log.level === 'warn' ? '!' : '·'}
          </span>
          <span className="text-text-secondary break-words">{log.message}</span>
        </div>
      ))}
    </div>
  )
}
