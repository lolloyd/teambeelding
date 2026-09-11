/**
 * Room code generation.
 * Uses a character set that avoids visually confusing characters:
 * I, O, 0, 1 are excluded.
 */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  let code = ''
  const chars = ROOM_CODE_CHARS
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== 6) return false
  return [...code].every(c => ROOM_CODE_CHARS.includes(c))
}
