'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CodeBlock({
  code,
  language,
  className,
  maxHeight,
}: {
  code: string
  language?: string
  className?: string
  maxHeight?: number
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard might be unavailable — silently fail
    }
  }

  return (
    <div className={cn('relative border border-border rounded-sm bg-bg', className)}>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-border bg-surface text-[11px] text-text-tertiary hover:text-text-primary hover:border-border-strong transition-colors font-mono"
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
      <pre
        className="font-mono text-xs text-text-secondary p-3.5 overflow-auto leading-relaxed"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  )
}
