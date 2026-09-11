import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db } from '../shared/helpers'

const schema = z.object({
  roomId:             z.string().min(1),
  questionInstanceId: z.string().min(1),
})

export async function skipQuestionFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId, questionInstanceId } = validatePayload(schema, request.data)
  const firestore = db()
  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!
    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host.')
    if (room['phase'] !== 'QUESTION_OPEN' && room['phase'] !== 'QUESTION_PAUSED') {
      throw new HttpsError('failed-precondition', `Cannot skip from: ${room['phase']}`)
    }
    if (room['currentQuestionInstanceId'] !== questionInstanceId) {
      throw new HttpsError('failed-precondition', 'Not the active question.')
    }
    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc(questionInstanceId)
    tx.update(qRef, { phase: 'QUESTION_CLOSED', skipped: true })
    tx.update(roomRef, { phase: 'ANSWER_REVEAL' }) // skip straight to reveal (no points)
  })
}
