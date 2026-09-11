import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { playSound, setSoundEnabled, isSoundEnabled } from '@/lib/audio'
import type { Room, RoomQuestionInstance, Player } from '@/types'
import { Leaderboard } from '@/features/rooms/Leaderboard'
import { StorageImage } from '@/components/ui/StorageImage'
import { collection, query, orderBy } from 'firebase/firestore'

export function HostControlRoom() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [room, setRoom]          = useState<Room | null>(null)
  const [question, setQuestion]  = useState<RoomQuestionInstance | null>(null)
  const [players, setPlayers]    = useState<Player[]>([])
  const [answerCounts, setAnswerCounts] = useState<{ answered: number; total: number }>({ answered: 0, total: 0 })
  const [loading, setLoading]    = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [soundOn, setSoundOn]    = useState(() => isSoundEnabled())
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [confirmSkipOpen, setConfirmSkipOpen] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<Player | null>(null)
  const [adjustAmount, setAdjustAmount] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')
  // Tracks the sequence index for which auto-close has already been fired
  const autoClosedRef = useRef<number | null>(null)

  const callFn = useCallback(async (name: string, payload: Record<string, unknown>) => {
    setActionLoading(name)
    try {
      await httpsCallable(functions, name)(payload)
    } catch (e: unknown) {
      toast((e as { message?: string }).message ?? `${name} failed.`, 'error')
    } finally {
      setActionLoading(null)
    }
  }, [toast])

  // Access guard — check room ownership
  useEffect(() => {
    if (!roomCode || !user) return
    const roomRef = doc(db, 'roomCodes', roomCode)
    const unsub = onSnapshot(roomRef, snap => {
      if (!snap.exists()) { toast('Room not found.', 'error'); navigate('/host'); return }
      const data = snap.data() as { roomId: string }
      // Now watch the actual room doc
      const roomUnsub = onSnapshot(doc(db, 'rooms', data.roomId), roomSnap => {
        if (!roomSnap.exists()) { navigate('/host'); return }
        const r = roomSnap.data() as Room
        if (r.hostUid !== user.uid) {
          toast('You are not the host of this room.', 'error')
          navigate('/host')
          return
        }
        setRoom({ ...r, roomId: roomSnap.id })
        setLoading(false)
      })
      return roomUnsub
    })
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, user])

  // Watch current question
  useEffect(() => {
    if (!room?.currentQuestionInstanceId) { setQuestion(null); return }
    setQuestion(null) // reset immediately so timer doesn't fire with stale closesAt
    const qRef = doc(db, 'rooms', room.roomId, 'questions', room.currentQuestionInstanceId)
    const unsub = onSnapshot(qRef, snap => {
      if (snap.exists()) setQuestion(snap.data() as RoomQuestionInstance)
    })
    return unsub
  }, [room?.roomId, room?.currentQuestionInstanceId])

  // Watch players
  useEffect(() => {
    if (!room?.roomId) return
    const q = query(collection(db, 'rooms', room.roomId, 'players'), orderBy('joinedAt'))
    const unsub = onSnapshot(q, snap => {
      setPlayers(snap.docs.map(d => ({ ...d.data(), playerUid: d.id }) as Player))
    })
    return unsub
  }, [room?.roomId])

  // Watch answer counts
  useEffect(() => {
    if (!room) return
    const active = players.filter(p => p.status === 'active' && (!p.lateJoiner ||
      (p.lateJoiner && p.eligibleFromSequenceIndex <= (room.currentSequenceIndex ?? 0))))
    // Use lastAnsweredSequenceIndex to detect per-question answers (robust to missed questions)
    const answered = active.filter(p =>
      room.phase === 'QUESTION_CLOSED' || room.phase === 'ANSWER_REVEAL' || room.phase === 'LEADERBOARD'
        ? true : p.lastAnsweredSequenceIndex === (room.currentSequenceIndex ?? -1)
    ).length
    setAnswerCounts({ answered, total: active.length })
  }, [room, players])

  // Timer countdown
  const lastSoundSecRef = useRef<number | null>(null)

  useEffect(() => {
    if (!question || room?.phase !== 'QUESTION_OPEN' || !question.closesAt || question.phase !== 'QUESTION_OPEN') {
      setRemainingMs(null)
      lastSoundSecRef.current = null
      return
    }

    const tick = () => {
      const rem = Math.max(0, question.closesAt! - Date.now())
      setRemainingMs(rem)

      const secs = Math.ceil(rem / 1000)
      if (soundOn && secs <= 5 && secs > 0 && lastSoundSecRef.current !== secs) {
        lastSoundSecRef.current = secs
        playSound('tick_warning')
      }
    }

    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [question?.closesAt, question?.phase, room?.phase, soundOn])

  // Auto-close question when timer expires or all active players have answered
  useEffect(() => {
    if (room?.phase !== 'QUESTION_OPEN' || !room || !question || question.phase !== 'QUESTION_OPEN') return
    const timerExpired = remainingMs !== null && remainingMs === 0
    // Compute allAnswered inline from players to avoid stale answerCounts state
    const active = players.filter(p =>
      (p.status === 'active' && !p.lateJoiner) ||
      (p.lateJoiner && p.eligibleFromSequenceIndex <= room.currentSequenceIndex)
    )
    const allAnswered = active.length > 0 &&
      active.every(p => p.lastAnsweredSequenceIndex === room.currentSequenceIndex)
    if ((timerExpired || allAnswered) && autoClosedRef.current !== room.currentSequenceIndex) {
      autoClosedRef.current = room.currentSequenceIndex
      void callFn('closeQuestion', { roomId: room.roomId })
    }
  }, [room, remainingMs, players, question, callFn])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  const handleAdjustScore = async () => {
    if (!adjustTarget || !room) return
    await callFn('adjustScore', {
      roomId: room.roomId,
      playerUid: adjustTarget.playerUid,
      amount: adjustAmount,
      reason: adjustReason,
    })
    setAdjustTarget(null)
    setAdjustAmount(0)
    setAdjustReason('')
  }

  const phase = room?.phase
  const timerSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!room) return null

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="font-black text-xl tracking-tight">
          <span className="text-[var(--text)]">Team</span>
          <span className="text-[var(--accent)]">BEElding</span>
        </span>
        <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-1 text-sm font-semibold">
          Code: <strong className="font-mono tracking-widest text-[var(--accent)] text-base">{room.roomCode}</strong>
        </div>
        <span className="text-sm font-medium text-[var(--text2)] flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
          {room.playerCount} Player{room.playerCount !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}
            className="p-2 rounded-lg bg-[var(--surface2)] hover:bg-[var(--border)] text-xl transition-colors"
            title={soundOn ? 'Sound On' : 'Sound Off'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <Button variant="danger" size="sm" onClick={() => setConfirmEndOpen(true)}>End Game</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main presentation area */}
        <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col">
          {/* Phase badge & question index */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full">
              Phase: {phase?.replace('_', ' ')}
            </span>
            {room.currentSequenceIndex >= 0 && (
              <span className="text-sm font-bold text-[var(--text2)]">
                Question {room.currentSequenceIndex + 1} of {room.totalQuestions}
              </span>
            )}
          </div>

          {/* Lobby */}
          {phase === 'LOBBY' && (
            <div className="flex flex-col items-center justify-center gap-6 py-12 my-auto text-center">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <p className="text-sm font-bold uppercase tracking-wider text-[var(--text2)] mb-2">Join Game Code</p>
                <div className="text-6xl font-black font-mono tracking-widest text-[var(--accent)] mb-4">{room.roomCode}</div>
                <p className="text-sm text-[var(--text2)]">Players join from any phone or browser.</p>
              </div>

              <div className="text-2xl font-bold">{room.playerCount} player{room.playerCount !== 1 ? 's' : ''} in lobby</div>

              <Button
                size="lg"
                variant="primary"
                disabled={room.playerCount === 0}
                loading={actionLoading === 'startGame'}
                onClick={() => void callFn('startGame', { roomId: room.roomId })}
                className="text-lg px-8 py-4 shadow-xl shadow-[var(--accent)]/20"
              >
                🚀 Start Game Now
              </Button>
            </div>
          )}

          {/* Between questions */}
          {phase === 'BETWEEN_QUESTIONS' && (
            <div className="flex flex-col items-center justify-center gap-6 py-12 my-auto text-center">
              <h2 className="text-3xl font-extrabold">Next Question Ready!</h2>
              <p className="text-[var(--text2)] max-w-md">Get your players ready on their devices before launching.</p>
              <Button
                size="lg"
                variant="primary"
                loading={actionLoading === 'startQuestion'}
                onClick={() => void callFn('startQuestion', { roomId: room.roomId })}
                className="text-lg px-8 py-4"
              >
                ▶ Start Question {room.currentSequenceIndex + 2}
              </Button>
            </div>
          )}

          {/* Question open / paused / closed */}
          {(phase === 'QUESTION_OPEN' || phase === 'QUESTION_PAUSED' || phase === 'QUESTION_CLOSED') && question && (
            <div className="flex flex-col gap-6">
              {/* Timer Display */}
              {timerSeconds !== null && (
                <div className="flex justify-center">
                  <div className={[
                    'text-6xl font-black font-mono tabular-nums px-8 py-3 rounded-2xl border bg-[var(--surface)] shadow-lg',
                    timerSeconds <= 5 ? 'text-[var(--red)] border-[var(--red)] animate-pulse' : timerSeconds <= 10 ? 'text-[var(--yellow)] border-[var(--yellow)]' : 'text-[var(--text)] border-[var(--border)]',
                  ].join(' ')}>
                    {timerSeconds}s
                  </div>
                </div>
              )}

              {/* Question Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-xl">
                {question.imageStorageUrl && (
                  <StorageImage
                    storageUrl={question.imageStorageUrl}
                    alt="Question image"
                    className="max-h-72 mx-auto rounded-xl object-contain mb-6 shadow-md"
                  />
                )}
                {question.lyricExcerpt && (
                  <blockquote className="italic text-center text-xl text-[var(--text2)] border-l-4 border-[var(--accent)] pl-4 py-2 mb-6 bg-[var(--surface2)] rounded-r-xl">
                    "{question.lyricExcerpt}"
                  </blockquote>
                )}
                <h2 className="text-2xl font-bold text-center leading-snug">{question.prompt}</h2>

                {/* Choices Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                  {question.choices.map(c => (
                    <div
                      key={c.choiceKey}
                      className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4 text-center text-base font-semibold shadow-sm"
                    >
                      {c.choiceText}
                    </div>
                  ))}
                </div>
              </div>

              {/* Response progress */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span>Player Responses</span>
                  <span className="text-[var(--accent)]">{answerCounts.answered} / {answerCounts.total}</span>
                </div>
                <div className="w-full h-3 bg-[var(--surface2)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--green)] transition-all duration-300 rounded-full"
                    style={{ width: `${answerCounts.total > 0 ? (answerCounts.answered / answerCounts.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Host Controls */}
              <div className="flex gap-3 flex-wrap justify-center">
                {phase === 'QUESTION_OPEN' && (
                  <Button
                    variant="secondary"
                    loading={actionLoading === 'pauseQuestion'}
                    onClick={() => void callFn('pauseQuestion', { roomId: room.roomId })}
                  >
                    ⏸ Pause Question
                  </Button>
                )}
                {phase === 'QUESTION_PAUSED' && (
                  <Button
                    variant="success"
                    loading={actionLoading === 'resumeQuestion'}
                    onClick={() => void callFn('resumeQuestion', { roomId: room.roomId })}
                  >
                    ▶ Resume Timer
                  </Button>
                )}
                {(phase === 'QUESTION_OPEN' || phase === 'QUESTION_PAUSED') && (
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmSkipOpen(true)}
                  >
                    ⏭ Skip Question
                  </Button>
                )}
                {phase === 'QUESTION_CLOSED' && (
                  <Button
                    variant="primary"
                    size="lg"
                    loading={actionLoading === 'revealAnswer'}
                    onClick={() => {
                      void callFn('revealAnswer', { roomId: room.roomId, questionInstanceId: question.questionInstanceId })
                      if (soundOn) playSound('answer_reveal')
                    }}
                    className="px-8"
                  >
                    🎯 Reveal Correct Answer
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Answer reveal */}
          {phase === 'ANSWER_REVEAL' && question && (
            <div className="flex flex-col gap-6 my-auto">
              <div className="text-center">
                <span className="text-sm font-bold uppercase tracking-wider text-[var(--green)]">Correct Answer Revealed</span>
                <h2 className="text-3xl font-black mt-1">{question.prompt}</h2>
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-xl mx-auto w-full">
                {question.choices.map(c => {
                  const isCorrect = question.correctChoiceKey === c.choiceKey
                  return (
                    <div
                      key={c.choiceKey}
                      className={`p-5 rounded-2xl border-2 font-bold text-lg flex items-center justify-between ${
                        isCorrect
                          ? 'bg-green-500/10 border-[var(--green)] text-emerald-300'
                          : 'bg-[var(--surface2)] border-[var(--border)] text-[var(--text2)] opacity-60'
                      }`}
                    >
                      <span>{c.choiceText}</span>
                      {isCorrect && <span className="text-2xl">✅</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center mt-4">
                <Button
                  variant="primary"
                  size="lg"
                  loading={actionLoading === 'showLeaderboard'}
                  onClick={() => {
                    void callFn('showLeaderboard', { roomId: room.roomId })
                    if (soundOn) playSound('leaderboard')
                  }}
                  className="px-8 text-lg"
                >
                  📊 View Leaderboard
                </Button>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {phase === 'LEADERBOARD' && (
            <div className="flex flex-col gap-6 my-auto">
              <Leaderboard roomId={room.roomId} currentPlayerUid={null} />
              <div className="flex justify-center gap-3">
                {room.currentSequenceIndex + 1 < room.totalQuestions ? (
                  <Button
                    variant="primary"
                    size="lg"
                    loading={actionLoading === 'prepareNextQuestion'}
                    onClick={() => void callFn('prepareNextQuestion', { roomId: room.roomId })}
                    className="px-8 text-lg"
                  >
                    ➡ Next Question
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setConfirmEndOpen(true)}
                    className="px-8 text-lg"
                  >
                    🏆 Complete Game
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Completed */}
          {phase === 'COMPLETED' && (
            <div className="text-center py-12 my-auto">
              <div className="text-7xl mb-4">🏆</div>
              <h2 className="text-4xl font-black mb-2">Game Complete!</h2>
              <p className="text-[var(--text2)] mb-8">Congratulations to all participants!</p>
              <Leaderboard roomId={room.roomId} currentPlayerUid={null} final />
            </div>
          )}
        </main>

        {/* Sidebar — player list */}
        <aside className="w-80 bg-[var(--surface)] border-l border-[var(--border)] p-5 overflow-y-auto hidden lg:block">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text2)] mb-4">Connected Players ({players.length})</h3>
          <ul className="flex flex-col gap-2">
            {players.filter(p => p.status === 'active').map(p => (
              <li key={p.playerUid} className="flex items-center gap-2 text-sm py-2 px-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
                <span className="flex-1 truncate font-semibold">{p.displayName}</span>
                <span className="font-mono font-bold text-xs bg-[var(--bg)] px-2 py-0.5 rounded-md">{p.totalScore} pts</span>
                <button
                  className="p-1 rounded text-[var(--red)] hover:bg-red-500/10 text-xs font-bold"
                  onClick={() => void callFn('removePlayer', { roomId: room.roomId, playerUid: p.playerUid })}
                  aria-label={`Remove ${p.displayName}`}
                  title="Remove player"
                >
                  ✕
                </button>
                <button
                  className="p-1 rounded text-[var(--accent)] hover:bg-indigo-500/10 text-xs font-bold"
                  onClick={() => { setAdjustTarget(p); setAdjustAmount(0); setAdjustReason('') }}
                  aria-label={`Adjust score for ${p.displayName}`}
                  title="Adjust score"
                >
                  ±
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={confirmEndOpen}
        onConfirm={() => {
          void callFn('endGame', { roomId: room.roomId })
          setConfirmEndOpen(false)
        }}
        onCancel={() => setConfirmEndOpen(false)}
        title="End Game"
        message="Are you sure you want to end this game? This cannot be undone."
        confirmLabel="End Game"
        danger
      />

      <ConfirmModal
        open={confirmSkipOpen}
        onConfirm={() => {
          if (question) void callFn('skipQuestion', { roomId: room.roomId, questionInstanceId: question.questionInstanceId })
          setConfirmSkipOpen(false)
        }}
        onCancel={() => setConfirmSkipOpen(false)}
        title="Skip Question"
        message="Skip this question? No points will be awarded unless adjusted manually."
        confirmLabel="Skip"
        danger
      />

      {/* Score adjustment modal */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">Adjust Score — {adjustTarget.displayName}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1.5">Amount (+ or -)</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1.5">Reason *</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  maxLength={200}
                  className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. Technical issue"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setAdjustTarget(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!adjustReason.trim()}
                  loading={actionLoading === 'adjustScore'}
                  onClick={() => void handleAdjustScore()}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
