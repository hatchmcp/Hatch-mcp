'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { TopBar } from '@/components/top-bar'
import { Sidebar } from '@/components/sidebar'
import { SidebarProvider, useSidebar } from '@/components/sidebar-context'

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
      <Shell>{children}</Shell>
    </SidebarProvider>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { toggle } = useSidebar()

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
    <div className="min-h-screen flex flex-col bg-bg">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
