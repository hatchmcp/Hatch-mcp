'use client'

import Link from 'next/link'
import { Plus, KeyRound, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Avatar } from '@/components/avatar'
import { useOAuthApps } from '@/hooks/use-oauth-apps'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import type { OAuthApp } from '@/types/api'

export default function OAuthAppsPage() {
  const { data, isLoading, isError, error } = useOAuthApps()
  const apps = data?.apps ?? []

  const totalSessions = apps.reduce((n, a) => n + (a.active_session_count ?? 0), 0)

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <PageHeader
        title="OAuth apps"
        description={
          isLoading
            ? '—'
            : `${apps.length} app${apps.length === 1 ? '' : 's'}${
                totalSessions > 0 ? ` · ${totalSessions} connected user${totalSessions === 1 ? '' : 's'}` : ''
              }`
        }
        actions={
          <Button asChild size="md">
            <Link href="/oauth-apps/new">
              <Plus />
              New app
            </Link>
          </Button>
        }
      />

      <p className="text-sm text-text-secondary mb-6 max-w-[640px] leading-relaxed">
        Register your backend with Hatch so users can connect to your MCP server in
        one click — no PATs, no tokens to paste. Each app gets a client_id +
        client_secret you drop into your{' '}
        <span className="font-mono text-text-primary">hatch-oauth</span> setup.
      </p>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <div className="border border-error/20 bg-error/5 rounded-md p-4 text-sm">
          <p className="text-error font-medium mb-1">Could not load OAuth apps</p>
          <p className="text-text-secondary">
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {!isLoading && !isError && apps.length === 0 && (
        <EmptyState
          bracketArt={`┌──────────────┐
│  no apps     │
└──────────────┘`}
          title="No OAuth apps yet"
          description="Register your first app and your users can connect their account to Claude with a single click. No tokens to copy."
          action={
            <Button asChild>
              <Link href="/oauth-apps/new">
                <Plus />
                Register your first app
              </Link>
            </Button>
          }
        />
      )}

      {apps.length > 0 && (
        <ol className="space-y-2">
          {apps.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </ol>
      )}
    </div>
  )
}

function AppRow({ app }: { app: OAuthApp }) {
  const active = app.active_session_count ?? 0
  const total = app.session_count ?? 0
  const revoked = total - active

  return (
    <li>
      <Link
        href={`/oauth-apps/${app.id}`}
        className={cn(
          'group flex items-center gap-4 px-4 py-4 border border-border rounded-md bg-surface',
          'hover:border-border-strong hover:bg-surface-2 transition-colors'
        )}
      >
        {app.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.logo_url}
            alt={app.name}
            width={38}
            height={38}
            className="rounded-md object-contain bg-bg shrink-0"
          />
        ) : (
          <Avatar seed={app.name} size={38} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-text-primary truncate">
              {app.name}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-px border border-border rounded-[3px] text-text-tertiary">
              {app.slug}
            </span>
          </div>
          <p className="text-xs text-text-tertiary truncate">
            {app.description ?? <span className="text-text-quaternary">no description</span>}
          </p>
        </div>

        <div className="hidden md:flex flex-col items-end gap-0.5 mr-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary font-mono">
            <Users className="size-3 text-text-tertiary" />
            <span className="text-text-primary">{active}</span>
            {revoked > 0 && (
              <span className="text-text-tertiary">/ {total}</span>
            )}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            {active === 1 ? 'active session' : 'active sessions'}
          </span>
        </div>

        <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-tertiary">
            <KeyRound className="size-3" />
            {app.scopes.length} scope{app.scopes.length === 1 ? '' : 's'}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            created {timeAgo(app.created_at)}
          </span>
        </div>

        <ArrowRight className="size-3.5 text-text-quaternary group-hover:text-text-secondary transition-colors shrink-0" />
      </Link>
    </li>
  )
}
