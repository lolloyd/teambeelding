import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  type DocumentData,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Game } from '@/types'

function docToGame(doc: DocumentData, id: string): Game {
  const d = doc as Record<string, unknown>
  return {
    gameId:                    id,
    gameKey:                   String(d.gameKey ?? ''),
    title:                     String(d.title ?? ''),
    description:               d.description ? String(d.description) : undefined,
    estimatedDurationMinutes:  d.estimatedDurationMinutes ? Number(d.estimatedDurationMinutes) : undefined,
    questionOrderMode:         (d.questionOrderMode as 'EXACT' | 'RANDOM') ?? 'EXACT',
    defaultDurationSeconds:    Number(d.defaultDurationSeconds ?? 15),
    incorrectPenaltyPoints:    Number(d.incorrectPenaltyPoints ?? 0),
    published:                 Boolean(d.published),
    createdAt:                 Number(d.createdAt ?? 0),
    updatedAt:                 Number(d.updatedAt ?? 0),
    roundCount:                Number(d.roundCount ?? 0),
    questionCount:             Number(d.questionCount ?? 0),
    tiebreakerCount:           Number(d.tiebreakerCount ?? 0),
    gameTypes:                 (d.gameTypes as Game['gameTypes']) ?? [],
    categories:                (d.categories as string[]) ?? [],
    difficulties:              (d.difficulties as string[]) ?? [],
  }
}

export function AdminGameList() {
  const { toast } = useToast()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setGames(snap.docs.map(d => docToGame(d.data(), d.id)))
      setLoading(false)
    }, () => {
      toast('Failed to load games.', 'error')
      setLoading(false)
    })
    return unsub
  }, [toast])

  const togglePublish = async (game: Game) => {
    const fn = game.published
      ? httpsCallable(functions, 'unpublishGame')
      : httpsCallable(functions, 'publishGame')
    setActionLoading(game.gameId)
    try {
      await fn({ gameId: game.gameId })
      toast(game.published ? 'Game unpublished.' : 'Game published!', 'success')
    } catch {
      toast('Action failed. Please try again.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(deleteTarget.gameId)
    try {
      await httpsCallable(functions, 'deleteGame')({ gameId: deleteTarget.gameId })
      toast('Game deleted.', 'success')
    } catch {
      toast('Delete failed. Please try again.', 'error')
    } finally {
      setActionLoading(null)
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Games</h1>
        <div className="flex gap-2">
          <Link to="/admin/games/new">
            <Button variant="primary">✏️ Create Quiz</Button>
          </Link>
          <Link to="/admin/import">
            <Button variant="secondary">📥 Import Game</Button>
          </Link>
        </div>
      </div>

      {games.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-[var(--text2)] text-lg mb-4">No games yet.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/admin/games/new">
              <Button variant="primary">✏️ Create your first quiz</Button>
            </Link>
            <Link to="/admin/import">
              <Button variant="secondary">📥 Import a game</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {games.map(g => (
            <Card key={g.gameId} className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[var(--text)] truncate">{g.title}</h2>
                  <span
                    className={[
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      g.published
                        ? 'bg-[rgba(67,217,143,.15)] text-[var(--green)]'
                        : 'bg-[var(--surface2)] text-[var(--text2)]',
                    ].join(' ')}
                  >
                    {g.published ? '✅ Published' : 'Draft'}
                  </span>
                </div>
                {g.description && (
                  <p className="text-sm text-[var(--text2)] mt-0.5 truncate">{g.description}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--text2)]">
                  <span>🔄 {g.roundCount} rounds</span>
                  <span>❓ {g.questionCount} questions</span>
                  {g.tiebreakerCount > 0 && <span>⚖️ {g.tiebreakerCount} tiebreakers</span>}
                  <span>{g.gameTypes.join(' · ')}</span>
                </div>
              </div>
              <div className="flex gap-2 items-center flex-shrink-0">
                <Link to={`/admin/games/${g.gameId}/edit`}>
                  <Button variant="secondary" size="sm">✏️ Edit</Button>
                </Link>
                <Button
                  variant={g.published ? 'secondary' : 'success'}
                  size="sm"
                  loading={actionLoading === g.gameId}
                  onClick={() => void togglePublish(g)}
                >
                  {g.published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTarget(g)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Game"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
