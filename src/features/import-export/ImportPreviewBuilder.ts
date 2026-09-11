import type { ImportParseResult, ImportPreview, ImportPreviewGame } from '@/types'

/**
 * Build a structured preview from a parse result.
 * Only called after parsing — errors are forwarded from the parse result.
 */
export function buildImportPreview(parsed: ImportParseResult): ImportPreview {
  const { games, rounds, questions, choices, imageFilenames, errors } = parsed

  // Build choice map
  const choicesByQuestion = new Map<string, typeof choices>()
  for (const c of choices) {
    const arr = choicesByQuestion.get(c.question_key) ?? []
    arr.push(c)
    choicesByQuestion.set(c.question_key, arr)
  }

  // Build preview per game
  const previewGames: ImportPreviewGame[] = games.map(g => {
    const gameRounds = rounds.filter(r => r.game_key === g.game_key)
    const previewRounds = gameRounds.map(r => {
      const roundQuestions = questions.filter(q => q.round_key === r.round_key && q.active)
      return {
        roundKey:      r.round_key,
        roundNumber:   r.round_number,
        title:         r.title,
        gameType:      r.game_type,
        questionCount: roundQuestions.length,
        questions:     roundQuestions.map(q => ({
          questionKey:    q.question_key,
          questionNumber: q.question_number,
          gameType:       q.game_type,
          prompt:         q.prompt,
          imagePath:      q.image_path,
          isTiebreaker:   q.is_tiebreaker,
        })),
      }
    })
    const gameQuestions = questions.filter(
      q => rounds.some(r => r.round_key === q.round_key && r.game_key === g.game_key) && q.active
    )
    return {
      gameKey:       g.game_key,
      title:         g.title,
      description:   g.description,
      roundCount:    gameRounds.length,
      questionCount: gameQuestions.length,
      rounds:        previewRounds,
    }
  })

  const activeQuestions = questions.filter(q => q.active)
  const allGameTypes = [...new Set(activeQuestions.map(q => q.game_type))]
  const allCategories = [...new Set(activeQuestions.map(q => q.category).filter(Boolean))] as string[]
  const allDifficulties = [...new Set(activeQuestions.map(q => q.difficulty).filter(Boolean))] as string[]

  return {
    packageName:      parsed.manifest?.packageName ?? 'Unknown Package',
    gameCount:        games.length,
    roundCount:       rounds.length,
    questionCount:    activeQuestions.filter(q => !q.is_tiebreaker).length,
    tiebreakerCount:  activeQuestions.filter(q => q.is_tiebreaker).length,
    imageCount:       imageFilenames.length,
    gameTypes:        allGameTypes,
    categories:       allCategories,
    difficulties:     allDifficulties,
    games:            previewGames,
    errors,
  }
}
