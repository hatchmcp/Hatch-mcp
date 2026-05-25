'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface GithubConnection {
  connected: boolean
  configured: boolean
  github_login?: string
  scopes?: string | null
  connected_at?: string
}

export const githubConnectionKey = ['me', 'github-connection'] as const

export function useGithubConnection() {
  return useQuery({
    queryKey: githubConnectionKey,
    queryFn: () => api.get<GithubConnection>('/me/github-connection'),
    staleTime: 30_000,
  })
}

/**
 * Kicks the GitHub OAuth dance — POSTs to /oauth/github/init with the
 * Bearer JWT (so the server knows which Hatch user is connecting), then
 * navigates the current window to the GitHub authorize URL. After approval
 * GitHub bounces back to /api/v1/oauth/github/callback which redirects to
 * `returnTo?github_connected=<login>`.
 */
export function useStartGithubOAuth() {
  return useMutation({
    mutationFn: async (returnTo: string) => {
      const { authorize_url } = await api.post<{ authorize_url: string }>(
        '/oauth/github/init',
        { return_to: returnTo }
      )
      window.location.href = authorize_url
      // Resolve to make TS happy; real "success" is the GitHub redirect
      return { authorize_url }
    },
  })
}

export function useDisconnectGithub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/me/github-connection'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: githubConnectionKey })
    },
  })
}
