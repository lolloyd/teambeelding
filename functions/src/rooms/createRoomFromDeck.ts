import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, generateRoomCode } from '../shared/helpers'

const choiceSchema = z.object({
  choiceKey: z.string(),
  choiceOrder: z.number(),
  choiceText: z.string(),
})

const questionSchema = z.object({
  questionId: z.string().optional(),
  gameType: z.enum(['NAME_THE_SONG', 'GUESS_THE_PICTURE']),
  prompt: z.string(),
  choices: z.array(choiceSchema),
  correctChoiceKey: z.string(),
  durationSeconds: z.number().default(15),
  isTiebreaker: z.boolean().default(false),
  lyricExcerpt: z.string().optional().nullable(),
  songTitle: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  imageStorageUrl: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
})

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1),
})

const MAX_CODE_ATTEMPTS = 10

export async function createRoomFromDeckFn(request: CallableRequest): Promise<{ roomId: string; roomCode: string }> {
  const token = requireAuth(request)
  const { title, description, questions } = validatePayload(schema, request.data)
  const firestore = db()

  let roomCode = ''
  let attempts = 0
  while (attempts < MAX_CODE_ATTEMPTS) {
    roomCode = generateRoomCode()
    const existing = await firestore.collection('roomCodes').doc(roomCode).get()
    if (!existing.exists) break
    attempts++
  }
  if (!roomCode) throw new HttpsError('resource-exhausted', 'Could not generate a unique room code.')

  const batch = firestore.batch()
  const roomRef = firestore.collection('rooms').doc()
  const roomId = roomRef.id
  const now = Date.now()

  batch.set(roomRef, {
    roomId,
    roomCode,
    gameId: 'custom-deck',
    gameTitle: title,
    description: description ?? null,
    hostUid: token['uid'],
    phase: 'LOBBY',
    currentQuestionInstanceId: null,
    currentSequenceIndex: -1,
    questionSequence: [],
    totalQuestions: questions.filter(q => !q.isTiebreaker).length,
    tiebreakerAvailable: questions.some(q => q.isTiebreaker),
    playerCount: 0,
    soundEnabled: false,
    createdAt: now,
    expiresAt: null,
    roundCount: 1,
    questionOrderMode: 'EXACT',
    incorrectPenaltyPoints: 0,
    defaultDurationSeconds: 15,
  })

  const questionSequenceIds: string[] = []
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc()
    const qId = qRef.id
    questionSequenceIds.push(qId)

    batch.set(qRef, {
      questionInstanceId: qId,
      questionId: q.questionId ?? `custom-q-${i}`,
      roundId: 'custom-round-1',
      roundNumber: 1,
      roundTitle: 'Trivia Deck',
      sequenceIndex: i,
      gameType: q.gameType,
      prompt: q.prompt,
      lyricExcerpt: q.lyricExcerpt ?? null,
      songTitle: null,
      artist: null,
      imageStorageUrl: q.imageStorageUrl ?? null,
      choices: q.choices,
      category: q.category ?? null,
      subcategory: null,
      difficulty: q.difficulty ?? null,
      durationSeconds: q.durationSeconds,
      isTiebreaker: q.isTiebreaker,
      phase: 'PENDING',
    })

    const privRef = firestore.collection('rooms').doc(roomId).collection('privateQuestions').doc(qId)
    batch.set(privRef, {
      questionInstanceId: qId,
      correctChoiceKey: q.correctChoiceKey,
      songTitle: q.songTitle ?? null,
      artist: q.artist ?? null,
      revealed: false,
    })
  }

  batch.update(roomRef, { questionSequence: questionSequenceIds })
  batch.set(firestore.collection('roomCodes').doc(roomCode), { roomId, createdAt: now })
  await batch.commit()

  return { roomId, roomCode }
}
