import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAdmin, db } from '../shared/helpers'

const schema = z.object({ gameId: z.string().min(1) })

export async function publishGameFn(request: CallableRequest): Promise<void> {
  requireAdmin(request)
  const { gameId } = schema.parse(request.data)
  const ref = db().collection('games').doc(gameId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Game not found.')
  await ref.update({ published: true, updatedAt: Date.now() })
}

export async function unpublishGameFn(request: CallableRequest): Promise<void> {
  requireAdmin(request)
  const { gameId } = schema.parse(request.data)
  const ref = db().collection('games').doc(gameId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Game not found.')
  await ref.update({ published: false, updatedAt: Date.now() })
}

export async function deleteGameFn(request: CallableRequest): Promise<void> {
  requireAdmin(request)
  const { gameId } = schema.parse(request.data)
  const firestore = db()
  // Firestore delete does not cascade — use a recursive delete helper
  await firestore.recursiveDelete(firestore.collection('games').doc(gameId))
}

export async function updateAppConfigFn(request: CallableRequest): Promise<void> {
  requireAdmin(request)
  const payload = z.object({
    maxPlayerNameLength: z.number().int().min(3).max(50).optional(),
    blockedWords: z.array(z.string()).optional(),
  }).parse(request.data)
  await db().collection('appConfig').doc('public').set(payload, { merge: true })
}
