import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1) })

export async function showLeaderboardFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId } = validatePayload(schema, request.data)
  const firestore = db()
  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!
    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host.')
    if (room['phase'] !== 'ANSWER_REVEAL') {
      throw new HttpsError('failed-precondition', `Cannot show leaderboard from: ${room['phase']}`)
    }
    tx.update(roomRef, { phase: 'LEADERBOARD' })
  })
}
