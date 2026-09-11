import * as admin from 'firebase-admin'
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'

export function requireAuth(request: CallableRequest): admin.auth.DecodedIdToken {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.')
  }
  return request.auth.token as admin.auth.DecodedIdToken
}

export function requireAdmin(request: CallableRequest): admin.auth.DecodedIdToken {
  const token = requireAuth(request)
  if (token['admin'] !== true) {
    throw new HttpsError('permission-denied', 'Admin access required.')
  }
  return token
}

export function validatePayload<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const msg = result.error.issues.map(i => i.message).join('; ')
    throw new HttpsError('invalid-argument', `Invalid payload: ${msg}`)
  }
  return result.data
}

export const db = () => admin.firestore()
export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp()
export const increment = (n: number) => admin.firestore.FieldValue.increment(n)
export const deleteField = () => admin.firestore.FieldValue.delete()

// Room code character set (matches frontend)
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length))
  }
  return code
}

// Competition ranking: 1, 2, 2, 4
export function competitionRank(scores: number[], score: number): number {
  const sorted = [...scores].sort((a, b) => b - a)
  return sorted.indexOf(score) + 1
}

export const BASE_CORRECT_POINTS = 1000
export const MAX_SPEED_BONUS = 200

export function calculateAwardedPoints(
  isCorrect: boolean,
  remainingMs: number,
  durationMs: number,
  incorrectPenaltyPts = 0
): number {
  if (isCorrect) {
    const ratio  = Math.max(0, Math.min(1, remainingMs / durationMs))
    const bonus  = Math.floor(MAX_SPEED_BONUS * ratio)
    return BASE_CORRECT_POINTS + bonus
  }
  return -Math.abs(incorrectPenaltyPts)
}

export function applyPoints(current: number, awarded: number): number {
  return Math.max(0, current + awarded)
}
