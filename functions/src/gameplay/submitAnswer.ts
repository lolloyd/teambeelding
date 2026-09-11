import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, calculateAwardedPoints, increment } from '../shared/helpers'

const schema = z.object({
  roomId:             z.string().min(1),
  questionInstanceId: z.string().min(1),
  choiceKey:          z.string().min(1),
})

export async function submitAnswerFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId, questionInstanceId, choiceKey } = validatePayload(schema, request.data)
  const firestore = db()
  const playerUid = token['uid'] as string
  const submissionId = `${questionInstanceId}_${playerUid}`

  await firestore.runTransaction(async tx => {
    const roomRef    = firestore.collection('rooms').doc(roomId)
    const qRef       = firestore.collection('rooms').doc(roomId).collection('questions').doc(questionInstanceId)
    const privRef    = firestore.collection('rooms').doc(roomId).collection('privateQuestions').doc(questionInstanceId)
    const playerRef  = firestore.collection('rooms').doc(roomId).collection('players').doc(playerUid)
    const submRef    = firestore.collection('rooms').doc(roomId).collection('submissions').doc(submissionId)

    const [roomSnap, qSnap, privSnap, playerSnap, submSnap] = await Promise.all([
      tx.get(roomRef), tx.get(qRef), tx.get(privRef), tx.get(playerRef), tx.get(submRef),
    ])

    if (!roomSnap.exists)   throw new HttpsError('not-found', 'Room not found.')
    if (!qSnap.exists)      throw new HttpsError('not-found', 'Question not found.')
    if (!playerSnap.exists) throw new HttpsError('not-found', 'Player not found.')

    const room   = roomSnap.data()!
    const q      = qSnap.data()!
    const player = playerSnap.data()!
    const priv   = privSnap.exists ? privSnap.data()! : null

    // Already submitted — idempotent
    if (submSnap.exists) throw new HttpsError('already-exists', 'ALREADY_SUBMITTED')

    // Phase checks
    if (room['phase'] !== 'QUESTION_OPEN') throw new HttpsError('failed-precondition', 'QUESTION_CLOSED: Not accepting answers.')
    if (q['phase']    !== 'QUESTION_OPEN') throw new HttpsError('failed-precondition', 'QUESTION_CLOSED')
    if (player['status'] === 'removed')   throw new HttpsError('permission-denied', 'Player removed.')

    // Late joiner eligibility
    const eligibleFrom = (player['eligibleFromSequenceIndex'] as number) ?? 0
    const seqIndex     = (q['sequenceIndex'] as number) ?? 0
    if (seqIndex < eligibleFrom) throw new HttpsError('failed-precondition', 'LATE_JOIN: Not eligible for this question.')

    // Timer check
    const closesAt = (q['closesAt'] as number) ?? 0
    const now      = Date.now()
    if (now > closesAt) throw new HttpsError('deadline-exceeded', 'QUESTION_CLOSED: Timer expired.')

    // Calculate response time (from question open, excluding paused time)
    const startedAt   = (q['startedAt'] as number) ?? now
    const durationMs  = (q['durationMs'] as number) ?? 15000
    const remainingMs = Math.max(0, closesAt - now)
    const responseTimeMs = now - startedAt

    // Calculate score (stored privately, not revealed yet)
    const correctKey = priv?.['correctChoiceKey'] as string | null
    const isCorrect  = correctKey ? choiceKey === correctKey : false
    const incorrectPenalty = (room['incorrectPenaltyPoints'] as number) ?? 0
    const awardedPoints = calculateAwardedPoints(isCorrect, remainingMs, durationMs, incorrectPenalty)

    // Write submission (player can read their own choice)
    tx.set(submRef, {
      submissionId,
      questionInstanceId,
      playerUid,
      roomId,
      choiceKey,
      submittedAt: now,
      responseTimeMs,
    })

    // Write private result (not revealed yet)
    const resultRef = firestore.collection('rooms').doc(roomId).collection('privateResults').doc(submissionId)
    tx.set(resultRef, {
      resultId: submissionId,
      questionInstanceId,
      playerUid,
      roomId,
      choiceKey,
      isCorrect,
      basePoints:    isCorrect ? 1000 : 0,
      speedBonus:    isCorrect ? awardedPoints - 1000 : 0,
      penaltyPoints: isCorrect ? 0 : Math.abs(awardedPoints),
      awardedPoints,
      responseTimeMs,
      revealed: false,
    })

    // Increment player's answeredCount and record which question they just answered
    tx.update(playerRef, { answeredCount: increment(1), lastAnsweredSequenceIndex: seqIndex })
  })
}
