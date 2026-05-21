import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { runtimeConfig } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const TAG_LENGTH = 16
const NONCE_LENGTH = 12

function getKey(): Buffer {
  return Buffer.from(runtimeConfig.ENCRYPTION_KEY, 'hex')
}

// Decrypts a secret stored as { ciphertext: hex, nonce: hex }
export function decryptSecret(ciphertextHex: string, nonceHex: string): string {
  const key = getKey()
  const nonce = Buffer.from(nonceHex, 'hex')
  const combined = Buffer.from(ciphertextHex, 'hex')

  const tag = combined.subarray(0, TAG_LENGTH)
  const encrypted = combined.subarray(TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, nonce)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// Encrypt — used when the runtime needs to store new values (rare)
export function encryptSecret(plaintext: string): { ciphertext: string; nonce: string } {
  const key = getKey()
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, nonce)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([tag, encrypted]).toString('hex'),
    nonce: nonce.toString('hex'),
  }
}
