import { describe, expect, it } from 'vitest'
import { decrypt, encrypt } from './crypto.js'

describe('crypto', () => {
  it('round-trips plaintext through AES-256-GCM', () => {
    const secret = 'super-secret-api-key'
    const { ciphertext, nonce } = encrypt(secret)
    expect(decrypt(ciphertext, nonce)).toBe(secret)
  })
})
