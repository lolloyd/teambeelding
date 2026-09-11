import { describe, it, expect } from 'vitest'
import { escapeCsvField, buildCsv } from '@/utils/csvExport'

describe('escapeCsvField', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })
  it('wraps values containing commas in quotes', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"')
  })
  it('escapes double quotes inside quoted values', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })
  it('wraps values containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('buildCsv', () => {
  it('builds a BOM-prefixed CSV with headers and rows', () => {
    const csv = buildCsv(['name', 'score'], [{ name: 'Alice', score: 100 }])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('name,score')
    expect(csv).toContain('Alice,100')
  })

  it('generates correct column count per row', () => {
    const csv = buildCsv(['a', 'b', 'c'], [{ a: 1, b: 2, c: 3 }])
    const lines = csv.replace('\uFEFF', '').split('\r\n')
    expect(lines[0].split(',').length).toBe(3)
    expect(lines[1].split(',').length).toBe(3)
  })
})
