import { describe, expect, it } from 'vitest'
import { generateProjectSlug, generateSubdomain } from './slug.js'

describe('slug helpers', () => {
  it('generates URL-safe project slugs with suffix', () => {
    const slug = generateProjectSlug('My Cool API!!!')
    expect(slug).toMatch(/^my-cool-api-[a-f0-9]{4}$/)
  })

  it('generates subdomains in the same format', () => {
    expect(generateSubdomain('Acme')).toMatch(/^acme-[a-f0-9]{4}$/)
  })
})
