import { describe, it, expect } from 'vitest'
import { validatePlayerName, normalizeName } from '@/utils/nameValidation'

describe('normalizeName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeName('  Alice   Bob  ')).toBe('alice bob')
  })
})

describe('validatePlayerName', () => {
  it('accepts a valid name', () => {
    const result = validatePlayerName('Alice')
    expect(result.valid).toBe(true)
    expect(result.normalizedName).toBe('alice')
  })

  it('rejects empty names', () => {
    expect(validatePlayerName('').valid).toBe(false)
    expect(validatePlayerName('   ').valid).toBe(false)
  })

  it('rejects names exceeding max length', () => {
    expect(validatePlayerName('A'.repeat(21), { maxLength: 20 }).valid).toBe(false)
  })

  it('rejects names with only symbols', () => {
    expect(validatePlayerName('!!! @@@').valid).toBe(false)
  })

  it('rejects names containing HTML injection', () => {
    expect(validatePlayerName('<script>alert(1)</script>').valid).toBe(false)
  })

  it('rejects blocked words', () => {
    expect(validatePlayerName('BadWord', { blockedWords: ['badword'] }).valid).toBe(false)
  })

  it('accepts names with numbers', () => {
    expect(validatePlayerName('Player123').valid).toBe(true)
  })
})
