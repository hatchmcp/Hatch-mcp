'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { MethodChip } from '@/components/method-chip'
import { CodeBlock } from '@/components/code-block'
import { cn } from '@/lib/utils'
import type { McpTool } from '@/types/api'

type Tab = 'schema' | 'http' | 'response'

export function ToolCard({
  tool,
  defaultOpen = false,
}: {
  tool: McpTool
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<Tab>('schema')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'schema', label: 'Schema' },
    { id: 'http', label: 'HTTP' },
    { id: 'response', label: 'Response' },
  ]

  return (
    <div
      className={cn(
        'border border-border rounded-md bg-surface overflow-hidden transition-colors',
        open && 'border-border-strong'
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
      >
        <ChevronRight
          className={cn(
            'size-3.5 text-text-tertiary shrink-0 transition-transform',
            open && 'rotate-90'
          )}
        />
        <MethodChip method={tool.http.method} />
        <span className="font-mono text-sm text-text-primary truncate">{tool.name}</span>
        <span className="font-mono text-xs text-text-tertiary truncate hidden md:inline">
          {tool.http.url_template}
        </span>
        <span className="ml-auto text-[11px] font-mono text-text-tertiary tabular-nums">
          {Object.keys(tool.input_schema.properties).length} args
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-border">
          {tool.description && (
            <p className="px-4 py-3 text-xs text-text-secondary leading-relaxed border-b border-border">
              {tool.description}
            </p>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'h-9 px-4 text-xs font-mono uppercase tracking-wider border-r border-border last:border-r-0 transition-colors',
                  tab === t.id
                    ? 'text-text-primary bg-bg border-b-2 border-b-accent -mb-px'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 bg-bg">
            {tab === 'schema' && (
              <CodeBlock
                code={JSON.stringify(tool.input_schema, null, 2)}
                language="json"
                maxHeight={420}
              />
            )}
            {tab === 'http' && (
              <CodeBlock
                code={JSON.stringify(
                  {
                    method: tool.http.method,
                    url_template: tool.http.url_template,
                    headers_template: tool.http.headers_template ?? undefined,
                    query_template: tool.http.query_template ?? undefined,
                    body_template: tool.http.body_template ?? undefined,
                  },
                  null,
                  2
                )}
                language="json"
                maxHeight={420}
              />
            )}
            {tab === 'response' && (
              <CodeBlock
                code={JSON.stringify(tool.response, null, 2)}
                language="json"
                maxHeight={420}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
