import jwt, { type JwtPayload } from 'jsonwebtoken'
import { randomBytes, randomUUID } from 'crypto'
import { config } from '../config.js'

/**
 * hatch_token = signed JWT (HS256) the MCP server holds in env and presents
 * on /oauth/exchange. We deliberately keep claims minimal — anything
 * sensitive lives in the DB row keyed by session_id.
 */
export interface HatchTokenClaims extends JwtPayload {
  sid: string  // session UUID
  cid: string  // company client_id (public)
  iss: 'hatchmcp'
  jti: string  // unique token id; lets us revoke a single token if needed
}

const ISS = 'hatchmcp'
const DAY = 24 * 60 * 60

export interface SignedToken {
  token: string
  expires_at: Date
  jti: string
}

export function signHatchToken(opts: {
  sessionId: string
  clientId: string
  ttlSeconds?: number
}): SignedToken {
  const ttl = opts.ttlSeconds ?? config.HATCH_OAUTH_TOKEN_TTL_DAYS * DAY
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + ttl * 1000)

  const payload: HatchTokenClaims = {
    sid: opts.sessionId,
    cid: opts.clientId,
    iss: ISS,
    jti,
  }

  const token = jwt.sign(payload, config.HATCH_OAUTH_SIGNING_SECRET, {
    algorithm: 'HS256',
    expiresIn: ttl,
  })

  // Prefix so the token is recognizable in logs as a hatch token.
  // The literal JWT lives after the prefix; verify() strips it.
  return { token: `hk_${token}`, expires_at: expiresAt, jti }
}

export class HatchTokenError extends Error {
  constructor(public reason: 'malformed' | 'expired' | 'invalid_signature' | 'wrong_issuer') {
    super(`Invalid hatch_token: ${reason}`)
    this.name = 'HatchTokenError'
  }
}

export function verifyHatchToken(input: string): HatchTokenClaims {
  if (!input || typeof input !== 'string') {
    throw new HatchTokenError('malformed')
  }
  const raw = input.startsWith('hk_') ? input.slice(3) : input

  let decoded: jwt.JwtPayload | string
  try {
    decoded = jwt.verify(raw, config.HATCH_OAUTH_SIGNING_SECRET, {
      algorithms: ['HS256'],
    })
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new HatchTokenError('expired')
    if (err instanceof jwt.JsonWebTokenError) throw new HatchTokenError('invalid_signature')
    throw new HatchTokenError('malformed')
  }

  if (typeof decoded === 'string') throw new HatchTokenError('malformed')
  const claims = decoded as HatchTokenClaims

  if (claims.iss !== ISS) throw new HatchTokenError('wrong_issuer')
  if (!claims.sid || !claims.cid || !claims.jti) throw new HatchTokenError('malformed')

  return claims
}

/** Decide whether to rotate on exchange. We rotate when <7 days to expiry. */
export function shouldRotate(claims: HatchTokenClaims): boolean {
  if (!claims.exp) return false
  const remaining = claims.exp * 1000 - Date.now()
  return remaining < 7 * DAY * 1000
}

/** New random client_id ("hco_…") — public, shown in connect URLs. */
export function generateClientId(): string {
  return `hco_${randomBytes(12).toString('base64url')}`
}

/** New random client_secret ("hcs_…") — shown ONCE on register. */
export function generateClientSecret(): string {
  return `hcs_${randomBytes(32).toString('base64url')}`
}
