import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Player } from '@/types'
import { buildLeaderboard } from '@/utils/scoring'

interface LeaderboardProps {
  roomId: string
  currentPlayerUid: string | null
  final?: boolean
}

export function Leaderboard({ roomId, currentPlayerUid, final = false }: LeaderboardProps) {
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'players'),
      orderBy('totalScore', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setPlayers(
        snap.docs
          .map(d => ({ ...d.data(), playerUid: d.id }) as Player)
          .filter(p => p.status === 'active')
      )
    })
    return unsub
  }, [roomId])

  const entries = buildLeaderboard(players)

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text2)] mb-3">
        {final ? '🏆 Final Standings' : '📊 Leaderboard'}
      </h2>
      {entries.length === 0 ? (
        <p className="text-[var(--text2)] text-sm text-center py-4">No players yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.slice(0, final ? entries.length : 10).map((e, i) => {
            const isMe     = e.playerUid === currentPlayerUid
            const isLeader = e.rank === 1
            return (
              <li
                key={e.playerUid}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold',
                  'transition-all',
                  isMe     ? 'border-[var(--accent)] bg-[rgba(108,99,255,.1)]' : 'border-[var(--border)] bg-[var(--surface)]',
                  isLeader ? 'shadow-[0_0_20px_rgba(245,197,66,.2)]' : '',
                  i === 0 ? 'animate-bounce-in' : 'animate-slide-in-up',
                ].join(' ')}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className={[
                  'text-base font-black min-w-[1.8ch] text-center',
                  isLeader ? 'text-[var(--yellow)]' : 'text-[var(--text2)]',
                ].join(' ')}>
                  {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                </span>
                <span className={`flex-1 truncate ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                  {e.displayName}
                  {isMe && <span className="ml-1 text-xs font-normal">(you)</span>}
                </span>
                <span className="text-[var(--yellow)] font-black tabular-nums">
                  {e.totalScore.toLocaleString()}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
