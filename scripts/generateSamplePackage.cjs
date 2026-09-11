#!/usr/bin/env node
/**
 * Generate a sample TeamBeelding import package for development and testing.
 *
 * Usage:
 *   node scripts/generateSamplePackage.js [output-dir]
 *
 * Output:
 *   teambeelding-package.zip in the current directory (or specified output dir)
 *
 * The package contains:
 *   - 1 game with 2 rounds
 *   - Round 1: Name the Song (4 questions + 1 tiebreaker)
 *   - Round 2: Guess the Picture (4 questions)
 *   - Placeholder images for Guess the Picture questions
 */

const XLSX = require('xlsx')
const JSZip = require('jszip')
const fs = require('fs')
const path = require('path')

const outputDir = process.argv[2] || '.'

const NOW = new Date().toISOString()

// ── Manifest ──────────────────────────────────────────────────────────────────
const manifest = [
  {
    schema_version: 1,
    package_name: 'TeamBeelding Sample Game',
    exported_at: NOW,
    application: 'TeamBeelding',
  },
]

// ── Games ─────────────────────────────────────────────────────────────────────
const games = [
  {
    game_key: 'sample-game-1',
    title: 'Sample Game — Development',
    description: 'A demo game containing both Name the Song and Guess the Picture rounds.',
    estimated_duration_minutes: 15,
    question_order_mode: 'EXACT',
    default_duration_seconds: 20,
    incorrect_penalty_points: 0,
    published: 'FALSE',
  },
]

// ── Rounds ────────────────────────────────────────────────────────────────────
const rounds = [
  {
    game_key: 'sample-game-1',
    round_key: 'round-nts',
    round_number: 1,
    title: 'Name That Tune',
    description: 'Identify the song from the lyric.',
    game_type: 'NAME_THE_SONG',
    category: 'Music',
    subcategory: '',
    difficulty: 'Medium',
    question_order_mode: 'EXACT',
  },
  {
    game_key: 'sample-game-1',
    round_key: 'round-gtp',
    round_number: 2,
    title: 'Picture This',
    description: 'Name what you see in the image.',
    game_type: 'GUESS_THE_PICTURE',
    category: 'Visuals',
    subcategory: '',
    difficulty: 'Easy',
    question_order_mode: 'EXACT',
  },
]

