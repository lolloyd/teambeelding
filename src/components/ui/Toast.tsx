import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | ''

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = '') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const borderColor = (type: ToastType) => {
    if (type === 'success') return 'border-l-4 border-l-[var(--green)]'
    if (type === 'error')   return 'border-l-4 border-l-[var(--red)]'
    return 'border-l-4 border-l-[var(--accent)]'
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-xs"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={[
              'bg-[var(--surface2)] border border-[var(--border)]',
              borderColor(t.type),
              'rounded-xl px-4 py-3 text-sm text-[var(--text)] shadow-[var(--shadow)]',
              'animate-slide-in-right pointer-events-auto',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
