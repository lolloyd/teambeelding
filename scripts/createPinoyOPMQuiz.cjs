#!/usr/bin/env node
/**
 * Creates a 10-item Pinoy OPM quiz package.
 *
 * Usage:  node scripts/createPinoyOPMQuiz.cjs [output-dir]
 * Output: teambeelding-pinoy-opm-quiz.zip
 */

'use strict'

const XLSX = require('xlsx')
const JSZip = require('jszip')
const fs = require('fs')
const path = require('path')

const outDir = process.argv[2] || '.'

const manifest = [{
  schema_version: 1,
  package_name: 'Pinoy OPM Quiz',
  exported_at: new Date().toISOString(),
  application: 'TeamBeelding',
}]

const games = [{
  game_key: 'pinoy-opm-quiz',
  title: 'Pinoy OPM Quiz',
  description: 'A 10-item round of iconic Original Pilipino Music songs.',
  estimated_duration_minutes: 10,
  question_order_mode: 'EXACT',
  default_duration_seconds: 20,
  incorrect_penalty_points: 0,
  published: 'FALSE',
}]

const rounds = [{
  game_key: 'pinoy-opm-quiz',
  round_key: 'pinoy-opm-round',
  round_number: 1,
  title: 'Pinoy OPM Classics',
  description: 'Identify the song from the lyric excerpt.',
  game_type: 'NAME_THE_SONG',
  category: 'Music',
  subcategory: 'OPM',
  difficulty: 'Mixed',
  question_order_mode: 'EXACT',
}]

const questions = [
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-1',
    question_number: 1, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Maging sino ka man, mayaman o mahirap...',
    song_title: 'Maging Sino Ka Man', artist: 'Jaya',
    image_path: '', category: 'OPM', subcategory: 'Ballad', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'p-1-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-2',
    question_number: 2, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Paano ba ang maghihintay? Paano kung hindi ka na dumating?',
    song_title: 'Huling El Bimbo', artist: 'Eraserheads',
    image_path: '', category: 'OPM', subcategory: 'Rock', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'p-2-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-3',
    question_number: 3, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: "Bawat hapon, ika'y aking tinatawag...",
    song_title: 'Kaleidoscope World', artist: 'Bamboo',
    image_path: '', category: 'OPM', subcategory: 'Alternative', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'p-3-c', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-4',
    question_number: 4, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: "Kung tayo'y magkakalayo, may mga luha pa bang matitira?",
    song_title: 'Tadhana', artist: 'Up Dharma Down',
    image_path: '', category: 'OPM', subcategory: 'Indie', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'p-4-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-5',
    question_number: 5, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Bakit pa kasi ganyan ang mundo?',
    song_title: 'Tatsulok', artist: 'Bamboo',
    image_path: '', category: 'OPM', subcategory: 'Rock', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'p-5-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-6',
    question_number: 6, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Huwag kang matakot, yumakap ka lang sa akin...',
    song_title: 'Ikaw', artist: 'Yeng Constantino',
    image_path: '', category: 'OPM', subcategory: 'Ballad', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'p-6-c', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-7',
    question_number: 7, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Kung akala mo ay mawawala ang pag-ibig, kahit na malayo ka pa...',
    song_title: 'One More Chance', artist: 'Eraserheads',
    image_path: '', category: 'OPM', subcategory: 'Rock', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'p-7-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-8',
    question_number: 8, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: "Sana ako ay iyong mahalin, hanggang sa huli...",
    song_title: "Pangako Sa'yo", artist: "Pangako Sa'yo",
    image_path: '', category: 'OPM', subcategory: 'Ballad', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'p-8-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-9',
    question_number: 9, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Bakit ba ang hirap mong iwanang muli?',
    song_title: 'Arawan', artist: 'Ben&Ben',
    image_path: '', category: 'OPM', subcategory: 'Folk Pop', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'p-9-c', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'pinoy-opm-quiz', round_key: 'pinoy-opm-round', question_key: 'p-10',
    question_number: 10, game_type: 'NAME_THE_SONG',
    prompt: 'Which OPM song contains this lyric?',
    lyric_excerpt: 'Saan ka man naroroon, di ko maalis ang isip ko sa iyo...',
    song_title: 'Saan Ka Man Naroroon', artist: 'Rivermaya',
    image_path: '', category: 'OPM', subcategory: 'Rock', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'p-10-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
]

