import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import type { Game } from '@/types'

export function HostGameSelection() {
  const { user, signInAnon, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [creating, setCreating] = useState(false)

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
    const unsub = onSnapshot(q, snap => {
      const gs = snap.docs.map(d => {
        const data = d.data() as Record<string, unknown>
        return {
          gameId:                  d.id,
          gameKey:                 String(data.gameKey ?? ''),
          title:                   String(data.title ?? ''),
          description:             data.description ? String(data.description) : undefined,
          estimatedDurationMinutes: data.estimatedDurationMinutes ? Number(data.estimatedDurationMinutes) : undefined,
          questionOrderMode:       (data.questionOrderMode as 'EXACT' | 'RANDOM') ?? 'EXACT',
          defaultDurationSeconds:  Number(data.defaultDurationSeconds ?? 15),
          incorrectPenaltyPoints:  Number(data.incorrectPenaltyPoints ?? 0),
          published:               true,
          createdAt:               Number(data.createdAt ?? 0),
          updatedAt:               Number(data.updatedAt ?? 0),
          roundCount:              Number(data.roundCount ?? 0),
          questionCount:           Number(data.questionCount ?? 0),
          tiebreakerCount:         Number(data.tiebreakerCount ?? 0),
          gameTypes:               (data.gameTypes as Game['gameTypes']) ?? [],
          categories:              (data.categories as string[]) ?? [],
          difficulties:            (data.difficulties as string[]) ?? [],
        } as Game
      })
      setGames(gs)
      setLoadingGames(false)
    }, () => {
      toast('Failed to load games.', 'error')
      setLoadingGames(false)
    })
    return unsub
  }, [toast])

  const handleCreateRoom = async () => {
    if (!selectedGame || !user) return
    setCreating(true)
    try {
      const fn = httpsCallable<{ gameId: string }, { roomId: string; roomCode: string }>(functions, 'createRoom')
      const result = await fn({ gameId: selectedGame.gameId })
      const { roomCode } = result.data
      localStorage.setItem('tb_active_room', roomCode)
      navigate(`/host/${roomCode}`)
    } catch (e: unknown) {
      toast((e as { message?: string }).message ?? 'Failed to create room.', 'error')
    } finally {
      setCreating(false)
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_40%_20%,_var(--surface)_0%,_var(--bg)_60%)] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">
            <span className="text-[var(--text)]">Team</span>
            <span className="text-[var(--accent)]">BEElding</span>
          </h1>
          <p className="text-[var(--text2)] mt-1">Select a game to host</p>
        </div>

        {games.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-[var(--text2)]">No published games available. An Admin must publish a game first.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {games.map(g => (
              <Card
                key={g.gameId}
                hoverable
                onClick={() => setSelectedGame(g)}
                className={selectedGame?.gameId === g.gameId ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : ''}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${selectedGame?.gameId === g.gameId ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border)]'}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-[var(--text)]">{g.title}</h2>
                    {g.description && <p className="text-sm text-[var(--text2)] mt-0.5">{g.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--text2)]">
                      <span>🔄 {g.roundCount} rounds</span>
                      <span>❓ {g.questionCount} questions</span>
                      {g.estimatedDurationMinutes && <span>⏱ ~{g.estimatedDurationMinutes} min</span>}
                      <span>{g.gameTypes.map(t => t === 'NAME_THE_SONG' ? '🎵' : '🖼️').join(' ')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {selectedGame && (
              <div className="mt-2 animate-slide-in-up">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => void handleCreateRoom()}
                  loading={creating}
                >
                  🎮 Create Room — {selectedGame.title}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
