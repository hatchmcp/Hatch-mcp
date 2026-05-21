'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MeResponse } from '@/types/api'

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/me'),
    enabled,
    staleTime: 5 * 60_000, // user info changes rarely
  })
}
