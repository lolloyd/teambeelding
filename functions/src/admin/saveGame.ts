import { type CallableRequest } from 'firebase-functions/v2/https'
import { requireAdmin, db, validatePayload } from '../shared/helpers'
import { z } from 'zod'

const ChoiceSchema = z.object({
  choiceKey:   z.string().min(1),
  choiceOrder: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  choiceText:  z.string().min(1).max(300),
})

const QuestionSchema = z.object({
  questionKey:       z.string().min(1),
  questionNumber:    z.number().int().positive(),
  gameType:          z.enum(['NAME_THE_SONG', 'GUESS_THE_PICTURE']),
  prompt:            z.string().min(1).max(500),
  lyricExcerpt:      z.string().max(500).nullable(),
  songTitle:         z.string().max(200).nullable(),
  artist:            z.string().max(200).nullable(),
  imagePath:         z.string().max(500).nullable(),
  imageStorageUrl:   z.string().max(1000).nullable(),
  category:          z.string().max(100).nullable(),
  subcategory:       z.string().max(100).nullable(),
  difficulty:        z.string().max(50).nullable(),
  durationSeconds:   z.number().int().min(5).max(120),
  correctChoiceKey:  z.string().min(1),
  isTiebreaker:      z.boolean(),
  active:            z.boolean(),
  choices:           z.array(ChoiceSchema).length(3),
})

const RoundSchema = z.object({
  roundKey:          z.string().min(1),
  roundNumber:       z.number().int().positive(),
  title:             z.string().min(1).max(200),
  description:       z.string().max(500).nullable(),
  gameType:          z.enum(['NAME_THE_SONG', 'GUESS_THE_PICTURE']),
  category:          z.string().max(100).nullable(),
  subcategory:       z.string().max(100).nullable(),
  difficulty:        z.string().max(50).nullable(),
  questionOrderMode: z.enum(['EXACT', 'RANDOM']),
  questions:         z.array(QuestionSchema),
})

const SaveGameSchema = z.object({
  gameId:                    z.string().min(1).nullable(),
  gameKey:                   z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  title:                     z.string().min(1).max(200),
  description:               z.string().max(500).nullable(),
  estimatedDurationMinutes:  z.number().positive().nullable(),
  questionOrderMode:         z.enum(['EXACT', 'RANDOM']),
  defaultDurationSeconds:    z.number().int().min(5).max(120),
  incorrectPenaltyPoints:    z.number().min(0),
  rounds:                    z.array(RoundSchema).min(1),
})

export async function saveGameFn(request: CallableRequest): Promise<{ gameId: string }> {
  requireAdmin(request)
  const payload = validatePayload(SaveGameSchema, request.data)
  const firestore = db()
  const now = Date.now()

  const isNew = !payload.gameId
  const gameRef = isNew
    ? firestore.collection('games').doc()
    : firestore.collection('games').doc(payload.gameId!)
  const gameId = gameRef.id

  // For updates: delete existing rounds and their subcollections first
  if (!isNew) {
    const existingRounds = await gameRef.collection('rounds').get()
    if (!existingRounds.empty) {
      const deleteBatch = firestore.batch()
      for (const roundDoc of existingRounds.docs) {
        const [qs, keys] = await Promise.all([
          roundDoc.ref.collection('questions').get(),
          roundDoc.ref.collection('answerKeys').get(),
        ])
        qs.docs.forEach(d => deleteBatch.delete(d.ref))
        keys.docs.forEach(d => deleteBatch.delete(d.ref))
        deleteBatch.delete(roundDoc.ref)
      }
      await deleteBatch.commit()
    }
  }

  // Preserve published status and createdAt on updates
  let createdAt = now
  let published = false
  if (!isNew) {
    const snap = await gameRef.get()
    if (snap.exists) {
      createdAt = (snap.data()?.createdAt as number) ?? now
      published = (snap.data()?.published as boolean) ?? false
    }
  }

  const allQuestions = payload.rounds.flatMap(r => r.questions)
  const activeQs     = allQuestions.filter(q => q.active)
  const gameTypes    = [...new Set(activeQs.map(q => q.gameType))]
  const categories   = [...new Set(activeQs.map(q => q.category).filter((c): c is string => !!c))]
  const difficulties = [...new Set(activeQs.map(q => q.difficulty).filter((d): d is string => !!d))]

  const batch = firestore.batch()

  batch.set(gameRef, {
    gameKey:                  payload.gameKey,
    title:                    payload.title,
    description:              payload.description ?? null,
    estimatedDurationMinutes: payload.estimatedDurationMinutes ?? null,
    questionOrderMode:        payload.questionOrderMode,
    defaultDurationSeconds:   payload.defaultDurationSeconds,
    incorrectPenaltyPoints:   payload.incorrectPenaltyPoints,
    published,
    createdAt,
    updatedAt:                now,
    roundCount:               payload.rounds.length,
    questionCount:            activeQs.filter(q => !q.isTiebreaker).length,
    tiebreakerCount:          activeQs.filter(q => q.isTiebreaker).length,
    gameTypes,
    categories,
    difficulties,
  })

  for (const round of payload.rounds) {
    const roundRef = gameRef.collection('rounds').doc()
    batch.set(roundRef, {
      roundKey:          round.roundKey,
      roundNumber:       round.roundNumber,
      title:             round.title,
      description:       round.description ?? null,
      gameType:          round.gameType,
      category:          round.category ?? null,
      subcategory:       round.subcategory ?? null,
      difficulty:        round.difficulty ?? null,
      questionOrderMode: round.questionOrderMode,
    })

    for (const q of round.questions) {
      const qRef = roundRef.collection('questions').doc()
      batch.set(qRef, {
        questionKey:      q.questionKey,
        questionNumber:   q.questionNumber,
        gameType:         q.gameType,
        prompt:           q.prompt,
        lyricExcerpt:     q.lyricExcerpt ?? null,
        songTitle:        q.songTitle ?? null,
        artist:           q.artist ?? null,
        imagePath:        q.imagePath ?? null,
        imageStorageUrl:  q.imageStorageUrl ?? null,
        choices:          q.choices,
        correctChoiceKey: q.correctChoiceKey,
        category:         q.category ?? null,
        subcategory:      q.subcategory ?? null,
        difficulty:       q.difficulty ?? null,
        durationSeconds:  q.durationSeconds,
        isTiebreaker:     q.isTiebreaker,
        active:           q.active,
      })
      batch.set(roundRef.collection('answerKeys').doc(qRef.id), {
        questionId:       qRef.id,
        correctChoiceKey: q.correctChoiceKey,
      })
    }
  }

  await batch.commit()
  return { gameId }
}
