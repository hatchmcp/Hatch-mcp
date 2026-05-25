'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ActivityJob } from '@/types/api'

export function useActivity(enabled = true) {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get<{ jobs: ActivityJob[] }>('/activity'),
    staleTime: 20_000,
    enabled,
  })
}
