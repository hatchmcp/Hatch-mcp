import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { randomBytes } from 'crypto'
import { auth } from '../middleware/auth.js'
import { execute, query, queryOne } from '../lib/db.js'
import { encrypt, decrypt } from '../lib/crypto.js'
import {
  signHatchToken,
  verifyHatchToken,
  shouldRotate,
  generateClientId,
  generateClientSecret,
  HatchTokenError,
} from '../lib/hatch-token.js'
import { HttpError } from '../middleware/error.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const router = Router()

/* ──────────────────────────────────────────────────────────────────────
 *  Rate limits
 *  Per IP. Different endpoints have different sensitivity.
 * ────────────────────────────────────────────────────────────────────── */

const registerLimit = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true })
const connectLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true })
const exchangeLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true })
const storeLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true })

/* ──────────────────────────────────────────────────────────────────────
 *  Client credential middleware (Basic auth: client_id:client_secret)
 *  Used by company → /store-token, /revoke, /sessions.
 *  The MCP-side /exchange does NOT use this — it's the JWT itself.
 * ────────────────────────────────────────────────────────────────────── */

interface CompanyRow {
  id: string
  name: string
  slug: string
  client_id: string
  client_secret_hash: string
  callback_url: string
  scopes: string[]
  logo_url: string | null
  description: string | null
}

async function requireClient(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization
    if (!header || !header.toLowerCase().startsWith('basic ')) {
      throw new HttpError(401, 'Missing Authorization: Basic <client_id:client_secret>')
    }
    let decoded = ''
    try {
      decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8')
    } catch {
      throw new HttpError(401, 'Authorization header is not valid base64')
    }
    const sep = decoded.indexOf(':')
    if (sep < 0) throw new HttpError(401, 'Authorization must be client_id:client_secret')
    const clientId = decoded.slice(0, sep)
    const clientSecret = decoded.slice(sep + 1)

    const company = await queryOne<CompanyRow>(
      `SELECT * FROM hatch_oauth_companies WHERE client_id = $1`,
      [clientId]
    )
    if (!company) throw new HttpError(401, 'Invalid client_id or client_secret')

    const ok = await bcrypt.compare(clientSecret, company.client_secret_hash)
    if (!ok) throw new HttpError(401, 'Invalid client_id or client_secret')

    ;(req as Request & { company?: CompanyRow }).company = company
    next()
  } catch (err) {
    next(err)
  }
}

function company(req: Request): CompanyRow {
  const c = (req as Request & { company?: CompanyRow }).company
  if (!c) throw new HttpError(500, 'Client auth not attached')
  return c
}

/* ──────────────────────────────────────────────────────────────────────
 *  POST /api/v1/oauth/register
 *  Authed as a HatchMCP user. Registers a company and returns the
 *  client_id + plaintext client_secret (shown ONCE).
 * ────────────────────────────────────────────────────────────────────── */

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'slug must be lowercase letters, digits, dashes'),
  callback_url: z.string().url(),
  description: z.string().max(500).optional(),
  logo_url: z.string().url().optional(),
  scopes: z.array(z.string().max(80)).max(20).default([]),
})

router.post('/register', registerLimit, auth, async (req, res) => {
  const body = RegisterSchema.parse(req.body)

  // Make sure slug is free
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM hatch_oauth_companies WHERE slug = $1`,
    [body.slug]
  )
  if (existing) throw new HttpError(409, `Slug "${body.slug}" is taken`)

  const clientId = generateClientId()
  const clientSecret = generateClientSecret()
  const clientSecretHash = await bcrypt.hash(clientSecret, 10)

  const [row] = await query<{ id: string }>(
    `INSERT INTO hatch_oauth_companies
       (name, slug, description, logo_url, client_id, client_secret_hash,
        callback_url, scopes, owner_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      body.name,
      body.slug,
      body.description ?? null,
      body.logo_url ?? null,
      clientId,
      clientSecretHash,
      body.callback_url,
      body.scopes,
      req.userId,
    ]
  )

  logger.info('hatch-oauth company registered', { id: row.id, slug: body.slug })

  res.status(201).json({
    id: row.id,
    name: body.name,
    slug: body.slug,
    client_id: clientId,
    // Plaintext shown ONCE — never returned again
    client_secret: clientSecret,
    callback_url: body.callback_url,
    scopes: body.scopes,
    connect_url: `${config.WEB_BASE_URL}/oauth/connect/${body.slug}`,
  })
})

/* ──────────────────────────────────────────────────────────────────────
 *  GET /api/v1/oauth/connect/:companySlug
 *  Public — used by the frontend Connect page to render the consent
 *  screen + by the page to seed a CSRF state token.
 * ────────────────────────────────────────────────────────────────────── */

