'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { useProject, useDeleteProject } from '@/hooks/use-projects'
import { useMcpServer } from '@/hooks/use-mcp-server'
import { timeAgo } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

const MCP_DOMAIN = process.env.NEXT_PUBLIC_MCP_DOMAIN ?? 'mcp.hatch.dev'

const SOURCE_LABELS: Record<string, string> = {
  github: 'GitHub',
  openapi: 'OpenAPI',
  postman: 'Postman',
  docs: 'Docs',
  paste: 'Paste',
}

export default function SettingsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id

  const { data, isLoading } = useProject(projectId)
  const { data: mcpServer } = useMcpServer(projectId)
  const project = data?.project

  return (
    <div className="max-w-[860px] mx-auto px-6 py-8">
      <PageHeader
        title={project?.name ?? 'Settings'}
        description="Project configuration"
      />

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-md" />
          <Skeleton className="h-40 rounded-md" />
        </div>
      )}

      {project && (
        <div className="space-y-5">
          {/* General — read-only info */}
          <Card label="General" hint="Sourced from the project record. Editing requires a PUT endpoint (not in the API yet).">
            <Row label="Name" value={project.name} mono={false} />
            <Row label="Slug" value={project.slug} mono />
            <Row
              label="Subdomain"
              value={
                mcpServer
                  ? `${mcpServer.mcp_server.subdomain}.${MCP_DOMAIN}`
                  : `<not generated yet>`
              }
              mono
              dim={!mcpServer}
            />
            <Row
              label="Source"
              value={SOURCE_LABELS[project.source_type] ?? project.source_type}
            />
            <Row label="Source URL" value={project.source_url ?? '—'} mono dim={!project.source_url} />
            <Row label="Branch / ref" value={project.source_ref ?? '—'} mono dim={!project.source_ref} />
            <Row label="Base API URL" value={project.base_api_url ?? '—'} mono dim={!project.base_api_url} />
            <Row
              label="Description"
              value={project.description ?? '—'}
              dim={!project.description}
            />
            <Row
              label="Created"
              value={`${timeAgo(project.created_at)} · ${new Date(project.created_at).toLocaleDateString()}`}
            />
            <Row
              label="Updated"
              value={`${timeAgo(project.updated_at)} · ${new Date(project.updated_at).toLocaleDateString()}`}
            />
          </Card>

          {/* Webhooks placeholder */}
          <Card label="Webhooks" hint="Auto-redeploy on GitHub push.">
            <div className="px-5 py-4 text-xs text-text-tertiary font-mono">
              Coming next — needs the <span className="text-text-secondary">/webhooks</span>{' '}
              management endpoint.
            </div>
          </Card>

          {/* Danger zone */}
          <DangerZone project={project} />
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
        {hint && (
          <span className="text-[11px] text-text-tertiary truncate">{hint}</span>
        )}
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
}: {
  label: string
  value: string
  mono?: boolean
  dim?: boolean
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-center px-5 py-2.5">
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
    </div>
  )
}

/* ─────────────────────────── Danger zone ─────────────────────────── */

function DangerZone({ project }: { project: { id: string; name: string } }) {
  const router = useRouter()
  const deleteProject = useDeleteProject()
  const [confirm, setConfirm] = useState('')

  const matches = confirm === project.name
  const pending = deleteProject.isPending

  async function handleDelete() {
    if (!matches) return
    try {
      await deleteProject.mutateAsync(project.id)
      toast.success(`Deleted ${project.name}`)
      router.replace('/')
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
          <p className="text-sm font-medium text-text-primary mb-1">Delete this project</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            This permanently removes the project, all extracted endpoints, generated tool
            versions, deployments, and encrypted secrets. The subdomain becomes available
            for reuse. There is no undo.
          </p>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">
            Type <span className="font-mono text-text-primary">{project.name}</span> to confirm
          </label>
          <Input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={project.name}
            className="font-mono"
            disabled={pending}
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-end">
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!matches || pending}
          >
            {pending ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 />
                Delete project
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}
