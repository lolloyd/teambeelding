import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, applyPoints } from '../shared/helpers'

const adjustSchema = z.object({
  roomId:    z.string().min(1),
  playerUid: z.string().min(1),
  amount:    z.number().int(),
  reason:    z.string().min(1).max(200),
})

export async function adjustScoreFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId, playerUid, amount, reason } = validatePayload(adjustSchema, request.data)
  const firestore = db()

  await firestore.runTransaction(async tx => {
    const roomRef   = firestore.collection('rooms').doc(roomId)
    const playerRef = firestore.collection('rooms').doc(roomId).collection('players').doc(playerUid)
    const [roomSnap, playerSnap] = await Promise.all([tx.get(roomRef), tx.get(playerRef)])

    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!
    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host.')
    if (!playerSnap.exists) throw new HttpsError('not-found', 'Player not found.')
    const player = playerSnap.data()!

    const newScore = applyPoints(player['totalScore'] as number, amount)
    tx.update(playerRef, { totalScore: newScore })

    // Write audit record
    const adjRef = firestore.collection('rooms').doc(roomId).collection('scoreAdjustments').doc()
    tx.set(adjRef, {
      adjustmentId: adjRef.id,
      roomId,
      playerUid,
      hostUid: token['uid'],
      amount,
      reason,
      timestamp: Date.now(),
    })
  })
}
