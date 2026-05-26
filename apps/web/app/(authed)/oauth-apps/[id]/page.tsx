'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Loader2,
  Users,
  Activity as ActivityIcon,
  Trash2,
  AlertTriangle,
  Edit2,
  Save,
  X,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { KeyRevealCard } from '@/components/key-reveal-card'
import { Avatar } from '@/components/avatar'
import {
  useOAuthApp,
  useUpdateOAuthApp,
  useDeleteOAuthApp,
  useRotateOAuthSecret,
  useOAuthAppSessions,
  useRevokeOAuthSession,
  useOAuthAppAccessLog,
} from '@/hooks/use-oauth-apps'
import { timeAgo } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { OAuthApp, OAuthAppSession, UpdateOAuthAppInput } from '@/types/api'

export default function OAuthAppDetailPage() {
  const params = useParams<{ id: string }>()
  const appId = params.id

  const { data, isLoading, isError, error } = useOAuthApp(appId)

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">
      <Link
        href="/oauth-apps"
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary mb-4"
      >
        <ArrowLeft className="size-3" />
        Back to OAuth apps
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-60 rounded-md" />
          <Skeleton className="h-44 rounded-md" />
        </div>
      )}

      {isError && (
        <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
          <p className="text-error font-medium mb-1">Could not load OAuth app</p>
          <p className="text-text-secondary">
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {data && <Body app={data.app} />}
    </div>
  )
}

/* ─────────────────────────── Body ─────────────────────────── */

function Body({ app }: { app: OAuthApp }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={app.name}
        description={`slug · ${app.slug}`}
      />

      <GeneralSection app={app} />
      <CredentialsSection app={app} />
      <SessionsSection appId={app.id} />
      <AccessLogSection appId={app.id} />
      <DangerZoneSection app={app} />
    </div>
  )
}

/* ─────────────────────────── General (editable) ─────────────────────────── */

function GeneralSection({ app }: { app: OAuthApp }) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateOAuthApp(app.id)

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          General
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        )}
      </header>

      {editing ? (
        <EditForm
          app={app}
          onCancel={() => setEditing(false)}
          onSave={async (patch) => {
            try {
              await update.mutateAsync(patch)
              setEditing(false)
              toast.success('App updated')
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Update failed')
            }
          }}
          pending={update.isPending}
        />
      ) : (
        <dl className="divide-y divide-border">
          <Row label="Name" value={app.name} />
          <Row label="Slug" value={app.slug} mono />
          <Row label="Description" value={app.description ?? '—'} dim={!app.description} />
          <Row label="Logo URL" value={app.logo_url ?? '—'} mono dim={!app.logo_url} />
          <Row label="Callback URL" value={app.callback_url} mono />
          <Row
            label="Scopes"
            value={
              app.scopes.length === 0
                ? '—'
                : app.scopes.join(' · ')
            }
            dim={app.scopes.length === 0}
          />
          <Row
            label="Connect URL"
            value={app.connect_url}
            mono
            copyable
            preview
          />
          <Row
            label="Created"
            value={`${timeAgo(app.created_at)} · ${new Date(app.created_at).toLocaleDateString()}`}
          />
        </dl>
      )}
    </section>
  )
}

function EditForm({
  app,
  onSave,
  onCancel,
  pending,
}: {
  app: OAuthApp
  onSave: (patch: UpdateOAuthAppInput) => void
  onCancel: () => void
  pending: boolean
}) {
  const [name, setName] = useState(app.name)
  const [description, setDescription] = useState(app.description ?? '')
  const [logoUrl, setLogoUrl] = useState(app.logo_url ?? '')
  const [callbackUrl, setCallbackUrl] = useState(app.callback_url)
  const [scopesText, setScopesText] = useState(app.scopes.join('\n'))

  function submit() {
    const scopes = scopesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    onSave({
      name: name.trim() !== app.name ? name.trim() : undefined,
      description: description.trim() !== (app.description ?? '') ? description.trim() || null : undefined,
      logo_url: logoUrl.trim() !== (app.logo_url ?? '') ? logoUrl.trim() || null : undefined,
      callback_url: callbackUrl.trim() !== app.callback_url ? callbackUrl.trim() : undefined,
      scopes:
        JSON.stringify(scopes) !== JSON.stringify(app.scopes) ? scopes : undefined,
    })
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <EditRow label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
      </EditRow>
      <EditRow label="Description">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          maxLength={500}
        />
      </EditRow>
      <EditRow label="Logo URL">
        <Input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          disabled={pending}
        />
      </EditRow>
      <EditRow label="Callback URL">
        <Input
          type="url"
          value={callbackUrl}
          onChange={(e) => setCallbackUrl(e.target.value)}
          disabled={pending}
          className="font-mono text-xs"
        />
      </EditRow>
      <EditRow label="Scopes (one per line)">
        <textarea
          value={scopesText}
          onChange={(e) => setScopesText(e.target.value)}
          disabled={pending}
          rows={4}
          className={cn(
            'flex w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text-primary',
            'placeholder:text-text-tertiary resize-none font-mono',
            'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/10',
            'transition-colors'
          )}
        />
      </EditRow>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
          <X />
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save />
              Save changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
      <label className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mt-2.5">
        {label}
      </label>
      <div>{children}</div>
    </div>
  )
}

