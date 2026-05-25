import { Router } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import axios from 'axios'
import { auth } from '../middleware/auth.js'
import { config } from '../config.js'
import { execute, queryOne } from '../lib/db.js'
import { encrypt, decrypt } from '../lib/crypto.js'
import { HttpError } from '../middleware/error.js'
import { logger } from '../lib/logger.js'

const router = Router()

const SCOPES = 'repo' // covers both public and private repo contents
const OAUTH_AUTHORIZE = 'https://github.com/login/oauth/authorize'
const OAUTH_TOKEN = 'https://github.com/login/oauth/access_token'
const GH_USER_API = 'https://api.github.com/user'

// In-memory state store for the OAuth dance. State tokens are short-lived
// (5 min) and consumed once. Server restart drops them — the user re-clicks
// "Connect GitHub" if that happens, no real harm.
interface OAuthState {
  userId: string
  returnTo: string
  expiresAt: number
}
const oauthStates = new Map<string, OAuthState>()

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of oauthStates) {
    if (v.expiresAt < now) oauthStates.delete(k)
  }
}, 60_000).unref?.()

function ensureConfigured() {
  if (!config.GITHUB_OAUTH_CLIENT_ID || !config.GITHUB_OAUTH_CLIENT_SECRET) {
    throw new HttpError(
      503,
      'GitHub OAuth is not configured on this server. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.'
    )
  }
}

/* ─────────────────────────── Routes ─────────────────────────── */

const InitSchema = z.object({
  return_to: z.string().min(1).default('/'),
})

// POST /api/v1/oauth/github/init
// Frontend calls this with Bearer auth, gets back the GitHub authorize URL,
// then sets window.location to it. Can't be a GET — we need the auth header.
router.post('/oauth/github/init', auth, async (req, res) => {
  ensureConfigured()

  const { return_to } = InitSchema.parse(req.body)

  const state = randomBytes(32).toString('hex')
  oauthStates.set(state, {
    userId: req.userId,
    returnTo: return_to,
    expiresAt: Date.now() + 5 * 60_000,
  })

  const callback = `${config.API_BASE_URL}/api/v1/oauth/github/callback`
  const params = new URLSearchParams({
    client_id: config.GITHUB_OAUTH_CLIENT_ID!,
    redirect_uri: callback,
    scope: SCOPES,
    state,
    allow_signup: 'true',
  })

  res.json({ authorize_url: `${OAUTH_AUTHORIZE}?${params.toString()}` })
})

