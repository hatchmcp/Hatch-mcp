'use client'

import { useState, useMemo } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

type ClientTab = 'claude' | 'cursor' | 'json'

const tabs: { id: ClientTab; label: string }[] = [
  { id: 'claude', label: 'Claude Desktop' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'json', label: 'Raw JSON' },
]

export function InstallSnippet({
  serverName,
  subdomain,
  domain,
  runtimeKey,
  runtimeKeyHint,
}: {
  serverName: string
  subdomain: string
  domain: string
  // If present, the real key is baked into the snippet (fresh deploy / rotate).
  runtimeKey?: string
  // Otherwise we show a masked placeholder using just the last 4 chars.
  runtimeKeyHint?: string | null
}) {
  const [tab, setTab] = useState<ClientTab>('claude')
  const [copied, setCopied] = useState(false)

  const url = `https://${subdomain}.${domain}/sse`
  const liveUrl = `https://${subdomain}.${domain}`
  const keyValue = runtimeKey ?? `hk_••••••${runtimeKeyHint ?? '????'}`

  const config = useMemo(() => {
    return {
      mcpServers: {
        [serverName]: {
          url,
          headers: { Authorization: `Bearer ${keyValue}` },
        },
      },
    }
  }, [serverName, url, keyValue])

  const snippet = useMemo(() => {
    if (tab === 'json') {
      return JSON.stringify(config, null, 2)
    }
    if (tab === 'cursor') {
      // Cursor and Claude Desktop use the same mcpServers shape today
      return JSON.stringify(config, null, 2)
    }
    return JSON.stringify(config, null, 2)
  }, [tab, config])

  const helperPath = useMemo(() => {
    if (tab === 'claude')
      return '~/Library/Application Support/Claude/claude_desktop_config.json'
    if (tab === 'cursor') return '~/.cursor/mcp.json'
    return null
  }, [tab])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="border border-border rounded-md bg-bg overflow-hidden">
      {/* Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-mono uppercase tracking-wider">
            ● Deployed
          </span>
          <span className="font-mono text-xs text-text-secondary truncate">
            {subdomain}.{domain}
          </span>
        </div>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
        >
          View live
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'h-9 px-4 text-xs font-mono border-r border-border last:border-r-0 transition-colors',
              tab === t.id
                ? 'text-text-primary bg-bg border-b-2 border-b-accent -mb-px'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Helper path */}
      {helperPath && (
        <div className="px-4 py-2 border-b border-border text-[11px] text-text-tertiary font-mono flex items-center gap-2">
          <span className="uppercase tracking-wider text-text-quaternary">paste into</span>
          <span className="text-text-secondary truncate">{helperPath}</span>
        </div>
      )}

      {/* Code */}
      <div className="relative">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-border bg-surface text-[11px] text-text-tertiary hover:text-text-primary hover:border-border-strong transition-colors font-mono"
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
        <pre className="font-mono text-xs text-text-secondary p-4 overflow-auto leading-relaxed">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  )
}
