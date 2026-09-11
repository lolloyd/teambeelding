import { describe, it, expect } from 'vitest'
import { isValidTransition, canSubmitAnswer, isTimerRunning } from '@/utils/stateMachine'
import type { RoomPhase } from '@/types'

describe('isValidTransition', () => {
  it('allows LOBBY -> BETWEEN_QUESTIONS', () => {
    expect(isValidTransition('LOBBY', 'BETWEEN_QUESTIONS')).toBe(true)
  })
  it('disallows LOBBY -> QUESTION_OPEN', () => {
    expect(isValidTransition('LOBBY', 'QUESTION_OPEN')).toBe(false)
  })
  it('allows QUESTION_OPEN -> QUESTION_PAUSED', () => {
    expect(isValidTransition('QUESTION_OPEN', 'QUESTION_PAUSED')).toBe(true)
  })
  it('disallows COMPLETED -> anything', () => {
    const phases: RoomPhase[] = ['LOBBY', 'BETWEEN_QUESTIONS', 'QUESTION_OPEN', 'LEADERBOARD']
    phases.forEach(p => expect(isValidTransition('COMPLETED', p)).toBe(false))
  })
  it('allows LEADERBOARD -> COMPLETED', () => {
    expect(isValidTransition('LEADERBOARD', 'COMPLETED')).toBe(true)
  })
})

describe('canSubmitAnswer', () => {
  it('returns true only for QUESTION_OPEN', () => {
    expect(canSubmitAnswer('QUESTION_OPEN')).toBe(true)
    expect(canSubmitAnswer('QUESTION_PAUSED')).toBe(false)
    expect(canSubmitAnswer('LOBBY')).toBe(false)
  })
})

describe('isTimerRunning', () => {
  it('returns true only for QUESTION_OPEN', () => {
    expect(isTimerRunning('QUESTION_OPEN')).toBe(true)
    expect(isTimerRunning('QUESTION_PAUSED')).toBe(false)
  })
})
