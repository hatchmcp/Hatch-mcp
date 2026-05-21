import { cn } from '@/lib/utils'
import type { HttpMethod } from '@/types/api'

const methodClass: Record<HttpMethod, string> = {
  GET: 'text-method-get bg-method-get/10',
  POST: 'text-method-post bg-accent/10',
  PUT: 'text-method-put bg-warning/10',
  PATCH: 'text-method-patch bg-warning/10',
  DELETE: 'text-method-delete bg-error/10',
  HEAD: 'text-text-secondary bg-surface-2',
  OPTIONS: 'text-text-secondary bg-surface-2',
}

export function MethodChip({
  method,
  className,
}: {
  method: HttpMethod
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-mono text-[10px] font-semibold tracking-wider py-0.5 rounded-[3px] w-[52px]',
        methodClass[method],
        className
      )}
    >
      {method}
    </span>
  )
}
