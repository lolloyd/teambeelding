import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/features/auth/AuthProvider'

const NAV_ITEMS = [
  { to: '/admin/games',    label: '🎮 Games' },
  { to: '/admin/import',   label: '📥 Import' },
  { to: '/admin/settings', label: '⚙️ Settings' },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Top bar */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-4">
        <span className="font-black text-lg">
          <span className="text-[var(--text)]">Team</span>
          <span className="text-[var(--accent)]">BEElding</span>
          <span className="ml-2 text-xs font-semibold text-[var(--text2)] bg-[var(--surface2)] border border-[var(--border)] px-2 py-0.5 rounded-full">
            Admin
          </span>
        </span>

        <nav className="flex gap-1 ml-4" aria-label="Admin navigation">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors',
                  isActive
                    ? 'bg-[rgba(108,99,255,.15)] text-[var(--accent)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
