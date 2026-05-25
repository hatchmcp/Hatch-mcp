import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

describe('createApp', () => {
  it('GET /health returns ok', async () => {
    const app = createApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.ts).toBeDefined()
  })
})