// ── Questions ─────────────────────────────────────────────────────────────────
const questions = [
  // Name the Song questions
  {
    game_key: 'sample-game-1', round_key: 'round-nts', question_key: 'nts-q1',
    question_number: 1, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'Is this the real life? Is this just fantasy?',
    song_title: 'Bohemian Rhapsody', artist: 'Queen',
    image_path: '', category: 'Rock', subcategory: '', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'nts-q1-c1', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-game-1', round_key: 'round-nts', question_key: 'nts-q2',
    question_number: 2, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: "Just a small town girl, livin' in a lonely world",
    song_title: "Don't Stop Believin'", artist: 'Journey',
    image_path: '', category: 'Rock', subcategory: '', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'nts-q2-c2', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-game-1', round_key: 'round-nts', question_key: 'nts-q3',
    question_number: 3, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'Never gonna give you up, never gonna let you down',
    song_title: 'Never Gonna Give You Up', artist: 'Rick Astley',
    image_path: '', category: 'Pop', subcategory: '', difficulty: 'Easy',
    duration_seconds: 15, correct_choice_key: 'nts-q3-c3', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-game-1', round_key: 'round-nts', question_key: 'nts-q4',
    question_number: 4, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'I will always love you',
    song_title: 'I Will Always Love You', artist: 'Whitney Houston',
    image_path: '', category: 'Pop', subcategory: '', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'nts-q4-c1', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  // Tiebreaker
  {
    game_key: 'sample-game-1', round_key: 'round-nts', question_key: 'nts-tb1',
    question_number: 99, game_type: 'NAME_THE_SONG',
    prompt: 'TIEBREAKER: Which song contains this lyric?',
    lyric_excerpt: 'Cause you had a bad day',
    song_title: 'Bad Day', artist: 'Daniel Powter',
    image_path: '', category: 'Pop', subcategory: '', difficulty: 'Hard',
    duration_seconds: 15, correct_choice_key: 'nts-tb1-c2', is_tiebreaker: 'TRUE', active: 'TRUE',
  },
  // Guess the Picture questions
  {
    game_key: 'sample-game-1', round_key: 'round-gtp', question_key: 'gtp-q1',
    question_number: 1, game_type: 'GUESS_THE_PICTURE',
    prompt: 'What landmark is shown in this image?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-game-1/landmark-001.jpg',
    category: 'Landmarks', subcategory: 'Towers', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'gtp-q1-c1', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-game-1', round_key: 'round-gtp', question_key: 'gtp-q2',
    question_number: 2, game_type: 'GUESS_THE_PICTURE',
    prompt: 'What is shown in this picture?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-game-1/object-001.jpg',
    category: 'Objects', subcategory: '', difficulty: 'Easy',
    duration_seconds: 15, correct_choice_key: 'gtp-q2-c2', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-game-1', round_key: 'round-gtp', question_key: 'gtp-q3',
    question_number: 3, game_type: 'GUESS_THE_PICTURE',
    prompt: 'Identify the logo shown.',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-game-1/logo-001.jpg',
    category: 'Logos', subcategory: '', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'gtp-q3-c3', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-game-1', round_key: 'round-gtp', question_key: 'gtp-q4',
    question_number: 4, game_type: 'GUESS_THE_PICTURE',
    prompt: 'What animal is pictured?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-game-1/animal-001.jpg',
    category: 'Animals', subcategory: '', difficulty: 'Easy',
    duration_seconds: 15, correct_choice_key: 'gtp-q4-c1', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
]

// ── Choices ───────────────────────────────────────────────────────────────────
const choices = [
  // nts-q1: Bohemian Rhapsody (c1 correct)
  { question_key: 'nts-q1', choice_key: 'nts-q1-c1', choice_order: 1, choice_text: 'Bohemian Rhapsody' },
  { question_key: 'nts-q1', choice_key: 'nts-q1-c2', choice_order: 2, choice_text: 'Hotel California' },
  { question_key: 'nts-q1', choice_key: 'nts-q1-c3', choice_order: 3, choice_text: 'Stairway to Heaven' },
  // nts-q2: Don't Stop Believin' (c2 correct)
  { question_key: 'nts-q2', choice_key: 'nts-q2-c1', choice_order: 1, choice_text: 'Sweet Home Alabama' },
  { question_key: 'nts-q2', choice_key: 'nts-q2-c2', choice_order: 2, choice_text: "Don't Stop Believin'" },
  { question_key: 'nts-q2', choice_key: 'nts-q2-c3', choice_order: 3, choice_text: 'Eye of the Tiger' },
  // nts-q3: Never Gonna Give You Up (c3 correct)
  { question_key: 'nts-q3', choice_key: 'nts-q3-c1', choice_order: 1, choice_text: 'Take On Me' },
  { question_key: 'nts-q3', choice_key: 'nts-q3-c2', choice_order: 2, choice_text: 'Girls Just Wanna Have Fun' },
  { question_key: 'nts-q3', choice_key: 'nts-q3-c3', choice_order: 3, choice_text: 'Never Gonna Give You Up' },
  // nts-q4: I Will Always Love You (c1 correct)
  { question_key: 'nts-q4', choice_key: 'nts-q4-c1', choice_order: 1, choice_text: 'I Will Always Love You' },
  { question_key: 'nts-q4', choice_key: 'nts-q4-c2', choice_order: 2, choice_text: 'My Heart Will Go On' },
  { question_key: 'nts-q4', choice_key: 'nts-q4-c3', choice_order: 3, choice_text: 'Endless Love' },
  // nts-tb1: Bad Day (c2 correct)
  { question_key: 'nts-tb1', choice_key: 'nts-tb1-c1', choice_order: 1, choice_text: 'Fix You' },
  { question_key: 'nts-tb1', choice_key: 'nts-tb1-c2', choice_order: 2, choice_text: 'Bad Day' },
  { question_key: 'nts-tb1', choice_key: 'nts-tb1-c3', choice_order: 3, choice_text: 'Beautiful Day' },
  // gtp-q1: Eiffel Tower (c1 correct)
  { question_key: 'gtp-q1', choice_key: 'gtp-q1-c1', choice_order: 1, choice_text: 'Eiffel Tower' },
  { question_key: 'gtp-q1', choice_key: 'gtp-q1-c2', choice_order: 2, choice_text: 'Burj Khalifa' },
  { question_key: 'gtp-q1', choice_key: 'gtp-q1-c3', choice_order: 3, choice_text: 'CN Tower' },
  // gtp-q2: Coffee cup (c2 correct)
  { question_key: 'gtp-q2', choice_key: 'gtp-q2-c1', choice_order: 1, choice_text: 'Tea Pot' },
  { question_key: 'gtp-q2', choice_key: 'gtp-q2-c2', choice_order: 2, choice_text: 'Coffee Cup' },
  { question_key: 'gtp-q2', choice_key: 'gtp-q2-c3', choice_order: 3, choice_text: 'Mug Rack' },
  // gtp-q3: Apple logo (c3 correct)
  { question_key: 'gtp-q3', choice_key: 'gtp-q3-c1', choice_order: 1, choice_text: 'Google' },
  { question_key: 'gtp-q3', choice_key: 'gtp-q3-c2', choice_order: 2, choice_text: 'Microsoft' },
  { question_key: 'gtp-q3', choice_key: 'gtp-q3-c3', choice_order: 3, choice_text: 'Apple' },
  // gtp-q4: Bee (c1 correct)
  { question_key: 'gtp-q4', choice_key: 'gtp-q4-c1', choice_order: 1, choice_text: 'Bee' },
  { question_key: 'gtp-q4', choice_key: 'gtp-q4-c2', choice_order: 2, choice_text: 'Wasp' },
  { question_key: 'gtp-q4', choice_key: 'gtp-q4-c3', choice_order: 3, choice_text: 'Hornet' },
]

// ── Build workbook ─────────────────────────────────────────────────────────────
function toSheet(data) {
  return XLSX.utils.json_to_sheet(data)
}

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, toSheet(manifest), 'Manifest')
XLSX.utils.book_append_sheet(wb, toSheet(games), 'Games')
XLSX.utils.book_append_sheet(wb, toSheet(rounds), 'Rounds')
XLSX.utils.book_append_sheet(wb, toSheet(questions), 'Questions')
XLSX.utils.book_append_sheet(wb, toSheet(choices), 'Choices')
const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

// ── Build placeholder images ───────────────────────────────────────────────────
// A minimal valid 1x1 white JPEG (bytes)
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
  'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
  'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAHhAA' +
  'AgIDAQEBAAAAAAAAAAAAAQIDBAUREiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAA' +
  'AAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AK9gABX/2Q==',
  'base64'
)

// ── Build ZIP ─────────────────────────────────────────────────────────────────
async function buildZip() {
  const zip = new JSZip()
  zip.file('teambeelding-import.xlsx', xlsxBuffer)

  const imageFiles = [
    'sample-game-1/landmark-001.jpg',
    'sample-game-1/object-001.jpg',
    'sample-game-1/logo-001.jpg',
    'sample-game-1/animal-001.jpg',
  ]
  for (const imgPath of imageFiles) {
    zip.file(`images/${imgPath}`, PLACEHOLDER_JPEG)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const outPath = path.join(outputDir, 'teambeelding-sample-package.zip')
  fs.writeFileSync(outPath, zipBuffer)
  console.log(`Sample package written to: ${outPath}`)
  console.log('Note: image files contain 1x1 placeholder JPEGs for development/testing only.')
  console.log('Replace them with real images before using in a live game.')
}

buildZip().catch(err => { console.error(err); process.exit(1) })
