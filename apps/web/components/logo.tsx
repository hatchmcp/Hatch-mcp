import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({
  size = 24,
  showWordmark = true,
  className,
}: {
  size?: number
  showWordmark?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/logo.png"
        alt="Hatch"
        width={size}
        height={size}
        priority
        className="block object-contain"
      />
      {showWordmark && (
        <span className="font-semibold text-sm tracking-tight text-text-primary">
          Hatch
        </span>
      )}
    </span>
  )
}
