#!/usr/bin/env node
/**
 * Generates pop-song-trivia.zip — a ready-to-import TeamBeelding package
 * containing 30 NAME_THE_SONG questions.
 *
 * Usage:  node scripts/createPopSongTriviaGame.cjs [output-dir]
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
  package_name:   'Pop Song Trivia',
  exported_at:    new Date().toISOString(),
  application:    'TeamBeelding',
}]

// ── Game ──────────────────────────────────────────────────────────────────────
const games = [{
  game_key:                   'pop-song-trivia',
  title:                      'Pop Song Trivia',
  description:                'Identify the hit song from the lyric shown on screen.',
  estimated_duration_minutes: 30,
  question_order_mode:        'EXACT',
  default_duration_seconds:   20,
  incorrect_penalty_points:   0,
  published:                  'FALSE',
}]

// ── Round ─────────────────────────────────────────────────────────────────────
const rounds = [{
  game_key:            'pop-song-trivia',
  round_key:           'pop-round',
  round_number:        1,
  title:               'Name That Song',
  description:         'Which song contains this lyric?',
  game_type:           'NAME_THE_SONG',
  category:            'Pop Music',
  subcategory:         '',
  difficulty:          'Mixed',
  question_order_mode: 'EXACT',
}]

// ── Question + Choice data ────────────────────────────────────────────────────
// Each entry: [ lyric, song_title, artist, [choice1, choice2, choice3], correctIndex (0-based) ]
const RAW = [
  ["We could have had it all",                                         "Rolling in the Deep",      "Adele",               ["Someone Like You","Set Fire to the Rain","Rolling in the Deep"], 2],
  ["Now you're just somebody that I used to know",                     "Somebody That I Used To Know","Gotye",            ["Somebody That I Used To Know","Take Me to Church","Pumped Up Kicks"], 0],
  ["Hey, I just met you, and this is crazy",                           "Call Me Maybe",            "Carly Rae Jepsen",   ["Teenage Dream","Call Me Maybe","Tik Tok"], 1],
  ["And we'll never be royals",                                        "Royals",                   "Lorde",              ["Team","Bad Guy","Royals"], 2],
  ["I got the eye of the tiger, a fighter",                            "Roar",                     "Katy Perry",         ["Firework","Roar","Stronger"], 1],
  ["Clap along if you feel like a room without a roof",                "Happy",                    "Pharrell Williams",  ["Uptown Funk","Can't Stop the Feeling!","Happy"], 2],
  ["I'm gonna swing from the chandelier",                              "Chandelier",               "Sia",                ["Titanium","Elastic Heart","Chandelier"], 2],
  ["'Cause the players gonna play, play, play, play, play",            "Shake It Off",             "Taylor Swift",       ["Blank Space","Shake It Off","Roar"], 1],
  ["Uptown funk you up, uptown funk you up",                           "Uptown Funk",              "Mark Ronson ft. Bruno Mars", ["24K Magic","Uptown Funk","Blurred Lines"], 1],
  ["Is it too late now to say sorry?",                                 "Sorry",                    "Justin Bieber",      ["Love Yourself","What Do You Mean?","Sorry"], 2],
  ["Strawberry champagne on ice",                                      "That's What I Like",       "Bruno Mars",         ["That's What I Like","Treasure","Watermelon Sugar"], 0],
  ["I'm a m*********in' starboy",                                      "Starboy",                  "The Weeknd",         ["The Hills","Blinding Lights","Starboy"], 2],
  ["I'm in love with the shape of you",                                "Shape of You",             "Ed Sheeran",         ["Thinking Out Loud","Perfect","Shape of You"], 2],
  ["We were just kids when we fell in love",                           "Perfect",                  "Ed Sheeran",         ["A Thousand Years","Photograph","Perfect"], 2],
  ["'Cause girls like you run 'round with guys like me",               "Girls Like You",           "Maroon 5",           ["Sugar","Payphone","Girls Like You"], 2],
  ["One taught me love, one taught me patience",                       "thank u, next",            "Ariana Grande",      ["7 rings","no tears left to cry","thank u, next"], 2],
  ["Yeah, I'm gonna take my horse to the old town road",               "Old Town Road",            "Lil Nas X",          ["Rockstar","Sunflower","Old Town Road"], 2],
  ["So you're a tough guy, like it really rough guy",                  "bad guy",                  "Billie Eilish",      ["bury a friend","royals","bad guy"], 2],
  ["Did a full 180, crazy",                                            "Don't Start Now",          "Dua Lipa",           ["New Rules","Physical","Don't Start Now"], 2],
  ["I said, ooh, I'm blinded by the lights",                          "Blinding Lights",          "The Weeknd",         ["Save Your Tears","Starboy","Blinding Lights"], 2],
  ["Didn't even notice, no punches left to roll with",                 "Say So",                   "Doja Cat",           ["Kiss Me More","Woman","Say So"], 2],
  ["I got you, moonlight, you're my starlight",                        "Levitating",               "Dua Lipa",           ["Dance The Night","Break My Heart","Levitating"], 2],
  ["Sometimes, all I think about is you",                              "Heat Waves",               "Glass Animals",      ["As It Was","Stressed Out","Heat Waves"], 2],
  ["'Cause you said forever, now I drive alone past your street",      "drivers license",          "Olivia Rodrigo",     ["good 4 u","deja vu","drivers license"], 2],
  ["I do the same thing I told you that I never would",                "STAY",                     "The Kid LAROI ft. Justin Bieber", ["Peaches","Without You","STAY"], 2],
  ["You know it's not the same as it was",                            "As It Was",                "Harry Styles",       ["Watermelon Sugar","Late Night Talking","As It Was"], 2],
  ["It's me, hi, I'm the problem, it's me",                           "Anti-Hero",                "Taylor Swift",       ["Blank Space","Cruel Summer","Anti-Hero"], 2],
  ["I can buy myself flowers",                                         "Flowers",                  "Miley Cyrus",        ["Wrecking Ball","Vampire","Flowers"], 2],
  ["Please stay, I want you, I need you, oh, God",                     "Beautiful Things",         "Benson Boone",       ["Lose Control","Stick Season","Beautiful Things"], 2],
  ["I'm working late 'cause I'm a singer",                            "Espresso",                 "Sabrina Carpenter",  ["Feather","Nonsense","Espresso"], 2],
]

const questions = []
const choices   = []

RAW.forEach(([lyric, song, artist, opts, correctIdx], i) => {
  const n       = i + 1
  const qKey    = `psq-${n}`
  const cKey    = `${qKey}-${String.fromCharCode(97 + correctIdx)}` // a/b/c

  questions.push({
    game_key:         'pop-song-trivia',
    round_key:        'pop-round',
    question_key:     qKey,
    question_number:  n,
    game_type:        'NAME_THE_SONG',
    prompt:           'Which song contains this lyric?',
    lyric_excerpt:    lyric,
    song_title:       song,
    artist:           artist,
    image_path:       '',
    category:         'Pop Music',
    subcategory:      '',
    difficulty:       'Medium',
    duration_seconds: 20,
    correct_choice_key: cKey,
    is_tiebreaker:    'FALSE',
    active:           'TRUE',
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
  // No images needed for NAME_THE_SONG

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const outPath = path.join(outDir, 'pop-song-trivia.zip')
  fs.writeFileSync(outPath, content)
  console.log(`✅  Written: ${outPath}`)
  console.log(`    ${questions.length} questions, ${choices.length} choices, 0 images`)
}

main().catch(err => { console.error(err); process.exit(1) })
