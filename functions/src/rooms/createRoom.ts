import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireAuth, validatePayload, db, generateRoomCode } from '../shared/helpers'

const schema = z.object({ gameId: z.string().min(1) })
const MAX_CODE_ATTEMPTS = 10

type RoundData = { roundId: string } & Record<string, unknown>
type QuestionData = Record<string, unknown>

export async function createRoomFn(request: CallableRequest): Promise<{ roomId: string; roomCode: string }> {
  const token = requireAuth(request)
  const { gameId } = validatePayload(schema, request.data)
  const firestore = db()

  const gameDoc = await firestore.collection('games').doc(gameId).get()
  if (!gameDoc.exists) throw new HttpsError('not-found', 'Game not found.')
  const game = gameDoc.data()!
  if (!game['published']) throw new HttpsError('failed-precondition', 'Game is not published.')

  const roundsSnap = await firestore.collection('games').doc(gameId).collection('rounds').orderBy('roundNumber').get()
  const rounds: RoundData[] = roundsSnap.docs.map(d => ({ roundId: d.id, ...d.data() }))

  const questionsByRound: Record<string, QuestionData[]> = {}
  for (const round of rounds) {
    const qSnap = await firestore
      .collection('games').doc(gameId)
      .collection('rounds').doc(round.roundId)
      .collection('questions')
      .where('active', '==', true)
      .orderBy('questionNumber')
      .get()
    questionsByRound[round.roundId] = qSnap.docs.map(d => ({ questionId: d.id, ...d.data() }))
  }

  const sequence: Array<{
    roundId: string; roundNumber: number; roundTitle: string;
    questionId: string; questionNumber: number;
    gameType: string; prompt: string; choices: unknown[]; correctChoiceKey: string;
    durationSeconds: number; isTiebreaker: boolean;
    lyricExcerpt?: string; songTitle?: string; artist?: string;
    imageStorageUrl?: string; category?: string; subcategory?: string; difficulty?: string;
  }> = []

  for (const round of rounds) {
    const qs = questionsByRound[round.roundId] ?? []
    const orderMode = (round['questionOrderMode'] as string) ?? (game['questionOrderMode'] as string) ?? 'EXACT'
    const normalQs = qs.filter(q => !q['isTiebreaker'])
    const ordered = orderMode === 'RANDOM'
      ? [...normalQs].sort(() => Math.random() - 0.5)
      : normalQs
    for (const q of ordered) {
      sequence.push({
        roundId:         round.roundId,
        roundNumber:     round['roundNumber'] as number,
        roundTitle:      round['title'] as string,
        questionId:      q['questionId'] as string,
        questionNumber:  q['questionNumber'] as number,
        gameType:        q['gameType'] as string,
        prompt:          q['prompt'] as string,
        choices:         q['choices'] as unknown[],
        correctChoiceKey: q['correctChoiceKey'] as string,
        durationSeconds: q['durationSeconds'] as number,
        isTiebreaker:    false,
        lyricExcerpt:    q['lyricExcerpt'] as string | undefined,
        songTitle:       q['songTitle'] as string | undefined,
        artist:          q['artist'] as string | undefined,
        imageStorageUrl: q['imageStorageUrl'] as string | undefined,
        category:        q['category'] as string | undefined,
        subcategory:     q['subcategory'] as string | undefined,
        difficulty:      q['difficulty'] as string | undefined,
      })
    }
  }

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
  const roomId  = roomRef.id
  const now     = Date.now()

  batch.set(roomRef, {
    roomId, roomCode, gameId,
    gameTitle:                game['title'],
    hostUid:                  token['uid'],
    phase:                    'LOBBY',
    currentQuestionInstanceId: null,
    currentSequenceIndex:     -1,
    questionSequence:         [],
    totalQuestions:           sequence.filter(q => !q.isTiebreaker).length,
    tiebreakerAvailable:      sequence.some(q => q.isTiebreaker),
    playerCount:              0,
    soundEnabled:             false,
    createdAt:                now,
    expiresAt:                null,
    roundCount:               rounds.length,
    questionOrderMode:        game['questionOrderMode'],
    incorrectPenaltyPoints:   game['incorrectPenaltyPoints'] ?? 0,
    defaultDurationSeconds:   game['defaultDurationSeconds'] ?? 15,
  })

  const questionSequenceIds: string[] = []
  for (let i = 0; i < sequence.length; i++) {
    const sq = sequence[i]
    const qRef = firestore.collection('rooms').doc(roomId).collection('questions').doc()
    const qId  = qRef.id
    questionSequenceIds.push(qId)
    batch.set(qRef, {
      questionInstanceId: qId, questionId: sq.questionId,
      roundId: sq.roundId, roundNumber: sq.roundNumber, roundTitle: sq.roundTitle,
      sequenceIndex: i, gameType: sq.gameType, prompt: sq.prompt,
      lyricExcerpt: sq.lyricExcerpt ?? null, songTitle: null, artist: null,
      imageStorageUrl: sq.imageStorageUrl ?? null, choices: sq.choices,
      category: sq.category ?? null, subcategory: sq.subcategory ?? null,
      difficulty: sq.difficulty ?? null, durationSeconds: sq.durationSeconds,
      isTiebreaker: sq.isTiebreaker, phase: 'PENDING',
    })
    const privRef = firestore.collection('rooms').doc(roomId).collection('privateQuestions').doc(qId)
    batch.set(privRef, {
      questionInstanceId: qId, correctChoiceKey: sq.correctChoiceKey,
      songTitle: sq.songTitle ?? null, artist: sq.artist ?? null, revealed: false,
    })
  }

  batch.update(roomRef, { questionSequence: questionSequenceIds })
  batch.set(firestore.collection('roomCodes').doc(roomCode), { roomId, createdAt: now })
  await batch.commit()

  return { roomId, roomCode }
}
