'use client'

import { ExternalLink, BookOpen, Github, FileCode2, Terminal } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'

interface DocLink {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  external?: boolean
}

const sections: { label: string; links: DocLink[] }[] = [
  {
    label: 'Get started',
    links: [
      {
        icon: BookOpen,
        title: 'Quickstart',
        description: 'Paste an OpenAPI URL → ship an MCP server in 60 seconds.',
        href: 'https://github.com/hatchmcp/Hatch-mcp#quickstart',
        external: true,
      },
      {
        icon: Terminal,
        title: 'CLI reference',
        description: '`hatch new`, `hatch deploy`, `hatch rollback` — coming next.',
        href: 'https://github.com/hatchmcp/Hatch-mcp',
        external: true,
      },
    ],
  },
  {
    label: 'Reference',
    links: [
      {
        icon: FileCode2,
        title: 'MCP protocol',
        description: 'Anthropic’s Model Context Protocol — the spec every Hatch server implements.',
        href: 'https://modelcontextprotocol.io/',
        external: true,
      },
      {
        icon: FileCode2,
        title: 'REST API (yours)',
        description: 'Hatch’s own API used by this dashboard — /api/v1/projects, /jobs/:id/stream…',
        href: 'https://github.com/hatchmcp/Hatch-mcp/blob/main/apps/api/src/routes',
        external: true,
      },
    ],
  },
  {
    label: 'Community',
    links: [
      {
        icon: Github,
        title: 'GitHub',
        description: 'Source, issues, roadmap. Star it if you find it useful.',
        href: 'https://github.com/hatchmcp/Hatch-mcp',
        external: true,
      },
    ],
  },
]

export default function DocsPage() {
  return (
    <div className="max-w-[860px] mx-auto px-6 py-8">
      <PageHeader
        title="Docs"
        description="Quickstart, references, and protocol links"
      />

      <p className="text-sm text-text-secondary mb-8 max-w-[640px] leading-relaxed">
        Hatch&apos;s in-app docs live on GitHub for now (one place, version-controlled with
        the codebase). A first-party docs site comes with the next release.
      </p>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.label}>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2 px-1">
              {section.label}
            </h3>
            <div className="border border-border rounded-md bg-surface overflow-hidden">
              {section.links.map((link, i) => (
                <DocRow key={link.href} link={link} isLast={i === section.links.length - 1} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function DocRow({ link, isLast }: { link: DocLink; isLast: boolean }) {
  const Icon = link.icon
  return (
    <a
      href={link.href}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
      className={cn(
        'flex items-start gap-3.5 px-5 py-4 group transition-colors',
        !isLast && 'border-b border-border',
        'hover:bg-surface-2'
      )}
    >
      <Icon className="size-4 text-text-tertiary mt-0.5 shrink-0 group-hover:text-text-secondary transition-colors" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary group-hover:text-text-primary transition-colors mb-0.5">
          {link.title}
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">{link.description}</p>
      </div>
      {link.external && (
        <ExternalLink className="size-3 text-text-tertiary mt-1 shrink-0 group-hover:text-text-secondary transition-colors" />
      )}
    </a>
  )
}
