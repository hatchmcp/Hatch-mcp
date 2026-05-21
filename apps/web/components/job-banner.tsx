'use client'

import { CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react'
import type { JobStreamState } from '@/hooks/use-job-stream'
import { cn } from '@/lib/utils'

export function JobBanner({
  state,
  label,
  jobId,
  onDismiss,
}: {
  state: JobStreamState
  label: string
  jobId: string
  onDismiss?: () => void
}) {
  const { status, progress, step, error } = state
  const running = status === 'running' || status === 'queued' || status === 'pending'
  const failed = status === 'failed'
  const done = status === 'succeeded'

  return (
    <div
      className={cn(
        'relative overflow-hidden border rounded-md mb-5 transition-colors',
        running && 'border-warning/30 bg-warning/5',
        done && 'border-accent/30 bg-accent/5',
        failed && 'border-error/30 bg-error/5'
      )}
    >
      {/* Progress fill — sits under the content as a horizontal bar */}
      {running && (
        <div
          className="absolute inset-y-0 left-0 bg-warning/5 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(progress, 4)}%` }}
          aria-hidden
        />
      )}

      <div className="relative flex items-center gap-3 px-4 py-3">
        {running && <Loader2 className="size-4 text-warning shrink-0 animate-spin" />}
        {done && <CheckCircle2 className="size-4 text-accent shrink-0" />}
        {failed && <AlertTriangle className="size-4 text-error shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5">
            <p className="text-sm font-medium text-text-primary">
              {failed ? `${label} failed` : done ? `${label} complete` : label}
            </p>
            {running && (
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums">
                {progress}%
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-text-tertiary truncate mt-0.5">
            {failed ? error : step ?? `job ${jobId.slice(0, 8)}`}
          </p>
        </div>

        {(done || failed) && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
