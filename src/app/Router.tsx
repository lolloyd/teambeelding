import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage }         from '@/routes/LandingPage'
import { JoinPage }            from '@/features/players/JoinPage'
import { PlayerSession }       from '@/features/players/PlayerSession'
import { HostGameSelection }   from '@/features/host/HostGameSelection'
import { HostControlRoom }     from '@/features/host/HostControlRoom'
import { AdminLoginPage }      from '@/features/admin/AdminLoginPage'
import { AdminLayout }         from '@/features/admin/AdminLayout'
import { AdminGameList }       from '@/features/admin/AdminGameList'
import { AdminGameEditor }     from '@/features/admin/AdminGameEditor'
import { AdminImportWizard }   from '@/features/admin/AdminImportWizard'
import { AdminSettingsPage }   from '@/features/admin/AdminSettingsPage'
import { AdminRoute }          from '@/features/auth/ProtectedRoute'
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

        {/* ── Admin login (both /admin and /erica) ───────────────── */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/erica" element={<AdminLoginPage />} />

        {/* ── Admin portal (protected) ───────────────────────────── */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="games"              element={<AdminGameList />} />
          <Route path="games/new"          element={<AdminGameEditor />} />
          <Route path="games/:gameId/edit" element={<AdminGameEditor />} />
          <Route path="import"             element={<AdminImportWizard />} />
          <Route path="settings"    element={<AdminSettingsPage />} />
          <Route index              element={<Navigate to="games" replace />} />
        </Route>

        {/* ── 404 ────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
