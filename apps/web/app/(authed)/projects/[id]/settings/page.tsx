'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2, KeyRound, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { KeyRevealCard } from '@/components/key-reveal-card'
import { useProject, useDeleteProject, useUpdateProject } from '@/hooks/use-projects'
import { useMcpServer } from '@/hooks/use-mcp-server'
import { useRotateRuntimeKey } from '@/hooks/use-deployments'
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
          <GeneralSettings project={project} mcpServer={mcpServer} />

          <Card label="Source" hint="Set at project creation — not editable here.">
            <Row label="Type" value={SOURCE_LABELS[project.source_type] ?? project.source_type} />
            <Row label="Source URL" value={project.source_url ?? '—'} mono dim={!project.source_url} />
            <Row label="Branch / ref" value={project.source_ref ?? '—'} mono dim={!project.source_ref} />
            <Row
              label="Created"
              value={`${timeAgo(project.created_at)} · ${new Date(project.created_at).toLocaleDateString()}`}
            />
            <Row
              label="Updated"
              value={`${timeAgo(project.updated_at)} · ${new Date(project.updated_at).toLocaleDateString()}`}
            />
          </Card>

          {/* Runtime key — tenant auth for the MCP server */}
          <RuntimeKeySection
            projectId={projectId}
            hint={mcpServer?.mcp_server.runtime_key_hint ?? null}
            rotatedAt={mcpServer?.mcp_server.runtime_key_rotated_at ?? null}
            deployed={!!mcpServer}
          />

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

/* ─────────────────────────── General settings ─────────────────────────── */

function GeneralSettings({
  project,
  mcpServer,
}: {
  project: {
    id: string
    name: string
    slug: string
    base_api_url: string | null
    description: string | null
  }
  mcpServer: { mcp_server: { subdomain: string } } | null | undefined
}) {
  const update = useUpdateProject(project.id)
  const [name, setName] = useState(project.name)
  const [baseUrl, setBaseUrl] = useState(project.base_api_url ?? '')
  const [description, setDescription] = useState(project.description ?? '')

  useEffect(() => {
    setName(project.name)
    setBaseUrl(project.base_api_url ?? '')
    setDescription(project.description ?? '')
  }, [project.name, project.base_api_url, project.description])

  const dirty =
    name !== project.name ||
    baseUrl !== (project.base_api_url ?? '') ||
    description !== (project.description ?? '')

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (baseUrl.trim() && !/^https?:\/\//i.test(baseUrl.trim())) {
      toast.error('Base URL must start with http:// or https://')
      return
    }
    try {
      await update.mutateAsync({
        name: name.trim(),
        base_api_url: baseUrl.trim() ? baseUrl.trim() : null,
        description: description.trim() ? description.trim() : null,
      })
      toast.success('Project updated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    }
  }

  return (
    <section className="border border-border rounded-md bg-surface overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between gap-4">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          General
        </span>
        <span className="text-[11px] text-text-tertiary font-mono truncate">
          {project.slug}
          {mcpServer
            ? ` · ${mcpServer.mcp_server.subdomain}.${MCP_DOMAIN}`
            : ''}
        </span>
      </header>

      <div className="px-5 py-4 space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={update.isPending} />
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Base API URL</label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
            className="font-mono"
            disabled={update.isPending}
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            disabled={update.isPending}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || update.isPending}>
            {update.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>
    </section>
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

/* ─────────────────────────── Runtime key ─────────────────────────── */

function RuntimeKeySection({
  projectId,
  hint,
  rotatedAt,
  deployed,
}: {
  projectId: string
  hint: string | null
  rotatedAt: string | null
  deployed: boolean
}) {
  const rotate = useRotateRuntimeKey(projectId)
  const [revealed, setRevealed] = useState<string | null>(null)

  function confirmRotate() {
    toast(`Rotate the runtime key?`, {
      description:
        'Any MCP client using the current key will get 401 within ~60 s. You\'ll need to update each client config with the new key.',
      action: {
        label: 'Rotate',
        onClick: async () => {
          try {
            const res = await rotate.mutateAsync()
            setRevealed(res.runtime_key)
            toast.success('Runtime key rotated')
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
      <header className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          <KeyRound className="size-3" />
          Runtime auth key
        </span>
        <span className="text-[11px] text-text-tertiary">
          Required on every MCP request — Authorization: Bearer …
        </span>
      </header>

      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-text-secondary leading-relaxed">
          Hatch authenticates every call to{' '}
          <span className="font-mono text-text-secondary">{`{subdomain}.mcp.hatch.dev`}</span>{' '}
          with a per-project bearer key. Only the SHA-256 hash is stored — the plaintext
          appears exactly once, on rotate or initial deploy. The install snippet on the
          Deploy page bakes the active key into the Claude/Cursor config.
        </p>

        {!deployed && (
          <p className="text-xs text-text-tertiary font-mono">
            The key is minted on first deploy. Generate the MCP config and deploy to get
            one.
          </p>
        )}

        {deployed && hint && (
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-mono text-sm text-text-primary">hk_••••••{hint}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  active
                </span>
              </div>
              {rotatedAt && (
                <p className="text-[11px] font-mono text-text-tertiary">
                  last rotated {timeAgo(rotatedAt)}
                </p>
              )}
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={confirmRotate}
              disabled={rotate.isPending}
            >
              <RefreshCw className={cn('size-3.5', rotate.isPending && 'animate-spin')} />
              Rotate
            </Button>
          </div>
        )}

        {deployed && !hint && (
          <div className="flex items-center justify-between gap-3 border border-warning/20 bg-warning/5 rounded-sm px-3 py-2.5">
            <p className="text-xs text-warning">
              No key set — the runtime is rejecting all requests with 503. Click to mint one.
            </p>
            <Button
              size="sm"
              onClick={confirmRotate}
              disabled={rotate.isPending}
            >
              <KeyRound className="size-3" />
              Mint
            </Button>
          </div>
        )}

        {revealed && (
          <KeyRevealCard
            title="New runtime key — save it now"
            description="Update your MCP client config with this value. The old key stops working within ~60 s."
            plaintext={revealed}
            onDismiss={() => setRevealed(null)}
          />
        )}
      </div>
    </section>
  )
}
