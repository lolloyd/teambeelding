import type { RoomPhase } from '@/types'

/**
 * Valid phase transitions for the room state machine.
 * Only these transitions are permitted; Cloud Functions enforce this server-side.
 */
const VALID_TRANSITIONS: Record<RoomPhase, RoomPhase[]> = {
  LOBBY:             ['BETWEEN_QUESTIONS'],
  BETWEEN_QUESTIONS: ['QUESTION_OPEN'],
  QUESTION_OPEN:     ['QUESTION_PAUSED', 'QUESTION_CLOSED'],
  QUESTION_PAUSED:   ['QUESTION_OPEN', 'QUESTION_CLOSED'],
  QUESTION_CLOSED:   ['ANSWER_REVEAL'],
  ANSWER_REVEAL:     ['LEADERBOARD'],
  LEADERBOARD:       ['BETWEEN_QUESTIONS', 'COMPLETED'],
  COMPLETED:         [],
}

export function isValidTransition(from: RoomPhase, to: RoomPhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function getValidNextPhases(current: RoomPhase): RoomPhase[] {
  return VALID_TRANSITIONS[current] ?? []
}

/**
 * Whether the game master can start the next question from the current phase.
 */
export function canStartNextQuestion(phase: RoomPhase): boolean {
  return phase === 'BETWEEN_QUESTIONS'
}

/**
 * Whether players can submit answers in the current phase.
 */
export function canSubmitAnswer(phase: RoomPhase): boolean {
  return phase === 'QUESTION_OPEN'
}

/**
 * Whether the timer is actively counting in the current phase.
 */
export function isTimerRunning(phase: RoomPhase): boolean {
  return phase === 'QUESTION_OPEN'
}