/* ─────────────────────────── Credentials ─────────────────────────── */

function CredentialsSection({ app }: { app: OAuthApp }) {
  const rotate = useRotateOAuthSecret(app.id)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [copiedClient, setCopiedClient] = useState(false)

  async function copyClientId() {
    try {
      await navigator.clipboard.writeText(app.client_id)
      setCopiedClient(true)
      setTimeout(() => setCopiedClient(false), 2000)
    } catch {
      /* ignore */
    }
  }

  function confirmRotate() {
    toast('Rotate client_secret?', {
      description:
        "The current secret stops working immediately — your backend must be updated to the new value before the next storeToken call.",
      action: {
        label: 'Rotate',
        onClick: async () => {
          try {
            const res = await rotate.mutateAsync()
            setRevealedSecret(res.client_secret)
            toast.success('client_secret rotated')
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Rotate failed')
          }
        },
      },
      duration: 8000,
    })
  }

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center gap-2">
        <KeyRound className="size-3 text-text-tertiary" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Credentials
        </span>
      </header>

      <div className="divide-y divide-border">
        <div className="px-5 py-3 grid grid-cols-[160px_1fr_auto] gap-4 items-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Client ID
          </span>
          <span className="font-mono text-sm text-text-primary truncate">
            {app.client_id}
          </span>
          <button
            type="button"
            onClick={copyClientId}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm border border-border bg-bg text-[11px] text-text-tertiary hover:text-text-primary hover:border-border-strong transition-colors font-mono"
          >
            {copiedClient ? (
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

        <div className="px-5 py-3 grid grid-cols-[160px_1fr_auto] gap-4 items-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Client secret
          </span>
          <span className="font-mono text-sm text-text-secondary">
            hcs_••••••••••••••••
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={confirmRotate}
            disabled={rotate.isPending}
          >
            <RefreshCw className={cn('size-3', rotate.isPending && 'animate-spin')} />
            Rotate
          </Button>
        </div>
      </div>

      {revealedSecret && (
        <div className="px-5 py-4 border-t border-border">
          <KeyRevealCard
            title="New client_secret — save it now"
            description="Update HATCH_CLIENT_SECRET in your backend env. The previous secret stopped working the moment you clicked Rotate."
            plaintext={revealedSecret}
            onDismiss={() => setRevealedSecret(null)}
          />
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── Connected sessions ─────────────────────────── */

function SessionsSection({ appId }: { appId: string }) {
  const { data, isLoading } = useOAuthAppSessions(appId)
  const sessions = data?.sessions ?? []
  const active = sessions.filter((s) => !s.revoked).length

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          <Users className="size-3" />
          Connected users
        </span>
        <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
          <span className="text-text-primary">{active}</span> active
          {sessions.length !== active && (
            <>
              {' '}/ <span className="text-text-secondary">{sessions.length}</span> total
            </>
          )}
        </span>
      </header>

      {isLoading && (
        <div className="px-5 py-8 flex items-center justify-center">
          <Loader2 className="size-4 text-text-tertiary animate-spin" />
        </div>
      )}

      {!isLoading && sessions.length === 0 && (
        <div className="px-5 py-8 text-center text-xs text-text-tertiary font-mono">
          no users connected yet
        </div>
      )}

      {sessions.length > 0 && (
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} appId={appId} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SessionRow({ session, appId }: { session: OAuthAppSession; appId: string }) {
  const revoke = useRevokeOAuthSession(appId)

  function confirmRevoke() {
    toast(`Revoke session for ${session.user_id}?`, {
      description: 'The next exchange call from this user will fail; they need to Connect again.',
      action: {
        label: 'Revoke',
        onClick: () =>
          revoke.mutate(session.id, {
            onSuccess: () => toast.success('Session revoked'),
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : 'Revoke failed'),
          }),
      },
      duration: 6000,
    })
  }

  return (
    <li
      className={cn(
        'px-5 py-3 grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center',
        session.revoked && 'opacity-60'
      )}
    >
      <Avatar seed={session.user_id} size={26} />
      <div className="min-w-0">
        <p className="text-sm font-mono text-text-primary truncate">{session.user_id}</p>
        <p className="text-[11px] text-text-tertiary truncate">
          {session.scopes.length > 0 ? session.scopes.join(' · ') : 'no scopes'}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-[11px] text-text-tertiary tabular-nums">
          <span className="text-text-primary">{session.access_count}</span> calls
        </p>
        <p className="font-mono text-[10px] text-text-tertiary">
          {session.last_used_at ? timeAgo(session.last_used_at) : 'never used'}
        </p>
      </div>
      {session.revoked ? (
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          REVOKED
        </span>
      ) : (
        <span className="text-[10px] font-mono uppercase tracking-wider text-accent">
          ACTIVE
        </span>
      )}
      {session.revoked ? (
        <span aria-hidden className="w-[68px]" />
      ) : (
        <Button
          variant="danger"
          size="sm"
          onClick={confirmRevoke}
          disabled={revoke.isPending}
        >
          Revoke
        </Button>
      )}
    </li>
  )
}

/* ─────────────────────────── Access log ─────────────────────────── */

function AccessLogSection({ appId }: { appId: string }) {
  const { data, isLoading } = useOAuthAppAccessLog(appId)
  const log = data?.log ?? []

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center gap-2">
        <ActivityIcon className="size-3 text-text-tertiary" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          Recent access
        </span>
        <span className="ml-auto text-[11px] font-mono text-text-tertiary tabular-nums">
          {log.length} call{log.length === 1 ? '' : 's'}
        </span>
      </header>

      {isLoading && (
        <div className="px-5 py-8 flex items-center justify-center">
          <Loader2 className="size-4 text-text-tertiary animate-spin" />
        </div>
      )}

      {!isLoading && log.length === 0 && (
        <div className="px-5 py-8 text-center text-xs text-text-tertiary font-mono">
          no exchanges yet
        </div>
      )}

      {log.length > 0 && (
        <ul className="divide-y divide-border">
          {log.map((entry) => (
            <li
              key={entry.id}
              className="px-5 py-2 grid grid-cols-[140px_minmax(120px,1fr)_minmax(120px,1fr)_auto] gap-4 items-center text-xs"
            >
              <span
                className="font-mono text-[11px] text-text-tertiary tabular-nums whitespace-nowrap"
                title={new Date(entry.accessed_at).toLocaleString()}
              >
                {timeAgo(entry.accessed_at)}
              </span>
              <span className="font-mono text-[11px] text-text-secondary truncate">
                {entry.tool_name ?? <span className="text-text-quaternary">—</span>}
              </span>
              <span className="font-mono text-[11px] text-text-primary truncate">
                {entry.user_id}
              </span>
              <span className="font-mono text-[10px] text-text-tertiary truncate text-right max-w-[200px]">
                {entry.ip_address ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ─────────────────────────── Danger zone ─────────────────────────── */

function DangerZoneSection({ app }: { app: OAuthApp }) {
  const router = useRouter()
  const del = useDeleteOAuthApp()
  const [confirm, setConfirm] = useState('')
  const matches = confirm === app.slug

  async function handleDelete() {
    if (!matches) return
    try {
      await del.mutateAsync(app.id)
      toast.success(`Deleted ${app.name}`)
      router.replace('/oauth-apps')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    }
  }

  return (
    <section className="border border-error/20 rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-error/20 bg-error/5 flex items-center gap-2">
        <AlertTriangle className="size-3.5 text-error" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-error">
          Danger zone
        </span>
      </header>

      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary mb-1">Delete this OAuth app</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Permanently removes the app and all its connected user sessions. The
            <span className="font-mono"> client_id </span> stops working immediately —
            any backend still using it will get 401s. There&apos;s no undo.
          </p>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">
            Type <span className="font-mono text-text-primary">{app.slug}</span> to confirm
          </label>
          <Input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={app.slug}
            className="font-mono"
            disabled={del.isPending}
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-end">
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!matches || del.isPending}
          >
            {del.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 />
                Delete app
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── Bits ─────────────────────────── */

function Row({
  label,
  value,
  mono,
  dim,
  copyable,
  preview,
}: {
  label: string
  value: string
  mono?: boolean
  dim?: boolean
  copyable?: boolean
  preview?: boolean
}) {
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
    <div className="grid grid-cols-[160px_1fr_auto] gap-4 items-center px-5 py-2.5">
      <dt className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm truncate',
          mono && 'font-mono',
          dim ? 'text-text-tertiary' : 'text-text-primary'
        )}
      >
        {value}
      </dd>
      {(copyable || preview) && (
        <div className="flex items-center gap-1">
          {preview && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center size-7 rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
              aria-label="Open"
            >
              <ExternalLink className="size-3" />
            </a>
          )}
          {copyable && (
            <button
              type="button"
              onClick={copy}
              className="size-7 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
              aria-label="Copy"
            >
              {copied ? (
                <Check className="size-3 text-accent" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
