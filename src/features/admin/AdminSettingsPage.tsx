import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

export function AdminSettingsPage() {
  const { toast } = useToast()
  const [maxNameLength, setMaxNameLength] = useState(20)
  const [blockedWordsRaw, setBlockedWordsRaw] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const blockedWords = blockedWordsRaw
        .split('\n')
        .map(w => w.trim().toLowerCase())
        .filter(Boolean)
      await httpsCallable(functions, 'updateAppConfig')({ maxPlayerNameLength: maxNameLength, blockedWords })
      toast('Settings saved.', 'success')
    } catch {
      toast('Failed to save settings.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Card className="flex flex-col gap-5">
        <Input
          id="max-name-length"
          label="Max Player Name Length"
          type="number"
          min={3}
          max={50}
          value={maxNameLength}
          onChange={e => setMaxNameLength(Number(e.target.value))}
        />
        <div>
          <label htmlFor="blocked-words" className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">
            Blocked Words (one per line)
          </label>
          <textarea
            id="blocked-words"
            value={blockedWordsRaw}
            onChange={e => setBlockedWordsRaw(e.target.value)}
            rows={6}
            className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] resize-y"
            placeholder="Enter each blocked word on a new line"
          />
        </div>
        <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
          Save Settings
        </Button>
      </Card>
    </div>
  )
}
