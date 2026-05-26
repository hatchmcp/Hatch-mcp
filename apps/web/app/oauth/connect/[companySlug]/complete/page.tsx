'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2, Copy, Check, Terminal, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

export default function OAuthConnectCompletePage() {
  const params = useParams<{ companySlug: string }>()
  const search = useSearchParams()

  const hatchToken = search.get('hatch_token')
  const error = search.get('error')
  const slug = params.companySlug

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <header className="h-14 border-b border-border flex items-center px-6">
        <Logo size={22} />
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Connect complete
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[520px]">
          {error && <FailureBlock detail={error} slug={slug} />}
          {!error && hatchToken && <SuccessBlock token={hatchToken} slug={slug} />}
          {!error && !hatchToken && <NoTokenBlock slug={slug} />}
        </div>
      </div>
    </main>
  )
}

/* ─────────────────────────── Success ─────────────────────────── */

function SuccessBlock({ token, slug }: { token: string; slug: string }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  // Auto-attempt a deeplink to the MCP installer (no-op if not installed yet)
  useEffect(() => {
    const url = `claude-mcp://install?slug=${encodeURIComponent(
      slug
    )}&hatch_token=${encodeURIComponent(token)}`
    // Don't navigate the page — just probe with a hidden iframe so existing
    // installers can pick it up. Most browsers will silently ignore unknown
    // schemes; some Linux flavors throw, which is harmless.
    try {
      const f = document.createElement('iframe')
      f.style.display = 'none'
      f.src = url
      document.body.appendChild(f)
      setTimeout(() => f.remove(), 2000)
    } catch {
      /* ignore */
    }
  }, [slug, token])

  return (
    <div className="border border-accent/30 rounded-md bg-surface overflow-hidden">
      <div className="px-6 py-7 flex flex-col items-center text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-accent/10 mb-3">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h1 className="text-lg font-semibold text-text-primary tracking-tight mb-1">
          You&apos;re connected
        </h1>
        <p className="text-xs text-text-secondary leading-relaxed max-w-[400px]">
          Hatch is holding your token securely. Drop the value below into your MCP
          server&apos;s env and Claude will start working with your account immediately.
        </p>
      </div>

      <div className="border-t border-border px-5 py-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Your hatch_token
          </span>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="flex items-stretch border border-border rounded-sm bg-bg overflow-hidden">
          <code
            className={cn(
              'flex-1 px-3 py-2.5 font-mono text-xs text-text-primary select-all break-all',
              !revealed && 'text-text-quaternary'
            )}
          >
            {revealed ? token : '•'.repeat(Math.min(token.length, 48))}
          </code>
          <button
            type="button"
            onClick={copy}
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
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="size-3.5 text-text-tertiary" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Add to your Claude Desktop config
          </span>
        </div>
        <pre className="font-mono text-[11px] text-text-secondary leading-relaxed bg-bg border border-border rounded-sm p-3 overflow-x-auto">
{`{
  "mcpServers": {
    "${slug}": {
      "command": "node",
      "args": ["/path/to/${slug}/dist/index.js"],
      "env": {
        "HATCH_TOKEN": "${revealed ? token : '<paste from above>'}"
      }
    }
  }
}`}
        </pre>
      </div>

      <div className="border-t border-border px-5 py-4 flex items-center justify-between">
        <p className="text-[11px] text-text-tertiary">
          You&apos;ll only see this token once — save it now.
        </p>
        <Button asChild variant="secondary" size="sm">
          <a href={`/oauth/connect/${slug}`}>Done</a>
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────── Failure / no-token states ─────────────────────────── */

function FailureBlock({ detail, slug }: { detail: string; slug: string }) {
  return (
    <div className="border border-error/30 rounded-md bg-surface overflow-hidden">
      <div className="px-6 py-7 flex flex-col items-center text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-error/10 mb-3">
          <AlertTriangle className="size-6 text-error" />
        </div>
        <h1 className="text-lg font-semibold text-text-primary tracking-tight mb-1">
          Connection failed
        </h1>
        <p className="text-xs text-text-secondary mb-4">
          {decodeURIComponent(detail).replace(/_/g, ' ')}
        </p>
        <Button asChild>
          <a href={`/oauth/connect/${slug}`}>Try again</a>
        </Button>
      </div>
    </div>
  )
}

function NoTokenBlock({ slug }: { slug: string }) {
  return (
    <div className="border border-border rounded-md bg-surface px-6 py-7 text-center">
      <h1 className="text-base font-semibold text-text-primary mb-2">
        We didn&apos;t receive a hatch_token
      </h1>
      <p className="text-xs text-text-secondary mb-4">
        This usually means the OAuth flow was started but never finished. Try the
        Connect button again — your account on the partner app is untouched.
      </p>
      <Button asChild>
        <a href={`/oauth/connect/${slug}`}>Back to Connect</a>
      </Button>
    </div>
  )
}
