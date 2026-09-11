import { useState, useEffect } from 'react'

interface ConnectionStatusProps {
  className?: string
}

export function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const [online, setOnline] = useState(navigator.onLine)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      setReconnecting(false)
    }
    const handleOffline = () => {
      setOnline(false)
      setReconnecting(true)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online && !reconnecting) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed top-3 left-1/2 -translate-x-1/2 z-[9999]',
        'bg-[var(--yellow)] text-[#0f1117] text-sm font-semibold',
        'px-4 py-2 rounded-full shadow-lg animate-slide-in',
        className,
      ].join(' ')}
    >
      {online ? '🔄 Reconnecting…' : '⚠️ No connection'}
    </div>
  )
}
