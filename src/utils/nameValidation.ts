/**
 * Player name validation and normalization.
 * The same normalization logic must be used for uniqueness checks.
 */

const DEFAULT_MAX_LENGTH = 20
const BLOCKED_WORDS_DEFAULT: string[] = []

/**
 * Normalize a display name for uniqueness comparison.
 * Lowercases and collapses internal whitespace.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface NameValidationOptions {
  maxLength?: number
  blockedWords?: string[]
}

export interface NameValidationResult {
  valid: boolean
  normalizedName: string
  errorCode?: string
  errorMessage?: string
}

export function validatePlayerName(
  raw: string,
  options: NameValidationOptions = {}
): NameValidationResult {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH
  const blockedWords = options.blockedWords ?? BLOCKED_WORDS_DEFAULT

  const trimmed = raw.trim()

  if (!trimmed) {
    return { valid: false, normalizedName: '', errorCode: 'EMPTY', errorMessage: 'Name cannot be empty.' }
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      normalizedName: '',
      errorCode: 'TOO_LONG',
      errorMessage: `Name must be ${maxLength} characters or fewer.`,
    }
  }

  // Must contain at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return {
      valid: false,
      normalizedName: '',
      errorCode: 'NO_ALPHANUMERIC',
      errorMessage: 'Name must contain at least one letter or number.',
    }
  }

  // No HTML/script injection characters
  if (/<|>|&(?!amp;|lt;|gt;|quot;|#)/i.test(trimmed)) {
    return {
      valid: false,
      normalizedName: '',
      errorCode: 'INVALID_CHARS',
      errorMessage: 'Name contains invalid characters.',
    }
  }

  const normalized = normalizeName(trimmed)

  // Blocked-word check (whole-word match)
  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`)
    if (regex.test(normalized)) {
      return {
        valid: false,
        normalizedName: '',
        errorCode: 'BLOCKED_WORD',
        errorMessage: 'That name is not allowed.',
      }
    }
  }

  return { valid: true, normalizedName: normalized }
}
