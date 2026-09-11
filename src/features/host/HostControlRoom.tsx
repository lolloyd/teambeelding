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
    const active = players.filter(p => p.status === 'active' && !p.lateJoiner ||
      (p.lateJoiner && p.eligibleFromSequenceIndex <= (room.currentSequenceIndex ?? 0)))
    // Use lastAnsweredSequenceIndex to detect per-question answers (robust to missed questions)
    const answered = active.filter(p =>
      room.phase === 'QUESTION_CLOSED' || room.phase === 'ANSWER_REVEAL' || room.phase === 'LEADERBOARD'
        ? true : p.lastAnsweredSequenceIndex === (room.currentSequenceIndex ?? -1)
    ).length
    setAnswerCounts({ answered, total: active.length })
  }, [room, players])

  // Timer countdown
  useEffect(() => {
    // Also check question.phase: stale Q1 data has phase=QUESTION_CLOSED and a past closesAt
    if (!question || room?.phase !== 'QUESTION_OPEN' || !question.closesAt || question.phase !== 'QUESTION_OPEN') {
      setRemainingMs(null)
      return
    }
    const tick = () => {
      const rem = question.closesAt! - Date.now()
      setRemainingMs(Math.max(0, rem))
      if (rem <= 5000 && rem > 0 && soundOn) playSound('tick_warning')
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [question, room?.phase, soundOn])

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
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="font-black text-lg">
          <span className="text-[var(--text)]">Team</span>
          <span className="text-[var(--accent)]">BEElding</span>
        </span>
        <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-1 text-sm">
          Code: <strong className="font-mono tracking-widest text-[var(--accent)]">{room.roomCode}</strong>
        </div>
        <span className="text-sm text-[var(--text2)]">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_6px_var(--green)] mr-1" />
          {room.playerCount} Player{room.playerCount !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}
            className="text-xl text-[var(--text2)] hover:text-[var(--text)] transition-colors"
            title={soundOn ? 'Sound On' : 'Sound Off'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <Button variant="danger" size="sm" onClick={() => setConfirmEndOpen(true)}>End Game</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main presentation area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Phase badge */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 rounded-full text-[var(--text2)]">
              {phase}
            </span>
            {room.currentSequenceIndex >= 0 && (
              <span className="text-xs text-[var(--text2)]">
                Q {room.currentSequenceIndex + 1} / {room.totalQuestions}
              </span>
            )}
          </div>

          {/* Lobby */}
          {phase === 'LOBBY' && (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="text-center">
                <div className="text-7xl font-black font-mono tracking-widest text-[var(--accent)] mb-2">{room.roomCode}</div>
                <p className="text-[var(--text2)]">Share this code with your players</p>
                <p className="text-sm text-[var(--text2)] mt-1">Join at your browser → TeamBeelding</p>
              </div>
              <div className="text-4xl font-bold text-[var(--text)]">{room.playerCount} player{room.playerCount !== 1 ? 's' : ''} waiting</div>
              <Button
                size="lg"
                variant="primary"
                disabled={room.playerCount === 0}
                loading={actionLoading === 'startGame'}
                onClick={() => void callFn('startGame', { roomId: room.roomId })}
              >
                🚀 Start Game
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={actionLoading === 'refreshRoomImages'}
                onClick={() => void callFn('refreshRoomImages', { roomId: room.roomId })}
                title="Re-sync image URLs from the source game questions (use after re-importing)"
              >
                🖼 Refresh Images
              </Button>
            </div>
          )}

          {/* Between questions */}
          {phase === 'BETWEEN_QUESTIONS' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <h2 className="text-2xl font-bold">Ready for next question?</h2>
              <Button
                size="lg"
                variant="primary"
                loading={actionLoading === 'startQuestion'}
                onClick={() => void callFn('startQuestion', { roomId: room.roomId })}
              >
                ▶ Start Question {room.currentSequenceIndex + 2}
              </Button>
            </div>
          )}

          {/* Question open / paused / closed */}
          {(phase === 'QUESTION_OPEN' || phase === 'QUESTION_PAUSED' || phase === 'QUESTION_CLOSED') && question && (
            <div className="flex flex-col gap-5">
              {/* Timer */}
              {timerSeconds !== null && (
                <div className={[
                  'text-center text-7xl font-black font-mono',
                  timerSeconds <= 5 ? 'text-[var(--red)] animate-timer-pulse' : timerSeconds <= 10 ? 'text-[var(--yellow)]' : 'text-[var(--text)]',
                ].join(' ')}
                  aria-live="polite"
                  aria-label={`${timerSeconds} seconds remaining`}
                >
                  {timerSeconds}
                </div>
              )}

              {/* Question content */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6">
                {question.gameType === 'GUESS_THE_PICTURE' && question.imageStorageUrl && (
                  <StorageImage
                    storageUrl={question.imageStorageUrl}
                    alt="Question image"
                    className="max-h-64 mx-auto rounded-xl object-contain mb-4"
                  />
                )}
                {question.gameType === 'NAME_THE_SONG' && question.lyricExcerpt && (
                  <blockquote className="italic text-center text-xl text-[var(--text2)] border-l-4 border-[var(--accent)] pl-4 py-2 mb-4">
                    "{question.lyricExcerpt}"
                  </blockquote>
                )}
                <h2 className="text-xl font-bold text-center">{question.prompt}</h2>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {question.choices.map(c => (
                    <div key={c.choiceKey} className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-3 text-center text-sm font-semibold">
                      {c.choiceText}
                    </div>
                  ))}
                </div>
              </div>

              {/* Answer progress */}
              <div className="flex items-center gap-2 text-sm text-[var(--text2)]">
                <div className="flex-1 h-2 bg-[var(--surface2)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--green)] transition-all"
                    style={{ width: `${answerCounts.total > 0 ? (answerCounts.answered / answerCounts.total) * 100 : 0}%` }}
                  />
                </div>
                <span>{answerCounts.answered}/{answerCounts.total} answered</span>
              </div>

              {/* Controls */}
              <div className="flex gap-2 flex-wrap">
                {phase === 'QUESTION_OPEN' && (
                  <Button
                    variant="secondary"
                    loading={actionLoading === 'pauseQuestion'}
                    onClick={() => void callFn('pauseQuestion', { roomId: room.roomId })}
                  >
                    ⏸ Pause
                  </Button>
                )}
                {phase === 'QUESTION_PAUSED' && (
                  <Button
                    variant="success"
                    loading={actionLoading === 'resumeQuestion'}
                    onClick={() => void callFn('resumeQuestion', { roomId: room.roomId })}
                  >
                    ▶ Resume
                  </Button>
                )}
                {(phase === 'QUESTION_OPEN' || phase === 'QUESTION_PAUSED') && (
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmSkipOpen(true)}
                  >
                    ⏭ Skip
                  </Button>
                )}
                {phase === 'QUESTION_CLOSED' && (
                  <Button
                    variant="primary"
                    loading={actionLoading === 'revealAnswer'}
                    onClick={() => {
                      void callFn('revealAnswer', { roomId: room.roomId, questionInstanceId: question.questionInstanceId })
                      if (soundOn) playSound('answer_reveal')
                    }}
                  >
                    🎯 Reveal Answer
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Answer reveal */}
          {phase === 'ANSWER_REVEAL' && question && (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">Answer Revealed</h2>
              {question.gameType === 'NAME_THE_SONG' && (
                <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-[var(--radius)] p-6 text-center">
                  <div className="text-2xl font-black text-[var(--accent)]">{question.songTitle}</div>
                  <div className="text-[var(--text2)] mt-1">{question.artist}</div>
                </div>
              )}
              <Button
                variant="primary"
                loading={actionLoading === 'showLeaderboard'}
                onClick={() => {
                  void callFn('showLeaderboard', { roomId: room.roomId })
                  if (soundOn) playSound('leaderboard')
                }}
              >
                📊 Show Leaderboard
              </Button>
            </div>
          )}

          {/* Leaderboard */}
          {phase === 'LEADERBOARD' && (
            <div className="flex flex-col gap-4">
              <Leaderboard roomId={room.roomId} currentPlayerUid={null} />
              <div className="flex gap-2">
                {room.currentSequenceIndex + 1 < room.totalQuestions ? (
                  <Button
                    variant="primary"
                    loading={actionLoading === 'prepareNextQuestion'}
                    onClick={() => void callFn('prepareNextQuestion', { roomId: room.roomId })}
                  >
                    ➡ Next Question
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setConfirmEndOpen(true)}
                  >
                    🏁 End Game
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Completed */}
          {phase === 'COMPLETED' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-black mb-2">Game Over!</h2>
              <Leaderboard roomId={room.roomId} currentPlayerUid={null} final />
            </div>
          )}
        </main>

        {/* Sidebar — player list */}
        <aside className="w-72 bg-[var(--surface)] border-l border-[var(--border)] p-4 overflow-y-auto hidden lg:block">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] mb-3">Players ({players.length})</h3>
          <ul className="flex flex-col gap-1">
            {players.filter(p => p.status === 'active').map(p => (
              <li key={p.playerUid} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-[var(--surface2)]">
                <span className="flex-1 truncate font-medium">{p.displayName}</span>
                <span className="text-[var(--text2)] text-xs">{p.totalScore}</span>
                {p.lateJoiner && <span title="Late joiner" className="text-xs">⏰</span>}
                <button
                  className="text-[var(--red)] text-xs hover:opacity-80"
                  onClick={() => void callFn('removePlayer', { roomId: room.roomId, playerUid: p.playerUid })}
                  aria-label={`Remove ${p.displayName}`}
                  title="Remove player"
                >
                  ✕
                </button>
                <button
                  className="text-[var(--accent)] text-xs hover:opacity-80"
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
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Adjust Score — {adjustTarget.displayName}</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">Amount (+ or -)</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">Reason *</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  maxLength={200}
                  className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
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
