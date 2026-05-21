import { cn } from '@/lib/utils'
import { initials } from '@/lib/format'

const tints = [
  'bg-[#2A3A5E] text-[#9CB8E8]',
  'bg-[#3A5E2A] text-[#B8E89C]',
  'bg-[#5E3A2A] text-[#E8B89C]',
  'bg-[#5E2A4A] text-[#E89CC8]',
  'bg-[#2A5E5A] text-[#9CE8E0]',
  'bg-[#4A2A5E] text-[#C89CE8]',
]

function hashTint(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return tints[Math.abs(hash) % tints.length]
}

export function Avatar({
  seed,
  size = 28,
  className,
}: {
  seed: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm font-mono font-medium tracking-tight select-none',
        hashTint(seed),
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {initials(seed)}
    </span>
  )
}
