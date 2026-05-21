import { cn } from '@/lib/utils'

export function MetricCard({
  label,
  value,
  delta,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  delta?: string
  tone?: 'default' | 'success' | 'warning' | 'error' | 'muted'
  className?: string
}) {
  return (
    <div
      className={cn(
        'border border-border rounded-md bg-surface px-5 py-4 flex flex-col gap-1.5',
        className
      )}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p
        className={cn(
          'text-2xl font-semibold font-mono tabular-nums tracking-tight truncate',
          tone === 'success' && 'text-accent',
          tone === 'warning' && 'text-warning',
          tone === 'error' && 'text-error',
          tone === 'muted' && 'text-text-secondary',
          tone === 'default' && 'text-text-primary'
        )}
      >
        {value}
      </p>
      {delta && (
        <p className="text-[11px] font-mono text-text-tertiary tabular-nums">{delta}</p>
      )}
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="border border-border rounded-md bg-surface px-5 py-4 space-y-2">
      <div className="h-2.5 w-16 bg-surface-2 rounded animate-pulse" />
      <div className="h-7 w-24 bg-surface-2 rounded animate-pulse" />
      <div className="h-2.5 w-20 bg-surface-2 rounded animate-pulse" />
    </div>
  )
}
