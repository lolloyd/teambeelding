#!/usr/bin/env node
/**
 * Generates philippines-gk-quiz.zip — a ready-to-import TeamBeelding package
 * containing 10 general knowledge questions about the Philippines.
 *
 * Usage:  node scripts/createPhilippinesGKQuiz.cjs [output-dir]
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
  package_name:   'Philippines General Knowledge Quiz',
  exported_at:    new Date().toISOString(),
  application:    'TeamBeelding',
}]

// ── Game ──────────────────────────────────────────────────────────────────────
const games = [{
  game_key:                   'philippines-gk-quiz',
  title:                      'Philippines General Knowledge',
  description:                'How well do you know the Philippines? Find out!',
  estimated_duration_minutes: 15,
  question_order_mode:        'EXACT',
  default_duration_seconds:   20,
  incorrect_penalty_points:   0,
  published:                  'FALSE',
}]

// ── Round ─────────────────────────────────────────────────────────────────────
const rounds = [{
  game_key:            'philippines-gk-quiz',
  round_key:           'ph-round',
  round_number:        1,
  title:               'Philippines General Knowledge',
  description:         'Choose the correct answer.',
  game_type:           'NAME_THE_SONG',
  category:            'General Knowledge',
  subcategory:         'Philippines',
  difficulty:          'Mixed',
  question_order_mode: 'EXACT',
}]

// ── Question + Choice data ────────────────────────────────────────────────────
// Each entry: [ question, answer, answer_context, [choice1, choice2, choice3], correctIndex (0-based) ]
const RAW = [
  [
    "What is the capital city of the Philippines?",
    "Manila", "Geography",
    ["Cebu City", "Manila", "Quezon City"], 1,
  ],
  [
    "Approximately how many islands make up the Philippines?",
    "More than 7,000", "Geography",
    ["Around 3,000", "Around 5,000", "More than 7,000"], 2,
  ],
  [
    "What is the national bird of the Philippines?",
    "Philippine Eagle", "National Symbols",
    ["Maya (Eurasian Tree Sparrow)", "Philippine Eagle", "Rooster"], 1,
  ],
  [
    "What is the highest mountain in the Philippines?",
    "Mount Apo", "Geography",
    ["Mount Mayon", "Mount Pinatubo", "Mount Apo"], 2,
  ],
  [
    "In what year did the Philippines officially gain independence from the United States?",
    "1946", "History",
    ["1898", "1935", "1946"], 2,
  ],
  [
    "What is the largest island in the Philippines by land area?",
    "Luzon", "Geography",
    ["Luzon", "Mindanao", "Palawan"], 0,
  ],
  [
    "Who is considered the national hero of the Philippines?",
    "José Rizal", "History",
    ["Andrés Bonifacio", "José Rizal", "Emilio Aguinaldo"], 1,
  ],
  [
    "What European country colonized the Philippines for over 300 years?",
    "Spain", "History",
    ["Portugal", "Spain", "United Kingdom"], 1,
  ],
  [
    "What is the currency of the Philippines?",
    "Philippine Peso", "Economy",
    ["Ringgit", "Philippine Peso", "Baht"], 1,
  ],
  [
    "What is the longest river in the Philippines?",
    "Cagayan River", "Geography",
    ["Agusan River", "Pampanga River", "Cagayan River"], 2,
  ],
]

const questions = []
const choices   = []

RAW.forEach(([question, answer, context, opts, correctIdx], i) => {
  const n    = i + 1
  const qKey = `phq-${n}`
  const cKey = `${qKey}-${String.fromCharCode(97 + correctIdx)}`

  questions.push({
    game_key:           'philippines-gk-quiz',
    round_key:          'ph-round',
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
    difficulty:         'Medium',
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
  const outPath = path.join(outDir, 'philippines-gk-quiz.zip')
  fs.writeFileSync(outPath, content)
  console.log(`✅  Written: ${outPath}`)
  console.log(`    ${questions.length} questions, ${choices.length} choices, 0 images`)
}

main().catch(err => { console.error(err); process.exit(1) })
