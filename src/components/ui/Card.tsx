import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag = (onClick ? 'button' : 'div') as any
  return (
    <Tag
      onClick={onClick}
      className={[
        'bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]',
        'shadow-[var(--shadow)] p-5',
        hoverable
          ? 'cursor-pointer transition-all duration-200 hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]'
          : '',
        onClick ? 'text-left w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </Tag>
  )
}

export function CardSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
