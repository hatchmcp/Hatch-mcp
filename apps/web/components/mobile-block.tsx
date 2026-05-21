import { Monitor } from 'lucide-react'

export function MobileBlock() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="max-w-[360px] w-full text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-md border border-border bg-surface mb-5">
          <Monitor className="size-5 text-text-secondary" />
        </div>

        <h1 className="text-lg font-semibold tracking-tight mb-2">
          Open Hatch on a larger screen
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          The dashboard is built for desktop — endpoint tables, the job rail, and the
          command palette need more room than a phone gives them. Public docs and the
          marketing site work everywhere.
        </p>

        <pre className="font-mono text-[10px] text-text-quaternary leading-tight whitespace-pre inline-block">
{`┌────────────────────┐
│   1024px or wider  │
└────────────────────┘`}
        </pre>
      </div>
    </main>
  )
}
