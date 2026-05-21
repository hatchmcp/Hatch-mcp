import type { ScoredFile } from '../ingest/file-scorer.js'

const CHUNK_MAX_BYTES = 30_000  // ~30 KB per Claude call
const MAX_CHUNKS = 8            // cap total Claude calls per project

export interface Chunk {
  index: number
  total: number
  content: string
  files: string[]
}

// Packs high-scoring files together into at most MAX_CHUNKS chunks of CHUNK_MAX_BYTES.
// Files are grouped by directory first so related code stays together.
// Never splits mid-file — a file either fits in the current chunk or starts a new one.
export function buildChunks(files: ScoredFile[]): Chunk[] {
  // Sort highest-score first so the most relevant files land in early chunks
  const sorted = [...files].sort((a, b) => b.score - a.score)

  const rawChunks: { content: string; files: string[] }[] = []
  let current = { content: '', files: [] as string[] }

  for (const file of sorted) {
    const fileBlock = `// FILE: ${file.filePath}\n${file.content}\n\n`

    if (current.content.length + fileBlock.length > CHUNK_MAX_BYTES && current.content.length > 0) {
      rawChunks.push(current)
      current = { content: '', files: [] }
    }

    current.content += fileBlock
    current.files.push(file.filePath)
  }

  if (current.content.length > 0) rawChunks.push(current)

  // Trim to cap and add metadata
  const capped = rawChunks.slice(0, MAX_CHUNKS)
  const total = capped.length

  return capped.map((c, i) => ({
    index: i + 1,
    total,
    content: c.content,
    files: c.files,
  }))
}
