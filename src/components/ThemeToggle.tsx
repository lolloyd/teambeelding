import { useTheme, type Theme } from '@/hooks/useTheme'

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'light',  label: 'Light',  icon: '☀️' },
  { value: 'dark',   label: 'Dark',   icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
]

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className={`flex items-center gap-1 bg-[var(--surface2)] border border-[var(--border)] rounded-full p-1 ${className}`}
      role="group"
      aria-label="Select theme"
    >
      {THEMES.map(t => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          aria-pressed={theme === t.value}
          aria-label={`${t.label} theme`}
          title={t.label}
          className={[
            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150',
            theme === t.value
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text2)] hover:text-[var(--text)]',
          ].join(' ')}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  )
}
