import { createHash, randomBytes } from 'crypto'

// 256-bit secret encoded base64url + `hk_` prefix → ~46 chars total.
// Recognizable, copy-paste safe, no `=` padding, no `+/` to worry about in URLs.
export function generateRuntimeKey(): string {
  const raw = randomBytes(32).toString('base64url')
  return `hk_${raw}`
}

// SHA-256 hex. Plaintext is high-entropy (256 bits) so a single un-salted hash
// is fine — no rainbow tables can cover 2^256 of preimage space, and brute
// force is computationally impossible. Salting would buy nothing.
export function hashRuntimeKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

// Last 4 chars of the plaintext, shown in the dashboard so the user can
// identify which key is active. Storing the suffix in cleartext is safe —
// 4 chars of base64url is too low-entropy to brute force the rest.
export function hintFromKey(plaintext: string): string {
  return plaintext.slice(-4)
}
