import { query, queryOne, execute } from '../lib/db.js'
import { generateProjectSlug, generateSubdomain } from '../lib/slug.js'
import { HttpError } from '../middleware/error.js'

interface ProjectRow {
  id: string
  company_id: string
  name: string
  slug: string
  source_type: string
  source_url: string | null
  source_ref: string | null
  base_api_url: string | null
  description: string | null
  created_at: Date
  updated_at: Date
}

export async function listProjects(companyId: string): Promise<ProjectRow[]> {
  return query<ProjectRow>(
    `SELECT * FROM projects WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  )
}

export async function getProject(id: string, companyId: string): Promise<ProjectRow> {
  const row = await queryOne<ProjectRow>(
    `SELECT * FROM projects WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  )
  if (!row) throw new HttpError(404, 'Project not found')
  return row
}

export async function createProject(opts: {
  companyId: string
  name: string
  sourceType: string
  sourceUrl?: string
  sourceRef?: string
  baseApiUrl?: string
  description?: string
}): Promise<ProjectRow> {
  const { companyId, name, sourceType, sourceUrl, sourceRef, baseApiUrl, description } = opts

  const slug = generateProjectSlug(name)
  const subdomain = generateSubdomain(name)

  const [project] = await query<ProjectRow>(
    `INSERT INTO projects (company_id, name, slug, source_type, source_url, source_ref, base_api_url, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [companyId, name, slug, sourceType, sourceUrl ?? null, sourceRef ?? null, baseApiUrl ?? null, description ?? null]
  )

  // Pre-create the mcp_server record with the subdomain so it's ready for deployment
  await execute(
    `INSERT INTO mcp_servers (project_id, subdomain) VALUES ($1, $2)`,
    [project.id, subdomain]
  )

  return project
}

export async function deleteProject(id: string, companyId: string): Promise<void> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM projects WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, companyId]
  )
  if (!result) throw new HttpError(404, 'Project not found')
}
