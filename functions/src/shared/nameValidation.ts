// Shared name validation for Cloud Functions (mirrors frontend util)

interface NameValidationOptions {
  maxLength?: number
  blockedWords?: string[]
}

interface NameValidationResult {
  valid: boolean
  normalizedName: string
  errorCode?: string
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function validatePlayerName(raw: string, options: NameValidationOptions = {}): NameValidationResult {
  const maxLength   = options.maxLength ?? 20
  const blockedWords = options.blockedWords ?? []
  const trimmed     = raw.trim()

  if (!trimmed) return { valid: false, normalizedName: '', errorCode: 'EMPTY' }
  if (trimmed.length > maxLength) return { valid: false, normalizedName: '', errorCode: 'TOO_LONG' }
  if (!/[a-zA-Z0-9]/.test(trimmed)) return { valid: false, normalizedName: '', errorCode: 'NO_ALPHANUMERIC' }
  if (/<|>|&(?!amp;|lt;|gt;|quot;|#)/i.test(trimmed)) return { valid: false, normalizedName: '', errorCode: 'INVALID_CHARS' }

  const normalized = normalizeName(trimmed)
  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`)
    if (regex.test(normalized)) return { valid: false, normalizedName: '', errorCode: 'BLOCKED_WORD' }
  }

  return { valid: true, normalizedName: normalized }
}