// GET /api/v1/oauth/github/callback?code=...&state=...
// GitHub redirects here. We can't require Bearer auth — it's a top-level
// browser nav. State token is what binds the dance to a Hatch user.
router.get('/oauth/github/callback', async (req, res) => {
  if (!config.GITHUB_OAUTH_CLIENT_ID || !config.GITHUB_OAUTH_CLIENT_SECRET) {
    res.redirect(`${config.WEB_BASE_URL}/?github_error=oauth_not_configured`)
    return
  }

  const code = String(req.query.code ?? '')
  const state = String(req.query.state ?? '')
  const error = req.query.error as string | undefined

  if (error) {
    res.redirect(
      `${config.WEB_BASE_URL}/?github_error=${encodeURIComponent(error)}`
    )
    return
  }

  if (!code || !state) {
    res.redirect(`${config.WEB_BASE_URL}/?github_error=missing_params`)
    return
  }

  const entry = oauthStates.get(state)
  oauthStates.delete(state)
  if (!entry || entry.expiresAt < Date.now()) {
    res.redirect(`${config.WEB_BASE_URL}/?github_error=invalid_state`)
    return
  }

  // Exchange the code for an access_token
  let accessToken: string
  let grantedScopes: string
  try {
    const tokenRes = await axios.post(
      OAUTH_TOKEN,
      {
        client_id: config.GITHUB_OAUTH_CLIENT_ID,
        client_secret: config.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${config.API_BASE_URL}/api/v1/oauth/github/callback`,
      },
      {
        headers: { Accept: 'application/json' },
        timeout: 10_000,
      }
    )

    accessToken = tokenRes.data?.access_token
    grantedScopes = tokenRes.data?.scope ?? ''
    if (!accessToken) {
      const ghError = tokenRes.data?.error ?? 'no_token'
      logger.warn('GitHub token exchange returned no access_token', { ghError })
      res.redirect(
        `${config.WEB_BASE_URL}${entry.returnTo}?github_error=${encodeURIComponent(ghError)}`
      )
      return
    }
  } catch (err) {
    logger.error('GitHub token exchange failed', { err: String(err) })
    res.redirect(
      `${config.WEB_BASE_URL}${entry.returnTo}?github_error=token_exchange_failed`
    )
    return
  }

  // Fetch the GitHub login so we can display "Connected as @foo"
  let githubLogin = 'unknown'
  let githubUserId: number | null = null
  try {
    const userRes = await axios.get(GH_USER_API, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
      timeout: 10_000,
    })
    githubLogin = userRes.data?.login ?? 'unknown'
    githubUserId = userRes.data?.id ?? null
  } catch (err) {
    logger.warn('Could not fetch GitHub user info — token still saved', {
      err: String(err),
    })
  }

  // Encrypt and persist the token (upsert — re-connecting replaces the old one)
  const { ciphertext, nonce } = encrypt(accessToken)
  await execute(
    `INSERT INTO user_github_connections
       (user_id, github_login, github_user_id, access_token_ciphertext, access_token_nonce, scopes, connected_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE
     SET github_login = EXCLUDED.github_login,
         github_user_id = EXCLUDED.github_user_id,
         access_token_ciphertext = EXCLUDED.access_token_ciphertext,
         access_token_nonce = EXCLUDED.access_token_nonce,
         scopes = EXCLUDED.scopes,
         connected_at = now()`,
    [entry.userId, githubLogin, githubUserId, ciphertext, nonce, grantedScopes]
  )

  logger.info('GitHub connected', {
    userId: entry.userId,
    githubLogin,
    scopes: grantedScopes,
  })

  // Redirect the user back to wherever they came from (export page usually),
  // with ?github_connected=<login> so the page can show a success toast.
  const returnUrl = new URL(entry.returnTo, config.WEB_BASE_URL)
  returnUrl.searchParams.set('github_connected', githubLogin)
  res.redirect(returnUrl.toString())
})

/* ─────────────────────────── Connection status ─────────────────────────── */

// GET /api/v1/me/github-connection
router.get('/me/github-connection', auth, async (req, res) => {
  const row = await queryOne<{
    github_login: string
    scopes: string | null
    connected_at: Date
  }>(
    `SELECT github_login, scopes, connected_at
     FROM user_github_connections WHERE user_id = $1`,
    [req.userId]
  )

  if (!row) {
    res.json({
      connected: false,
      configured: !!config.GITHUB_OAUTH_CLIENT_ID,
    })
    return
  }

  res.json({
    connected: true,
    configured: true,
    github_login: row.github_login,
    scopes: row.scopes,
    connected_at: row.connected_at,
  })
})

// DELETE /api/v1/me/github-connection
router.delete('/me/github-connection', auth, async (req, res) => {
  await execute(
    `DELETE FROM user_github_connections WHERE user_id = $1`,
    [req.userId]
  )
  res.status(204).send()
})

/* ─────────────────────────── Helpers for other routes ─────────────────────────── */

// Used by /push-to-github to fetch the caller's stored OAuth token
export async function getUserGithubToken(userId: string): Promise<{
  token: string
  login: string
} | null> {
  const row = await queryOne<{
    github_login: string
    access_token_ciphertext: string
    access_token_nonce: string
  }>(
    `SELECT github_login, access_token_ciphertext, access_token_nonce
     FROM user_github_connections WHERE user_id = $1`,
    [userId]
  )

  if (!row) return null

  try {
    const token = decrypt(row.access_token_ciphertext, row.access_token_nonce)
    return { token, login: row.github_login }
  } catch (err) {
    logger.warn('Failed to decrypt stored GitHub token', { userId, err: String(err) })
    return null
  }
}

export default router
