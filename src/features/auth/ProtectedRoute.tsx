import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

interface AnonRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

/**
 * Ensures an anonymous (or any) authenticated user exists.
 * Redirects to the given path if unauthenticated.
 */
export function AnonRoute({ children, redirectTo = '/' }: AnonRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
