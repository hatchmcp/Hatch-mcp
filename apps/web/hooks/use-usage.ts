'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { UsageResponse } from '@/types/api'

export function useUsage(projectId: string | undefined, days: number) {
  return useQuery({
    queryKey: ['usage', projectId, days],
    queryFn: () =>
      api.get<UsageResponse>(`/projects/${projectId}/usage?days=${days}`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}
