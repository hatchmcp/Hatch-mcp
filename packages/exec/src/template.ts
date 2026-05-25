// Resolves ${env.X}, ${input.X}, ${auth.X} template variables.
export function substituteTemplate(
  template: string,
  vars: {
    env: Record<string, string>
    input: Record<string, unknown>
    auth: Record<string, string>
  }
): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key: string) => {
    const dotIdx = key.indexOf('.')
    if (dotIdx === -1) return match

    const ns = key.slice(0, dotIdx)
    const field = key.slice(dotIdx + 1)

    switch (ns) {
      case 'env':
        return vars.env[field] ?? ''
      case 'input':
        return String(vars.input[field] ?? '')
      case 'auth':
        return vars.auth[field] ?? ''
      default:
        return ''
    }
  })
}

export function substituteObject(
  obj: Record<string, unknown>,
  vars: Parameters<typeof substituteTemplate>[1]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = substituteTemplate(value, vars)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = substituteObject(value as Record<string, unknown>, vars)
    } else {
      result[key] = value
    }
  }
  return result
}
