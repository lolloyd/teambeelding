import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { StorageImage } from '@/components/ui/StorageImage'
import type { Room, RoomQuestionInstance, Player } from '@/types'
import { Leaderboard } from '@/features/rooms/Leaderboard'

export function PlayerSession() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [room, setRoom]       = useState<Room | null>(null)
  const [question, setQuestion] = useState<RoomQuestionInstance | null>(null)
  const [me, setMe]           = useState<Player | null>(null)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [locked, setLocked]   = useState(false)
  const [revealed, setRevealed] = useState<{ correct: boolean; correctKey: string; points: number } | null>(null)

  // Resolve roomCode -> roomId
  const [roomId, setRoomId] = useState<string | null>(null)

  useEffect(() => {
    if (!roomCode) { navigate('/join'); return }
    const unsub = onSnapshot(doc(db, 'roomCodes', roomCode), snap => {
      if (!snap.exists()) { toast('Room not found.', 'error'); navigate('/join'); return }
      setRoomId((snap.data() as { roomId: string }).roomId)
    })
    return unsub
  }, [roomCode, navigate, toast])

  // Watch room
  useEffect(() => {
    if (!roomId) return
    const unsub = onSnapshot(doc(db, 'rooms', roomId), snap => {
      if (!snap.exists()) { toast('Room has ended.', 'error'); navigate('/'); return }
      const r = snap.data() as Room
      if (r.expiresAt && r.expiresAt < Date.now()) {
        toast('This game has expired.', 'error')
        navigate('/')
        return
      }
      setRoom({ ...r, roomId: snap.id })
    })
    return unsub
  }, [roomId, navigate, toast])

  // Watch current question
  useEffect(() => {
    // Always reset per-question state when the question instance changes
    setQuestion(null)
    setLocked(false)
    setSelectedChoice(null)
    setRevealed(null)
    if (!roomId || !room?.currentQuestionInstanceId) return
    const unsub = onSnapshot(doc(db, 'rooms', roomId, 'questions', room.currentQuestionInstanceId), snap => {
      if (snap.exists()) setQuestion(snap.data() as RoomQuestionInstance)
    })
    return unsub
  }, [roomId, room?.currentQuestionInstanceId])

  // Watch my player doc
  useEffect(() => {
    if (!roomId || !user) return
    const unsub = onSnapshot(doc(db, 'rooms', roomId, 'players', user.uid), snap => {
      if (!snap.exists()) { toast('You have been removed from the room.', 'error'); navigate('/'); return }
      const p = snap.data() as Player
      if (p.status === 'removed') { toast('You have been removed from the game.', 'error'); navigate('/'); return }
      setMe(p)
    })
    return unsub
  }, [roomId, user, navigate, toast])

  // Watch my submission for current question to restore lock on reconnect
  useEffect(() => {
    if (!roomId || !user || !room?.currentQuestionInstanceId) return
    const submId = `${room.currentQuestionInstanceId}_${user.uid}`
    const unsub = onSnapshot(doc(db, 'rooms', roomId, 'submissions', submId), snap => {
      if (snap.exists()) {
        const data = snap.data() as { choiceKey: string }
        setSelectedChoice(data.choiceKey)
        setLocked(true)
      }
    })
    return unsub
  }, [roomId, user, room?.currentQuestionInstanceId])

  // Fetch private result when answer is revealed (tells player if they were correct and their points)
  useEffect(() => {
    if (room?.phase !== 'ANSWER_REVEAL' || !roomId || !user || !room?.currentQuestionInstanceId) {
      setRevealed(null)
      return
    }
    const resultId = `${room.currentQuestionInstanceId}_${user.uid}`
    getDoc(doc(db, 'rooms', roomId, 'privateResults', resultId))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          setRevealed({
            correct:    data['isCorrect'] as boolean,
            correctKey: '',  // correctChoiceKey is now on the question doc
            points:     data['awardedPoints'] as number,
          })
        }
      })
      .catch(() => {}) // silently ignore (may not be revealed yet)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, roomId, user?.uid, room?.currentQuestionInstanceId])

  // Timer
  useEffect(() => {
    if (!question?.closesAt || room?.phase !== 'QUESTION_OPEN' || question.phase !== 'QUESTION_OPEN') { setRemainingMs(null); return }
    const tick = () => setRemainingMs(Math.max(0, question.closesAt! - Date.now()))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [question?.closesAt, room?.phase])

  const submitAnswer = useCallback(async (choiceKey: string) => {
    if (locked || submitting || !roomId || !user || !question || !room) return
    setSubmitting(true)
    setSelectedChoice(choiceKey)
    try {
      await httpsCallable(functions, 'submitAnswer')({
        roomId,
        questionInstanceId: question.questionInstanceId,
        choiceKey,
      })
      setLocked(true)
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? ''
      if (msg.includes('ALREADY_SUBMITTED')) {
        setLocked(true)
      } else if (msg.includes('QUESTION_CLOSED') || msg.includes('PAUSED')) {
        toast('The question is no longer accepting answers.', 'error')
        setSelectedChoice(null)
      } else {
        toast('Could not submit. Try again.', 'error')
        setSelectedChoice(null)
      }
    } finally {
      setSubmitting(false)
    }
  }, [locked, submitting, roomId, user, question, room, toast])

  const phase = room?.phase
  const timerSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null
  const canAnswer = phase === 'QUESTION_OPEN' && !locked && !submitting && !!question &&
    (!me?.lateJoiner || (me.eligibleFromSequenceIndex <= (room?.currentSequenceIndex ?? 0)))

  if (!room || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_50%_80%,_var(--surface)_0%,_var(--bg)_60%)]">
      {/* Top bar */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <span className="font-bold truncate">{me.displayName}</span>
        <span className="ml-auto text-sm text-[var(--text2)]">
          Score: <strong className="text-[var(--yellow)]">{me.totalScore.toLocaleString()}</strong>
        </span>
        {room.currentSequenceIndex >= 0 && (
          <span className="text-xs text-[var(--text2)]">
            Q {room.currentSequenceIndex + 1}/{room.totalQuestions}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Leave</Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start pt-4 px-4 gap-4 max-w-lg mx-auto w-full">
        {/* Status message */}
        <p
          className={[
            'text-center font-semibold text-base min-h-[1.6em]',
            locked ? 'text-[var(--green)]' : phase === 'QUESTION_OPEN' ? 'text-[var(--green)]' : 'text-[var(--text2)]',
          ].join(' ')}
          aria-live="polite"
        >
          {phase === 'LOBBY'             && 'Waiting for the Game Master to start…'}
          {phase === 'BETWEEN_QUESTIONS' && 'Get ready for the next question!'}
          {phase === 'QUESTION_OPEN'     && !locked && '⚡ Tap an answer!'}
          {phase === 'QUESTION_OPEN'     && locked  && '✅ Answer locked in!'}
          {phase === 'QUESTION_PAUSED'   && '⏸ Paused…'}
          {phase === 'QUESTION_CLOSED'   && '\u23F1 Time\u2019s up!'}
          {phase === 'ANSWER_REVEAL'     && revealed && (revealed.correct ? `🎉 Correct! +${revealed.points} pts` : '❌ Incorrect')}
          {phase === 'ANSWER_REVEAL'     && !revealed && 'Answer incoming…'}
          {phase === 'LEADERBOARD'       && '📊 Leaderboard'}
          {phase === 'COMPLETED'         && '🏆 Game Over!'}
        </p>

        {/* Timer */}
        {timerSeconds !== null && (
          <div
            className={[
              'text-5xl font-black font-mono tabular-nums',
              timerSeconds <= 5 ? 'text-[var(--red)] animate-pulse-danger' : timerSeconds <= 10 ? 'text-[var(--yellow)]' : 'text-[var(--text)]',
            ].join(' ')}
            aria-live="polite"
            aria-label={`${timerSeconds} seconds remaining`}
          >
            {timerSeconds}
          </div>
        )}

        {/* Question content */}
        {question && (phase === 'QUESTION_OPEN' || phase === 'QUESTION_PAUSED' || phase === 'QUESTION_CLOSED' || phase === 'ANSWER_REVEAL') && (
          <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4">
            {question.gameType === 'GUESS_THE_PICTURE' && question.imageStorageUrl && (
              <StorageImage
                storageUrl={question.imageStorageUrl}
                alt="Question"
                className="max-h-48 mx-auto rounded-xl object-contain mb-3"
              />
            )}
            {question.gameType === 'NAME_THE_SONG' && question.lyricExcerpt && (
              <blockquote className="italic text-center text-[var(--text2)] border-l-4 border-[var(--accent)] pl-3 py-1 mb-3 text-sm">
                "{question.lyricExcerpt}"
              </blockquote>
            )}
            <p className="text-center font-semibold">{question.prompt}</p>
          </div>
        )}

        {/* Answer buttons */}
        {question && (phase === 'QUESTION_OPEN' || phase === 'QUESTION_PAUSED' || phase === 'QUESTION_CLOSED' || phase === 'ANSWER_REVEAL') && (
          <div className="grid gap-3 w-full" role="group" aria-label="Answer choices">
            {question.choices.map(c => {
              const isSelected = selectedChoice === c.choiceKey
              const isCorrect  = phase === 'ANSWER_REVEAL' && question.correctChoiceKey === c.choiceKey
              const isWrong    = phase === 'ANSWER_REVEAL' && isSelected && !isCorrect
              return (
                <button
                  key={c.choiceKey}
                  onClick={() => void submitAnswer(c.choiceKey)}
                  disabled={!canAnswer || phase !== 'QUESTION_OPEN'}
                  aria-pressed={isSelected}
                  className={[
                    'w-full px-5 py-4 rounded-[var(--radius)] text-base font-bold text-left',
                    'border-2 transition-all duration-150 select-none touch-manipulation',
                    'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
                    isCorrect ? 'border-[var(--green)] bg-[rgba(67,217,143,.2)] text-[var(--text)]' :
                    isWrong   ? 'border-[var(--red)]   bg-[rgba(255,92,92,.15)] text-[var(--text)]' :
                    isSelected && locked ? 'border-[var(--accent)] bg-[rgba(108,99,255,.15)] text-[var(--text)]' :
                    canAnswer ? 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:-translate-y-0.5 active:scale-[.97]' :
                    'border-[var(--border)] bg-[var(--surface2)] text-[var(--text2)] cursor-not-allowed opacity-70',
                  ].join(' ')}
                >
                  {isCorrect && <span aria-hidden="true">✅ </span>}
                  {isWrong   && <span aria-hidden="true">❌ </span>}
                  {isSelected && locked && phase !== 'ANSWER_REVEAL' && <span aria-hidden="true">🔒 </span>}
                  {c.choiceText}
                </button>
              )
            })}
          </div>
        )}

        {/* Leaderboard */}
        {(phase === 'LEADERBOARD' || phase === 'COMPLETED') && (
          <div className="w-full">
            <Leaderboard roomId={room.roomId} currentPlayerUid={user?.uid ?? null} final={phase === 'COMPLETED'} />
          </div>
        )}
      </main>
    </div>
  )
}
