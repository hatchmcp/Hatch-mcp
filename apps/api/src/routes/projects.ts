import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { listProjects, getProject, createProject, deleteProject } from '../services/projects.service.js'

const router = Router()

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  source_type: z.enum(['github', 'openapi', 'postman', 'docs', 'paste']),
  source_url: z.string().url().optional(),
  source_ref: z.string().optional(),
  base_api_url: z.string().url().optional(),
  description: z.string().max(500).optional(),
})

router.get('/', auth, async (req, res) => {
  const projects = await listProjects(req.companyId)
  res.json({ projects })
})

router.post('/', auth, async (req, res) => {
  const body = CreateProjectSchema.parse(req.body)
  const project = await createProject({
    companyId: req.companyId,
    name: body.name,
    sourceType: body.source_type,
    sourceUrl: body.source_url,
    sourceRef: body.source_ref,
    baseApiUrl: body.base_api_url,
    description: body.description,
  })
  res.status(201).json({ project })
})

router.get('/:id', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  res.json({ project })
})

router.delete('/:id', auth, async (req, res) => {
  await deleteProject(req.params.id, req.companyId)
  res.status(204).send()
})

export default router
