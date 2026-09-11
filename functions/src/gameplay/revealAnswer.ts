import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, applyPoints, increment } from '../shared/helpers'

const schema = z.object({
  roomId:             z.string().min(1),
  questionInstanceId: z.string().min(1),
})

export async function revealAnswerFn(request: CallableRequest): Promise<void> {
  const token = requireAuth(request)
  const { roomId, questionInstanceId } = validatePayload(schema, request.data)
  const firestore = db()

  // Phase transition: QUESTION_CLOSED -> ANSWER_REVEAL
  await firestore.runTransaction(async tx => {
    const roomRef = firestore.collection('rooms').doc(roomId)
    const roomSnap = await tx.get(roomRef)
    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found.')
    const room = roomSnap.data()!

    if (room['hostUid'] !== token['uid']) throw new HttpsError('permission-denied', 'Only the host can reveal answers.')
    if (room['phase'] !== 'QUESTION_CLOSED') {
      throw new HttpsError('failed-precondition', `Cannot reveal from phase: ${room['phase']}`)
    }

    const privQRef  = firestore.collection('rooms').doc(roomId).collection('privateQuestions').doc(questionInstanceId)
    const privQSnap = await tx.get(privQRef)
    if (!privQSnap.exists) throw new HttpsError('not-found', 'Private question data not found.')
    const privQ = privQSnap.data()!

    // Idempotent: if already revealed, just update room phase
    if (privQ['revealed']) {
      tx.update(roomRef, { phase: 'ANSWER_REVEAL' })
      return
    }

    tx.update(privQRef, { revealed: true })

    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc(questionInstanceId)
    tx.update(qRef, {
      phase:            'ANSWER_REVEAL',
      songTitle:        privQ['songTitle'] ?? null,
      artist:           privQ['artist'] ?? null,
      correctChoiceKey: privQ['correctChoiceKey'],
    })

    tx.update(roomRef, { phase: 'ANSWER_REVEAL' })
  })

  // Apply scores to players outside the transaction
  const resultsSnap = await firestore
    .collection('rooms').doc(roomId)
    .collection('privateResults')
    .where('questionInstanceId', '==', questionInstanceId)
    .where('revealed', '==', false)
    .get()

  const batch = firestore.batch()

  for (const rDoc of resultsSnap.docs) {
    const result = rDoc.data()
    const playerRef = firestore
      .collection('rooms').doc(roomId)
      .collection('players').doc(result['playerUid'] as string)
    const playerSnap = await playerRef.get()
    if (!playerSnap.exists) continue

    const player = playerSnap.data()!
    const newTotal = applyPoints(player['totalScore'] as number, result['awardedPoints'] as number)

    batch.update(playerRef, {
      totalScore:    newTotal,
      correctCount:  increment(result['isCorrect'] ? 1 : 0),
      incorrectCount: increment((!result['isCorrect'] as boolean) && (result['penaltyPoints'] as number) > 0 ? 1 : 0),
    })

    batch.update(rDoc.ref, { revealed: true })
  }

  await batch.commit()
}

