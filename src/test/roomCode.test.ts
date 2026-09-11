import { describe, it, expect } from 'vitest'
import { generateRoomCode, isValidRoomCode, ROOM_CODE_CHARS } from '@/utils/roomCode'

describe('generateRoomCode', () => {
  it('generates a 6-character code', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(6)
  })

  it('only uses allowed characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode()
      expect([...code].every(c => ROOM_CODE_CHARS.includes(c))).toBe(true)
    }
  })

  it('does not contain I, O, 0, or 1', () => {
    const EXCLUDED = ['I', 'O', '0', '1']
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode()
      expect(EXCLUDED.some(c => code.includes(c))).toBe(false)
    }
  })
})

describe('isValidRoomCode', () => {
  it('accepts valid 6-char codes', () => {
    expect(isValidRoomCode('ABC234')).toBe(true)
    expect(isValidRoomCode('XYZPQR')).toBe(true)
  })

  it('rejects codes with wrong length', () => {
    expect(isValidRoomCode('ABC')).toBe(false)
    expect(isValidRoomCode('ABCDEFG')).toBe(false)
  })

  it('rejects codes with excluded characters', () => {
    expect(isValidRoomCode('ABC001')).toBe(false)
    expect(isValidRoomCode('ABCIOX')).toBe(false)
  })
})
