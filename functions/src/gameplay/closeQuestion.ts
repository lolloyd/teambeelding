import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1) })

export async function closeQuestionFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId } = validatePayload(schema, request.data)
  const firestore = db()
  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!
    if (room['hostUid'] !== token['uid'] && !request.auth?.token['admin']) {
      throw new HttpsError('permission-denied', 'Only the host.')
    }
    if (room['phase'] !== 'QUESTION_OPEN' && room['phase'] !== 'QUESTION_PAUSED') {
      throw new HttpsError('failed-precondition', `Cannot close from: ${room['phase']}`)
    }
    const qId  = room['currentQuestionInstanceId'] as string
    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc(qId)
    tx.update(qRef, { phase: 'QUESTION_CLOSED' })
    tx.update(roomRef, { phase: 'QUESTION_CLOSED' })
  })
}
