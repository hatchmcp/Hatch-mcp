import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const TAG_LENGTH = 16 // bytes
const NONCE_LENGTH = 12 // 96-bit IV recommended for GCM

function getKey(): Buffer {
  return Buffer.from(config.ENCRYPTION_KEY, 'hex')
}

export interface Encrypted {
  ciphertext: string // hex: authTag (32 chars) + encrypted payload
  nonce: string      // hex: 24 chars
}

export function encrypt(plaintext: string): Encrypted {
  const key = getKey()
  const nonce = randomBytes(NONCE_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, nonce)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag() // 16-byte auth tag

  // Prepend auth tag to ciphertext for single-blob storage
  return {
    ciphertext: Buffer.concat([tag, encrypted]).toString('hex'),
    nonce: nonce.toString('hex'),
  }
}

export function decrypt(ciphertextHex: string, nonceHex: string): string {
  const key = getKey()
  const nonce = Buffer.from(nonceHex, 'hex')
  const combined = Buffer.from(ciphertextHex, 'hex')

  const tag = combined.subarray(0, TAG_LENGTH)
  const encrypted = combined.subarray(TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, nonce)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
