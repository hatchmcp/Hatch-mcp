import { describe, expect, it } from 'vitest'
import { buildAuthConfig } from './auth-mapper.js'

describe('buildAuthConfig', () => {
  it('maps bearer auth to required token secret', () => {
    const cfg = buildAuthConfig('bearer')
    expect(cfg.type).toBe('bearer')
    expect(cfg.user_must_provide).toContain('token')
  })

  it('maps none auth to empty requirements', () => {
    const cfg = buildAuthConfig('none')
    expect(cfg.user_must_provide).toEqual([])
  })
})
