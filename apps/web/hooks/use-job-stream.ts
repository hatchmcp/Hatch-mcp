'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { JobStreamEvent, JobStatus, LogLevel } from '@/types/api'

export interface JobStreamState {
  status: JobStatus | 'pending'
  progress: number
  step: string | null
  error: string | null
  result: unknown | null
  logs: Array<{ id: number; level: LogLevel; message: string }>
}

const initialState: JobStreamState = {
  status: 'pending',
  progress: 0,
  step: null,
  error: null,
  result: null,
  logs: [],
}

export interface UseJobStreamOptions {
  onDone?: (result: unknown) => void
  onFailed?: (error: string) => void
  onProgress?: (percent: number, step: string | null) => void
}

export function useJobStream(
  jobId: string | undefined | null,
  options: UseJobStreamOptions = {}
) {
  const [state, setState] = useState<JobStreamState>(initialState)

  // Pin handlers in a ref so callers can pass inline fns without re-subscribing
  const handlersRef = useRef(options)
  handlersRef.current = options

  useEffect(() => {
    if (!jobId) {
      setState(initialState)
      return
    }

    const ctrl = new AbortController()
    let cancelled = false
    let logSeq = 0

    setState(initialState)
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return

        // Bypass the Next.js dev rewrite for SSE — the rewrite proxy buffers
        // chunked responses, so events only flush when the connection closes.
        // Hitting the API origin directly streams in real time. CORS is
        // configured on the API for http://localhost:3000.
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
        const res = await fetch(`${apiBase}/api/v1/jobs/${jobId}/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: ctrl.signal,
        })

        if (!res.ok || !res.body) {
          if (!cancelled) {
            setState((s) => ({ ...s, status: 'failed', error: `Stream HTTP ${res.status}` }))
          }
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || cancelled) break
          buffer += decoder.decode(value, { stream: true })

          // SSE events are terminated by a blank line (\n\n)
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            processBlock(block)
          }
        }
      } catch (err: unknown) {
        if (cancelled) return
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        if (!aborted) {
          setState((s) => ({
            ...s,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Stream error',
          }))
        }
      }
    })()

    function processBlock(block: string) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        let parsed: JobStreamEvent
        try {
          parsed = JSON.parse(line.slice(6)) as JobStreamEvent
        } catch {
          continue
        }
        applyEvent(parsed)
      }
    }

    function applyEvent(ev: JobStreamEvent) {
      switch (ev.type) {
        case 'snapshot':
          setState((s) => ({
            ...s,
            status: ev.status,
            progress: ev.progress,
            step: ev.current_step ?? null,
            error: ev.error ?? null,
            result: ev.result ?? null,
          }))
          if (ev.status === 'succeeded') handlersRef.current.onDone?.(ev.result)
          if (ev.status === 'failed') handlersRef.current.onFailed?.(ev.error ?? 'failed')
          break

        case 'progress':
          setState((s) => ({
            ...s,
            status: 'running',
            progress: ev.percent,
            step: ev.step,
          }))
          handlersRef.current.onProgress?.(ev.percent, ev.step)
          break

        case 'log':
          setState((s) => ({
            ...s,
            logs: [...s.logs, { id: ++logSeq, level: ev.level, message: ev.message }].slice(-200),
          }))
          break

        case 'done':
          setState((s) => ({
            ...s,
            status: 'succeeded',
            progress: 100,
            result: ev.result,
          }))
          handlersRef.current.onDone?.(ev.result)
          break

        case 'failed':
          setState((s) => ({
            ...s,
            status: 'failed',
            error: ev.error,
          }))
          handlersRef.current.onFailed?.(ev.error)
          break
      }
    }

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [jobId])

  return state
}
