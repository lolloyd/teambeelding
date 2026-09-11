import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import type {
  ImportParseResult,
  ImportManifest,
  ImportRow_Game,
  ImportRow_Round,
  ImportRow_Question,
  ImportRow_Choice,
  ImportValidationError,
} from '@/types'
import {
  ImportManifestSchema,
  ImportGameRowSchema,
  ImportRoundRowSchema,
  ImportQuestionRowSchema,
  ImportChoiceRowSchema,
} from '@/lib/schemas'
import { SCHEMA_VERSION } from '@/types'

// ── Limits ────────────────────────────────────────────────────────────────────
const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024   // 10 MB
const MAX_PACKAGE_BYTES  = 100 * 1024 * 1024  // 100 MB
const MAX_IMAGE_BYTES    =   5 * 1024 * 1024  // 5 MB
const MAX_QUESTIONS      = 500
const ALLOWED_IMAGE_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const REQUIRED_SHEETS    = ['Manifest', 'Games', 'Rounds', 'Questions', 'Choices']

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(
  sheet: string,
  code: string,
  message: string,
  row?: number,
  column?: string,
  isWarning = false
): ImportValidationError {
  return { sheet, row, column, errorCode: code, message, isWarning }
}

function coerceBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toUpperCase()
    if (v === 'TRUE' || v === '1' || v === 'YES') return true
    if (v === 'FALSE' || v === '0' || v === 'NO') return false
  }
  if (value === 1) return true
  if (value === 0) return false
  return null
}

function coerceNumber(value: unknown): number | null {
  const n = Number(value)
  return isNaN(n) ? null : n
}

function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    out[k.trim().toLowerCase()] = v
  }
  return out
}

function sheetToRows(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: undefined, raw: true })
  return raw.map(normalizeRow)
}

function getColHeaders(ws: XLSX.WorkSheet): string[] {
  const ref = ws['!ref']
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const headers: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]
    if (cell && cell.v) headers.push(String(cell.v).trim().toLowerCase())
  }
  return headers
}

