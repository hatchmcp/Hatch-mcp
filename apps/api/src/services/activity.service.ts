import { query } from '../lib/db.js'

export interface ActivityJobRow {
  id: string
  project_id: string
  project_name: string
  project_slug: string
  type: string
  status: string
  progress: number
  current_step: string | null
  error: string | null
  started_at: Date | null
  finished_at: Date | null
  created_at: Date
}

export async function listWorkspaceActivity(
  companyId: string,
  limit = 50
): Promise<ActivityJobRow[]> {
  return query<ActivityJobRow>(
    `SELECT
       j.id,
       j.project_id,
       p.name AS project_name,
       p.slug AS project_slug,
       j.type,
       j.status,
       j.progress,
       j.current_step,
       j.error,
       j.started_at,
       j.finished_at,
       j.created_at
     FROM jobs j
     INNER JOIN projects p ON p.id = j.project_id
     WHERE p.company_id = $1
     ORDER BY j.created_at DESC
     LIMIT $2`,
    [companyId, limit]
  )
}
