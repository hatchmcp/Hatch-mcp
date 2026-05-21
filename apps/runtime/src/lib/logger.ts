type Level = 'debug' | 'info' | 'warn' | 'error'
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN_LEVEL = process.env['NODE_ENV'] === 'production' ? LEVELS.info : LEVELS.debug

function log(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < MIN_LEVEL) return
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...meta })
  level === 'error' || level === 'warn' ? process.stderr.write(line + '\n') : process.stdout.write(line + '\n')
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  child: (bindings: Record<string, unknown>) => ({
    debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, { ...bindings, ...meta }),
    info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, { ...bindings, ...meta }),
    warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, { ...bindings, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, { ...bindings, ...meta }),
  }),
}
