import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center bg-[var(--bg)]">
      <div className="text-7xl select-none" aria-hidden="true">🐝</div>
      <h1 className="text-4xl font-black text-[var(--text)]">404</h1>
      <p className="text-[var(--text2)] max-w-sm">
        This page doesn&apos;t exist. Maybe the game already ended?
      </p>
      <Link to="/">
        <Button variant="primary">← Back to Home</Button>
      </Link>
    </div>
  )
}
