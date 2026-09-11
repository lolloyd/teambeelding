import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import type { Game, GameType, Choice } from '@/types'

// HTML Entity decoder for Open Trivia DB response strings
function decodeHTMLEntities(str: string): string {
  const txt = document.createElement('textarea')
  txt.innerHTML = str
  return txt.value
}

interface OpenTDBQuestion {
  category: string
  type: string
  difficulty: string
  question: string
  correct_answer: string
  incorrect_answers: string[]
}

interface DeckQuestion {
  questionId?: string
  gameType: GameType
  prompt: string
  choices: Choice[]
  correctChoiceKey: string
  durationSeconds: number
  isTiebreaker: boolean
  lyricExcerpt?: string | null
  songTitle?: string | null
  artist?: string | null
  imageStorageUrl?: string | null
  category?: string | null
  difficulty?: string | null
}

const OPEN_TRIVIA_CATEGORIES = [
  { id: '', name: 'Any Category' },
  { id: '9', name: 'General Knowledge' },
  { id: '10', name: 'Entertainment: Books' },
  { id: '11', name: 'Entertainment: Film' },
  { id: '12', name: 'Entertainment: Music' },
  { id: '14', name: 'Entertainment: Television' },
  { id: '15', name: 'Entertainment: Video Games' },
  { id: '17', name: 'Science & Nature' },
  { id: '18', name: 'Science: Computers' },
  { id: '21', name: 'Sports' },
  { id: '22', name: 'Geography' },
  { id: '23', name: 'History' },
  { id: '27', name: 'Animals' },
]

