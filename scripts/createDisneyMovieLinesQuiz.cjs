#!/usr/bin/env node
/**
 * Generates disney-movie-lines-quiz.zip — a ready-to-import TeamBeelding package
 * containing 10 NAME_THE_SONG questions about famous Disney movie lines.
 *
 * Usage:  node scripts/createDisneyMovieLinesQuiz.cjs [output-dir]
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
  package_name:   'Disney Movie Lines Quiz',
  exported_at:    new Date().toISOString(),
  application:    'TeamBeelding',
}]

// ── Game ──────────────────────────────────────────────────────────────────────
const games = [{
  game_key:                   'disney-movie-lines-quiz',
  title:                      'Disney Movie Lines Quiz',
  description:                'Name the Disney movie from its most iconic line.',
  estimated_duration_minutes: 15,
  question_order_mode:        'EXACT',
  default_duration_seconds:   20,
  incorrect_penalty_points:   0,
  published:                  'FALSE',
}]

// ── Round ─────────────────────────────────────────────────────────────────────
const rounds = [{
  game_key:            'disney-movie-lines-quiz',
  round_key:           'disney-round',
  round_number:        1,
  title:               'Name That Disney Movie',
  description:         'Which Disney movie contains this iconic line?',
  game_type:           'NAME_THE_SONG',
  category:            'Disney',
  subcategory:         '',
  difficulty:          'Mixed',
  question_order_mode: 'EXACT',
}]

// ── Question + Choice data ────────────────────────────────────────────────────
// Each entry: [ line, movie_title, character, [choice1, choice2, choice3], correctIndex (0-based) ]
const RAW = [
  [
    "Hakuna Matata! What a wonderful phrase. Ain't no passing craze.",
    "The Lion King", "Timon & Pumbaa",
    ["The Jungle Book", "The Lion King", "Tarzan"], 1,
  ],
  [
    "To infinity and beyond!",
    "Toy Story", "Buzz Lightyear",
    ["Toy Story", "A Bug's Life", "Monsters, Inc."], 0,
  ],
  [
    "Just keep swimming, just keep swimming.",
    "Finding Nemo", "Dory",
    ["The Little Mermaid", "Finding Nemo", "Moana"], 1,
  ],
  [
    "Magic mirror on the wall, who is the fairest one of all?",
    "Snow White and the Seven Dwarfs", "Evil Queen",
    ["Sleeping Beauty", "Snow White and the Seven Dwarfs", "Cinderella"], 1,
  ],
  [
    "Be our guest, be our guest, put our service to the test!",
    "Beauty and the Beast", "Lumière",
    ["Cinderella", "Tangled", "Beauty and the Beast"], 2,
  ],
  [
    "I was hiding under your porch because I love you.",
    "Up", "Dug",
    ["Up", "Bolt", "The Incredibles"], 0,
  ],
  [
    "I just wish I could be part of that world.",
    "The Little Mermaid", "Ariel",
    ["Moana", "Tangled", "The Little Mermaid"], 2,
  ],
  [
    "Look for the bare necessities, the simple bare necessities, forget about your worries and your strife.",
    "The Jungle Book", "Baloo",
    ["The Jungle Book", "Tarzan", "The Lion King"], 0,
  ],
  [
    "Ohana means family. Family means nobody gets left behind or forgotten.",
    "Lilo & Stitch", "Stitch",
    ["Moana", "Lilo & Stitch", "Encanto"], 1,
  ],
  [
    "We don't talk about Bruno, no, no, no!",
    "Encanto", "The Madrigal Family",
    ["Coco", "Moana", "Encanto"], 2,
  ],
]

const questions = []
const choices   = []

RAW.forEach(([line, movie, character, opts, correctIdx], i) => {
  const n    = i + 1
  const qKey = `dlq-${n}`
  const cKey = `${qKey}-${String.fromCharCode(97 + correctIdx)}`

  questions.push({
    game_key:           'disney-movie-lines-quiz',
    round_key:          'disney-round',
    question_key:       qKey,
    question_number:    n,
    game_type:          'NAME_THE_SONG',
    prompt:             'Which Disney movie contains this iconic line?',
    lyric_excerpt:      line,
    song_title:         movie,
    artist:             character,
    image_path:         '',
    category:           'Disney',
    subcategory:        '',
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
  const outPath = path.join(outDir, 'disney-movie-lines-quiz.zip')
  fs.writeFileSync(outPath, content)
  console.log(`✅  Written: ${outPath}`)
  console.log(`    ${questions.length} questions, ${choices.length} choices, 0 images`)
}

main().catch(err => { console.error(err); process.exit(1) })
