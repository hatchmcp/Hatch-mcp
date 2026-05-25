import { describe, expect, it } from 'vitest'
import { validateAuthSecrets } from './auth-test.service.js'

describe('validateAuthSecrets', () => {
  it('requires bearer token', () => {
    expect(() => validateAuthSecrets('bearer', {})).toThrow(/token/)
  })

  it('accepts bearer when token is present', () => {
    expect(() => validateAuthSecrets('bearer', { token: 'x' })).not.toThrow()
  })

  it('requires oauth client credentials fields', () => {
    expect(() =>
      validateAuthSecrets('oauth2_client_credentials', {
        client_id: 'a',
      })
    ).toThrow(/client_secret|token_url/)
  })
})
