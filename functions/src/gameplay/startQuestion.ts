import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1) })

export async function startQuestionFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId } = validatePayload(schema, request.data)
  const firestore = db()

  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!

    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host can control questions.')
    if (room['phase'] !== 'BETWEEN_QUESTIONS') {
      throw new HttpsError('failed-precondition', `Cannot start question from phase: ${room['phase']}`)
    }

    const sequence = room['questionSequence'] as string[]
    const nextIndex = (room['currentSequenceIndex'] as number) + 1
    if (nextIndex >= sequence.length) throw new HttpsError('out-of-range', 'No more questions.')

    const nextQId  = sequence[nextIndex]
    const qRef     = firestore.collection('rooms').doc(roomId).collection('questions').doc(nextQId)
    const qSnap    = await tx.get(qRef)
    if (!qSnap.exists) throw new HttpsError('not-found', 'Question instance not found.')

    const q        = qSnap.data()!
    const durationMs = ((q['durationSeconds'] as number) ?? 15) * 1000
    const now      = Date.now()
    const closesAt = now + durationMs

    // Update question
    tx.update(qRef, {
      phase:       'QUESTION_OPEN',
      startedAt:   now,
      closesAt,
      durationMs,
      remainingMsWhenPaused: null,
      pausedAt: null,
    })

    // Update room
    tx.update(roomRef, {
      phase:                     'QUESTION_OPEN',
      currentQuestionInstanceId: nextQId,
      currentSequenceIndex:      nextIndex,
    })
  })
}
