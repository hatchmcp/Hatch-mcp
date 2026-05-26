import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { auth } from '../middleware/auth.js'
import { query, queryOne, execute } from '../lib/db.js'
import { generateClientSecret } from '../lib/hatch-token.js'
import { HttpError } from '../middleware/error.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

/**
 * Hatch-user-authenticated routes for managing OAuth apps from the
 * dashboard. The /api/v1/oauth router (oauth-broker.ts) has the
 * SDK-facing protocol endpoints; this one has CRUD scoped to the
 * caller's owned apps.
 *
 * Mount AFTER oauth-broker.ts under the same prefix so reserved paths
 * (/register, /connect, /store-token, /exchange, /revoke, /sessions)
 * win the match. Our paths all start with `/apps`, so no collision.
 */
const router = Router()

interface AppRow {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  client_id: string
  callback_url: string
  scopes: string[]
  owner_user_id: string | null
  created_at: Date
  updated_at: Date
}

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────── */

function connectUrlFor(slug: string): string {
  return `${config.WEB_BASE_URL}/oauth/connect/${slug}`
}

/** Returns the app if owned by the caller, else throws 404 (deliberately
 *  not 403 — don't reveal existence to non-owners). */
async function loadOwnedApp(appId: string, userId: string): Promise<AppRow> {
  const row = await queryOne<AppRow>(
    `SELECT id, name, slug, description, logo_url, client_id,
            callback_url, scopes, owner_user_id, created_at, updated_at
       FROM hatch_oauth_companies
      WHERE id = $1 AND owner_user_id = $2`,
    [appId, userId]
  )
  if (!row) throw new HttpError(404, 'OAuth app not found')
  return row
}

function publicShape(row: AppRow, extras: Partial<{
  session_count: number
  active_session_count: number
  last_used_at: string | null
}> = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logo_url: row.logo_url,
    client_id: row.client_id,
    callback_url: row.callback_url,
    scopes: row.scopes,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    connect_url: connectUrlFor(row.slug),
    ...extras,
  }
}

/* ────────────────────────────────────────────────────────────────
 * GET /api/v1/oauth/apps — list the caller's apps
 * ──────────────────────────────────────────────────────────────── */

router.get('/apps', auth, async (req, res) => {
  const rows = await query<
    AppRow & {
      session_count: string
      active_session_count: string
      last_used_at: Date | null
    }
  >(
    `SELECT c.*,
            (SELECT COUNT(*) FROM hatch_oauth_sessions s WHERE s.company_id = c.id) AS session_count,
            (SELECT COUNT(*) FROM hatch_oauth_sessions s WHERE s.company_id = c.id AND s.revoked_at IS NULL) AS active_session_count,
            (SELECT MAX(s.last_used_at) FROM hatch_oauth_sessions s WHERE s.company_id = c.id) AS last_used_at
       FROM hatch_oauth_companies c
      WHERE c.owner_user_id = $1
      ORDER BY c.created_at DESC`,
    [req.userId]
  )

  res.json({
    apps: rows.map((r) =>
      publicShape(r, {
        session_count: Number(r.session_count),
        active_session_count: Number(r.active_session_count),
        last_used_at: r.last_used_at?.toISOString() ?? null,
      })
    ),
  })
})

/* ────────────────────────────────────────────────────────────────
 * GET /api/v1/oauth/apps/:id — single app
 * ──────────────────────────────────────────────────────────────── */

router.get('/apps/:id', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)

  const counts = await queryOne<{
    session_count: string
    active_session_count: string
    last_used_at: Date | null
  }>(
    `SELECT
       (SELECT COUNT(*) FROM hatch_oauth_sessions s WHERE s.company_id = $1) AS session_count,
       (SELECT COUNT(*) FROM hatch_oauth_sessions s WHERE s.company_id = $1 AND s.revoked_at IS NULL) AS active_session_count,
       (SELECT MAX(s.last_used_at) FROM hatch_oauth_sessions s WHERE s.company_id = $1) AS last_used_at`,
    [app.id]
  )

  res.json({
    app: publicShape(app, {
      session_count: Number(counts?.session_count ?? 0),
      active_session_count: Number(counts?.active_session_count ?? 0),
      last_used_at: counts?.last_used_at?.toISOString() ?? null,
    }),
  })
})

/* ────────────────────────────────────────────────────────────────
 * PATCH /api/v1/oauth/apps/:id — update editable fields
 * Slug + client_id are intentionally NOT editable (they're stable
 * identifiers consumers might have baked in).
 * ──────────────────────────────────────────────────────────────── */

const UpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  callback_url: z.string().url().optional(),
  scopes: z.array(z.string().max(80)).max(20).optional(),
})

router.patch('/apps/:id', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)
  const body = UpdateSchema.parse(req.body)

  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  if (sets.length === 0) {
    res.json({ app: publicShape(app) })
    return
  }

  vals.push(app.id)
  const updated = await queryOne<AppRow>(
    `UPDATE hatch_oauth_companies
        SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $${i}
  RETURNING id, name, slug, description, logo_url, client_id,
            callback_url, scopes, owner_user_id, created_at, updated_at`,
    vals
  )
  if (!updated) throw new HttpError(404, 'OAuth app not found')

  logger.info('OAuth app updated', { id: app.id, fields: Object.keys(body) })
  res.json({ app: publicShape(updated) })
})

