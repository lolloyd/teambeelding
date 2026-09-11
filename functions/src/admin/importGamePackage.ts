import { type CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { requireAdmin, db } from '../shared/helpers'
import { z } from 'zod'

const schema = z.object({
  importId:       z.string().min(1),
  adminUid:       z.string().min(1),
  manifest:       z.object({ packageName: z.string(), schemaVersion: z.number() }).nullable(),
  games:          z.array(z.record(z.unknown())),
  rounds:         z.array(z.record(z.unknown())),
  questions:      z.array(z.record(z.unknown())),
  choices:        z.array(z.record(z.unknown())),
  imageFilenames: z.array(z.string()),
})

export async function importGamePackageFn(request: CallableRequest): Promise<{ importedGameIds: string[] }> {
  requireAdmin(request)
  const payload = schema.parse(request.data)
  const firestore = db()
  const now = Date.now()
  const importedGameIds: string[] = []

  // Build lookup maps
  const choicesByQuestion = new Map<string, typeof payload.choices>()
  for (const c of payload.choices) {
    const qk = c['question_key'] as string
    const arr = choicesByQuestion.get(qk) ?? []
    arr.push(c)
    choicesByQuestion.set(qk, arr)
  }

  const roundsByGame = new Map<string, typeof payload.rounds>()
  for (const r of payload.rounds) {
    const gk = r['game_key'] as string
    const arr = roundsByGame.get(gk) ?? []
    arr.push(r)
    roundsByGame.set(gk, arr)
  }

  const questionsByRound = new Map<string, typeof payload.questions>()
  for (const q of payload.questions) {
    const rk = q['round_key'] as string
    const arr = questionsByRound.get(rk) ?? []
    arr.push(q)
    questionsByRound.set(rk, arr)
  }

  const batch = firestore.batch()
  // Track questions with images so we can copy files and update URLs after the batch commits
  const imagesToProcess: Array<{
    questionRef: FirebaseFirestore.DocumentReference
    srcPath: string
    gameId: string
    filename: string
  }> = []

  for (const game of payload.games) {
    const gameRef = firestore.collection('games').doc()
    const gameId  = gameRef.id
    importedGameIds.push(gameId)

    // Compute denormalized counts
    const gameRounds = roundsByGame.get(game['game_key'] as string) ?? []
    const allGameQuestions = gameRounds.flatMap(r => questionsByRound.get(r['round_key'] as string) ?? [])
    const activeQs = allGameQuestions.filter(q => q['active'] !== false)
    const gameTypes = [...new Set(activeQs.map(q => q['game_type'] as string))]
    const categories = [...new Set(activeQs.map(q => q['category'] as string | undefined).filter(Boolean))] as string[]
    const difficulties = [...new Set(activeQs.map(q => q['difficulty'] as string | undefined).filter(Boolean))] as string[]

    batch.set(gameRef, {
      gameKey:                 game['game_key'],
      title:                   game['title'],
      description:             game['description'] ?? null,
      estimatedDurationMinutes: game['estimated_duration_minutes'] ?? null,
      questionOrderMode:       game['question_order_mode'],
      defaultDurationSeconds:  game['default_duration_seconds'],
      incorrectPenaltyPoints:  game['incorrect_penalty_points'],
      published:               false, // always import as draft
      createdAt:               now,
      updatedAt:               now,
      roundCount:              gameRounds.length,
      questionCount:           activeQs.filter(q => !q['is_tiebreaker']).length,
      tiebreakerCount:         activeQs.filter(q => q['is_tiebreaker']).length,
      gameTypes,
      categories,
      difficulties,
    })

    // Rounds
    for (const round of gameRounds) {
      const roundRef = gameRef.collection('rounds').doc()
      const roundQs  = questionsByRound.get(round['round_key'] as string) ?? []

      batch.set(roundRef, {
        roundKey:          round['round_key'],
        roundNumber:       round['round_number'],
        title:             round['title'],
        description:       round['description'] ?? null,
        gameType:          round['game_type'],
        category:          round['category'] ?? null,
        subcategory:       round['subcategory'] ?? null,
        difficulty:        round['difficulty'] ?? null,
        questionOrderMode: round['question_order_mode'],
      })

      // Questions
      for (const q of roundQs) {
        const qRef = roundRef.collection('questions').doc()
        const choices = (choicesByQuestion.get(q['question_key'] as string) ?? [])
          .sort((a, b) => (a['choice_order'] as number) - (b['choice_order'] as number))
          .map(c => ({ choiceKey: c['choice_key'], choiceOrder: c['choice_order'], choiceText: c['choice_text'] }))

        // Move image from staging to game-assets (done after batch commit)
        let imageStorageUrl: string | null = null
        if (q['image_path']) {
          const filename = q['image_path'] as string
          const srcPath  = `import-staging/${payload.adminUid}/${payload.importId}/${filename}`
          imagesToProcess.push({ questionRef: qRef, srcPath, gameId, filename })
          // Placeholder — will be updated after files are copied
        }

        batch.set(qRef, {
          questionKey:      q['question_key'],
          questionNumber:   q['question_number'],
          gameType:         q['game_type'],
          prompt:           q['prompt'],
          lyricExcerpt:     q['lyric_excerpt'] ?? null,
          songTitle:        q['song_title'] ?? null,
          artist:           q['artist'] ?? null,
          imagePath:        q['image_path'] ?? null,
          imageStorageUrl,  // updated after Storage copy
          choices,
          correctChoiceKey: q['correct_choice_key'],
          category:         q['category'] ?? null,
          subcategory:      q['subcategory'] ?? null,
          difficulty:       q['difficulty'] ?? null,
          durationSeconds:  q['duration_seconds'],
          isTiebreaker:     q['is_tiebreaker'],
          active:           q['active'] !== false,
        })

        // Answer key (separate doc)
        const answerRef = roundRef.collection('answerKeys').doc(qRef.id)
        batch.set(answerRef, {
          questionId:       qRef.id,
          correctChoiceKey: q['correct_choice_key'],
        })
      }
    }
  }

  await batch.commit()

  // Copy images from staging to game-assets and update Firestore with download URLs
  if (imagesToProcess.length > 0) {
    const bucket = admin.storage().bucket()
    await Promise.all(imagesToProcess.map(async ({ questionRef, srcPath, gameId, filename }) => {
      try {
        const destPath = `game-assets/${gameId}/${filename}`
        const srcFile  = bucket.file(srcPath)
        const destFile = bucket.file(destPath)
        await srcFile.copy(destFile)
        // Generate a Firebase Storage download URL with a random token
        const token = crypto.randomUUID()
        await destFile.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } })
        const encodedPath = encodeURIComponent(destPath)
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`
        await questionRef.update({ imageStorageUrl: downloadUrl })
      } catch (err) {
        // Non-fatal: log and continue — question is usable without the image
        console.error(`Failed to copy image for question ${questionRef.id}:`, err)
      }
    }))
  }

  return { importedGameIds }
}
