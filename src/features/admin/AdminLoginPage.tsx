import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/AuthProvider'

export function AdminLoginPage() {
  const { signInAdmin, isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in as admin — redirect to portal
  if (user && isAdmin) {
    navigate('/admin/games', { replace: true })
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      await signInAdmin(email.trim(), password)
      navigate('/admin/games', { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string; message?: string }).code
      if ((err as { message?: string }).message === 'NOT_ADMIN') {
        setError('Your account does not have Admin access.')
      } else if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_40%_60%,_var(--surface)_0%,_var(--bg)_70%)] px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">
            <span className="text-[var(--text)]">Team</span>
            <span className="text-[var(--accent)]">BEElding</span>
          </h1>
          <p className="text-sm text-[var(--text2)] mt-1">Admin Portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 shadow-[var(--shadow)] flex flex-col gap-4"
          noValidate
        >
          <h2 className="text-lg font-bold text-[var(--text)]">Sign In</h2>

          {error && (
            <div role="alert" className="text-sm text-[var(--red)] bg-[rgba(255,92,92,0.1)] border border-[rgba(255,92,92,0.3)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Input
            id="admin-email"
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="admin@example.com"
          />

          <Input
            id="admin-password"
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />

          <Button type="submit" fullWidth loading={loading} className="mt-1">
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-[var(--text2)] mt-6">
          Admin accounts are created manually in Firebase Authentication.
        </p>
      </div>
    </div>
  )
}
