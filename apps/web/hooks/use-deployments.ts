'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { mcpServerKey } from '@/hooks/use-mcp-server'
import type { DeploymentsListResponse } from '@/types/api'

export const deploymentsKey = (projectId: string) => ['deployments', projectId] as const

export function useDeployments(projectId: string | undefined) {
  return useQuery({
    queryKey: deploymentsKey(projectId ?? ''),
    queryFn: () =>
      api.get<DeploymentsListResponse>(`/projects/${projectId}/deployments`),
    enabled: !!projectId,
    staleTime: 10_000,
  })
}

export function useDeploy(projectId: string) {
  return useMutation({
    mutationFn: (secrets: Record<string, string> = {}) =>
      api.post<{ job_id: string }>(`/projects/${projectId}/deploy`, { secrets }),
  })
}

export function useRollback(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ message: string }>(`/projects/${projectId}/rollback`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deploymentsKey(projectId) })
      qc.invalidateQueries({ queryKey: mcpServerKey(projectId) })
    },
  })
}
