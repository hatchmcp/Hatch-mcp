import { config } from '../config.js'

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN_LEVEL: number = config.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < MIN_LEVEL) return

  // Pino-compatible structured JSON output — Logtail ingests this directly
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  }

  const line = JSON.stringify(entry)
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),

  // Returns a child logger with pre-bound fields (e.g. { jobId, projectId })
  child(bindings: Record<string, unknown>) {
    return {
      debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, { ...bindings, ...meta }),
      info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, { ...bindings, ...meta }),
      warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, { ...bindings, ...meta }),
      error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, { ...bindings, ...meta }),
    }
  },
}
