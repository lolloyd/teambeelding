#!/usr/bin/env node
/**
 * Generates queen-beatles-quiz.zip — a ready-to-import TeamBeelding package
 * containing 10 NAME_THE_SONG questions about Queen and The Beatles.
 *
 * Usage:  node scripts/createQueenBeatlesQuiz.cjs [output-dir]
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
  package_name:   'Queen & Beatles Quiz',
  exported_at:    new Date().toISOString(),
  application:    'TeamBeelding',
}]

// ── Game ──────────────────────────────────────────────────────────────────────
const games = [{
  game_key:                   'queen-beatles-quiz',
  title:                      'Queen & Beatles Quiz',
  description:                'Name the iconic song from Queen or The Beatles by its lyric.',
  estimated_duration_minutes: 15,
  question_order_mode:        'EXACT',
  default_duration_seconds:   20,
  incorrect_penalty_points:   0,
  published:                  'FALSE',
}]

// ── Round ─────────────────────────────────────────────────────────────────────
const rounds = [{
  game_key:            'queen-beatles-quiz',
  round_key:           'qb-round',
  round_number:        1,
  title:               'Queen & Beatles',
  description:         'Which song contains this lyric?',
  game_type:           'NAME_THE_SONG',
  category:            'Classic Rock',
  subcategory:         '',
  difficulty:          'Mixed',
  question_order_mode: 'EXACT',
}]

// ── Question + Choice data ────────────────────────────────────────────────────
// Each entry: [ lyric, song_title, artist, [choice1, choice2, choice3], correctIndex (0-based) ]
const RAW = [
  // Queen (5 questions)
  [
    "Is this the real life? Is this just fantasy? Caught in a landslide, no escape from reality",
    "Bohemian Rhapsody", "Queen",
    ["We Are the Champions", "Bohemian Rhapsody", "Don't Stop Me Now"], 1,
  ],
  [
    "Buddy, you're a boy, make a big noise, playing in the street, gonna be a big man someday",
    "We Will Rock You", "Queen",
    ["We Will Rock You", "Radio Ga Ga", "Under Pressure"], 0,
  ],
  [
    "Tonight I'm gonna have myself a real good time, I feel alive and the world I'll turn it inside out",
    "Don't Stop Me Now", "Queen",
    ["Killer Queen", "Somebody to Love", "Don't Stop Me Now"], 2,
  ],
  [
    "I'd sit alone and watch your light, my only friend through teenage nights",
    "Radio Ga Ga", "Queen",
    ["I Want to Break Free", "Radio Ga Ga", "Another One Bites the Dust"], 1,
  ],
  [
    "Pressure pushing down on me, pressing down on you, no man ask for",
    "Under Pressure", "Queen & David Bowie",
    ["Flash", "Under Pressure", "Innuendo"], 1,
  ],
  // The Beatles (5 questions)
  [
    "Hey Jude, don't make it bad, take a sad song and make it better",
    "Hey Jude", "The Beatles",
    ["Hey Jude", "Let It Be", "Come Together"], 0,
  ],
  [
    "When I find myself in times of trouble, Mother Mary comes to me, speaking words of wisdom",
    "Let It Be", "The Beatles",
    ["Yesterday", "The Long and Winding Road", "Let It Be"], 2,
  ],
  [
    "Here come old flat top, he come grooving up slowly, he got joo joo eyeball",
    "Come Together", "The Beatles",
    ["Come Together", "Twist and Shout", "Back in the U.S.S.R."], 0,
  ],
  [
    "Yesterday, all my troubles seemed so far away, now it looks as though they're here to stay",
    "Yesterday", "The Beatles",
    ["Blackbird", "Yesterday", "In My Life"], 1,
  ],
  [
    "Well shake it up baby now, twist and shout, c'mon c'mon c'mon baby now",
    "Twist and Shout", "The Beatles",
    ["Love Me Do", "She Loves You", "Twist and Shout"], 2,
  ],
]

const questions = []
const choices   = []

RAW.forEach(([lyric, song, artist, opts, correctIdx], i) => {
  const n    = i + 1
  const qKey = `qbq-${n}`
  const cKey = `${qKey}-${String.fromCharCode(97 + correctIdx)}` // a/b/c

  questions.push({
    game_key:           'queen-beatles-quiz',
    round_key:          'qb-round',
    question_key:       qKey,
    question_number:    n,
    game_type:          'NAME_THE_SONG',
    prompt:             'Which song contains this lyric?',
    lyric_excerpt:      lyric,
    song_title:         song,
    artist:             artist,
    image_path:         '',
    category:           'Classic Rock',
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
  const outPath = path.join(outDir, 'queen-beatles-quiz.zip')
  fs.writeFileSync(outPath, content)
  console.log(`✅  Written: ${outPath}`)
  console.log(`    ${questions.length} questions, ${choices.length} choices, 0 images`)
}

main().catch(err => { console.error(err); process.exit(1) })
