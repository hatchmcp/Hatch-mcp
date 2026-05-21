import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { getProject } from '../services/projects.service.js'
import { query, execute } from '../lib/db.js'

const router = Router({ mergeParams: true })

const BulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      selected: z.boolean().optional(),
      llm_name: z.string().max(64).optional(),
      llm_description: z.string().max(500).optional(),
    })
  ),
})

router.get('/', auth, async (req, res) => {
  // Verify the project belongs to this company
  await getProject(req.params.id, req.companyId)

  const endpoints = await query(
    `SELECT * FROM endpoints WHERE project_id = $1 ORDER BY method, path`,
    [req.params.id]
  )
  res.json({ endpoints })
})

router.patch('/', auth, async (req, res) => {
  await getProject(req.params.id, req.companyId)

  const { updates } = BulkUpdateSchema.parse(req.body)

  // Update each endpoint individually — small enough set for a PATCH operation
  for (const update of updates) {
    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (update.selected !== undefined) {
      sets.push(`selected = $${idx++}`)
      values.push(update.selected)
    }
    if (update.llm_name !== undefined) {
      sets.push(`llm_name = $${idx++}`)
      values.push(update.llm_name)
    }
    if (update.llm_description !== undefined) {
      sets.push(`llm_description = $${idx++}`)
      values.push(update.llm_description)
    }

    if (sets.length === 0) continue

    values.push(update.id, req.params.id)
    await execute(
      `UPDATE endpoints SET ${sets.join(', ')} WHERE id = $${idx} AND project_id = $${idx + 1}`,
      values
    )
  }

  const updated = await query(
    `SELECT * FROM endpoints WHERE project_id = $1 ORDER BY method, path`,
    [req.params.id]
  )
  res.json({ endpoints: updated })
})

export default router
