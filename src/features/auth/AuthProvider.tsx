import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isAdmin: boolean
  isAnonymous: boolean
  signInAdmin: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signInAnon: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      setUser(fbUser)
      if (fbUser) {
        const tokenResult = await fbUser.getIdTokenResult(false)
        setIsAdmin(tokenResult.claims['admin'] === true)
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInAdmin = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const tokenResult = await credential.user.getIdTokenResult(true)
    if (tokenResult.claims['admin'] !== true) {
      await firebaseSignOut(auth)
      throw new Error('NOT_ADMIN')
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const signInAnon = async () => {
    if (!user || !user.isAnonymous) {
      await signInAnonymously(auth)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isAnonymous: user?.isAnonymous ?? false,
        signInAdmin,
        signOut,
        signInAnon,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
