import { Construction } from 'lucide-react'

export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="border border-border rounded-md bg-surface py-16 px-6 flex flex-col items-center justify-center text-center">
      <Construction className="size-5 text-text-tertiary mb-3" />
      <h3 className="text-base font-semibold text-text-primary tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-text-secondary font-mono">{note ?? 'Coming next.'}</p>
    </div>
  )
}