/* ────────────────────────────────────────────────────────────────
 * DELETE /api/v1/oauth/apps/:id — delete app + cascade sessions
 * ──────────────────────────────────────────────────────────────── */

router.delete('/apps/:id', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)
  await execute(`DELETE FROM hatch_oauth_companies WHERE id = $1`, [app.id])
  logger.info('OAuth app deleted', { id: app.id, slug: app.slug })
  res.status(204).send()
})

/* ────────────────────────────────────────────────────────────────
 * POST /api/v1/oauth/apps/:id/rotate-secret — mint a new client_secret
 * Previous secret stops working immediately. Plaintext shown ONCE.
 * ──────────────────────────────────────────────────────────────── */

router.post('/apps/:id/rotate-secret', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)

  const plaintext = generateClientSecret()
  const hash = await bcrypt.hash(plaintext, 10)

  await execute(
    `UPDATE hatch_oauth_companies
        SET client_secret_hash = $1, updated_at = now()
      WHERE id = $2`,
    [hash, app.id]
  )

  logger.info('OAuth app client_secret rotated', { id: app.id, slug: app.slug })
  res.json({
    client_secret: plaintext,
    client_secret_hint: plaintext.slice(-4),
    rotated_at: new Date().toISOString(),
  })
})

/* ────────────────────────────────────────────────────────────────
 * GET /api/v1/oauth/apps/:id/sessions — connected users for this app
 * Same shape as the company-side /api/v1/oauth/sessions but
 * auth'd as the Hatch user owner instead of via Basic credentials.
 * ──────────────────────────────────────────────────────────────── */

router.get('/apps/:id/sessions', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)

  const sessions = await query<{
    id: string
    user_id: string
    real_token_expires_at: Date | null
    real_token_scopes: string[]
    revoked_at: Date | null
    metadata: Record<string, unknown>
    created_at: Date
    last_used_at: Date | null
    access_count: string
  }>(
    `SELECT s.id, s.user_id, s.real_token_expires_at, s.real_token_scopes,
            s.revoked_at, s.metadata, s.created_at, s.last_used_at,
            (SELECT COUNT(*) FROM hatch_oauth_access_log l WHERE l.session_id = s.id) AS access_count
       FROM hatch_oauth_sessions s
      WHERE s.company_id = $1
      ORDER BY s.last_used_at DESC NULLS LAST, s.created_at DESC
      LIMIT $2`,
    [app.id, limit]
  )

  res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      scopes: s.real_token_scopes,
      revoked: !!s.revoked_at,
      revoked_at: s.revoked_at?.toISOString() ?? null,
      real_token_expires_at: s.real_token_expires_at?.toISOString() ?? null,
      metadata: s.metadata,
      created_at: s.created_at.toISOString(),
      last_used_at: s.last_used_at?.toISOString() ?? null,
      access_count: Number(s.access_count),
    })),
  })
})

/* ────────────────────────────────────────────────────────────────
 * DELETE /api/v1/oauth/apps/:id/sessions/:sessionId — revoke one user
 * Dashboard-side flavor of the broker's POST /revoke (which is for
 * the SDK). Only the app owner can do this.
 * ──────────────────────────────────────────────────────────────── */

router.delete('/apps/:id/sessions/:sessionId', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)

  const session = await queryOne<{ id: string; revoked_at: Date | null }>(
    `SELECT id, revoked_at FROM hatch_oauth_sessions
       WHERE id = $1 AND company_id = $2`,
    [req.params.sessionId, app.id]
  )
  if (!session) throw new HttpError(404, 'Session not found')

  if (!session.revoked_at) {
    await execute(
      `UPDATE hatch_oauth_sessions SET revoked_at = now() WHERE id = $1`,
      [session.id]
    )
    logger.info('OAuth session revoked (dashboard)', {
      app_id: app.id,
      session_id: session.id,
    })
  }
  res.status(204).send()
})

/* ────────────────────────────────────────────────────────────────
 * GET /api/v1/oauth/apps/:id/access-log — paginated exchange audit
 * ──────────────────────────────────────────────────────────────── */

router.get('/apps/:id/access-log', auth, async (req, res) => {
  const app = await loadOwnedApp(req.params.id, req.userId)
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500)
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0)

  const rows = await query<{
    id: string
    session_id: string
    user_id: string
    ip_address: string | null
    user_agent: string | null
    tool_name: string | null
    accessed_at: Date
  }>(
    `SELECT l.id, l.session_id, s.user_id, l.ip_address, l.user_agent, l.tool_name, l.accessed_at
       FROM hatch_oauth_access_log l
       JOIN hatch_oauth_sessions s ON s.id = l.session_id
      WHERE l.company_id = $1
      ORDER BY l.accessed_at DESC
      LIMIT $2 OFFSET $3`,
    [app.id, limit, offset]
  )

  res.json({
    log: rows.map((r) => ({
      id: String(r.id),
      session_id: r.session_id,
      user_id: r.user_id,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      tool_name: r.tool_name,
      accessed_at: r.accessed_at.toISOString(),
    })),
    limit,
    offset,
  })
})

export default router
