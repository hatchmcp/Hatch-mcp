import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger.js'

// Signals that a job/request failed for a reason the user must fix (e.g. bad URL).
// Caught by runJob and propagated to the job.error column.
export class PermanentError extends Error {
  readonly permanent = true
  constructor(message: string) {
    super(message)
    this.name = 'PermanentError'
  }
}

// HTTP-aware error with an explicit status code
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

// Express 5 error handler — must have four parameters
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  // PermanentError (from job pipeline + github pusher) means the user has
  // something to fix — bad URL, no access, missing branch. Surface the
  // actual message instead of squashing it to "Internal server error".
  if ((err as { permanent?: boolean }).permanent === true || err.name === 'PermanentError') {
    res.status(422).json({ error: err.message })
    return
  }

  // Validation errors from Zod surface as plain Errors with readable messages
  if (err.name === 'ZodError') {
    res.status(422).json({ error: 'Validation error', detail: err.message })
    return
  }

  logger.error('Unhandled error', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  })

  res.status(500).json({ error: 'Internal server error' })
}
