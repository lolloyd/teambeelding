import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db } from '../shared/helpers'

const schema = z.object({ roomId: z.string().min(1) })

export async function pauseQuestionFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId } = validatePayload(schema, request.data)
  const firestore = db()
  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!
    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host.')
    if (room['phase'] !== 'QUESTION_OPEN') throw new HttpsError('failed-precondition', `Cannot pause from: ${room['phase']}`)

    const qId  = room['currentQuestionInstanceId'] as string
    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc(qId)
    const qSnap = await tx.get(qRef)
    if (!qSnap.exists) throw new HttpsError('not-found', 'Question not found.')
    const q = qSnap.data()!

    const now          = Date.now()
    const remainingMs  = Math.max(0, (q['closesAt'] as number) - now)

    tx.update(qRef, { phase: 'QUESTION_PAUSED', remainingMsWhenPaused: remainingMs, pausedAt: now })
    tx.update(roomRef, { phase: 'QUESTION_PAUSED' })
  })
}

export async function resumeQuestionFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId } = validatePayload(schema, request.data)
  const firestore = db()
  await firestore.runTransaction(async tx => {
    const roomRef  = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!
    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host.')
    if (room['phase'] !== 'QUESTION_PAUSED') throw new HttpsError('failed-precondition', `Cannot resume from: ${room['phase']}`)

    const qId  = room['currentQuestionInstanceId'] as string
    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc(qId)
    const qSnap = await tx.get(qRef)
    if (!qSnap.exists) throw new HttpsError('not-found', 'Question not found.')
    const q = qSnap.data()!

    const now          = Date.now()
    const remainingMs  = (q['remainingMsWhenPaused'] as number) ?? 5000
    const newClosesAt  = now + remainingMs

    tx.update(qRef, { phase: 'QUESTION_OPEN', closesAt: newClosesAt, remainingMsWhenPaused: null, pausedAt: null })
    tx.update(roomRef, { phase: 'QUESTION_OPEN' })
  })
}
