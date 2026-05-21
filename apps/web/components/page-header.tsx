import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-6 mb-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight mb-1">{title}</h1>
        {description && (
          <p className="text-xs text-text-tertiary font-mono truncate">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
