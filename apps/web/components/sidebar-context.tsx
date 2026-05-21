'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'hatch:sidebar:collapsed'

interface SidebarCtx {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarCtx | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Read once on first client render so the sidebar boots in the right state
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle: () => setCollapsed((v) => !v) }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarCtx {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside SidebarProvider')
  return ctx
}
