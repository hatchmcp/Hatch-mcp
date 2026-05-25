'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Project,
  ProjectsListResponse,
  ProjectResponse,
  SourceType,
} from '@/types/api'

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectsListResponse>('/projects'),
    enabled,
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectResponse>(`/projects/${id}`),
    enabled: !!id,
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export interface CreateProjectInput {
  name: string
  source_type: SourceType
  source_url?: string
  source_ref?: string
  base_api_url?: string
  description?: string
}

export function useCreateProject() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api.post<{ project: Project }>('/projects', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useStartIngest() {
  return useMutation({
    mutationFn: (projectId: string) =>
      api.post<{ job_id: string }>(`/projects/${projectId}/ingest`),
  })
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
  base_api_url?: string | null
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      api.put<ProjectResponse>(`/projects/${projectId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
