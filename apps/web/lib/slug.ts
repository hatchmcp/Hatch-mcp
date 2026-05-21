// Client-side preview slug. The server picks the canonical slug (with a random
// suffix) — this is just for showing the user what the subdomain will look like.
export function previewSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
