import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { listWorkspaceActivity } from '../services/activity.service.js'

const router = Router()

// GET /activity — last N jobs across all projects in the workspace
router.get('/', auth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const jobs = await listWorkspaceActivity(req.companyId, limit)
  res.json({ jobs })
})

export default router
