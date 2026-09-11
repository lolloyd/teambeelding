import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useEffect } from 'react'

export function JoinPage() {
  const { user, signInAnon, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [codeError, setCodeError] = useState('')
  const [nameError, setNameError] = useState('')
  const [joining, setJoining] = useState(false)

  // Ensure anonymous auth before allowing join
  useEffect(() => {
    if (!authLoading && !user) void signInAnon()
  }, [authLoading, user, signInAnon])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    let valid = true
    setCodeError('')
    setNameError('')

    const trimCode = code.trim().toUpperCase()
    if (trimCode.length !== 6) {
      setCodeError('Enter the 6-character room code.')
      valid = false
    }
    if (!name.trim()) {
      setNameError('Enter your display name.')
      valid = false
    }
    if (!valid) return

    setJoining(true)
    try {
      const fn = httpsCallable<{ roomCode: string; displayName: string }, { roomId: string }>(
        functions,
        'joinRoom'
      )
      await fn({ roomCode: trimCode, displayName: name.trim() })
      navigate(`/play/${trimCode}`)
    } catch (e: unknown) {
      const code = (e as { code?: string; message?: string }).code ?? ''
      const msg  = (e as { message?: string }).message ?? ''
      if (msg.includes('NOT_FOUND') || code === 'not-found') {
        setCodeError('Room not found. Check the code and try again.')
      } else if (msg.includes('NAME_TAKEN') || msg.includes('DUPLICATE')) {
        setNameError('That name is already taken in this room. Please choose another.')
      } else if (msg.includes('ROOM_FULL')) {
        toast('This room is full.', 'error')
      } else if (msg.includes('BLOCKED_WORD') || msg.includes('INVALID_NAME')) {
        setNameError('That name is not allowed.')
      } else if (msg.includes('EXPIRED')) {
        toast('This game has already ended.', 'error')
      } else {
        toast('Could not join. Please try again.', 'error')
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_40%_60%,_var(--surface)_0%,_var(--bg)_70%)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">
            <span className="text-[var(--text)]">Team</span>
            <span className="text-[var(--accent)]">BEElding</span>
          </h1>
          <p className="text-sm text-[var(--text2)] mt-1">Join a live game</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 shadow-[var(--shadow)] flex flex-col gap-4"
          noValidate
        >
          <Input
            id="room-code"
            label="Room Code"
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="e.g. ABC123"
            error={codeError}
            className="text-center text-2xl tracking-[0.4em] font-black uppercase"
          />

          <Input
            id="display-name"
            label="Your Name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={32}
            autoComplete="nickname"
            placeholder="e.g. Alex"
            error={nameError}
          />

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={joining || authLoading}
          >
            ⚡ Join Game
          </Button>
        </form>

        <div className="flex justify-center mt-6">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
