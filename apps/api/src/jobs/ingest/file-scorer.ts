import path from 'node:path'

// Patterns that suggest a file contains route definitions (heuristic, not AI)
const ROUTE_FILE_PATTERNS = [
  /routes?\//i,
  /controllers?\//i,
  /api\//i,
  /endpoints?\//i,
  /handlers?\//i,
  /resolvers?\//i,
  /server\.[jt]sx?$/i,
  /app\.[jt]sx?$/i,
  /index\.[jt]sx?$/i,
  /urls?\.py$/i,
  /views?\.py$/i,
]

// Inline route declarations across popular frameworks
const ROUTE_SIGNAL_REGEX =
  /\b(app|router|api|fastify)\.(get|post|put|patch|delete|use)\s*\(|@(Get|Post|Put|Patch|Delete|Route)\b|@app\.(route|get|post)|router\.(get|post)/

export interface ScoredFile {
  filePath: string
  content: string
  score: number
}

// Assigns a relevance score to a file — higher = more likely to contain routes.
// Files scoring above 0 are included in extraction chunks.
export function scoreFile(filePath: string, content: string): number {
  let score = 0

  const normalized = filePath.replace(/\\/g, '/')

  if (ROUTE_FILE_PATTERNS.some((r) => r.test(normalized))) score += 5

  const matches = content.match(new RegExp(ROUTE_SIGNAL_REGEX.source, 'g'))
  if (matches) score += Math.min(matches.length, 20)

  // Penalise very large files — they're usually bundled output, not source
  if (content.length > 100_000) score -= 3

  // Skip test files, lock files, and generated output
  if (/\.(test|spec|lock|snap)\.[jt]s$/.test(normalized)) score -= 10
  if (/\b(node_modules|dist|build|\.next|__pycache__)\b/.test(normalized)) score -= 20

  return score
}

// Sorts scored files highest-first and returns only those with score > 0
export function rankFiles(files: ScoredFile[]): ScoredFile[] {
  return files
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
}

// Groups files by directory — used by chunker to keep related files together
export function groupByDirectory(files: ScoredFile[]): Map<string, ScoredFile[]> {
  const groups = new Map<string, ScoredFile[]>()
  for (const file of files) {
    const dir = path.dirname(file.filePath)
    const existing = groups.get(dir) ?? []
    existing.push(file)
    groups.set(dir, existing)
  }
  return groups
}
