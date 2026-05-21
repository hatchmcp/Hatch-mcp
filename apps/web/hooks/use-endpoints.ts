'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { EndpointsListResponse, EndpointUpdate } from '@/types/api'

export const endpointsKey = (projectId: string) => ['endpoints', projectId] as const

export function useEndpoints(projectId: string | undefined) {
  return useQuery({
    queryKey: endpointsKey(projectId ?? ''),
    queryFn: () => api.get<EndpointsListResponse>(`/projects/${projectId}/endpoints`),
    enabled: !!projectId,
    staleTime: 10_000,
  })
}

export function useUpdateEndpoints(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: EndpointUpdate[]) =>
      api.patch<EndpointsListResponse>(`/projects/${projectId}/endpoints`, { updates }),
    // Optimistic update — the table feels instant
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: endpointsKey(projectId) })
      const prev = qc.getQueryData<EndpointsListResponse>(endpointsKey(projectId))
      if (prev) {
        const byId = new Map(updates.map((u) => [u.id, u]))
        qc.setQueryData<EndpointsListResponse>(endpointsKey(projectId), {
          endpoints: prev.endpoints.map((e) => {
            const u = byId.get(e.id)
            if (!u) return e
            return {
              ...e,
              selected: u.selected ?? e.selected,
              llm_name: u.llm_name ?? e.llm_name,
              llm_description: u.llm_description ?? e.llm_description,
            }
          }),
        })
      }
      return { prev }
    },
    onError: (_err, _updates, ctx) => {
      if (ctx?.prev) qc.setQueryData(endpointsKey(projectId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: endpointsKey(projectId) })
    },
  })
}
