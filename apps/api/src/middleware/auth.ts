import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/supabase.js'
import { queryOne } from '../lib/db.js'

// Extends Express Request with authenticated user context
declare global {
  namespace Express {
    interface Request {
      userId: string
      companyId: string
      userRole: 'owner' | 'member'
    }
  }
}

interface UserRow {
  id: string
  company_id: string
  role: 'owner' | 'member'
}

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  const token = header.slice(7)
  const supabaseUser = await verifyToken(token)
  if (!supabaseUser) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  // Load the user row to get company_id and role
  const user = await queryOne<UserRow>(
    'SELECT id, company_id, role FROM users WHERE id = $1',
    [supabaseUser.id]
  )

  // User authenticated in Supabase but not yet registered in our DB
  if (!user) {
    res.status(403).json({ error: 'User not found. Please complete onboarding.' })
    return
  }

  req.userId = user.id
  req.companyId = user.company_id
  req.userRole = user.role
  next()
}
