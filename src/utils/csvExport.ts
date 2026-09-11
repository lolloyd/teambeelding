import type { Player, PrivateResult } from '@/types'

export interface CsvRow {
  rank: number
  player_name: string
  total_score: number
  correct_answers: number
  incorrect_answers: number
  unanswered_questions: number
  average_response_time_ms: number
  joined_at: string
  late_joiner: boolean
  [key: string]: string | number | boolean
}

/**
 * Escape a CSV field value.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
export function escapeCsvField(value: string | number | boolean): string {
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Build a CSV string from an array of rows and a header list.
 * Includes a UTF-8 BOM for Excel compatibility.
 */
export function buildCsv(headers: string[], rows: Array<Record<string, string | number | boolean>>): string {
  const BOM = '\uFEFF'
  const headerLine = headers.map(escapeCsvField).join(',')
  const dataLines = rows.map(row =>
    headers.map(h => escapeCsvField(row[h] ?? '')).join(',')
  )
  return BOM + [headerLine, ...dataLines].join('\r\n')
}

/**
 * Build a results CSV from the game summary data.
 */
export function buildResultsCsv(
  players: Player[],
  results: PrivateResult[],
  roundIds: string[]
): string {
  // Group results by playerUid for quick lookup
  const resultsByPlayer: Record<string, PrivateResult[]> = {}
  for (const r of results) {
    if (!resultsByPlayer[r.playerUid]) resultsByPlayer[r.playerUid] = []
    resultsByPlayer[r.playerUid].push(r)
  }

  // Build round score lookup: playerUid -> roundId -> score
  const roundScores: Record<string, Record<string, number>> = {}
  for (const p of players) {
    roundScores[p.playerUid] = p.roundScores
  }

  // Build leaderboard-ordered players
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore)
  let rank = 1
  const rows: Array<Record<string, string | number | boolean>> = sorted.map((p, i) => {
    if (i > 0 && sorted[i - 1].totalScore !== p.totalScore) rank = i + 1
    const row: Record<string, string | number | boolean> = {
      rank,
      player_name: p.displayName,
      total_score: p.totalScore,
      correct_answers: p.correctCount,
      incorrect_answers: p.incorrectCount,
      unanswered_questions: p.answeredCount - p.correctCount - p.incorrectCount,
      average_response_time_ms: Math.round(p.avgResponseTimeMs),
      joined_at: new Date(p.joinedAt).toISOString(),
      late_joiner: p.lateJoiner,
    }
    roundIds.forEach((rid, idx) => {
      row[`round_${idx + 1}_score`] = roundScores[p.playerUid]?.[rid] ?? 0
    })
    return row
  })

  const staticHeaders = [
    'rank',
    'player_name',
    'total_score',
    'correct_answers',
    'incorrect_answers',
    'unanswered_questions',
    'average_response_time_ms',
    'joined_at',
    'late_joiner',
  ]
  const roundHeaders = roundIds.map((_, i) => `round_${i + 1}_score`)

  return buildCsv([...staticHeaders, ...roundHeaders], rows)
}

/**
 * Trigger a browser download for a string blob.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
