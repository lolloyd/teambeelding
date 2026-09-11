import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, doc, getDoc, orderBy, query } from 'firebase/firestore'
import { db as firestoreDb, functions } from '@/lib/firebase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { GameType, QuestionOrderMode } from '@/types'

// ── Draft types ───────────────────────────────────────────────────────────────

type ChoiceDraft = {
  choiceKey: string
  choiceOrder: 1 | 2 | 3
  choiceText: string
}

type QuestionDraft = {
  _id: string
  questionKey: string
  questionNumber: number
  gameType: GameType
  prompt: string
  lyricExcerpt: string
  songTitle: string
  artist: string
  imageStorageUrl: string
  imagePath: string
  category: string
  difficulty: string
  durationSeconds: number
  correctChoiceKey: string
  isTiebreaker: boolean
  active: boolean
  choices: ChoiceDraft[]
}

type RoundDraft = {
  _id: string
  roundKey: string
  roundNumber: number
  title: string
  gameType: GameType
  questionOrderMode: QuestionOrderMode
  questions: QuestionDraft[]
}

type GameDraft = {
  gameId: string | null
  gameKey: string
  title: string
  description: string
  estimatedDurationMinutes: string
  questionOrderMode: QuestionOrderMode
  defaultDurationSeconds: number
  incorrectPenaltyPoints: number
  rounds: RoundDraft[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _seq = 0
const tempId = () => `t${++_seq}_${Math.random().toString(36).slice(2, 6)}`

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'quiz'
  )
}

function makeChoices(): ChoiceDraft[] {
  return [
    { choiceKey: 'a', choiceOrder: 1, choiceText: '' },
    { choiceKey: 'b', choiceOrder: 2, choiceText: '' },
    { choiceKey: 'c', choiceOrder: 3, choiceText: '' },
  ]
}

function makeQuestion(roundGameType: GameType): QuestionDraft {
  return {
    _id: tempId(),
    questionKey: tempId(),
    questionNumber: 0,
    gameType: roundGameType,
    prompt: '',
    lyricExcerpt: '',
    songTitle: '',
    artist: '',
    imageStorageUrl: '',
    imagePath: '',
    category: '',
    difficulty: '',
    durationSeconds: 15,
    correctChoiceKey: 'a',
    isTiebreaker: false,
    active: true,
    choices: makeChoices(),
  }
}

function makeRound(n: number): RoundDraft {
  return {
    _id: tempId(),
    roundKey: tempId(),
    roundNumber: n,
    title: `Round ${n}`,
    gameType: 'NAME_THE_SONG',
    questionOrderMode: 'EXACT',
    questions: [],
  }
}

const BLANK_DRAFT: GameDraft = {
  gameId: null,
  gameKey: '',
  title: '',
  description: '',
  estimatedDurationMinutes: '',
  questionOrderMode: 'EXACT',
  defaultDurationSeconds: 15,
  incorrectPenaltyPoints: 0,
  rounds: [],
}

// ── AdminGameEditor ───────────────────────────────────────────────────────────

