import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-2 rounded-sm animate-pulse', className)}
      {...props}
    />
  )
}
