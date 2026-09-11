/**
 * Scoring utilities — shared between frontend display and Cloud Functions.
 * The authoritative calculation always runs on the backend.
 */

const BASE_CORRECT_POINTS = 1000
const MAX_SPEED_BONUS = 200

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate the speed bonus based on remaining time.
 * @param remainingMs  How many ms were left when the player answered
 * @param durationMs   Total question duration in ms
 */
export function calculateSpeedBonus(remainingMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  const ratio = clamp(remainingMs / durationMs, 0, 1)
  return Math.floor(MAX_SPEED_BONUS * ratio)
}

/**
 * Calculate points awarded for an answer.
 * @param isCorrect             Whether the answer is correct
 * @param remainingMs           Remaining ms on timer when answered
 * @param durationMs            Total duration in ms
 * @param incorrectPenaltyPts   Points deducted for incorrect (default 0)
 */
export function calculateAwardedPoints(
  isCorrect: boolean,
  remainingMs: number,
  durationMs: number,
  incorrectPenaltyPts = 0
): number {
  if (isCorrect) {
    return BASE_CORRECT_POINTS + calculateSpeedBonus(remainingMs, durationMs)
  }
  if (incorrectPenaltyPts === 0) return 0
  return -Math.abs(incorrectPenaltyPts)
}

/**
 * Apply points to a total score, clamped at zero minimum.
 */
export function applyPoints(currentTotal: number, awarded: number): number {
  return Math.max(0, currentTotal + awarded)
}

/**
 * Build a competition-ranked leaderboard array from player scores.
 * Ties share the same rank: 1, 2, 2, 4 …
 */
export function buildLeaderboard(
  players: Array<{ playerUid: string; displayName: string; totalScore: number }>
): Array<{ rank: number; playerUid: string; displayName: string; totalScore: number }> {
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore)
  let rank = 1
  return sorted.map((p, i) => {
    if (i > 0 && sorted[i - 1].totalScore !== p.totalScore) {
      rank = i + 1
    }
    return { rank, ...p }
  })
}
