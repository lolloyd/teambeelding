import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, increment } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1), playerUid: z.string().min(1) })

export async function removePlayerFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId, playerUid } = validatePayload(schema, request.data)
  const firestore = db()
  await firestore.runTransaction(async tx => {
    const roomRef   = firestore.collection('rooms').doc(roomId)
    const playerRef = firestore.collection('rooms').doc(roomId).collection('players').doc(playerUid)
    const [roomSnap, playerSnap] = await Promise.all([tx.get(roomRef), tx.get(playerRef)])
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    if (roomSnap.data()!['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host.')
    if (!playerSnap.exists) return // already removed
    tx.update(playerRef, { status: 'removed' })
    tx.update(roomRef, { playerCount: increment(-1) })
  })
}