export function HostGameSelection() {
  const { user, signInAnon, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [publishedGames, setPublishedGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [creating, setCreating] = useState(false)

  // Active Modal Tab: 'opentdb' | 'import' | 'sample'
  const [activeTab, setActiveTab] = useState<'opentdb' | 'import' | 'sample'>('opentdb')

  // OpenTDB form state
  const [otdbCategory, setOtdbCategory] = useState('')
  const [otdbDifficulty, setOtdbDifficulty] = useState('')
  const [otdbAmount, setOtdbAmount] = useState('10')
  const [otdbType, setOtdbType] = useState('multiple')
  const [fetchingOtdb, setFetchingOtdb] = useState(false)

  // Import / Paste form state
  const [pastedJson, setPastedJson] = useState('')
  const [importing, setImporting] = useState(false)

  // Ensure anonymous auth
  useEffect(() => {
    if (!authLoading && !user) void signInAnon()
  }, [authLoading, user, signInAnon])

  // Load published games
  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('published', '==', true),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      snap => {
        const gs = snap.docs.map(d => {
          const data = d.data() as Record<string, unknown>
          return {
            gameId: d.id,
            gameKey: String(data.gameKey ?? ''),
            title: String(data.title ?? ''),
            description: data.description ? String(data.description) : undefined,
            estimatedDurationMinutes: data.estimatedDurationMinutes ? Number(data.estimatedDurationMinutes) : undefined,
            questionOrderMode: (data.questionOrderMode as 'EXACT' | 'RANDOM') ?? 'EXACT',
            defaultDurationSeconds: Number(data.defaultDurationSeconds ?? 15),
            incorrectPenaltyPoints: Number(data.incorrectPenaltyPoints ?? 0),
            published: true,
            createdAt: Number(data.createdAt ?? 0),
            updatedAt: Number(data.updatedAt ?? 0),
            roundCount: Number(data.roundCount ?? 0),
            questionCount: Number(data.questionCount ?? 0),
            tiebreakerCount: Number(data.tiebreakerCount ?? 0),
            gameTypes: (data.gameTypes as Game['gameTypes']) ?? [],
            categories: (data.categories as string[]) ?? [],
            difficulties: (data.difficulties as string[]) ?? [],
          } as Game
        })
        setPublishedGames(gs)
        setLoadingGames(false)
      },
      () => {
        setLoadingGames(false)
      }
    )
    return unsub
  }, [])

  // Create room from custom question list
  const handleCreateRoomFromQuestions = async (title: string, description: string, questions: DeckQuestion[]) => {
    if (!user) return
    setCreating(true)
    try {
      const fn = httpsCallable<
        { title: string; description?: string; questions: DeckQuestion[] },
        { roomId: string; roomCode: string }
      >(functions, 'createRoomFromDeck')

      const result = await fn({ title, description, questions })
      const { roomCode } = result.data
      localStorage.setItem('tb_active_room', roomCode)
      navigate(`/host/${roomCode}`)
    } catch (e: unknown) {
      toast((e as { message?: string }).message ?? 'Failed to create room.', 'error')
    } finally {
      setCreating(false)
    }
  }

  // Fetch Open Trivia DB Deck
  const handleFetchOpenTDB = async () => {
    setFetchingOtdb(true)
    try {
      let url = `https://opentdb.com/api.php?amount=${otdbAmount}`
      if (otdbCategory) url += `&category=${otdbCategory}`
      if (otdbDifficulty) url += `&difficulty=${otdbDifficulty}`
      if (otdbType) url += `&type=${otdbType}`

      const res = await fetch(url)
      const data = (await res.json()) as { response_code: number; results: OpenTDBQuestion[] }

      if (data.response_code !== 0 || !data.results || data.results.length === 0) {
        toast('No questions returned from Open Trivia DB. Try changing criteria.', 'error')
        setFetchingOtdb(false)
        return
      }

      const questions: DeckQuestion[] = data.results.map((q, idx) => {
        const prompt = decodeHTMLEntities(q.question)
        const correctText = decodeHTMLEntities(q.correct_answer)
        const incorrectTexts = q.incorrect_answers.map(decodeHTMLEntities)

        const allAnswerTexts = [correctText, ...incorrectTexts]
        // Shuffle choices
        const shuffled = [...allAnswerTexts].sort(() => Math.random() - 0.5)

        const choices: Choice[] = shuffled.map((txt, orderIdx) => ({
          choiceKey: `choice_${orderIdx + 1}`,
          choiceOrder: (orderIdx + 1) as 1 | 2 | 3,
          choiceText: txt,
        }))

        const correctChoice = choices.find(c => c.choiceText === correctText)

        return {
          questionId: `otdb_${idx}`,
          gameType: 'NAME_THE_SONG',
          prompt,
          choices,
          correctChoiceKey: correctChoice ? correctChoice.choiceKey : choices[0].choiceKey,
          durationSeconds: 15,
          isTiebreaker: false,
          category: decodeHTMLEntities(q.category),
          difficulty: q.difficulty,
        }
      })

      const catObj = OPEN_TRIVIA_CATEGORIES.find(c => c.id === otdbCategory)
      const deckTitle = `OpenTB: ${catObj ? catObj.name : 'Trivia'}`

      await handleCreateRoomFromQuestions(deckTitle, `${questions.length} Questions deck from Open Trivia DB`, questions)
    } catch {
      toast('Failed to fetch from Open Trivia DB. Check your connection.', 'error')
    } finally {
      setFetchingOtdb(false)
    }
  }

  // Handle pasted JSON deck
  const handlePasteDeck = async () => {
    if (!pastedJson.trim()) {
      toast('Please paste JSON deck content.', 'error')
      return
    }
    setImporting(true)
    try {
      const parsed = JSON.parse(pastedJson)
      const title = parsed.title || 'Custom Imported Deck'
      const description = parsed.description || 'Imported via paste'
      const questionsRaw = parsed.questions || parsed

      if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) {
        throw new Error('Invalid JSON format. Expected an array of questions or deck object.')
      }

      const questions: DeckQuestion[] = questionsRaw.map((q, i) => ({
        questionId: q.questionId || `pasted_${i}`,
        gameType: q.gameType || 'NAME_THE_SONG',
        prompt: q.prompt || q.question || 'Trivia Question',
        choices: q.choices || [
          { choiceKey: 'c1', choiceOrder: 1, choiceText: q.option1 || 'Option 1' },
          { choiceKey: 'c2', choiceOrder: 2, choiceText: q.option2 || 'Option 2' },
          { choiceKey: 'c3', choiceOrder: 3, choiceText: q.option3 || 'Option 3' },
        ],
        correctChoiceKey: q.correctChoiceKey || 'c1',
        durationSeconds: q.durationSeconds || 15,
        isTiebreaker: !!q.isTiebreaker,
        imageStorageUrl: q.imageStorageUrl || q.imageUrl || null,
        lyricExcerpt: q.lyricExcerpt || null,
      }))

      await handleCreateRoomFromQuestions(title, description, questions)
    } catch (e: unknown) {
      toast((e as Error).message || 'Failed to parse JSON deck.', 'error')
    } finally {
      setImporting(false)
    }
  }

  // Sample Decks
  const handleLoadSampleDeck = async (sampleType: 'pop' | 'teambuilding' | 'pictures') => {
    if (sampleType === 'pop') {
      const questions: DeckQuestion[] = [
        {
          gameType: 'NAME_THE_SONG',
          prompt: 'Which 2010 hit song features these lyrics?',
          lyricExcerpt: "Just a small town girl, livin' in a lonely world...",
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: "Don't Stop Believin' - Journey" },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'Livin on a Prayer - Bon Jovi' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'Eye of the Tiger - Survivor' },
          ],
          correctChoiceKey: 'c1',
          durationSeconds: 15,
          isTiebreaker: false,
        },
        {
          gameType: 'NAME_THE_SONG',
          prompt: 'Identify this iconic anthem:',
          lyricExcerpt: "Cause baby you're a firework, come on show 'em what you're worth...",
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: 'Roar - Katy Perry' },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'Firework - Katy Perry' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'Halo - Beyoncé' },
          ],
          correctChoiceKey: 'c2',
          durationSeconds: 15,
          isTiebreaker: false,
        },
        {
          gameType: 'NAME_THE_SONG',
          prompt: 'Name the song and artist:',
          lyricExcerpt: "I'm on the right track baby, I was born this way!",
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: 'Poker Face - Lady Gaga' },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'Born This Way - Lady Gaga' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'Bad Romance - Lady Gaga' },
          ],
          correctChoiceKey: 'c2',
          durationSeconds: 15,
          isTiebreaker: false,
        },
      ]
      await handleCreateRoomFromQuestions('Pop Song Trivia', 'Guess the song title & artist from lyrics!', questions)
    } else if (sampleType === 'teambuilding') {
      const questions: DeckQuestion[] = [
        {
          gameType: 'NAME_THE_SONG',
          prompt: 'What was the first domain name ever registered on the internet?',
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: 'symbolics.com' },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'google.com' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'microsoft.com' },
          ],
          correctChoiceKey: 'c1',
          durationSeconds: 15,
          isTiebreaker: false,
        },
        {
          gameType: 'NAME_THE_SONG',
          prompt: 'Which country invented coffee?',
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: 'Brazil' },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'Ethiopia' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'Italy' },
          ],
          correctChoiceKey: 'c2',
          durationSeconds: 15,
          isTiebreaker: false,
        },
      ]
      await handleCreateRoomFromQuestions('Team Icebreaker Quiz', 'Fun trivia questions for company watercooler sessions!', questions)
    } else if (sampleType === 'pictures') {
      const questions: DeckQuestion[] = [
        {
          gameType: 'GUESS_THE_PICTURE',
          prompt: 'Which famous world landmark is shown below?',
          imageStorageUrl: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=600&auto=format&fit=crop',
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: 'Eiffel Tower (Paris)' },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'Tokyo Tower (Tokyo)' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'Blackpool Tower (UK)' },
          ],
          correctChoiceKey: 'c1',
          durationSeconds: 15,
          isTiebreaker: false,
        },
        {
          gameType: 'GUESS_THE_PICTURE',
          prompt: 'Name this natural wonder of the world:',
          imageStorageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop',
          choices: [
            { choiceKey: 'c1', choiceOrder: 1, choiceText: 'Grand Canyon' },
            { choiceKey: 'c2', choiceOrder: 2, choiceText: 'Yosemite Valley' },
            { choiceKey: 'c3', choiceOrder: 3, choiceText: 'Zion National Park' },
          ],
          correctChoiceKey: 'c1',
          durationSeconds: 15,
          isTiebreaker: false,
        },
      ]
      await handleCreateRoomFromQuestions('Picture Recognition Deck', 'Identify landmarks and pictures!', questions)
    }
  }

  if (authLoading || loadingGames) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_50%_20%,_var(--surface)_0%,_var(--bg)_70%)] px-4 py-8 flex flex-col items-center">
      {/* Page Title */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black">
          <span className="text-[var(--text)]">Team</span>
          <span className="text-[var(--accent)]">BEElding</span>
        </h1>
        <p className="text-[var(--text2)] mt-1 text-sm sm:text-base">Host a live game session for your team</p>
      </div>

      {/* Main Deck Container (Matches design from provided image) */}
      <div className="w-full max-w-2xl bg-[#181a24] border border-[#2a2d3d] rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block transform -rotate-6"></span>
              <span className="w-3 h-3 rounded-sm bg-pink-500 inline-block transform rotate-6"></span>
              <span className="w-3 h-3 rounded-sm bg-cyan-400 inline-block"></span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Trivia & Question Deck</h2>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2e3245] mb-6">
          <button
            onClick={() => setActiveTab('opentdb')}
            className={`pb-3 px-4 font-bold text-sm transition-all relative ${
              activeTab === 'opentdb' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Open Trivia DB
            {activeTab === 'opentdb' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 px-4 font-bold text-sm transition-all relative ${
              activeTab === 'import' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Import / Paste
            {activeTab === 'import' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab('sample')}
            className={`pb-3 px-4 font-bold text-sm transition-all relative ${
              activeTab === 'sample' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sample Decks
            {activeTab === 'sample' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>
        </div>

        {/* Tab 1: Open Trivia DB */}
        {activeTab === 'opentdb' && (
          <div className="flex flex-col gap-5">
            <p className="text-xs sm:text-sm text-slate-400">
              Fetch questions directly from the Open Trivia Database API (free, instant, no key needed).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">CATEGORY</label>
                <select
                  value={otdbCategory}
                  onChange={e => setOtdbCategory(e.target.value)}
                  className="w-full bg-[#222536] border border-[#33374d] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {OPEN_TRIVIA_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">DIFFICULTY</label>
                <select
                  value={otdbDifficulty}
                  onChange={e => setOtdbDifficulty(e.target.value)}
                  className="w-full bg-[#222536] border border-[#33374d] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Any Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">NUMBER OF QUESTIONS</label>
                <select
                  value={otdbAmount}
                  onChange={e => setOtdbAmount(e.target.value)}
                  className="w-full bg-[#222536] border border-[#33374d] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="5">5 Questions</option>
                  <option value="10">10 Questions</option>
                  <option value="15">15 Questions</option>
                  <option value="20">20 Questions</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">TYPE</label>
                <select
                  value={otdbType}
                  onChange={e => setOtdbType(e.target.value)}
                  className="w-full bg-[#222536] border border-[#33374d] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="multiple">Multiple Choice only</option>
                  <option value="">Any Type</option>
                  <option value="boolean">True / False</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => void handleFetchOpenTDB()}
              disabled={fetchingOtdb || creating}
              className="mt-2 w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {fetchingOtdb || creating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-yellow-300">⚡</span> Fetch & Load Deck
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Import / Paste */}
        {activeTab === 'import' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs sm:text-sm text-slate-400">Paste a JSON question deck structure below to load instantly.</p>
            <textarea
              rows={6}
              value={pastedJson}
              onChange={e => setPastedJson(e.target.value)}
              placeholder='{"title": "Custom Trivia", "questions": [{"prompt": "What is 2+2?", "choices": [{"choiceKey":"c1","choiceOrder":1,"choiceText":"4"}]}]}'
              className="w-full bg-[#222536] border border-[#33374d] rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <Button variant="primary" size="lg" fullWidth onClick={() => void handlePasteDeck()} loading={importing || creating}>
              📥 Parse & Load Deck
            </Button>
          </div>
        )}

        {/* Tab 3: Sample Decks */}
        {activeTab === 'sample' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs sm:text-sm text-slate-400 mb-1">Select a pre-built sample deck ready to host:</p>
            <Card
              hoverable
              onClick={() => void handleLoadSampleDeck('pop')}
              className="bg-[#222536] border-[#33374d] text-slate-100 hover:border-indigo-500 transition-all p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">🎵 Pop Song Trivia</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Guess the song title & artist from lyric excerpts</p>
                </div>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-semibold">3 Questions</span>
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => void handleLoadSampleDeck('teambuilding')}
              className="bg-[#222536] border-[#33374d] text-slate-100 hover:border-indigo-500 transition-all p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">🤝 Team Icebreaker Deck</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Fun watercooler trivia questions for online team sessions</p>
                </div>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-semibold">2 Questions</span>
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => void handleLoadSampleDeck('pictures')}
              className="bg-[#222536] border-[#33374d] text-slate-100 hover:border-indigo-500 transition-all p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">🖼️ Picture Recognition Deck</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Visual image trivia identifying famous world landmarks</p>
                </div>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-semibold">2 Questions</span>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Published games fallback list if any exist */}
      {publishedGames.length > 0 && (
        <div className="w-full max-w-2xl mt-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text2)] mb-3">Or choose a pre-published game</h3>
          <div className="grid gap-3">
            {publishedGames.map(g => (
              <Card
                key={g.gameId}
                hoverable
                onClick={() =>
                  void handleCreateRoomFromQuestions(
                    g.title,
                    g.description || '',
                    []
                  )
                }
                className="flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">{g.title}</div>
                  <div className="text-xs text-[var(--text2)]">{g.questionCount} questions</div>
                </div>
                <Button size="sm" variant="secondary">
                  Host
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
