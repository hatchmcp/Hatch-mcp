import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../services/projects.service.js'

const router = Router()

const CreateProjectSchema = z
  .object({
    name: z.string().min(1).max(100),
    source_type: z.enum(['github', 'openapi', 'postman', 'docs', 'paste']),
    source_url: z.string().optional(),
    source_ref: z.string().optional(),
    base_api_url: z.string().url().optional(),
    description: z.string().max(500).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.source_type === 'paste') {
      if (!body.source_url || body.source_url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source_url'],
          message: 'source_url is required for paste source type',
        })
      }
      return
    }
    if (!body.source_url || !/^https?:\/\//i.test(body.source_url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_url'],
        message: 'source_url must be a valid http(s) URL for this source type',
      })
    }
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

const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    base_api_url: z.string().url().nullable().optional(),
  })
  .refine((b) => b.name !== undefined || b.description !== undefined || b.base_api_url !== undefined, {
    message: 'At least one field is required',
  })

router.get('/:id', auth, async (req, res) => {
  const project = await getProject(req.params.id, req.companyId)
  res.json({ project })
})

router.put('/:id', auth, async (req, res) => {
  const body = UpdateProjectSchema.parse(req.body)
  const project = await updateProject(req.params.id, req.companyId, body)
  res.json({ project })
})

router.delete('/:id', auth, async (req, res) => {
  await deleteProject(req.params.id, req.companyId)
  res.status(204).send()
})

export default router
