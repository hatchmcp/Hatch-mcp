import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  bracketArt,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  bracketArt?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6 border border-border rounded-md bg-surface',
        className
      )}
    >
      {bracketArt && (
        <pre className="font-mono text-xs text-text-quaternary mb-6 leading-tight whitespace-pre">
          {bracketArt}
        </pre>
      )}
      <h3 className="text-lg font-semibold text-text-primary tracking-tight mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-[420px] mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
