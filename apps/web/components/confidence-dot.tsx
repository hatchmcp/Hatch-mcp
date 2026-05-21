import { cn } from '@/lib/utils'
import type { Confidence } from '@/types/api'

const dotClass: Record<Confidence, string> = {
  high: 'bg-accent',
  medium: 'bg-warning',
  low: 'bg-error',
}

const label: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

export function ConfidenceDot({
  confidence,
  showLabel,
  className,
}: {
  confidence: Confidence
  showLabel?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={label[confidence]}>
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dotClass[confidence])} />
      {showLabel && (
        <span className="text-[10px] uppercase font-mono tracking-wider text-text-tertiary">
          {confidence === 'medium' ? 'med' : confidence}
        </span>
      )}
    </span>
  )
}
