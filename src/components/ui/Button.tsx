import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-[var(--accent)] text-white hover:opacity-90 active:scale-[.97]',
  secondary: 'bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] active:scale-[.97]',
  danger:    'bg-[var(--red)] text-white hover:opacity-90 active:scale-[.97]',
  success:   'bg-[var(--green)] text-[#0f1117] hover:opacity-90 active:scale-[.97]',
  ghost:     'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] active:scale-[.97]',
}

const sizeClasses: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md:  'px-4 py-2.5 text-base rounded-[var(--radius)] gap-2',
  lg:  'px-6 py-3.5 text-lg rounded-[var(--radius)] gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, fullWidth = false, className = '', children, disabled, ...rest }, ref) => {
    const isDisabled = disabled || loading
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-semibold cursor-pointer transition-all duration-150',
          'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
          className,
        ].filter(Boolean).join(' ')}
        aria-busy={loading}
        {...rest}
      >
        {loading && (
          <span
            className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
