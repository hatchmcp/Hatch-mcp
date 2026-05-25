'use client'

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ToolSimulatorResult } from '@/types/api'

export function useRunTool(projectId: string) {
  return useMutation({
    mutationFn: (body: {
      tool_name: string
      inputs: Record<string, unknown>
      secrets: Record<string, string>
    }) =>
      api.post<ToolSimulatorResult>(`/projects/${projectId}/tests/run-tool`, body),
  })
}
