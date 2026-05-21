import { formatDistanceToNowStrict } from 'date-fns'

export function timeAgo(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function initials(input: string): string {
  // For an email "alice@acme.com" → "AC"; for a name "Alice Cohen" → "AC".
  const cleaned = input.split('@')[0] ?? input
  const parts = cleaned.split(/[.\s_-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

export function formatCount(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
