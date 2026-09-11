import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_60%_30%,_var(--surface)_0%,_var(--bg)_70%)]">
      {/* Header spacer */}
      <div className="flex-1" />

      {/* Hero */}
      <main className="flex flex-col items-center justify-center gap-6 px-4 text-center">
        {/* Wordmark */}
        <div className="select-none">
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none">
            <span className="text-[var(--text)]">Team</span>
            <span className="text-[var(--accent)]">BEElding</span>
          </h1>
          <p className="mt-3 text-lg text-[var(--text2)] max-w-md mx-auto">
            Live team-building games for your next online meeting.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-2">
          <Link to="/join" className="flex-1">
            <Button size="lg" variant="primary" fullWidth>
              ⚡ Join a Game
            </Button>
          </Link>
          <Link to="/host" className="flex-1">
            <Button size="lg" variant="secondary" fullWidth>
              🎮 Create a Room
            </Button>
          </Link>
        </div>

        {/* Theme toggle */}
        <ThemeToggle className="mt-4" />
      </main>

      <div className="flex-1" />

      {/* Footer */}
      <footer className="text-center py-6 px-4">
        <Link
          to="/admin"
          className="text-xs text-[var(--text2)] hover:text-[var(--accent)] transition-colors"
          aria-label="Admin portal"
        >
          Admin ↗
        </Link>
      </footer>
    </div>
  )
}
