'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to console so devtools always have it; ship to Sentry later
    console.error('[hatch] root error boundary:', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="max-w-[480px] w-full">
        <div className="border border-error/20 bg-error/5 rounded-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-error" />
            <p className="text-sm font-medium text-error font-mono uppercase tracking-wider">
              Something went wrong
            </p>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            An unexpected error broke the page. The job pipeline itself is unaffected —
            this is only the UI. Reloading usually clears it.
          </p>

          <div className="font-mono text-[11px] text-text-tertiary bg-bg border border-border rounded-sm px-3 py-2 mb-4 break-words">
            {error.message || 'Unknown error'}
            {error.digest && (
              <div className="mt-1 text-text-quaternary">digest: {error.digest}</div>
            )}
          </div>

          <Button onClick={() => reset()}>
            <RefreshCcw />
            Try again
          </Button>
        </div>
      </div>
    </main>
  )
}
