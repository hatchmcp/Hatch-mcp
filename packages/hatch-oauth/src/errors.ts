/**
 * Errors thrown by `hatch-oauth`. Catch the base `HatchOAuthError` if you
 * just want to surface a generic "broker is unhappy" — or `instanceof`
 * the specific subclasses for targeted handling (e.g. show a Reconnect
 * button on `HatchOAuthReconnectRequired`).
 */
export class HatchOAuthError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'HatchOAuthError'
  }
}

/** Misconfiguration that can't be fixed at runtime — bad clientId, missing secret. */
export class HatchOAuthConfigError extends HatchOAuthError {
  constructor(message: string) {
    super(message, undefined, 'CONFIG')
    this.name = 'HatchOAuthConfigError'
  }
}

/** Network or transport failure. Caller may retry. */
export class HatchOAuthNetworkError extends HatchOAuthError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message, undefined, 'NETWORK')
    this.name = 'HatchOAuthNetworkError'
  }
}

/**
 * The hatch_token is missing, expired, or its session was revoked.
 * The end user needs to go through /oauth/connect again.
 * Use this to render a "Reconnect" button or surface the connect URL.
 */
export class HatchOAuthReconnectRequired extends HatchOAuthError {
  constructor(message: string = 'Reconnect required — the user needs to authorize again') {
    super(message, 401, 'RECONNECT_REQUIRED')
    this.name = 'HatchOAuthReconnectRequired'
  }
}

/** Client credentials rejected by the broker. Usually a typo in clientSecret. */
export class HatchOAuthForbidden extends HatchOAuthError {
  constructor(message: string = 'Forbidden — check clientId/clientSecret') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'HatchOAuthForbidden'
  }
}

/** Rate limit hit. Surface the `retryAfter` so callers can back off. */
export class HatchOAuthRateLimited extends HatchOAuthError {
  constructor(
    message: string = 'Rate limited by hatch broker',
    public readonly retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMITED')
    this.name = 'HatchOAuthRateLimited'
  }
}

/** 4xx that isn't 401/403/429 — usually a validation error. */
export class HatchOAuthValidationError extends HatchOAuthError {
  constructor(message: string, status: number) {
    super(message, status, 'VALIDATION')
    this.name = 'HatchOAuthValidationError'
  }
}

/** Unhelpful catch-all for 5xx from the broker. Retry-friendly. */
export class HatchOAuthServerError extends HatchOAuthError {
  constructor(message: string, status: number) {
    super(message, status, 'SERVER')
    this.name = 'HatchOAuthServerError'
  }
}
