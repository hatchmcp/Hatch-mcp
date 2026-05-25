import { describe, expect, it } from 'vitest'
import { substituteTemplate } from './template.js'

describe('substituteTemplate', () => {
  const vars = {
    env: { BASE_URL: 'https://api.example.com' },
    input: { id: '42' },
    auth: { token: 'secret' },
  }

  it('resolves env, input, and auth namespaces', () => {
    const out = substituteTemplate(
      '${env.BASE_URL}/items/${input.id}?t=${auth.token}',
      vars
    )
    expect(out).toBe('https://api.example.com/items/42?t=secret')
  })

  it('leaves malformed placeholders intact', () => {
    expect(substituteTemplate('${bad}', vars)).toBe('${bad}')
  })
})