router.get('/connect/:slug', connectLimit, async (req, res) => {
  const slug = req.params.slug
  const company = await queryOne<CompanyRow>(
    `SELECT id, name, slug, description, logo_url, callback_url, scopes
     FROM hatch_oauth_companies WHERE slug = $1`,
    [slug]
  )
  if (!company) throw new HttpError(404, `No company "${slug}"`)

  // Create a one-shot state nonce — 10 min TTL — that the company will
  // echo back when it calls /store-token. CSRF for the consent flow.
  const state = randomBytes(24).toString('base64url')
  const redirectTo =
    typeof req.query.redirect_to === 'string'
      ? req.query.redirect_to
      : `${config.WEB_BASE_URL}/oauth/connect/${slug}/complete`

  await execute(
    `INSERT INTO hatch_oauth_connect_states (state, company_id, redirect_to, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [state, company.id, redirectTo]
  )

  // The "Connect" button on the consent page navigates the user to the
  // company's callback URL (path included!) with ?hatch_state=<csrf>. The
  // company's auth handler picks up the state, runs its normal login, then
  // calls /oauth/store-token with that state.
  const loginUrlObj = new URL(company.callback_url)
  loginUrlObj.searchParams.set('hatch_state', state)
  const loginUrl = loginUrlObj.toString()

  res.json({
    company: {
      name: company.name,
      slug: company.slug,
      description: company.description,
      logo_url: company.logo_url,
      scopes: company.scopes,
    },
    state,
    login_url: loginUrl, // Where the "Connect" button sends the user
    callback_url: company.callback_url,
  })
})

/* ──────────────────────────────────────────────────────────────────────
 *  POST /api/v1/oauth/store-token
 *  Company backend calls this AFTER the user logs in. Encrypts and
 *  stores the real upstream token, mints a hatch_token, returns it.
 * ────────────────────────────────────────────────────────────────────── */

const StoreTokenSchema = z.object({
  user_id: z.string().min(1).max(255),
  real_token: z.string().min(1),
  expires_at: z.string().datetime().optional().nullable(),
  scopes: z.array(z.string().max(80)).max(50).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Optional — when present, validates the connect-state nonce + consumes it
  state: z.string().optional(),
})

router.post('/store-token', storeLimit, requireClient, async (req, res) => {
  const c = company(req)
  const body = StoreTokenSchema.parse(req.body)

  if (body.state) {
    const stateRow = await queryOne<{
      company_id: string
      redirect_to: string
      consumed_at: Date | null
      expires_at: Date
    }>(
      `SELECT company_id, redirect_to, consumed_at, expires_at
       FROM hatch_oauth_connect_states WHERE state = $1`,
      [body.state]
    )
    if (!stateRow) throw new HttpError(400, 'Unknown connect state')
    if (stateRow.consumed_at) throw new HttpError(400, 'Connect state already consumed')
    if (new Date(stateRow.expires_at).getTime() < Date.now())
      throw new HttpError(400, 'Connect state expired — restart the flow')
    if (stateRow.company_id !== c.id)
      throw new HttpError(400, 'Connect state belongs to a different company')

    await execute(
      `UPDATE hatch_oauth_connect_states SET consumed_at = now() WHERE state = $1`,
      [body.state]
    )
  }

  const { ciphertext, nonce } = encrypt(body.real_token)

  // Upsert by (company_id, user_id) — re-store replaces token + un-revokes
  const [session] = await query<{ id: string }>(
    `INSERT INTO hatch_oauth_sessions
       (company_id, user_id, encrypted_real_token, real_token_nonce,
        real_token_expires_at, real_token_scopes, metadata, revoked_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL)
     ON CONFLICT (company_id, user_id) DO UPDATE
       SET encrypted_real_token = EXCLUDED.encrypted_real_token,
           real_token_nonce = EXCLUDED.real_token_nonce,
           real_token_expires_at = EXCLUDED.real_token_expires_at,
           real_token_scopes = EXCLUDED.real_token_scopes,
           metadata = EXCLUDED.metadata,
           revoked_at = NULL
     RETURNING id`,
    [
      c.id,
      body.user_id,
      ciphertext,
      nonce,
      body.expires_at ?? null,
      body.scopes,
      JSON.stringify(body.metadata ?? {}),
    ]
  )

  const signed = signHatchToken({ sessionId: session.id, clientId: c.client_id })

  logger.info('hatch-oauth token stored', {
    company: c.slug,
    user_id: body.user_id,
    session_id: session.id,
  })

  res.status(201).json({
    hatch_token: signed.token,
    expires_at: signed.expires_at.toISOString(),
    session_id: session.id,
  })
})

/* ──────────────────────────────────────────────────────────────────────
 *  POST /api/v1/oauth/exchange
 *  MCP server calls this on every protected request. Sends hatch_token,
 *  gets back the real upstream token. Logs each access.
 * ────────────────────────────────────────────────────────────────────── */

const ExchangeSchema = z.object({
  hatch_token: z.string().min(1),
  tool_name: z.string().max(120).optional(),
})

interface SessionRow {
  id: string
  company_id: string
  user_id: string
  encrypted_real_token: string
  real_token_nonce: string
  real_token_expires_at: Date | null
  real_token_scopes: string[]
  revoked_at: Date | null
  metadata: Record<string, unknown>
}

router.post('/exchange', exchangeLimit, async (req, res) => {
  const body = ExchangeSchema.parse(req.body)

  let claims
  try {
    claims = verifyHatchToken(body.hatch_token)
  } catch (err) {
    if (err instanceof HatchTokenError) {
      const status = err.reason === 'expired' ? 401 : 400
      throw new HttpError(status, err.message)
    }
    throw err
  }

  const session = await queryOne<SessionRow>(
    `SELECT id, company_id, user_id, encrypted_real_token, real_token_nonce,
            real_token_expires_at, real_token_scopes, revoked_at, metadata
     FROM hatch_oauth_sessions WHERE id = $1`,
    [claims.sid]
  )
  if (!session) throw new HttpError(401, 'Session not found — reconnect required')
  if (session.revoked_at) throw new HttpError(401, 'Session revoked — reconnect required')

  // Make sure the JWT was actually issued for this company
  const cc = await queryOne<{ client_id: string; slug: string }>(
    `SELECT client_id, slug FROM hatch_oauth_companies WHERE id = $1`,
    [session.company_id]
  )
  if (!cc || cc.client_id !== claims.cid) {
    throw new HttpError(401, 'Token client_id mismatch')
  }

  const realToken = decrypt(session.encrypted_real_token, session.real_token_nonce)

  // Async write — don't block the response on logging
  void execute(
    `INSERT INTO hatch_oauth_access_log (session_id, company_id, ip_address, user_agent, tool_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      session.id,
      session.company_id,
      req.ip ?? null,
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      body.tool_name ?? null,
    ]
  ).catch((err) => logger.warn('access-log write failed', { err: String(err) }))

  void execute(
    `UPDATE hatch_oauth_sessions SET last_used_at = now() WHERE id = $1`,
    [session.id]
  ).catch(() => undefined)

  // Lazy rotation: if the JWT has <7d to live, mint a fresh one. SDK detects
  // `rotated_hatch_token` in the response and overwrites its stored value.
  let rotated: { hatch_token: string; expires_at: string } | undefined
  if (shouldRotate(claims)) {
    const s = signHatchToken({ sessionId: session.id, clientId: cc.client_id })
    rotated = { hatch_token: s.token, expires_at: s.expires_at.toISOString() }
  }

  res.json({
    real_token: realToken,
    user_id: session.user_id,
    session_id: session.id,
    expires_at: session.real_token_expires_at?.toISOString() ?? null,
    scopes: session.real_token_scopes,
    metadata: session.metadata,
    ...(rotated ? { rotated_hatch_token: rotated.hatch_token, rotated_expires_at: rotated.expires_at } : {}),
  })
})

