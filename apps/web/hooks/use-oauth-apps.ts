'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  OAuthAppListResponse,
  CreateOAuthAppInput,
  CreateOAuthAppResponse,
} from '@/types/api'

export const oauthAppsKey = ['oauth-apps'] as const

export function useOAuthApps() {
  return useQuery({
    queryKey: oauthAppsKey,
    queryFn: () => api.get<OAuthAppListResponse>('/oauth/apps'),
    staleTime: 30_000,
  })
}

export function useCreateOAuthApp() {
  const qc = useQueryClient()
  return useMutation({
    // Existing /oauth/register endpoint owns the create path — it generates
    // the client_id + plaintext client_secret atomically.
    mutationFn: (input: CreateOAuthAppInput) =>
      api.post<CreateOAuthAppResponse>('/oauth/register', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthAppsKey })
    },
  })
}
