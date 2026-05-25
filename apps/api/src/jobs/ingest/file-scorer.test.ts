import { describe, expect, it } from 'vitest'
import { scoreFile, rankFiles } from './file-scorer.js'

describe('file-scorer', () => {
  it('scores route files higher than unrelated files', () => {
    const routeScore = scoreFile(
      'src/routes/users.ts',
      'router.get("/users", handler)'
    )
    const junkScore = scoreFile('README.md', '# docs')
    expect(routeScore).toBeGreaterThan(junkScore)
  })

  it('rankFiles drops non-positive scores', () => {
    const ranked = rankFiles([
      { filePath: 'a.ts', content: 'router.get("/a")', score: 3 },
      { filePath: 'b.ts', content: 'plain', score: 0 },
    ])
    expect(ranked).toHaveLength(1)
    expect(ranked[0].filePath).toBe('a.ts')
  })
})
