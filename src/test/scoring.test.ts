import { describe, it, expect } from 'vitest'
import { calculateSpeedBonus, calculateAwardedPoints, applyPoints, buildLeaderboard, clamp } from '@/utils/scoring'

describe('clamp', () => {
  it('returns value within range', () => expect(clamp(5, 0, 10)).toBe(5))
  it('clamps to min', () => expect(clamp(-5, 0, 10)).toBe(0))
  it('clamps to max', () => expect(clamp(15, 0, 10)).toBe(10))
})

describe('calculateSpeedBonus', () => {
  it('returns 200 at full remaining time', () => {
    expect(calculateSpeedBonus(15000, 15000)).toBe(200)
  })
  it('returns 0 at 0 remaining', () => {
    expect(calculateSpeedBonus(0, 15000)).toBe(0)
  })
  it('returns 100 at half remaining', () => {
    expect(calculateSpeedBonus(7500, 15000)).toBe(100)
  })
  it('returns 0 for zero duration', () => {
    expect(calculateSpeedBonus(5000, 0)).toBe(0)
  })
})

describe('calculateAwardedPoints', () => {
  it('correct answer = 1200 with full speed bonus', () => {
    expect(calculateAwardedPoints(true, 15000, 15000)).toBe(1200)
  })
  it('correct answer = 1000 with no speed', () => {
    expect(calculateAwardedPoints(true, 0, 15000)).toBe(1000)
  })
  it('incorrect answer = 0 with no penalty', () => {
    expect(calculateAwardedPoints(false, 5000, 15000, 0)).toBe(0)
  })
  it('incorrect answer deducts penalty', () => {
    expect(calculateAwardedPoints(false, 5000, 15000, 500)).toBe(-500)
  })
})

describe('applyPoints', () => {
  it('adds points to score', () => expect(applyPoints(1000, 200)).toBe(1200))
  it('clamps total at 0', () => expect(applyPoints(100, -500)).toBe(0))
  it('returns 0 for 0 + negative', () => expect(applyPoints(0, -200)).toBe(0))
})

describe('buildLeaderboard', () => {
  it('sorts by score descending', () => {
    const players = [
      { playerUid: 'b', displayName: 'Bob', totalScore: 800 },
      { playerUid: 'a', displayName: 'Alice', totalScore: 1200 },
      { playerUid: 'c', displayName: 'Carol', totalScore: 1200 },
    ]
    const result = buildLeaderboard(players)
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(1) // tie
    expect(result[2].rank).toBe(3) // competition ranking
  })

  it('handles single player', () => {
    const result = buildLeaderboard([{ playerUid: 'a', displayName: 'A', totalScore: 500 }])
    expect(result[0].rank).toBe(1)
    expect(result[0].totalScore).toBe(500)
  })
})
