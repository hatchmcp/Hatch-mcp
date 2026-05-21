'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { TopBar } from '@/components/top-bar'
import { Sidebar } from '@/components/sidebar'
import { SidebarProvider, useSidebar } from '@/components/sidebar-context'
import { JobRailProvider, useJobRail } from '@/components/job-rail-context'
import { JobRail } from '@/components/job-rail'
import { CommandPaletteProvider } from '@/components/command-palette-context'
import { CommandPalette } from '@/components/command-palette'
import { MobileBlock } from '@/components/mobile-block'
import { cn } from '@/lib/utils'

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [loading, session, router])

  if (loading || !session) {
    return <div className="min-h-screen bg-bg" />
  }

  return (
    <SidebarProvider>
      <JobRailProvider>
        <CommandPaletteProvider>
          <Shell>{children}</Shell>
        </CommandPaletteProvider>
      </JobRailProvider>
    </SidebarProvider>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { toggle } = useSidebar()
  const { activeJob, expanded: railExpanded } = useJobRail()
  const railOpen = !!activeJob && railExpanded

  // Global ⌘\ / Ctrl+\ to toggle the sidebar
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [toggle])

  return (
    <>
      {/* < lg (1024px): show "use a larger screen" message — dashboard is desktop-only */}
      <div className="lg:hidden">
        <MobileBlock />
      </div>

      {/* >= lg: full shell */}
      <div className="hidden lg:flex min-h-screen flex-col bg-bg">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main
            className={cn(
              'flex-1 min-w-0 overflow-y-auto transition-[padding] duration-200 ease-out',
              railOpen && 'pr-[320px]'
            )}
          >
            {children}
          </main>
        </div>
        <JobRail />
        <CommandPalette />
      </div>
    </>
  )
}
