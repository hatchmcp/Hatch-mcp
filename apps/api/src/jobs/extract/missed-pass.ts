// Builds the user prompt for the "missed endpoint" second pass.
// Kept separate so extractor.ts stays focused on orchestration.

export function buildMissedPassPrompt(opts: {
  projectName: string
  fileIndex: string
  extractedPaths: string[]
}): string {
  const { projectName, fileIndex, extractedPaths } = opts
  return `Project: ${projectName}

Already extracted endpoints:
${extractedPaths.join('\n')}

File index (all source files in this project):
${fileIndex}

Are there any obvious API endpoints visible in the file index that are NOT listed above?
Reply using the same JSON schema. Include only endpoints you are confident are genuinely missing.
If nothing is missing, return {"endpoints": [], "framework_detected": "unknown", "base_url_hint": null, "auth_methods_detected": [], "extraction_confidence": "high", "possibly_missed": []}.`
}