export function AdminGameEditor() {
  const { gameId } = useParams<{ gameId?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isEdit = !!gameId && gameId !== 'new'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<GameDraft>({ ...BLANK_DRAFT })
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())
  const [qModal, setQModal] = useState<{ roundId: string; question: QuestionDraft | null } | null>(null)
  const keyEditedRef = useRef(false)

  // Load existing game for editing
  useEffect(() => {
    if (!isEdit || !gameId) return

    const load = async () => {
      try {
        const gameSnap = await getDoc(doc(firestoreDb, 'games', gameId))
        if (!gameSnap.exists()) {
          toast('Game not found.', 'error')
          navigate('/admin/games')
          return
        }
        const g = gameSnap.data()

        const roundsSnap = await getDocs(
          query(collection(firestoreDb, 'games', gameId, 'rounds'), orderBy('roundNumber', 'asc'))
        )

        const rounds: RoundDraft[] = await Promise.all(
          roundsSnap.docs.map(async roundDoc => {
            const r = roundDoc.data()
            const qSnap = await getDocs(
              query(
                collection(firestoreDb, 'games', gameId, 'rounds', roundDoc.id, 'questions'),
                orderBy('questionNumber', 'asc')
              )
            )
            const questions: QuestionDraft[] = qSnap.docs.map(qd => {
              const q = qd.data()
              return {
                _id: tempId(),
                questionKey:     String(q.questionKey ?? qd.id),
                questionNumber:  Number(q.questionNumber ?? 0),
                gameType:        (q.gameType as GameType) ?? 'NAME_THE_SONG',
                prompt:          String(q.prompt ?? ''),
                lyricExcerpt:    String(q.lyricExcerpt ?? ''),
                songTitle:       String(q.songTitle ?? ''),
                artist:          String(q.artist ?? ''),
                imageStorageUrl: String(q.imageStorageUrl ?? ''),
                imagePath:       String(q.imagePath ?? ''),
                category:        String(q.category ?? ''),
                difficulty:      String(q.difficulty ?? ''),
                durationSeconds: Number(q.durationSeconds ?? 15),
                correctChoiceKey: String(q.correctChoiceKey ?? 'a'),
                isTiebreaker:    Boolean(q.isTiebreaker),
                active:          q.active !== false,
                choices:         (q.choices as ChoiceDraft[]) ?? makeChoices(),
              }
            })
            return {
              _id:               tempId(),
              roundKey:          String(r.roundKey ?? roundDoc.id),
              roundNumber:       Number(r.roundNumber ?? 0),
              title:             String(r.title ?? ''),
              gameType:          (r.gameType as GameType) ?? 'NAME_THE_SONG',
              questionOrderMode: (r.questionOrderMode as QuestionOrderMode) ?? 'EXACT',
              questions,
            }
          })
        )

        setDraft({
          gameId,
          gameKey:                   String(g.gameKey ?? ''),
          title:                     String(g.title ?? ''),
          description:               String(g.description ?? ''),
          estimatedDurationMinutes:  g.estimatedDurationMinutes ? String(g.estimatedDurationMinutes) : '',
          questionOrderMode:         (g.questionOrderMode as QuestionOrderMode) ?? 'EXACT',
          defaultDurationSeconds:    Number(g.defaultDurationSeconds ?? 15),
          incorrectPenaltyPoints:    Number(g.incorrectPenaltyPoints ?? 0),
          rounds,
        })
        keyEditedRef.current = true
        setExpandedRounds(new Set(rounds.map(r => r._id)))
      } catch {
        toast('Failed to load game.', 'error')
        navigate('/admin/games')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [gameId, isEdit, navigate, toast])

  // ── Draft mutations ──────────────────────────────────────────────────────

  const setG = (updates: Partial<GameDraft>) => setDraft(d => ({ ...d, ...updates }))

  const handleTitleChange = (title: string) => {
    if (!keyEditedRef.current) {
      setDraft(d => ({ ...d, title, gameKey: slugify(title) }))
    } else {
      setDraft(d => ({ ...d, title }))
    }
  }

  const handleKeyChange = (raw: string) => {
    keyEditedRef.current = true
    setDraft(d => ({ ...d, gameKey: raw.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
  }

  const addRound = () => {
    const r = makeRound(draft.rounds.length + 1)
    setDraft(d => ({ ...d, rounds: [...d.rounds, r] }))
    setExpandedRounds(prev => new Set([...prev, r._id]))
  }

  const updateRound = (id: string, updates: Partial<Omit<RoundDraft, '_id' | 'questions'>>) => {
    setDraft(d => ({
      ...d,
      rounds: d.rounds.map(r => r._id === id ? { ...r, ...updates } : r),
    }))
  }

  const deleteRound = (id: string) => {
    setDraft(d => ({
      ...d,
      rounds: d.rounds
        .filter(r => r._id !== id)
        .map((r, i) => ({ ...r, roundNumber: i + 1 })),
    }))
  }

  const saveQuestion = (roundId: string, q: QuestionDraft) => {
    setDraft(d => ({
      ...d,
      rounds: d.rounds.map(r => {
        if (r._id !== roundId) return r
        const exists = r.questions.some(eq => eq._id === q._id)
        const questions = exists
          ? r.questions.map(eq => eq._id === q._id ? q : eq)
          : [...r.questions, { ...q, questionNumber: r.questions.length + 1 }]
        return { ...r, questions }
      }),
    }))
    setQModal(null)
  }

  const deleteQuestion = (roundId: string, qId: string) => {
    setDraft(d => ({
      ...d,
      rounds: d.rounds.map(r => {
        if (r._id !== roundId) return r
        return {
          ...r,
          questions: r.questions
            .filter(q => q._id !== qId)
            .map((q, i) => ({ ...q, questionNumber: i + 1 })),
        }
      }),
    }))
  }

  // ── Validation ───────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!draft.title.trim()) return 'Game title is required.'
    if (!draft.gameKey.trim()) return 'Game key is required.'
    if (!/^[a-z0-9-]+$/.test(draft.gameKey)) return 'Game key must contain only lowercase letters, numbers, and hyphens.'
    if (draft.rounds.length === 0) return 'Add at least one round.'
    for (const r of draft.rounds) {
      if (!r.title.trim()) return `Round ${r.roundNumber} needs a title.`
      for (const q of r.questions) {
        if (!q.prompt.trim()) return `Round "${r.title}", Q${q.questionNumber}: prompt is required.`
        if (q.gameType === 'NAME_THE_SONG') {
          if (!q.lyricExcerpt.trim()) return `Round "${r.title}", Q${q.questionNumber}: lyric excerpt is required.`
          if (!q.songTitle.trim()) return `Round "${r.title}", Q${q.questionNumber}: song title is required.`
          if (!q.artist.trim()) return `Round "${r.title}", Q${q.questionNumber}: artist is required.`
        }
        if (q.gameType === 'GUESS_THE_PICTURE' && !q.imageStorageUrl.trim() && !q.imagePath.trim()) {
          return `Round "${r.title}", Q${q.questionNumber}: image URL is required.`
        }
        if (q.choices.some(c => !c.choiceText.trim())) {
          return `Round "${r.title}", Q${q.questionNumber}: all three choices must have text.`
        }
        if (!q.choices.some(c => c.choiceKey === q.correctChoiceKey)) {
          return `Round "${r.title}", Q${q.questionNumber}: select the correct answer.`
        }
      }
    }
    return null
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const err = validate()
    if (err) { toast(err, 'error'); return }

    setSaving(true)
    try {
      const payload = {
        gameId:                   draft.gameId,
        gameKey:                  draft.gameKey,
        title:                    draft.title.trim(),
        description:              draft.description.trim() || null,
        estimatedDurationMinutes: draft.estimatedDurationMinutes ? Number(draft.estimatedDurationMinutes) : null,
        questionOrderMode:        draft.questionOrderMode,
        defaultDurationSeconds:   draft.defaultDurationSeconds,
        incorrectPenaltyPoints:   draft.incorrectPenaltyPoints,
        rounds: draft.rounds.map(r => ({
          roundKey:          r.roundKey,
          roundNumber:       r.roundNumber,
          title:             r.title.trim(),
          description:       null,
          gameType:          r.gameType,
          category:          null,
          subcategory:       null,
          difficulty:        null,
          questionOrderMode: r.questionOrderMode,
          questions: r.questions.map(q => ({
            questionKey:      q.questionKey,
            questionNumber:   q.questionNumber,
            gameType:         q.gameType,
            prompt:           q.prompt.trim(),
            lyricExcerpt:     q.lyricExcerpt.trim() || null,
            songTitle:        q.songTitle.trim() || null,
            artist:           q.artist.trim() || null,
            imagePath:        q.imagePath.trim() || null,
            imageStorageUrl:  q.imageStorageUrl.trim() || null,
            category:         q.category.trim() || null,
            subcategory:      null,
            difficulty:       q.difficulty.trim() || null,
            durationSeconds:  q.durationSeconds,
            correctChoiceKey: q.correctChoiceKey,
            isTiebreaker:     q.isTiebreaker,
            active:           q.active,
            choices:          q.choices,
          })),
        })),
      }

      const fn = httpsCallable<unknown, { gameId: string }>(functions, 'saveGame')
      await fn(payload)
      toast(isEdit ? 'Quiz updated!' : 'Quiz created!', 'success')
      navigate('/admin/games')
    } catch (e: unknown) {
      toast((e as { message?: string }).message ?? 'Save failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    )
  }

  const totalQuestions = draft.rounds.reduce((s, r) => s + r.questions.length, 0)

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/games')}>← Back</Button>
        <h1 className="text-2xl font-bold text-[var(--text)] flex-1">
          {isEdit ? 'Edit Quiz' : 'Create Quiz'}
        </h1>
        <span className="text-sm text-[var(--text2)]">
          {draft.rounds.length} round{draft.rounds.length !== 1 ? 's' : ''} · {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
        </span>
        <Button onClick={() => void handleSave()} loading={saving}>
          {isEdit ? 'Save Changes' : 'Save Quiz'}
        </Button>
      </div>

      {/* Game settings */}
      <Card className="mb-6">
        <h2 className="text-base font-bold text-[var(--text)] mb-4">Game Settings</h2>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_200px] gap-3 items-end">
            <Input
              id="game-title"
              label="Title *"
              value={draft.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g. Pop Music Trivia"
            />
            <Input
              id="game-key"
              label="Game Key *"
              value={draft.gameKey}
              onChange={e => handleKeyChange(e.target.value)}
              placeholder="pop-music-trivia"
              className="font-mono text-sm"
              hint="Lowercase letters, numbers, hyphens"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">
              Description
            </label>
            <textarea
              value={draft.description}
              onChange={e => setG({ description: e.target.value })}
              placeholder="Short description (optional)"
              rows={2}
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] text-base outline-none transition-colors duration-150 placeholder:text-[var(--text2)] focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">
                Question Order
              </label>
              <select
                value={draft.questionOrderMode}
                onChange={e => setG({ questionOrderMode: e.target.value as QuestionOrderMode })}
                className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] text-base outline-none focus:border-[var(--accent)]"
              >
                <option value="EXACT">Exact Order</option>
                <option value="RANDOM">Random</option>
              </select>
            </div>
            <Input
              id="default-duration"
              label="Default Duration (sec)"
              type="number"
              min={5}
              max={120}
              value={draft.defaultDurationSeconds}
              onChange={e => setG({ defaultDurationSeconds: Number(e.target.value) })}
            />
            <Input
              id="penalty"
              label="Penalty Points"
              type="number"
              min={0}
              value={draft.incorrectPenaltyPoints}
              onChange={e => setG({ incorrectPenaltyPoints: Number(e.target.value) })}
            />
            <Input
              id="est-duration"
              label="Est. Duration (min)"
              type="number"
              min={1}
              value={draft.estimatedDurationMinutes}
              onChange={e => setG({ estimatedDurationMinutes: e.target.value })}
              placeholder="—"
            />
          </div>
        </div>
      </Card>

      {/* Rounds */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[var(--text)]">Rounds</h2>
        <Button variant="secondary" size="sm" onClick={addRound}>+ Add Round</Button>
      </div>

      {draft.rounds.length === 0 ? (
        <Card className="text-center py-12 mb-6">
          <p className="text-[var(--text2)] mb-4">No rounds yet. Add your first round to get started.</p>
          <Button onClick={addRound}>+ Add Round</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {draft.rounds.map(round => (
            <RoundSection
              key={round._id}
              round={round}
              expanded={expandedRounds.has(round._id)}
              onToggle={() =>
                setExpandedRounds(prev => {
                  const next = new Set(prev)
                  next.has(round._id) ? next.delete(round._id) : next.add(round._id)
                  return next
                })
              }
              onUpdate={updates => updateRound(round._id, updates)}
              onDelete={() => deleteRound(round._id)}
              onAddQuestion={() => setQModal({ roundId: round._id, question: null })}
              onEditQuestion={q => setQModal({ roundId: round._id, question: q })}
              onDeleteQuestion={qId => deleteQuestion(round._id, qId)}
            />
          ))}
          <Button variant="secondary" onClick={addRound} className="self-start">
            + Add Round
          </Button>
        </div>
      )}

      {/* Question editor modal */}
      {qModal && (
        <QuestionModal
          open
          roundGameType={draft.rounds.find(r => r._id === qModal.roundId)?.gameType ?? 'NAME_THE_SONG'}
          initial={qModal.question}
          onSave={q => saveQuestion(qModal.roundId, q)}
          onClose={() => setQModal(null)}
        />
      )}
    </div>
  )
}

// ── RoundSection ──────────────────────────────────────────────────────────────

interface RoundSectionProps {
  round: RoundDraft
  expanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<Omit<RoundDraft, '_id' | 'questions'>>) => void
  onDelete: () => void
  onAddQuestion: () => void
  onEditQuestion: (q: QuestionDraft) => void
  onDeleteQuestion: (qId: string) => void
}

function RoundSection({
  round, expanded, onToggle, onUpdate, onDelete,
  onAddQuestion, onEditQuestion, onDeleteQuestion,
}: RoundSectionProps) {
  return (
    <Card className="p-0 overflow-hidden">
      {/* Round header row */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={onToggle}
          className="text-[var(--text2)] hover:text-[var(--text)] transition-colors text-xs w-4 shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="text-xs font-semibold text-[var(--text2)] w-14 shrink-0">
          Round {round.roundNumber}
        </span>
        <input
          type="text"
          value={round.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Round title"
          className="flex-1 min-w-0 bg-transparent border-b border-[var(--border)] focus:border-[var(--accent)] outline-none text-[var(--text)] font-semibold py-0.5 text-sm"
        />
        <select
          value={round.gameType}
          onChange={e => onUpdate({ gameType: e.target.value as GameType })}
          className="bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] shrink-0"
        >
          <option value="NAME_THE_SONG">🎵 Name the Song</option>
          <option value="GUESS_THE_PICTURE">🖼 Guess the Picture</option>
        </select>
        <select
          value={round.questionOrderMode}
          onChange={e => onUpdate({ questionOrderMode: e.target.value as QuestionOrderMode })}
          className="bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] shrink-0"
        >
          <option value="EXACT">Exact</option>
          <option value="RANDOM">Random</option>
        </select>
        <span className="text-xs text-[var(--text2)] shrink-0">
          {round.questions.length}Q
        </span>
        <button
          onClick={onDelete}
          className="text-[var(--red)] hover:opacity-70 transition-opacity text-sm shrink-0"
          aria-label="Delete round"
        >
          🗑
        </button>
      </div>

      {/* Questions list */}
      {expanded && (
        <div className="border-t border-[var(--border)]">
          {round.questions.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[var(--text2)] text-center">
              No questions yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {round.questions.map(q => (
                <div
                  key={q._id}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--surface2)] transition-colors"
                >
                  <span className="text-xs text-[var(--text2)] w-5 shrink-0 text-center">
                    {q.questionNumber}
                  </span>
                  <span
                    className={[
                      'text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                      q.isTiebreaker
                        ? 'bg-[rgba(250,204,21,.15)] text-yellow-400'
                        : 'bg-[var(--surface2)] text-[var(--text2)]',
                    ].join(' ')}
                  >
                    {q.isTiebreaker ? '⚖ TB' : q.gameType === 'NAME_THE_SONG' ? '🎵' : '🖼'}
                  </span>
                  <span className="flex-1 text-sm text-[var(--text)] truncate min-w-0">
                    {q.prompt || <em className="text-[var(--text2)]">No prompt</em>}
                  </span>
                  <span className="text-xs text-[var(--text2)] shrink-0">{q.durationSeconds}s</span>
                  <button
                    onClick={() => onEditQuestion(q)}
                    className="text-xs text-[var(--accent)] hover:opacity-80 shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteQuestion(q._id)}
                    className="text-xs text-[var(--red)] hover:opacity-80 shrink-0"
                    aria-label="Delete question"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <Button variant="secondary" size="sm" onClick={onAddQuestion}>
              + Add Question
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── QuestionModal ─────────────────────────────────────────────────────────────

interface QuestionModalProps {
  open: boolean
  onClose: () => void
  onSave: (q: QuestionDraft) => void
  initial: QuestionDraft | null
  roundGameType: GameType
}

function QuestionModal({ open, onClose, onSave, initial, roundGameType }: QuestionModalProps) {
  const [q, setQ] = useState<QuestionDraft>(() =>
    initial ? { ...initial, choices: initial.choices.map(c => ({ ...c })) } : makeQuestion(roundGameType)
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQ(initial ? { ...initial, choices: initial.choices.map(c => ({ ...c })) } : makeQuestion(roundGameType))
      setError(null)
    }
  }, [open, initial, roundGameType])

  const upd = (updates: Partial<QuestionDraft>) => setQ(prev => ({ ...prev, ...updates }))

  const updChoice = (idx: number, text: string) =>
    setQ(prev => ({
      ...prev,
      choices: prev.choices.map((c, i) => (i === idx ? { ...c, choiceText: text } : c)),
    }))

  const validate = (): string | null => {
    if (!q.prompt.trim()) return 'Prompt is required.'
    if (q.gameType === 'NAME_THE_SONG') {
      if (!q.lyricExcerpt.trim()) return 'Lyric excerpt is required.'
      if (!q.songTitle.trim()) return 'Song title is required.'
      if (!q.artist.trim()) return 'Artist is required.'
    }
    if (q.gameType === 'GUESS_THE_PICTURE' && !q.imageStorageUrl.trim()) {
      return 'Image URL is required.'
    }
    if (q.choices.some(c => !c.choiceText.trim())) return 'All three choices must have text.'
    if (q.durationSeconds < 5 || q.durationSeconds > 120) return 'Duration must be 5–120 seconds.'
    return null
  }

  const handleSave = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    onSave(q)
  }

  const inputCls =
    'w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] text-sm outline-none transition-colors focus:border-[var(--accent)] placeholder:text-[var(--text2)]'
  const labelCls =
    'text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Question' : 'Add Question'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{initial ? 'Update' : 'Add Question'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto pr-1">
        {/* Validation error banner */}
        {error && (
          <div className="p-3 bg-[rgba(255,70,70,.1)] border border-[var(--red)] rounded-lg text-sm text-[var(--red)]">
            {error}
          </div>
        )}

        {/* Question type toggle */}
        <div>
          <span className={labelCls}>Question Type</span>
          <div className="flex gap-2">
            {(['NAME_THE_SONG', 'GUESS_THE_PICTURE'] as GameType[]).map(type => (
              <button
                key={type}
                onClick={() => upd({ gameType: type })}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                  q.gameType === type
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {type === 'NAME_THE_SONG' ? '🎵 Name the Song' : '🖼 Guess the Picture'}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className={labelCls}>Prompt *</label>
          <textarea
            value={q.prompt}
            onChange={e => upd({ prompt: e.target.value })}
            placeholder="Question prompt shown to players..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* NAME_THE_SONG fields */}
        {q.gameType === 'NAME_THE_SONG' && (
          <>
            <div>
              <label className={labelCls}>
                Lyric Excerpt *{' '}
                <span className="font-normal normal-case tracking-normal">(shown to players)</span>
              </label>
              <textarea
                value={q.lyricExcerpt}
                onChange={e => upd({ lyricExcerpt: e.target.value })}
                placeholder="Paste the lyric lines..."
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Song Title *{' '}
                  <span className="font-normal normal-case tracking-normal">(revealed after)</span>
                </label>
                <input
                  type="text"
                  value={q.songTitle}
                  onChange={e => upd({ songTitle: e.target.value })}
                  placeholder="Song title"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Artist *{' '}
                  <span className="font-normal normal-case tracking-normal">(revealed after)</span>
                </label>
                <input
                  type="text"
                  value={q.artist}
                  onChange={e => upd({ artist: e.target.value })}
                  placeholder="Artist or band name"
                  className={inputCls}
                />
              </div>
            </div>
          </>
        )}

        {/* GUESS_THE_PICTURE fields */}
        {q.gameType === 'GUESS_THE_PICTURE' && (
          <div>
            <label className={labelCls}>
              Image URL *{' '}
              <span className="font-normal normal-case tracking-normal">(Firebase Storage download URL)</span>
            </label>
            <input
              type="url"
              value={q.imageStorageUrl}
              onChange={e => upd({ imageStorageUrl: e.target.value })}
              placeholder="https://firebasestorage.googleapis.com/..."
              className={inputCls}
            />
            {q.imageStorageUrl && (
              <img
                src={q.imageStorageUrl}
                alt="Preview"
                className="mt-2 max-h-32 rounded-lg border border-[var(--border)] object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        )}

        {/* Answer choices */}
        <div>
          <span className={labelCls}>Answer Choices * — select the correct one</span>
          <div className="flex flex-col gap-2">
            {q.choices.map((choice, idx) => (
              <div key={choice.choiceKey} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${q._id}`}
                  checked={q.correctChoiceKey === choice.choiceKey}
                  onChange={() => upd({ correctChoiceKey: choice.choiceKey })}
                  className="w-4 h-4 accent-[var(--accent)] shrink-0"
                  aria-label={`Choice ${choice.choiceOrder} is correct`}
                />
                <span className="text-xs font-bold text-[var(--text2)] w-4 shrink-0 text-center">
                  {choice.choiceKey.toUpperCase()}
                </span>
                <input
                  type="text"
                  value={choice.choiceText}
                  onChange={e => updChoice(idx, e.target.value)}
                  placeholder={`Choice ${choice.choiceOrder}`}
                  className={`${inputCls} flex-1`}
                />
                {q.correctChoiceKey === choice.choiceKey && (
                  <span className="text-xs text-[var(--green)] font-semibold shrink-0">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Duration / category / difficulty */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Duration (sec) *</label>
            <input
              type="number"
              min={5}
              max={120}
              value={q.durationSeconds}
              onChange={e => upd({ durationSeconds: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input
              type="text"
              value={q.category}
              onChange={e => upd({ category: e.target.value })}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Difficulty</label>
            <input
              type="text"
              value={q.difficulty}
              onChange={e => upd({ difficulty: e.target.value })}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
        </div>

        {/* Flags */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={q.isTiebreaker}
              onChange={e => upd({ isTiebreaker: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text)]">Tiebreaker question</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={q.active}
              onChange={e => upd({ active: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text)]">Active</span>
          </label>
        </div>
      </div>
    </Modal>
  )
}
