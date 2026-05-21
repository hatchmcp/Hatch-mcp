'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-me'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types/api'

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_LIMITS: Record<Plan, { rpm: number; monthly: string }> = {
  free: { rpm: 60, monthly: '10,000' },
  pro: { rpm: 600, monthly: '500,000' },
  enterprise: { rpm: 6_000, monthly: '10,000,000' },
}

export default function WorkspaceSettingsPage() {
  const { data, isLoading } = useMe()
  const user = data?.user

  return (
    <div className="max-w-[860px] mx-auto px-6 py-8">
      <PageHeader title="Workspace settings" description="Account, workspace, plan" />

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-md" />
          ))}
        </div>
      )}

      {user && (
        <div className="space-y-5">
          {/* Profile */}
          <Card label="Profile">
            <div className="px-5 py-4 flex items-center gap-4">
              <Avatar seed={user.email} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.email}
                </p>
                <p className="text-xs text-text-tertiary font-mono">
                  {user.role} · joined {timeAgo(user.created_at)}
                </p>
              </div>
            </div>
            <Row label="User ID" value={user.id} mono dim copyable />
          </Card>

          {/* Workspace */}
          <Card label="Workspace">
            <Row label="Name" value={user.company_name} />
            <Row label="Slug" value={user.company_slug} mono copyable />
            <Row
              label="Plan"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-text-primary">{PLAN_LABELS[user.plan]}</span>
                  {user.plan === 'free' && (
                    <span className="px-1.5 py-px text-[10px] font-mono uppercase tracking-wider border border-border rounded-[3px] text-text-tertiary">
                      default
                    </span>
                  )}
                </span>
              }
            />
          </Card>

          {/* Billing */}
          <Card label="Billing & limits">
            <Row
              label="Rate limit"
              value={
                <span>
                  <span className="font-mono">{PLAN_LIMITS[user.plan].rpm}</span>{' '}
                  <span className="text-text-tertiary">requests / minute</span>
                </span>
              }
            />
            <Row
              label="Monthly cap"
              value={
                <span>
                  <span className="font-mono">{PLAN_LIMITS[user.plan].monthly}</span>{' '}
                  <span className="text-text-tertiary">calls / month</span>
                </span>
              }
            />
            {user.plan === 'free' && (
              <div className="px-5 py-3 bg-bg border-t border-border flex items-center justify-between gap-4">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Need more? Pro raises the cap to 500k/month and unlocks priority support.
                </p>
                <Button variant="secondary" size="sm" disabled>
                  Upgrade <span className="text-text-quaternary ml-1">(soon)</span>
                </Button>
              </div>
            )}
          </Card>

          {/* Members */}
          <Card
            label="Members"
            hint="Invite teammates — coming with the next backend release."
          >
            <div className="px-5 py-4 flex items-center gap-3">
              <Avatar seed={user.email} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{user.email}</p>
                <p className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
                  {user.role}
                </p>
              </div>
              <Button variant="secondary" size="sm" disabled>
                Invite <span className="text-text-quaternary ml-1">(soon)</span>
              </Button>
            </div>
          </Card>

          {/* API keys */}
          <Card
            label="API keys"
            hint="Programmatic access — coming with the next backend release."
          >
            <div className="px-5 py-4 text-xs text-text-tertiary font-mono">
              No keys yet. Once the management endpoint lands, generate one here for the
              REST API + CLI.
            </div>
          </Card>

          {/* Resources */}
          <Card label="Resources">
            <ExternalRow
              label="GitHub repository"
              href="https://github.com/hatchmcp/Hatch-mcp"
              value="hatchmcp/Hatch-mcp"
            />
            <ExternalRow
              label="MCP protocol spec"
              href="https://modelcontextprotocol.io/"
              value="modelcontextprotocol.io"
            />
          </Card>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Bits ─────────────────────────── */

function Card({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between gap-4">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        {hint && <span className="text-[11px] text-text-tertiary truncate">{hint}</span>}
      </header>
      <dl className="divide-y divide-border">{children}</dl>
    </section>
  )
}

function Row({
  label,
  value,
  mono,
  dim,
  copyable,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  dim?: boolean
  copyable?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const text = typeof value === 'string' ? value : null

  async function handleCopy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
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
      {copyable && text && (
        <button
          type="button"
          onClick={handleCopy}
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
  )
}

function ExternalRow({
  label,
  href,
  value,
}: {
  label: string
  href: string
  value: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[160px_1fr_auto] gap-4 items-center px-5 py-2.5 group hover:bg-surface-2 transition-colors"
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <span className="text-sm font-mono text-text-secondary group-hover:text-text-primary truncate transition-colors">
        {value}
      </span>
      <ExternalLink className="size-3 text-text-tertiary group-hover:text-text-primary transition-colors" />
    </a>
  )
}
