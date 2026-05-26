'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/avatar'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface ConnectMeta {
  company: {
    name: string
    slug: string
    description: string | null
    logo_url: string | null
    scopes: string[]
  }
  state: string
  login_url: string
  callback_url: string
}

export default function OAuthConnectPage() {
  const params = useParams<{ companySlug: string }>()
  const slug = params.companySlug

  const [meta, setMeta] = useState<ConnectMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/v1/oauth/connect/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          try {
            const parsed = JSON.parse(body)
            throw new Error(parsed.error || `HTTP ${res.status}`)
          } catch {
            throw new Error(body || `HTTP ${res.status}`)
          }
        }
        const data = (await res.json()) as ConnectMeta
        if (!cancelled) setMeta(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this connect page')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  function handleConnect() {
    if (!meta) return
    setConnecting(true)
    // The login URL we got back from the broker carries the state nonce as
    // ?hatch_state=… — the company's auth handler will pull it off and pass
    // it back to /oauth/store-token to complete the dance.
    window.location.href = meta.login_url
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      {/* Top bar — minimal, just the Hatch logo */}
      <header className="h-14 border-b border-border flex items-center px-6">
        <Logo size={22} />
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Connect to Claude
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          {error && (
            <ErrorBlock title="Couldn't load this page" detail={error} slug={slug} />
          )}

          {!error && !meta && <LoadingBlock />}

          {!error && meta && (
            <ConsentCard meta={meta} onConnect={handleConnect} connecting={connecting} />
          )}

          <p className="text-[11px] text-text-tertiary text-center mt-6 leading-relaxed">
            Powered by{' '}
            <a
              href="https://hatchmcp.com"
              className="text-text-secondary hover:text-text-primary underline underline-offset-2"
            >
              Hatch
            </a>
            . You can revoke access any time.
          </p>
        </div>
      </div>
    </main>
  )
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function ConsentCard({
  meta,
  onConnect,
  connecting,
}: {
  meta: ConnectMeta
  onConnect: () => void
  connecting: boolean
}) {
  const c = meta.company

  return (
    <div className="border border-border rounded-md bg-surface overflow-hidden">
      <div className="px-6 py-7 flex flex-col items-center text-center">
        {c.logo_url ? (
          // Plain img so we don't have to whitelist arbitrary remote hosts in next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.logo_url}
            alt={c.name}
            width={44}
            height={44}
            className="rounded-md mb-3 object-contain"
          />
        ) : (
          <Avatar seed={c.name} size={44} className="mb-3" />
        )}
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1">
          Connect to Claude
        </p>
        <h1 className="text-lg font-semibold text-text-primary tracking-tight mb-1">
          {c.name}
        </h1>
        {c.description && (
          <p className="text-xs text-text-secondary leading-relaxed max-w-[340px]">
            {c.description}
          </p>
        )}
      </div>

      {/* Permissions */}
      <div className="border-t border-border px-5 py-4">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-3">
          Claude will be able to
        </p>
        <ul className="space-y-2">
          {(c.scopes.length > 0 ? c.scopes : [`Read and act on your ${c.name} account`]).map(
            (scope, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <ShieldCheck className="size-3.5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-text-secondary leading-relaxed">{scope}</span>
              </li>
            )
          )}
        </ul>
      </div>

      {/* Trust strip */}
      <div className="border-t border-border bg-bg px-5 py-3 flex items-center gap-2.5">
        <Lock className="size-3 text-text-tertiary shrink-0" />
        <p className="text-[11px] text-text-tertiary leading-relaxed">
          Your <span className="font-mono">{c.name}</span> token is encrypted at rest.
          Claude never sees it directly.
        </p>
      </div>

      {/* CTA */}
      <div className="border-t border-border px-5 py-4">
        <Button
          onClick={onConnect}
          disabled={connecting}
          className="w-full"
          size="lg"
        >
          {connecting ? (
            <>
              <Loader2 className="animate-spin" />
              Redirecting to {c.name}…
            </>
          ) : (
            <>
              <Sparkles />
              Continue with {c.name}
              <ArrowRight />
            </>
          )}
        </Button>
        <p className="text-[11px] text-text-tertiary text-center mt-2">
          You&apos;ll sign in to {c.name}, then come back here.
        </p>
      </div>
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="border border-border rounded-md bg-surface px-6 py-12 flex flex-col items-center">
      <Loader2 className="size-5 text-text-tertiary animate-spin mb-3" />
      <p className="text-sm text-text-secondary">Loading…</p>
    </div>
  )
}

function ErrorBlock({
  title,
  detail,
  slug,
}: {
  title: string
  detail: string
  slug: string
}) {
  return (
    <div className="border border-error/20 bg-error/5 rounded-md px-6 py-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="size-4 text-error" />
        <p className="text-sm font-medium text-text-primary">{title}</p>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed mb-4">{detail}</p>
      <p className="text-[11px] font-mono text-text-tertiary">
        slug: <span className="text-text-secondary">{slug}</span>
      </p>
    </div>
  )
}