const choices = [
  { question_key: 'p-1', choice_key: 'p-1-a', choice_order: 1, choice_text: 'Kahit Isang Saglit' },
  { question_key: 'p-1', choice_key: 'p-1-b', choice_order: 2, choice_text: 'Maging Sino Ka Man' },
  { question_key: 'p-1', choice_key: 'p-1-c', choice_order: 3, choice_text: 'Bituing Walang Ningning' },

  { question_key: 'p-2', choice_key: 'p-2-a', choice_order: 1, choice_text: 'Huling El Bimbo' },
  { question_key: 'p-2', choice_key: 'p-2-b', choice_order: 2, choice_text: 'Ligaya' },
  { question_key: 'p-2', choice_key: 'p-2-c', choice_order: 3, choice_text: 'Alapaap' },

  { question_key: 'p-3', choice_key: 'p-3-a', choice_order: 1, choice_text: 'Bituin' },
  { question_key: 'p-3', choice_key: 'p-3-b', choice_order: 2, choice_text: 'Paano' },
  { question_key: 'p-3', choice_key: 'p-3-c', choice_order: 3, choice_text: 'Kaleidoscope World' },

  { question_key: 'p-4', choice_key: 'p-4-a', choice_order: 1, choice_text: 'Arawan' },
  { question_key: 'p-4', choice_key: 'p-4-b', choice_order: 2, choice_text: 'Tadhana' },
  { question_key: 'p-4', choice_key: 'p-4-c', choice_order: 3, choice_text: 'Dahil Sayo' },

  { question_key: 'p-5', choice_key: 'p-5-a', choice_order: 1, choice_text: 'Tatsulok' },
  { question_key: 'p-5', choice_key: 'p-5-b', choice_order: 2, choice_text: 'Minsan' },
  { question_key: 'p-5', choice_key: 'p-5-c', choice_order: 3, choice_text: 'Bayan Ko' },

  { question_key: 'p-6', choice_key: 'p-6-a', choice_order: 1, choice_text: 'Pangarap Ko ang Ibigin Ka' },
  { question_key: 'p-6', choice_key: 'p-6-b', choice_order: 2, choice_text: 'Bakit Pa' },
  { question_key: 'p-6', choice_key: 'p-6-c', choice_order: 3, choice_text: 'Ikaw' },

  { question_key: 'p-7', choice_key: 'p-7-a', choice_order: 1, choice_text: 'Nosi Balasi' },
  { question_key: 'p-7', choice_key: 'p-7-b', choice_order: 2, choice_text: 'One More Chance' },
  { question_key: 'p-7', choice_key: 'p-7-c', choice_order: 3, choice_text: 'Maging Akin Ka' },

  { question_key: 'p-8', choice_key: 'p-8-a', choice_order: 1, choice_text: "Pangako Sa'yo" },
  { question_key: 'p-8', choice_key: 'p-8-b', choice_order: 2, choice_text: 'Bakit' },
  { question_key: 'p-8', choice_key: 'p-8-c', choice_order: 3, choice_text: 'Pabebe' },

  { question_key: 'p-9', choice_key: 'p-9-a', choice_order: 1, choice_text: 'Narda' },
  { question_key: 'p-9', choice_key: 'p-9-b', choice_order: 2, choice_text: 'Sino Ang Baliw' },
  { question_key: 'p-9', choice_key: 'p-9-c', choice_order: 3, choice_text: 'Arawan' },

  { question_key: 'p-10', choice_key: 'p-10-a', choice_order: 1, choice_text: 'Huwag Ka Nang Umuwi' },
  { question_key: 'p-10', choice_key: 'p-10-b', choice_order: 2, choice_text: 'Saan Ka Man Naroroon' },
  { question_key: 'p-10', choice_key: 'p-10-c', choice_order: 3, choice_text: 'Sino' },
]

const wb = XLSX.utils.book_new()
const addSheet = (name, data) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name)
addSheet('Manifest', manifest)
addSheet('Games', games)
addSheet('Rounds', rounds)
addSheet('Questions', questions)
addSheet('Choices', choices)

const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

async function build() {
  const zip = new JSZip()
  zip.file('teambeelding-import.xlsx', xlsxBuf)
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const out = path.join(outDir, 'teambeelding-pinoy-opm-quiz.zip')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, buf)

  console.log(`\n✅ Package written to: ${out}`)
  console.log('\nContents:')
  console.log('  teambeelding-import.xlsx')
  console.log('    Manifest  : 1 row')
  console.log('    Games     : 1 game (Pinoy OPM Quiz)')
  console.log('    Rounds    : 1 (Pinoy OPM Classics)')
  console.log('    Questions : 10')
  console.log('    Choices   : 30')
  console.log('\nHow to import:')
  console.log('  1. Start the app:  npm run dev')
  console.log('  2. Open /admin')
  console.log('  3. Import teambeelding-pinoy-opm-quiz.zip')
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
