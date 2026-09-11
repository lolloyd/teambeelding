import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage }         from '@/routes/LandingPage'
import { JoinPage }            from '@/features/players/JoinPage'
import { PlayerSession }       from '@/features/players/PlayerSession'
import { HostGameSelection }   from '@/features/host/HostGameSelection'
import { HostControlRoom }     from '@/features/host/HostControlRoom'
import { NotFoundPage }        from '@/routes/NotFoundPage'
import { ConnectionStatus }    from '@/components/ConnectionStatus'

export function AppRouter() {
  return (
    <BrowserRouter>
      <ConnectionStatus />
      <Routes>
        {/* ── Public ─────────────────────────────────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/play/:roomCode" element={<PlayerSession />} />

        {/* ── Host ───────────────────────────────────────────────── */}
        <Route path="/host" element={<HostGameSelection />} />
        <Route path="/host/:roomCode" element={<HostControlRoom />} />

        {/* ── 404 ────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
