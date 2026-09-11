#!/usr/bin/env node
/**
 * Creates a complete, importable TeamBeelding game package.
 *
 * Usage:  node scripts/createSampleGame.cjs [output-dir]
 * Output: teambeelding-sample-game.zip
 *
 * The package contains:
 *   - 1 game  ("TeamBEElding Sample")
 *   - Round 1 — Name the Song    (5 questions + 1 tiebreaker)
 *   - Round 2 — Guess the Picture (4 questions, colored placeholder images)
 */

'use strict'

const XLSX  = require('xlsx')
const JSZip = require('jszip')
const zlib  = require('zlib')
const fs    = require('fs')
const path  = require('path')

const outDir = process.argv[2] || '.'

// ── Minimal PNG generator ─────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF]
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length, 0)
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([lb, tb, data, cb])
}

/**
 * Create a solid-colour 200×200 PNG with a centred text label.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {string} _label  (reserved — PNG text chunk would need more work; skip for now)
 */
function makePng(r, g, b) {
  const W = 200, H = 200
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 2   // 8-bit RGB

  // Raw scanlines: filter byte 0 + RGB pixels
  const raw = Buffer.alloc(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    const base = y * (1 + W * 3)
    raw[base] = 0 // filter: None
    for (let x = 0; x < W; x++) {
      const p = base + 1 + x * 3
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Palette: a different colour per image so you can tell them apart
const PALETTE = [
  { r: 108, g:  99, b: 255, label: 'Landmark'  },  // purple
  { r: 255, g: 101, b: 132, label: 'Person'     },  // pink
  { r:  67, g: 217, b: 143, label: 'Logo'       },  // green
  { r: 245, g: 197, b:  66, label: 'Animal'     },  // yellow
]

// ── Workbook data ─────────────────────────────────────────────────────────────

const manifest = [{
  schema_version: 1,
  package_name:   'TeamBEElding Sample Game',
  exported_at:    new Date().toISOString(),
  application:    'TeamBeelding',
}]

const games = [{
  game_key:                   'sample-001',
  title:                      'TeamBEElding Sample',
  description:                'A ready-to-use demo game with both game types.',
  estimated_duration_minutes: 15,
  question_order_mode:        'EXACT',
  default_duration_seconds:   20,
  incorrect_penalty_points:   0,
  published:                  'FALSE',
}]

const rounds = [
  {
    game_key:            'sample-001',
    round_key:           'nts-round',
    round_number:        1,
    title:               'Name That Tune',
    description:         'Identify the song from the lyric excerpt.',
    game_type:           'NAME_THE_SONG',
    category:            'Music',
    subcategory:         '',
    difficulty:          'Mixed',
    question_order_mode: 'EXACT',
  },
  {
    game_key:            'sample-001',
    round_key:           'gtp-round',
    round_number:        2,
    title:               'Picture This',
    description:         'Name what you see in the image.',
    game_type:           'GUESS_THE_PICTURE',
    category:            'Visuals',
    subcategory:         '',
    difficulty:          'Mixed',
    question_order_mode: 'EXACT',
  },
]

const questions = [
  // ── Name the Song ──────────────────────────────────────────────────────────
  {
    game_key: 'sample-001', round_key: 'nts-round', question_key: 'nts-1',
    question_number: 1, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'Is this the real life? Is this just fantasy?',
    song_title: 'Bohemian Rhapsody', artist: 'Queen',
    image_path: '', category: 'Rock', subcategory: '70s', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'nts-1-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'nts-round', question_key: 'nts-2',
    question_number: 2, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: "Just a small town girl, livin' in a lonely world",
    song_title: "Don't Stop Believin'", artist: 'Journey',
    image_path: '', category: 'Rock', subcategory: '80s', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'nts-2-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'nts-round', question_key: 'nts-3',
    question_number: 3, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'Never gonna give you up, never gonna let you down',
    song_title: 'Never Gonna Give You Up', artist: 'Rick Astley',
    image_path: '', category: 'Pop', subcategory: '80s', difficulty: 'Easy',
    duration_seconds: 15, correct_choice_key: 'nts-3-c', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'nts-round', question_key: 'nts-4',
    question_number: 4, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'I will always love you',
    song_title: 'I Will Always Love You', artist: 'Whitney Houston',
    image_path: '', category: 'Pop', subcategory: '90s', difficulty: 'Medium',
    duration_seconds: 20, correct_choice_key: 'nts-4-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'nts-round', question_key: 'nts-5',
    question_number: 5, game_type: 'NAME_THE_SONG',
    prompt: 'Which song contains this lyric?',
    lyric_excerpt: 'Somebody once told me the world is gonna roll me',
    song_title: 'All Star', artist: 'Smash Mouth',
    image_path: '', category: 'Pop', subcategory: '90s', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'nts-5-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  // Tiebreaker
  {
    game_key: 'sample-001', round_key: 'nts-round', question_key: 'nts-tb',
    question_number: 99, game_type: 'NAME_THE_SONG',
    prompt: 'TIEBREAKER: Which song contains this lyric?',
    lyric_excerpt: 'Cause you had a bad day',
    song_title: 'Bad Day', artist: 'Daniel Powter',
    image_path: '', category: 'Pop', subcategory: '2000s', difficulty: 'Hard',
    duration_seconds: 15, correct_choice_key: 'nts-tb-b', is_tiebreaker: 'TRUE', active: 'TRUE',
  },
  // ── Guess the Picture ──────────────────────────────────────────────────────
  {
    game_key: 'sample-001', round_key: 'gtp-round', question_key: 'gtp-1',
    question_number: 1, game_type: 'GUESS_THE_PICTURE',
    prompt: 'Which famous landmark is shown?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-001/landmark.png',
    category: 'Landmarks', subcategory: 'Towers', difficulty: 'Easy',
    duration_seconds: 20, correct_choice_key: 'gtp-1-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'gtp-round', question_key: 'gtp-2',
    question_number: 2, game_type: 'GUESS_THE_PICTURE',
    prompt: 'Who is this famous person?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-001/person.png',
    category: 'People', subcategory: 'Celebrities', difficulty: 'Medium',
    duration_seconds: 25, correct_choice_key: 'gtp-2-b', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'gtp-round', question_key: 'gtp-3',
    question_number: 3, game_type: 'GUESS_THE_PICTURE',
    prompt: 'Which company does this logo belong to?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-001/logo.png',
    category: 'Logos', subcategory: 'Tech', difficulty: 'Easy',
    duration_seconds: 15, correct_choice_key: 'gtp-3-c', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
  {
    game_key: 'sample-001', round_key: 'gtp-round', question_key: 'gtp-4',
    question_number: 4, game_type: 'GUESS_THE_PICTURE',
    prompt: 'What animal is shown in this picture?',
    lyric_excerpt: '', song_title: '', artist: '',
    image_path: 'sample-001/animal.png',
    category: 'Animals', subcategory: 'Insects', difficulty: 'Easy',
    duration_seconds: 15, correct_choice_key: 'gtp-4-a', is_tiebreaker: 'FALSE', active: 'TRUE',
  },
]

const choices = [
  // nts-1: Bohemian Rhapsody (a ✓)
  { question_key: 'nts-1', choice_key: 'nts-1-a', choice_order: 1, choice_text: 'Bohemian Rhapsody' },
  { question_key: 'nts-1', choice_key: 'nts-1-b', choice_order: 2, choice_text: 'Hotel California' },
  { question_key: 'nts-1', choice_key: 'nts-1-c', choice_order: 3, choice_text: 'Stairway to Heaven' },
  // nts-2: Don't Stop Believin' (b ✓)
  { question_key: 'nts-2', choice_key: 'nts-2-a', choice_order: 1, choice_text: 'Sweet Home Alabama' },
  { question_key: 'nts-2', choice_key: 'nts-2-b', choice_order: 2, choice_text: "Don't Stop Believin'" },
  { question_key: 'nts-2', choice_key: 'nts-2-c', choice_order: 3, choice_text: 'Eye of the Tiger' },
  // nts-3: Never Gonna Give You Up (c ✓)
  { question_key: 'nts-3', choice_key: 'nts-3-a', choice_order: 1, choice_text: 'Take On Me' },
  { question_key: 'nts-3', choice_key: 'nts-3-b', choice_order: 2, choice_text: 'Girls Just Wanna Have Fun' },
  { question_key: 'nts-3', choice_key: 'nts-3-c', choice_order: 3, choice_text: 'Never Gonna Give You Up' },
  // nts-4: I Will Always Love You (a ✓)
  { question_key: 'nts-4', choice_key: 'nts-4-a', choice_order: 1, choice_text: 'I Will Always Love You' },
  { question_key: 'nts-4', choice_key: 'nts-4-b', choice_order: 2, choice_text: 'My Heart Will Go On' },
  { question_key: 'nts-4', choice_key: 'nts-4-c', choice_order: 3, choice_text: 'Endless Love' },
  // nts-5: All Star (b ✓)
  { question_key: 'nts-5', choice_key: 'nts-5-a', choice_order: 1, choice_text: 'Mambo No. 5' },
  { question_key: 'nts-5', choice_key: 'nts-5-b', choice_order: 2, choice_text: 'All Star' },
  { question_key: 'nts-5', choice_key: 'nts-5-c', choice_order: 3, choice_text: 'MMMBop' },
  // nts-tb: Bad Day (b ✓)
  { question_key: 'nts-tb', choice_key: 'nts-tb-a', choice_order: 1, choice_text: 'Fix You' },
  { question_key: 'nts-tb', choice_key: 'nts-tb-b', choice_order: 2, choice_text: 'Bad Day' },
  { question_key: 'nts-tb', choice_key: 'nts-tb-c', choice_order: 3, choice_text: 'Beautiful Day' },
  // gtp-1: Eiffel Tower (a ✓)
  { question_key: 'gtp-1', choice_key: 'gtp-1-a', choice_order: 1, choice_text: 'Eiffel Tower' },
  { question_key: 'gtp-1', choice_key: 'gtp-1-b', choice_order: 2, choice_text: 'Burj Khalifa' },
  { question_key: 'gtp-1', choice_key: 'gtp-1-c', choice_order: 3, choice_text: 'CN Tower' },
  // gtp-2: Taylor Swift (b ✓)
  { question_key: 'gtp-2', choice_key: 'gtp-2-a', choice_order: 1, choice_text: 'Beyoncé' },
  { question_key: 'gtp-2', choice_key: 'gtp-2-b', choice_order: 2, choice_text: 'Taylor Swift' },
  { question_key: 'gtp-2', choice_key: 'gtp-2-c', choice_order: 3, choice_text: 'Adele' },
  // gtp-3: Apple (c ✓)
  { question_key: 'gtp-3', choice_key: 'gtp-3-a', choice_order: 1, choice_text: 'Google' },
  { question_key: 'gtp-3', choice_key: 'gtp-3-b', choice_order: 2, choice_text: 'Microsoft' },
  { question_key: 'gtp-3', choice_key: 'gtp-3-c', choice_order: 3, choice_text: 'Apple' },
  // gtp-4: Bee (a ✓)
  { question_key: 'gtp-4', choice_key: 'gtp-4-a', choice_order: 1, choice_text: 'Bee' },
  { question_key: 'gtp-4', choice_key: 'gtp-4-b', choice_order: 2, choice_text: 'Wasp' },
  { question_key: 'gtp-4', choice_key: 'gtp-4-c', choice_order: 3, choice_text: 'Hornet' },
]

// ── Build workbook ─────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new()
const addSheet = (name, data) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name)
addSheet('Manifest', manifest)
addSheet('Games',    games)
addSheet('Rounds',   rounds)
addSheet('Questions', questions)
addSheet('Choices',  choices)
const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

// ── Build ZIP ─────────────────────────────────────────────────────────────────
async function build() {
  const zip = new JSZip()
  zip.file('teambeelding-import.xlsx', xlsxBuf)

  // Colour-coded PNG placeholders — replace with real images before going live
  const images = [
    { path: 'sample-001/landmark.png', ...PALETTE[0] },
    { path: 'sample-001/person.png',   ...PALETTE[1] },
    { path: 'sample-001/logo.png',     ...PALETTE[2] },
    { path: 'sample-001/animal.png',   ...PALETTE[3] },
  ]
  for (const img of images) {
    zip.file(`images/${img.path}`, makePng(img.r, img.g, img.b))
  }

  const buf  = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const out  = path.join(outDir, 'teambeelding-sample-game.zip')
  fs.writeFileSync(out, buf)

  console.log(`\n✅  Package written to: ${out}`)
  console.log('\nContents:')
  console.log('  teambeelding-import.xlsx')
  console.log('    Manifest  : 1 row')
  console.log('    Games     : 1 game  ("TeamBEElding Sample")')
  console.log('    Rounds    : 2  (Name the Song + Guess the Picture)')
  console.log('    Questions : 9  (5 + tiebreaker + 4 picture)')
  console.log('    Choices   : 27 (3 per question)')
  console.log('  images/sample-001/  : 4 × coloured 200×200 PNG placeholders')
  console.log('\nHow to import:')
  console.log('  1. Start the dev server:  npm run dev')
  console.log('  2. Open http://localhost:5173/admin')
  console.log('  3. Sign in, then go to Import')
  console.log('  4. Upload teambeelding-sample-game.zip')
  console.log('  5. Click Validate → Import → Publish\n')
}

build().catch(err => { console.error(err); process.exit(1) })
