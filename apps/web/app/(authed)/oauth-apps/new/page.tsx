'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Info,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { KeyRevealCard } from '@/components/key-reveal-card'
import { CodeBlock } from '@/components/code-block'
import { useCreateOAuthApp } from '@/hooks/use-oauth-apps'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { CreateOAuthAppResponse } from '@/types/api'

export default function NewOAuthAppPage() {
  const router = useRouter()
  const create = useCreateOAuthApp()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')
  const [scopesText, setScopesText] = useState('')

  const [result, setResult] = useState<CreateOAuthAppResponse | null>(null)

  // Auto-derive slug from name unless the user has typed in slug themselves
  const derivedSlug = useMemo(() => slugify(name), [name])
  const effectiveSlug = slugTouched ? slug : derivedSlug

  const scopes = useMemo(
    () =>
      scopesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [scopesText]
  )

  const valid =
    name.trim().length >= 2 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(effectiveSlug) &&
    /^https?:\/\//i.test(callbackUrl.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || create.isPending) return

    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        slug: effectiveSlug,
        description: description.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        callback_url: callbackUrl.trim(),
        scopes,
      })
      setResult(res)
      toast.success(`Registered ${res.name}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not register app')
    }
  }

  /* ─────────────────────────── Reveal state ─────────────────────────── */
  if (result) {
    return (
      <RevealScreen
        result={result}
        onDone={() => router.replace(`/oauth-apps`)}
      />
    )
  }

  /* ─────────────────────────── Form state ─────────────────────────── */
  return (
    <div className="max-w-[720px] mx-auto px-6 py-8">
      <Link
        href="/oauth-apps"
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary mb-4"
      >
        <ArrowLeft className="size-3" />
        Back to OAuth apps
      </Link>

      <PageHeader
        title="Register an OAuth app"
        description="One-click Connect for your MCP server"
      />

      <p className="text-sm text-text-secondary mb-6 max-w-[560px] leading-relaxed">
        Tell Hatch about your app. We&apos;ll mint a client_id + client_secret you
        drop into your backend (via the{' '}
        <span className="font-mono text-text-primary">hatch-oauth</span> package).
      </p>

      <form
        onSubmit={handleSubmit}
        className="border border-border rounded-md bg-surface p-6 space-y-5"
      >
        <Field
          label="App name"
          hint="Shown on the Connect consent screen and in the dashboard."
        >
          <Input
            type="text"
            placeholder="DevShowcase"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </Field>

        <Field
          label="Slug"
          hint={
            <>
              Lives in your connect URL:{' '}
              <span className="font-mono text-text-secondary">
                /oauth/connect/{effectiveSlug || 'your-slug'}
              </span>
              . Lowercase letters, digits, dashes.
            </>
          }
        >
          <Input
            type="text"
            placeholder={derivedSlug || 'devshowcase'}
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugTouched(true)
            }}
            className="font-mono"
            required
          />
        </Field>

        <Field
          label="Description (optional)"
          hint="One line that shows under your app name on the Connect screen."
        >
          <Input
            type="text"
            placeholder="Developer portfolio platform"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </Field>

        <Field
          label="Logo URL (optional)"
          hint="Square image. Defaults to a generated initials avatar if blank."
        >
          <Input
            type="url"
            placeholder="https://yourapp.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </Field>

        <Field
          label="Callback URL"
          hint="Where Hatch sends users to sign in to your app. The Connect button on the consent screen navigates here."
        >
          <Input
            type="url"
            placeholder="https://yourapp.com/auth/hatch-callback"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            className="font-mono"
            required
          />
        </Field>

        <Field
          label="Scopes (optional)"
          hint="One per line — shown as bullets on the consent screen, e.g. “Read your projects”."
        >
          <textarea
            placeholder={`Read your projects\nCreate posts on your behalf`}
            value={scopesText}
            onChange={(e) => setScopesText(e.target.value)}
            rows={4}
            className={cn(
              'flex w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-tertiary resize-none font-mono',
              'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/10',
              'transition-colors'
            )}
            maxLength={2000}
          />
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[11px] text-text-tertiary">
            You&apos;ll see the client_secret exactly once on the next screen.
          </span>
          <Button type="submit" disabled={!valid || create.isPending}>
            {create.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Registering…
              </>
            ) : (
              <>
                <Sparkles />
                Register app
                <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

/* ─────────────────────────── Reveal screen ─────────────────────────── */

function RevealScreen({
  result,
  onDone,
}: {
  result: CreateOAuthAppResponse
  onDone: () => void
}) {
  const installSnippet = useMemo(
    () =>
      [
        `// 1. Add to your .env`,
        `HATCH_CLIENT_ID=${result.client_id}`,
        `HATCH_CLIENT_SECRET=${result.client_secret}`,
        ``,
        `// 2. Wire into your auth callback`,
        `import { HatchOAuth } from 'hatch-oauth'`,
        ``,
        `const hatch = new HatchOAuth({`,
        `  clientId: process.env.HATCH_CLIENT_ID!,`,
        `  clientSecret: process.env.HATCH_CLIENT_SECRET!,`,
        `})`,
        ``,
        `// 3. After your user logs in:`,
        `const { hatch_token } = await hatch.storeToken({`,
        `  user_id: session.user.id,`,
        `  real_token: session.access_token,`,
        `  state: req.query.hatch_state as string | undefined,`,
        `})`,
      ].join('\n'),
    [result.client_id, result.client_secret]
  )

  return (
    <div className="max-w-[720px] mx-auto px-6 py-8 space-y-5">
      {/* Success banner */}
      <div className="border border-accent/30 bg-accent/5 rounded-md px-5 py-4 flex items-start gap-3">
        <CheckCircle2 className="size-4 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">
            Registered <span className="font-mono">{result.name}</span>
          </p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Hatch generated your credentials. Save the client_secret now — it&apos;s
            only shown on this screen.
          </p>
        </div>
      </div>

      {/* Client ID (always visible) */}
      <section className="border border-border rounded-md bg-surface overflow-hidden">
        <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Client ID
          </span>
          <span className="text-[11px] text-text-tertiary">public, OK to commit</span>
        </header>
        <CopyableValue value={result.client_id} />
      </section>

      {/* Client secret (one-time reveal) */}
      <KeyRevealCard
        title="Client secret — save it now"
        description="Used by your backend to authenticate to Hatch when calling storeToken / revoke / sessions. Hatch only stores its bcrypt hash from here on — rotate from the app dashboard if you lose it."
        plaintext={result.client_secret}
      />

      {/* Connect URL */}
      <section className="border border-border rounded-md bg-surface overflow-hidden">
        <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Your Connect URL
          </span>
          <a
            href={result.connect_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
          >
            preview
            <ExternalLink className="size-3" />
          </a>
        </header>
        <CopyableValue value={result.connect_url} mono />
      </section>

      {/* Install snippet */}
      <section>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1 flex items-center gap-1.5">
          <Info className="size-3" />
          Drop this into your backend
        </h3>
        <CodeBlock code={installSnippet} language="typescript" maxHeight={420} />
      </section>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        <Button asChild variant="secondary">
          <Link href={`/oauth-apps/${result.id}`}>
            View app dashboard
            <ArrowRight />
          </Link>
        </Button>
        <Button onClick={onDone}>
          <CheckCircle2 />
          I&apos;ve saved everything
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────── Bits ─────────────────────────── */

function CopyableValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="flex items-stretch border-t-0 bg-bg">
      <code
        className={cn(
          'flex-1 px-4 py-3 text-sm text-text-primary select-all break-all',
          mono && 'font-mono'
        )}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="px-4 inline-flex items-center gap-1.5 text-[11px] font-mono text-text-tertiary hover:text-text-primary border-l border-border bg-surface-2 transition-colors"
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
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1.5 block">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-text-tertiary mt-1.5 flex items-start gap-1.5">
          <Info className="size-3 shrink-0 mt-px" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  )
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
