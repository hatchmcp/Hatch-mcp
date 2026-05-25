import Link from 'next/link'
import { Sparkles, Package } from 'lucide-react'

/**
 * Soft notice shown on hosted-runtime-only pages (Deploy / Deployments /
 * Analytics) while the runtime is on the roadmap. Points users at the
 * Export page so they can ship code locally in the meantime.
 */
export function HostedRuntimeNotice({
  projectId,
  className,
}: {
  projectId: string
  className?: string
}) {
  return (
    <div
      className={`border border-warning/20 bg-warning/5 rounded-md px-4 py-3 mb-5 flex items-start gap-3 ${className ?? ''}`}
    >
      <Sparkles className="size-3.5 text-warning shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-medium mb-0.5">
          Hosted runtime — coming soon
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          This page lights up once we launch the managed{' '}
          <span className="font-mono">{`{slug}.mcp.hatch.dev`}</span> runtime. Until then,
          take your generated MCP server with you — download the zip or push it to
          your own repo.
        </p>
      </div>
      <Link
        href={`/projects/${projectId}/export`}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm border border-border bg-surface text-xs text-text-primary hover:border-border-strong transition-colors shrink-0"
      >
        <Package className="size-3" />
        Export
      </Link>
    </div>
  )
}
