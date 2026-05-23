'use client'

import Link from 'next/link'
import { Search, Bell, LogOut, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useMe } from '@/hooks/use-me'
import { useAuth } from '@/hooks/use-auth'
import { useSidebar } from '@/components/sidebar-context'
import { useCommandPalette } from '@/components/command-palette-context'
import { Avatar } from '@/components/avatar'
import { Logo } from '@/components/logo'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export function TopBar() {
  const { data } = useMe()
  const { signOut } = useAuth()
  const { collapsed, toggle } = useSidebar()
  const { setOpen: setCommandOpen } = useCommandPalette()

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-3 bg-bg sticky top-0 z-30">
      {/* Sidebar toggle */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
        className="size-7 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-surface transition-colors -ml-1"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>

      {/* Logo + workspace */}
      <Link href="/" className="flex items-center group">
        <Logo size={22} />
      </Link>

      {data?.user && (
        <>
          <span className="text-text-quaternary text-xs">/</span>
          <span className="font-mono text-xs text-text-secondary truncate max-w-[200px]">
            {data.user.company_slug}
          </span>
        </>
      )}

      {/* Command palette trigger */}
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="ml-auto inline-flex items-center gap-2 h-7 px-2.5 border border-border rounded-sm text-xs text-text-tertiary hover:border-border-strong hover:text-text-secondary transition-colors bg-surface"
      >
        <Search className="size-3" />
        <span>Search…</span>
        <kbd className="font-mono text-[10px] px-1 py-px border border-border rounded-[3px] bg-surface-2 text-text-secondary">
          ⌘K
        </kbd>
      </button>

      {/* Notifications */}
      <button
        type="button"
        className="size-7 inline-flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-secondary hover:bg-surface transition-colors"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
      </button>

      {/* User menu */}
      {data?.user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar seed={data.user.email} size={28} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{data.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Workspace settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut()} danger>
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
