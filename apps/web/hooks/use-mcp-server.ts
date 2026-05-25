'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { AuthTestResult, AuthType, McpServerResponse } from '@/types/api'

export const mcpServerKey = (projectId: string) => ['mcp-server', projectId] as const

export function useMcpServer(projectId: string | undefined) {
  return useQuery({
    queryKey: mcpServerKey(projectId ?? ''),
    queryFn: async () => {
      try {
        return await api.get<McpServerResponse>(`/projects/${projectId}/mcp-server`)
      } catch (err) {
        // 404 means no config generated yet — surface as null instead of throwing
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    enabled: !!projectId,
    staleTime: 10_000,
  })
}

export interface GenerateInput {
  auth_type: AuthType
  base_api_url?: string
}

export function useGenerate(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateInput) =>
      api.post<{ job_id: string }>(`/projects/${projectId}/generate`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mcpServerKey(projectId) })
      // The project's base_api_url may have changed if the user supplied a
      // new one in this generate request — refresh the cached project too.
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useRunTests(projectId: string) {
  return useMutation({
    mutationFn: () => api.post<{ job_id: string }>(`/projects/${projectId}/test`),
  })
}

export interface AuthTestInput {
  auth_type: AuthType
  base_api_url: string
  secrets: Record<string, string>
}

export function useTestAuth(projectId: string) {
  return useMutation({
    mutationFn: (input: AuthTestInput) =>
      api.post<AuthTestResult>(`/projects/${projectId}/auth/test`, input),
  })
}
