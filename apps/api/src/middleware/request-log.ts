import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger.js'
import { randomBytes } from 'crypto'

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  const requestId = randomBytes(8).toString('hex')

  // Attach so route handlers can reference it in logs
  ;(req as { requestId?: string }).requestId = requestId

  res.on('finish', () => {
    logger.info('request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      // Omit auth header; include user if already parsed
      userId: (req as { userId?: string }).userId,
    })
  })

  next()
}