function isSafePath(p: string): boolean {
  // Reject path traversal and absolute paths
  if (!p) return false
  const normalized = p.replace(/\\/g, '/')
  if (normalized.includes('../')) return false
  if (normalized.startsWith('/')) return false
  if (/[<>:"|?*\x00-\x1f]/.test(normalized)) return false
  return true
}

function getImageExt(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i).toLowerCase() : ''
}

// ── Main parser ───────────────────────────────────────────────────────────────

export async function parseImportPackage(
  packageFile: File | null,
  xlsxFile: File | null,
  imageZipFile: File | null
): Promise<ImportParseResult> {
  const errors: ImportValidationError[] = []
  let workbookBytes: ArrayBuffer | null = null
  let imageFilenames: string[] = []
  const imageSizes: Map<string, number> = new Map()

  // ── 1. Load sources ────────────────────────────────────────────────────────
  if (packageFile) {
    if (packageFile.size > MAX_PACKAGE_BYTES) {
      errors.push(err('Package', 'PKG_TOO_LARGE', `Package exceeds ${MAX_PACKAGE_BYTES / 1024 / 1024} MB limit.`))
      return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
    }
    try {
      const zip = await JSZip.loadAsync(await packageFile.arrayBuffer())
      // Find xlsx in root
      const xlsxEntry = Object.values(zip.files).find(
        f => !f.dir && f.name.endsWith('teambeelding-import.xlsx')
      )
      if (!xlsxEntry) {
        errors.push(err('Package', 'MISSING_XLSX', 'teambeelding-import.xlsx not found in package root.'))
        return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
      }
      workbookBytes = await xlsxEntry.async('arraybuffer')
      // Collect images
      for (const [name, entry] of Object.entries(zip.files)) {
        if (!entry.dir && name.startsWith('images/')) {
          const filename = name.slice('images/'.length)
          const ext = getImageExt(filename)
          if (ALLOWED_IMAGE_EXT.has(ext)) {
            const data = await entry.async('arraybuffer')
            if (data.byteLength > MAX_IMAGE_BYTES) {
              errors.push(err('Images', 'IMAGE_TOO_LARGE', `Image "${filename}" exceeds 5 MB.`, undefined, undefined, false))
            } else {
              imageSizes.set(filename, data.byteLength)
              imageFilenames.push(filename)
            }
          }
        }
      }
    } catch {
      errors.push(err('Package', 'ZIP_READ_ERROR', 'Could not read the ZIP package. The file may be corrupt.'))
      return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
    }
  } else {
    // Separate files mode
    if (!xlsxFile) {
      errors.push(err('Workbook', 'MISSING_XLSX', 'No Excel workbook provided.'))
      return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
    }
    if (xlsxFile.size > MAX_WORKBOOK_BYTES) {
      errors.push(err('Workbook', 'XLSX_TOO_LARGE', `Workbook exceeds ${MAX_WORKBOOK_BYTES / 1024 / 1024} MB limit.`))
      return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
    }
    workbookBytes = await xlsxFile.arrayBuffer()

    if (imageZipFile) {
      if (imageZipFile.size > MAX_PACKAGE_BYTES) {
        errors.push(err('Images', 'IMG_ZIP_TOO_LARGE', `Image ZIP exceeds ${MAX_PACKAGE_BYTES / 1024 / 1024} MB limit.`))
      } else {
        try {
          const zip = await JSZip.loadAsync(await imageZipFile.arrayBuffer())
          for (const [name, entry] of Object.entries(zip.files)) {
            if (!entry.dir) {
              const filename = name.startsWith('images/') ? name.slice('images/'.length) : name
              const ext = getImageExt(filename)
              if (ALLOWED_IMAGE_EXT.has(ext)) {
                const data = await entry.async('arraybuffer')
                if (data.byteLength > MAX_IMAGE_BYTES) {
                  errors.push(err('Images', 'IMAGE_TOO_LARGE', `Image "${filename}" exceeds 5 MB.`))
                } else {
                  imageSizes.set(filename, data.byteLength)
                  imageFilenames.push(filename)
                }
              }
            }
          }
        } catch {
          errors.push(err('Images', 'IMG_ZIP_READ_ERROR', 'Could not read the image ZIP file.'))
        }
      }
    }
  }

  if (!workbookBytes) {
    errors.push(err('Workbook', 'NO_WORKBOOK', 'No workbook data found.'))
    return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
  }

  // ── 2. Parse workbook ──────────────────────────────────────────────────────
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(workbookBytes, { type: 'array', cellDates: false })
  } catch {
    errors.push(err('Workbook', 'XLSX_PARSE_ERROR', 'Could not parse the Excel file. Ensure it is a valid .xlsx file.'))
    return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames: [], errors }
  }

  // ── 3. Check required sheets ───────────────────────────────────────────────
  for (const sheet of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(sheet)) {
      errors.push(err(sheet, 'MISSING_SHEET', `Required sheet "${sheet}" not found in workbook.`))
    }
  }
  if (errors.length > 0) {
    return { manifest: null, games: [], rounds: [], questions: [], choices: [], imageFilenames, errors }
  }

  // ── 4. Parse Manifest ──────────────────────────────────────────────────────
  let manifest: ImportManifest | null = null
  const manifestRows = sheetToRows(wb.Sheets['Manifest'])
  if (manifestRows.length === 0) {
    errors.push(err('Manifest', 'EMPTY_MANIFEST', 'Manifest sheet is empty.'))
  } else {
    const rawManifest = manifestRows[0]
    const parsed = ImportManifestSchema.safeParse({
      schemaVersion: coerceNumber(rawManifest['schema_version']),
      packageName:   rawManifest['package_name'],
      exportedAt:    rawManifest['exported_at'],
      application:   rawManifest['application'],
    })
    if (!parsed.success) {
      errors.push(err('Manifest', 'INVALID_MANIFEST', `Manifest validation failed: ${parsed.error.issues[0]?.message ?? 'unknown'}`))
    } else {
      if (parsed.data.schemaVersion !== SCHEMA_VERSION) {
        errors.push(err('Manifest', 'UNSUPPORTED_SCHEMA', `Schema version ${parsed.data.schemaVersion} is not supported. Expected ${SCHEMA_VERSION}.`))
      }
      manifest = parsed.data
    }
  }

  if (errors.some(e => !e.isWarning)) {
    return { manifest, games: [], rounds: [], questions: [], choices: [], imageFilenames, errors }
  }

  // ── 5. Parse Games ─────────────────────────────────────────────────────────
  const games: ImportRow_Game[] = []
  const gameRows = sheetToRows(wb.Sheets['Games'])
  const gameKeys = new Set<string>()

  for (let i = 0; i < gameRows.length; i++) {
    const r = gameRows[i]
    const rowNum = i + 2 // 1-indexed + header
    const raw = {
      game_key:                   r['game_key'],
      title:                      r['title'],
      description:                r['description'],
      estimated_duration_minutes: coerceNumber(r['estimated_duration_minutes']),
      question_order_mode:        r['question_order_mode'],
      default_duration_seconds:   coerceNumber(r['default_duration_seconds']) ?? 15,
      incorrect_penalty_points:   coerceNumber(r['incorrect_penalty_points']) ?? 0,
      published:                  coerceBool(r['published']) ?? false,
    }
    const result = ImportGameRowSchema.safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(err('Games', 'GAME_VALIDATION', issue.message, rowNum, issue.path[0]?.toString()))
      }
      continue
    }
    const g = result.data as ImportRow_Game
    if (gameKeys.has(g.game_key)) {
      errors.push(err('Games', 'DUPLICATE_GAME_KEY', `Duplicate game_key "${g.game_key}".`, rowNum, 'game_key'))
      continue
    }
    gameKeys.add(g.game_key)
    games.push(g)
  }

  // ── 6. Parse Rounds ────────────────────────────────────────────────────────
  const rounds: ImportRow_Round[] = []
  const roundKeys = new Set<string>()

  for (let i = 0; i < sheetToRows(wb.Sheets['Rounds']).length; i++) {
    const r = sheetToRows(wb.Sheets['Rounds'])[i]
    const rowNum = i + 2
    const raw = {
      game_key:            r['game_key'],
      round_key:           r['round_key'],
      round_number:        coerceNumber(r['round_number']),
      title:               r['title'],
      description:         r['description'],
      game_type:           r['game_type'],
      category:            r['category'],
      subcategory:         r['subcategory'],
      difficulty:          r['difficulty'],
      question_order_mode: r['question_order_mode'],
    }
    const result = ImportRoundRowSchema.safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(err('Rounds', 'ROUND_VALIDATION', issue.message, rowNum, issue.path[0]?.toString()))
      }
      continue
    }
    const round = result.data as ImportRow_Round
    if (!gameKeys.has(round.game_key)) {
      errors.push(err('Rounds', 'ORPHAN_ROUND', `Round "${round.round_key}" references unknown game_key "${round.game_key}".`, rowNum, 'game_key'))
      continue
    }
    if (roundKeys.has(round.round_key)) {
      errors.push(err('Rounds', 'DUPLICATE_ROUND_KEY', `Duplicate round_key "${round.round_key}".`, rowNum, 'round_key'))
      continue
    }
    roundKeys.add(round.round_key)
    rounds.push(round)
  }

  // ── 7. Parse Questions & Choices ──────────────────────────────────────────
  const questions: ImportRow_Question[] = []
  const questionKeys = new Set<string>()
  const questionRows = sheetToRows(wb.Sheets['Questions'])

  if (questionRows.filter(r => r['active'] !== false).length > MAX_QUESTIONS) {
    errors.push(err('Questions', 'TOO_MANY_QUESTIONS', `Package contains more than ${MAX_QUESTIONS} active questions.`))
  }

  for (let i = 0; i < questionRows.length; i++) {
    const r = questionRows[i]
    const rowNum = i + 2
    const raw = {
      game_key:          r['game_key'],
      round_key:         r['round_key'],
      question_key:      r['question_key'],
      question_number:   coerceNumber(r['question_number']),
      game_type:         r['game_type'],
      prompt:            r['prompt'],
      lyric_excerpt:     r['lyric_excerpt'],
      song_title:        r['song_title'],
      artist:            r['artist'],
      image_path:        r['image_path'],
      category:          r['category'],
      subcategory:       r['subcategory'],
      difficulty:        r['difficulty'],
      duration_seconds:  coerceNumber(r['duration_seconds']) ?? 15,
      correct_choice_key: r['correct_choice_key'],
      is_tiebreaker:     coerceBool(r['is_tiebreaker']) ?? false,
      active:            coerceBool(r['active']) ?? true,
    }
    const result = ImportQuestionRowSchema.safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(err('Questions', 'QUESTION_VALIDATION', issue.message, rowNum, issue.path[0]?.toString()))
      }
      continue
    }
    const q = result.data as ImportRow_Question
    if (!roundKeys.has(q.round_key)) {
      errors.push(err('Questions', 'ORPHAN_QUESTION', `Question "${q.question_key}" references unknown round_key "${q.round_key}".`, rowNum, 'round_key'))
      continue
    }
    if (questionKeys.has(q.question_key)) {
      errors.push(err('Questions', 'DUPLICATE_QUESTION_KEY', `Duplicate question_key "${q.question_key}".`, rowNum, 'question_key'))
      continue
    }
    // Game-type specific validation
    if (q.game_type === 'NAME_THE_SONG') {
      if (!q.lyric_excerpt) errors.push(err('Questions', 'MISSING_LYRIC', `NAME_THE_SONG question "${q.question_key}" requires lyric_excerpt.`, rowNum, 'lyric_excerpt'))
      if (!q.song_title)    errors.push(err('Questions', 'MISSING_SONG_TITLE', `NAME_THE_SONG question "${q.question_key}" requires song_title.`, rowNum, 'song_title'))
      if (!q.artist)        errors.push(err('Questions', 'MISSING_ARTIST', `NAME_THE_SONG question "${q.question_key}" requires artist.`, rowNum, 'artist'))
    }
    if (q.game_type === 'GUESS_THE_PICTURE') {
      if (!q.image_path) {
        errors.push(err('Questions', 'MISSING_IMAGE_PATH', `GUESS_THE_PICTURE question "${q.question_key}" requires image_path.`, rowNum, 'image_path'))
      } else {
        if (!isSafePath(q.image_path)) {
          errors.push(err('Questions', 'UNSAFE_IMAGE_PATH', `image_path "${q.image_path}" is invalid or contains path traversal.`, rowNum, 'image_path'))
        } else if (!imageSizes.has(q.image_path)) {
          errors.push(err('Questions', 'MISSING_IMAGE_FILE', `Image file "${q.image_path}" referenced by question "${q.question_key}" was not found in the ZIP.`, rowNum, 'image_path'))
        }
      }
    }
    questionKeys.add(q.question_key)
    questions.push(q)
  }

  // ── 8. Parse Choices ──────────────────────────────────────────────────────
  const choices: ImportRow_Choice[] = []
  const choicesByQuestion = new Map<string, ImportRow_Choice[]>()
  const choiceRows = sheetToRows(wb.Sheets['Choices'])

  for (let i = 0; i < choiceRows.length; i++) {
    const r = choiceRows[i]
    const rowNum = i + 2
    const raw = {
      question_key: r['question_key'],
      choice_key:   r['choice_key'],
      choice_order: coerceNumber(r['choice_order']),
      choice_text:  r['choice_text'],
    }
    const result = ImportChoiceRowSchema.safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(err('Choices', 'CHOICE_VALIDATION', issue.message, rowNum, issue.path[0]?.toString()))
      }
      continue
    }
    const c = result.data as ImportRow_Choice
    if (!questionKeys.has(c.question_key)) {
      errors.push(err('Choices', 'ORPHAN_CHOICE', `Choice "${c.choice_key}" references unknown question_key "${c.question_key}".`, rowNum, 'question_key'))
      continue
    }
    const existing = choicesByQuestion.get(c.question_key) ?? []
    // Duplicate choice_key within question
    if (existing.some(e => e.choice_key === c.choice_key)) {
      errors.push(err('Choices', 'DUPLICATE_CHOICE_KEY', `Duplicate choice_key "${c.choice_key}" in question "${c.question_key}".`, rowNum, 'choice_key'))
      continue
    }
    existing.push(c)
    choicesByQuestion.set(c.question_key, existing)
    choices.push(c)
  }

  // ── 9. Cross-validate questions vs choices ─────────────────────────────────
  for (const q of questions) {
    const qChoices = choicesByQuestion.get(q.question_key) ?? []
    if (qChoices.length !== 3) {
      errors.push(err('Choices', 'WRONG_CHOICE_COUNT', `Question "${q.question_key}" has ${qChoices.length} choice(s); exactly 3 required.`))
    }
    const orders = qChoices.map(c => c.choice_order).sort()
    if (JSON.stringify(orders) !== '[1,2,3]') {
      errors.push(err('Choices', 'WRONG_CHOICE_ORDERS', `Question "${q.question_key}" choice orders must be exactly 1, 2, 3.`))
    }
    if (!qChoices.some(c => c.choice_key === q.correct_choice_key)) {
      errors.push(err('Questions', 'INVALID_CORRECT_CHOICE', `Correct choice "${q.correct_choice_key}" not found among choices for question "${q.question_key}".`, undefined, 'correct_choice_key'))
    }
  }

  // ── 10. Warn about unused images ───────────────────────────────────────────
  const usedImagePaths = new Set(questions.filter(q => q.image_path).map(q => q.image_path!))
  for (const img of imageFilenames) {
    if (!usedImagePaths.has(img)) {
      errors.push(err('Images', 'UNUSED_IMAGE', `Image "${img}" is not referenced by any question.`, undefined, undefined, true))
    }
  }

  return { manifest, games, rounds, questions, choices, imageFilenames, errors }
}

// ── Re-export helper used by ImportPreviewBuilder ─────────────────────────────
export { sheetToRows, getColHeaders }
