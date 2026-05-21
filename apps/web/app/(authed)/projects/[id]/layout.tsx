'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useProject } from '@/hooks/use-projects'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const { data, isLoading, isError, error } = useProject(params.id)

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Skeleton className="h-3 w-24 mb-4" />
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
    )
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="max-w-[640px] mx-auto px-6 py-16 text-center">
        <p className="text-lg font-semibold text-text-primary mb-2">
          {notFound ? 'Project not found' : 'Could not load project'}
        </p>
        <p className="text-sm text-text-secondary mb-6">
          {notFound
            ? "Either it was deleted or you don't have access."
            : error instanceof Error
              ? error.message
              : 'Unknown error.'}
        </p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft />
            Back to projects
          </Link>
        </Button>
      </div>
    )
  }

  // Project loaded — children render their own page content. TanStack Query
  // dedupes useProject calls, so sub-pages reading params.id + useProject are free.
  return <>{children}</>
}
