import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1) })

export async function startGameFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId } = validatePayload(schema, request.data)
  const firestore = db()

  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!

    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host can start the game.')
    if (room['phase'] !== 'LOBBY') throw new HttpsError('failed-precondition', 'Game already started.')
    if ((room['playerCount'] as number) === 0) throw new HttpsError('failed-precondition', 'No players in room.')

    tx.update(roomRef, {
      phase: 'BETWEEN_QUESTIONS',
      startedAt: Date.now(),
      currentSequenceIndex: -1,
    })
  })
}
