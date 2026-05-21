import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'error' | 'neutral' | 'muted'

const toneClass: Record<Tone, string> = {
  success: 'bg-accent',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-text-secondary',
  muted: 'bg-text-tertiary',
}

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  className,
}: {
  tone?: Tone
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className={cn(
          'inline-block w-1.5 h-1.5 rounded-full',
          toneClass[tone]
        )}
      />
      {pulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-60',
            toneClass[tone]
          )}
          aria-hidden
        />
      )}
    </span>
  )
}
