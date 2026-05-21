'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { JobType } from '@/types/api'

const STORAGE_KEY = 'hatch:job-rail:active'

export interface ActiveJob {
  id: string
  label: string
  kind: JobType | 'pipeline'
  startedAt: number
}

interface JobRailCtx {
  activeJob: ActiveJob | null
  expanded: boolean
  start: (jobId: string, opts: { label: string; kind?: JobType | 'pipeline' }) => void
  dismiss: () => void
  toggleExpanded: () => void
  setExpanded: (open: boolean) => void
}

const JobRailContext = createContext<JobRailCtx | null>(null)

export function JobRailProvider({ children }: { children: React.ReactNode }) {
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as ActiveJob
    } catch {
      return null
    }
  })
  const [expanded, setExpandedState] = useState(true)

  useEffect(() => {
    if (activeJob) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activeJob))
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [activeJob])

  const start = useCallback<JobRailCtx['start']>((jobId, opts) => {
    setActiveJob({
      id: jobId,
      label: opts.label,
      kind: opts.kind ?? 'pipeline',
      startedAt: Date.now(),
    })
    setExpandedState(true)
  }, [])

  const dismiss = useCallback(() => setActiveJob(null), [])

  const toggleExpanded = useCallback(() => setExpandedState((v) => !v), [])
  const setExpanded = useCallback((open: boolean) => setExpandedState(open), [])

  return (
    <JobRailContext.Provider
      value={{ activeJob, expanded, start, dismiss, toggleExpanded, setExpanded }}
    >
      {children}
    </JobRailContext.Provider>
  )
}

export function useJobRail(): JobRailCtx {
  const ctx = useContext(JobRailContext)
  if (!ctx) throw new Error('useJobRail must be used inside JobRailProvider')
  return ctx
}