/* ──────────────────────────────────────────────────────────────────────
 *  POST /api/v1/oauth/revoke
 *  Two modes:
 *    { hatch_token } — anyone holding the token can revoke
 *    { user_id }     — requires client auth; revokes that user's session
 * ────────────────────────────────────────────────────────────────────── */

const RevokeSchema = z
  .object({
    hatch_token: z.string().optional(),
    user_id: z.string().optional(),
  })
  .refine((d) => d.hatch_token || d.user_id, 'hatch_token or user_id required')

router.post('/revoke', exchangeLimit, async (req, res, next) => {
  try {
    const body = RevokeSchema.parse(req.body)

    if (body.hatch_token) {
      let claims
      try {
        claims = verifyHatchToken(body.hatch_token)
      } catch {
        // Treat invalid tokens as a no-op success — leaks no info about validity
        res.status(204).send()
        return
      }
      await execute(
        `UPDATE hatch_oauth_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
        [claims.sid]
      )
      logger.info('hatch-oauth session revoked via token', { session_id: claims.sid })
      res.status(204).send()
      return
    }

    // user_id mode — need to know which company is making the request
    await new Promise<void>((resolve, reject) => {
      requireClient(req, res, (err?: unknown) => (err ? reject(err) : resolve()))
    })
    const c = company(req)
    const result = await execute(
      `UPDATE hatch_oauth_sessions SET revoked_at = now()
       WHERE company_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [c.id, body.user_id!]
    )
    logger.info('hatch-oauth session revoked via client', {
      company: c.slug,
      user_id: body.user_id,
      affected: result,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/* ──────────────────────────────────────────────────────────────────────
 *  GET /api/v1/oauth/sessions
 *  Company sees all sessions for itself. (companyId is implicit from
 *  client auth — we don't expose by id since that's enumerable.)
 * ────────────────────────────────────────────────────────────────────── */

router.get('/sessions', requireClient, async (req, res) => {
  const c = company(req)
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
    [c.id, limit]
  )

  res.json({
    company: { id: c.id, name: c.name, slug: c.slug },
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

export default router
