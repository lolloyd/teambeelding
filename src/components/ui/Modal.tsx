import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className={[
        sizeClasses[size],
        'w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]',
        'shadow-[var(--shadow-lg)] p-0 backdrop:bg-black/60',
        'open:animate-bounce-in',
      ].join(' ')}
      aria-labelledby="modal-title"
    >
      <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
        <h2 id="modal-title" className="text-lg font-bold text-[var(--text)]">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
          ✕
        </Button>
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="flex gap-2 justify-end p-5 border-t border-[var(--border)]">
          {footer}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-[var(--text2)]">{message}</p>
    </Modal>
  )
}
