'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  OAuthAppListResponse,
  OAuthAppResponse,
  OAuthAppSessionsResponse,
  OAuthAccessLogResponse,
  CreateOAuthAppInput,
  CreateOAuthAppResponse,
  UpdateOAuthAppInput,
  RotateOAuthSecretResponse,
} from '@/types/api'

export const oauthAppsKey = ['oauth-apps'] as const
export const oauthAppKey = (id: string) => ['oauth-app', id] as const
export const oauthSessionsKey = (id: string) => ['oauth-app', id, 'sessions'] as const
export const oauthAccessLogKey = (id: string) => ['oauth-app', id, 'access-log'] as const

export function useOAuthApps() {
  return useQuery({
    queryKey: oauthAppsKey,
    queryFn: () => api.get<OAuthAppListResponse>('/oauth/apps'),
    staleTime: 30_000,
  })
}

export function useOAuthApp(id: string | undefined) {
  return useQuery({
    queryKey: oauthAppKey(id ?? ''),
    queryFn: () => api.get<OAuthAppResponse>(`/oauth/apps/${id}`),
    enabled: !!id,
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

export function useUpdateOAuthApp(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOAuthAppInput) =>
      api.patch<OAuthAppResponse>(`/oauth/apps/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthAppKey(id) })
      qc.invalidateQueries({ queryKey: oauthAppsKey })
    },
  })
}

export function useDeleteOAuthApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/oauth/apps/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthAppsKey })
    },
  })
}

export function useRotateOAuthSecret(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<RotateOAuthSecretResponse>(`/oauth/apps/${id}/rotate-secret`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthAppKey(id) })
    },
  })
}

export function useOAuthAppSessions(id: string | undefined) {
  return useQuery({
    queryKey: oauthSessionsKey(id ?? ''),
    queryFn: () => api.get<OAuthAppSessionsResponse>(`/oauth/apps/${id}/sessions`),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useRevokeOAuthSession(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/oauth/apps/${appId}/sessions/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthSessionsKey(appId) })
      qc.invalidateQueries({ queryKey: oauthAppKey(appId) })
    },
  })
}

export function useOAuthAppAccessLog(id: string | undefined) {
  return useQuery({
    queryKey: oauthAccessLogKey(id ?? ''),
    queryFn: () => api.get<OAuthAccessLogResponse>(`/oauth/apps/${id}/access-log`),
    enabled: !!id,
    staleTime: 15_000,
  })
}
