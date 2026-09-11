#!/usr/bin/env node
/**
 * Generates philippines-gk-quiz-hard.zip — a harder 10-question TeamBeelding package
 * about Philippine history, geography, and culture.
 *
 * Usage:  node scripts/createPhilippinesGKQuizHard.cjs [output-dir]
 */
'use strict'

const XLSX  = require('xlsx')
const JSZip = require('jszip')
const fs    = require('fs')
const path  = require('path')

const outDir = process.argv[2] || '.'

// ── Manifest ──────────────────────────────────────────────────────────────────
const manifest = [{
  schema_version: 1,
  package_name:   'Philippines General Knowledge Quiz (Hard)',
  exported_at:    new Date().toISOString(),
  application:    'TeamBeelding',
}]

// ── Game ──────────────────────────────────────────────────────────────────────
const games = [{
  game_key:                   'philippines-gk-quiz-hard',
  title:                      'Philippines General Knowledge (Hard)',
  description:                'A tougher challenge — how well do you really know the Philippines?',
  estimated_duration_minutes: 15,
  question_order_mode:        'EXACT',
  default_duration_seconds:   20,
  incorrect_penalty_points:   0,
  published:                  'FALSE',
}]

// ── Round ─────────────────────────────────────────────────────────────────────
const rounds = [{
  game_key:            'philippines-gk-quiz-hard',
  round_key:           'ph-hard-round',
  round_number:        1,
  title:               'Philippines — Expert Level',
  description:         'Choose the correct answer.',
  game_type:           'NAME_THE_SONG',
  category:            'General Knowledge',
  subcategory:         'Philippines',
  difficulty:          'Hard',
  question_order_mode: 'EXACT',
}]

// ── Question + Choice data ────────────────────────────────────────────────────
// Each entry: [ question, answer, answer_context, [choice1, choice2, choice3], correctIndex (0-based) ]
const RAW = [
  [
    "What year was the current Philippine Constitution ratified?",
    "1987", "History",
    ["1935", "1973", "1987"], 2,
  ],
  [
    "What is the largest lake in the Philippines?",
    "Laguna de Bay", "Geography",
    ["Lake Taal", "Laguna de Bay", "Lake Lanao"], 1,
  ],
  [
    "The Philippines was named after which Spanish king?",
    "King Philip II", "History",
    ["King Philip II", "King Charles V", "King Ferdinand II"], 0,
  ],
  [
    "What is the second largest island in the Philippines by land area?",
    "Mindanao", "Geography",
    ["Samar", "Palawan", "Mindanao"], 2,
  ],
  [
    "The famous Chocolate Hills geological formation is located in which province?",
    "Bohol", "Geography",
    ["Cebu", "Bohol", "Leyte"], 1,
  ],
  [
    "How many rays does the sun on the Philippine flag have?",
    "8", "National Symbols",
    ["6", "8", "12"], 1,
  ],
  [
    "How many regions does the Philippines currently have?",
    "17", "Government",
    ["15", "17", "19"], 1,
  ],
  [
    "What is the name of the secret revolutionary society founded by Andrés Bonifacio in 1892?",
    "Katipunan", "History",
    ["La Liga Filipina", "Katipunan", "Ilustrismo"], 1,
  ],
  [
    "Which Filipino chieftain led the Battle of Mactan in 1521, defeating Ferdinand Magellan?",
    "Lapu-Lapu", "History",
    ["Rajah Humabon", "Lapu-Lapu", "Rajah Sulayman"], 1,
  ],
  [
    "What is the national tree of the Philippines?",
    "Narra", "National Symbols",
    ["Molave", "Narra", "Mahogany"], 1,
  ],
]

const questions = []
const choices   = []

RAW.forEach(([question, answer, context, opts, correctIdx], i) => {
  const n    = i + 1
  const qKey = `phqh-${n}`
  const cKey = `${qKey}-${String.fromCharCode(97 + correctIdx)}`

  questions.push({
    game_key:           'philippines-gk-quiz-hard',
    round_key:          'ph-hard-round',
    question_key:       qKey,
    question_number:    n,
    game_type:          'NAME_THE_SONG',
    prompt:             'Choose the correct answer.',
    lyric_excerpt:      question,
    song_title:         answer,
    artist:             context,
    image_path:         '',
    category:           'General Knowledge',
    subcategory:        'Philippines',
    difficulty:         'Hard',
    duration_seconds:   20,
    correct_choice_key: cKey,
    is_tiebreaker:      'FALSE',
    active:             'TRUE',
  })

  opts.forEach((text, j) => {
    choices.push({
      question_key: qKey,
      choice_key:   `${qKey}-${String.fromCharCode(97 + j)}`,
      choice_order: j + 1,
      choice_text:  text,
    })
  })
})

// ── Build workbook ────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new()

XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(manifest),  'Manifest')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(games),     'Games')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rounds),    'Rounds')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questions), 'Questions')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(choices),   'Choices')

const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

// ── Build ZIP ─────────────────────────────────────────────────────────────────
async function main() {
  const zip = new JSZip()
  zip.file('teambeelding-import.xlsx', xlsxBuf)

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const outPath = path.join(outDir, 'philippines-gk-quiz-hard.zip')
  fs.writeFileSync(outPath, content)
  console.log(`✅  Written: ${outPath}`)
  console.log(`    ${questions.length} questions, ${choices.length} choices, 0 images`)
}

main().catch(err => { console.error(err); process.exit(1) })
