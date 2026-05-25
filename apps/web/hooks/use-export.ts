'use client'

import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export interface PushInput {
  repo: string
  token: string
  branch?: string
  commit_message?: string
}

export interface PushResult {
  owner: string
  repo: string
  branch: string
  commit_sha: string
  commit_url: string
  tree_url: string
  file_count: number
}

export function usePushToGitHub(projectId: string) {
  return useMutation({
    mutationFn: (input: PushInput) =>
      api.post<PushResult>(`/projects/${projectId}/push-to-github`, input),
  })
}

/**
 * Trigger a zip download — fetches the binary with Bearer auth attached
 * (a plain anchor tag can't carry the JWT), then constructs a temporary
 * blob URL and clicks it.
 *
 * Throws ApiError on non-2xx so the caller can surface the message.
 */
export async function downloadProjectZip(
  projectId: string,
  filename: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new ApiError(401, 'Not signed in')
  }

  // Hit the API directly — the Next dev rewrite proxy can buffer / mangle
  // binary responses. Same trick we use for SSE.
  const res = await fetch(
    `${API_BASE}/api/v1/projects/${projectId}/export.zip`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error) msg = parsed.error
    } catch {
      // body wasn't JSON; keep generic
    }
    throw new ApiError(res.status, msg)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  // Headless anchor click — most reliable cross-browser download trigger
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
