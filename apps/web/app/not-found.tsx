import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="max-w-[420px] w-full text-center">
        <pre className="font-mono text-xs text-text-quaternary leading-tight whitespace-pre mb-6 inline-block">
{`┌──────────────────┐
│   404 / not_found │
└──────────────────┘`}
        </pre>

        <h1 className="text-xl font-semibold tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          The URL doesn&apos;t match a project, route, or known page. It may have been
          deleted or renamed.
        </p>

        <Button asChild>
          <Link href="/">
            <ArrowLeft />
            Back to projects
          </Link>
        </Button>
      </div>
    </main>
  )
}
