import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  id: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={!!error}
          className={[
            'w-full bg-[var(--surface2)] border rounded-lg px-3 py-2.5 text-[var(--text)]',
            'text-base outline-none transition-colors duration-150',
            'placeholder:text-[var(--text2)]',
            error
              ? 'border-[var(--red)] focus:border-[var(--red)]'
              : 'border-[var(--border)] focus:border-[var(--accent)]',
            className,
          ].filter(Boolean).join(' ')}
          {...rest}
        />
        {error && (
          <span id={`${id}-error`} className="text-xs text-[var(--red)]" role="alert">
            {error}
          </span>
        )}
        {hint && !error && (
          <span id={`${id}-hint`} className="text-xs text-[var(--text2)]">
            {hint}
          </span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
