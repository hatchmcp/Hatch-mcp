import axios from 'axios'
import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { PermanentError } from '../runner.js'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

// Remove nav/sidebar/footer noise before converting to Markdown
const NAV_SELECTORS = [
  'nav', 'aside', 'header', 'footer',
  '.sidebar', '.navigation', '.nav', '.toc',
  '#sidebar', '#nav', '#header', '#footer',
]

export async function fetchDocsAsMarkdown(url: string): Promise<string> {
  let html: string
  try {
    const { data } = await axios.get<string>(url, {
      timeout: 15_000,
      maxContentLength: 5 * 1024 * 1024, // 5 MB
      headers: { 'User-Agent': 'HatchMCP/1.0 (+https://hatch.dev)' },
    })
    html = data
  } catch (err: unknown) {
    const e = err as { response?: { status: number }; message?: string }
    if (e.response?.status === 404) throw new PermanentError(`Docs URL not found: ${url}`)
    throw new PermanentError(`Failed to fetch docs from ${url}: ${e.message ?? String(err)}`)
  }

  const $ = cheerio.load(html)

  // Strip noisy boilerplate elements
  NAV_SELECTORS.forEach((sel) => $(sel).remove())
  $('script, style, [role="navigation"]').remove()

  // Prefer main content area if available
  const main = $('main, [role="main"], article, .content, #content, .docs-content').first()
  const body = main.length ? main : $('body')

  const cleaned = body.html() ?? ''
  const markdown = turndown.turndown(cleaned)

  // Trim to ~30 KB — excessive docs provide diminishing extraction value
  const MAX_CHARS = 30_000
  if (markdown.length > MAX_CHARS) {
    return markdown.slice(0, MAX_CHARS) + '\n\n[truncated]'
  }

  return markdown
}
