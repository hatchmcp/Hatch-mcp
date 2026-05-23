'use client'

import { useState } from 'react'
import { Copy, Check, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function KeyRevealCard({
  title,
  description,
  plaintext,
  onDismiss,
}: {
  title: string
  description?: string
  plaintext: string
  onDismiss?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plaintext)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="border border-warning/30 bg-warning/5 rounded-md overflow-hidden">
      <header className="px-5 py-3 border-b border-warning/20 flex items-center gap-2">
        <AlertTriangle className="size-3.5 text-warning" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-warning flex-1">
          {title}
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="size-6 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors -mr-1"
          >
            <X className="size-3.5" />
          </button>
        )}
      </header>

      <div className="px-5 py-4 space-y-3">
        {description && (
          <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
        )}

        <p className="text-xs text-text-tertiary leading-relaxed">
          <span className="font-medium text-text-secondary">Copy this now.</span> Hatch stores
          only a hash — once you close this panel the plaintext is gone. To get a new one,
          rotate from the Settings page.
        </p>

        <div className="flex items-stretch gap-0 border border-border rounded-sm bg-bg overflow-hidden">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="px-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary hover:text-text-primary border-r border-border bg-surface-2 transition-colors"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
          <code
            className={cn(
              'flex-1 px-3 py-2.5 font-mono text-sm text-text-primary select-all break-all',
              !revealed && 'text-text-quaternary'
            )}
          >
            {revealed ? plaintext : '•'.repeat(Math.min(plaintext.length, 32))}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 inline-flex items-center gap-1 text-[11px] font-mono text-text-tertiary hover:text-text-primary border-l border-border bg-surface-2 transition-colors"
          >
            {copied ? (
              <>
                <Check className="size-3 text-accent" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </button>
        </div>

        {onDismiss && (
          <div className="flex justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              I&apos;ve saved it
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
