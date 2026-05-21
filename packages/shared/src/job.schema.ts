import { z } from 'zod'

export const JobTypeSchema = z.enum(['ingest', 'extract', 'generate', 'test', 'deploy', 'full_pipeline'])
export const JobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled'])
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

export const JobSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  progress: z.number().int().min(0).max(100).default(0),
  current_step: z.string().nullable().optional(),
  result: z.unknown().nullable().optional(),
  error: z.string().nullable().optional(),
  started_at: z.coerce.date().nullable().optional(),
  finished_at: z.coerce.date().nullable().optional(),
  heartbeat_at: z.coerce.date().nullable().optional(),
  created_at: z.coerce.date(),
})

export const JobLogSchema = z.object({
  id: z.number().int(),
  job_id: z.string().uuid(),
  level: LogLevelSchema,
  message: z.string(),
  // Zod v4: z.record requires explicit key schema
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.coerce.date(),
})

export type Job = z.infer<typeof JobSchema>
export type JobLog = z.infer<typeof JobLogSchema>
export type JobType = z.infer<typeof JobTypeSchema>
export type JobStatus = z.infer<typeof JobStatusSchema>
export type LogLevel = z.infer<typeof LogLevelSchema>

export interface JobContext {
  progress(percent: number, step: string): Promise<void>
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<void>
}

export type JobEvent =
  | { type: 'progress'; jobId: string; percent: number; step: string }
  | { type: 'log'; jobId: string; level: LogLevel; message: string }
  | { type: 'done'; jobId: string; result: unknown }
  | { type: 'failed'; jobId: string; error: string; permanent: boolean }
  | { type: 'snapshot'; jobId: string } & Omit<Job, 'id' | 'project_id'>
