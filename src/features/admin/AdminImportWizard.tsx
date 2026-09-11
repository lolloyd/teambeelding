import { useState, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes } from 'firebase/storage'
import { functions, storage } from '@/lib/firebase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { parseImportPackage } from '@/features/import-export/ImportParser'
import { buildImportPreview } from '@/features/import-export/ImportPreviewBuilder'
import type { ImportParseResult, ImportPreview, ImportValidationError } from '@/types'

type Step = 'upload' | 'validating' | 'preview' | 'importing' | 'done' | 'error'

export function AdminImportWizard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const packageInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef    = useRef<HTMLInputElement>(null)
  const zipInputRef     = useRef<HTMLInputElement>(null)

  const [step, setStep]     = useState<Step>('upload')
  const [mode, setMode]     = useState<'package' | 'separate'>('package')
  const [parsed, setParsed] = useState<ImportParseResult | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importId] = useState(() => `import_${Date.now()}`)

  const blockingErrors = (preview?.errors ?? []).filter(e => !e.isWarning)
  const warnings       = (preview?.errors ?? []).filter(e => e.isWarning)

  const handleFileValidation = async (
    packageFile: File | null,
    xlsxFile: File | null,
    imageZip: File | null
  ) => {
    setStep('validating')
    try {
      const result = await parseImportPackage(packageFile, xlsxFile, imageZip)
      const pv = buildImportPreview(result)
      setParsed(result)
      setPreview(pv)
      setStep('preview')
    } catch (e: unknown) {
      console.error('Parse error', e)
      toast('Failed to parse the import package.', 'error')
      setStep('error')
    }
  }

  const handlePackageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file) void handleFileValidation(file, null, null)
  }

  const handleSeparateValidate = () => {
    const xlsx = xlsxInputRef.current?.files?.[0] ?? null
    const zip  = zipInputRef.current?.files?.[0] ?? null
    if (!xlsx) { toast('Please select an Excel workbook.', 'error'); return }
    void handleFileValidation(null, xlsx, zip)
  }

  const handleImport = async () => {
    if (!parsed || !user || blockingErrors.length > 0) return
    setStep('importing')
    try {
      // Upload images to staging
      if (parsed.imageFilenames.length > 0 && mode === 'package' && packageInputRef.current?.files?.[0]) {
        const JSZip = (await import('jszip')).default
        const pkg = packageInputRef.current.files[0]
        const zip = await JSZip.loadAsync(await pkg.arrayBuffer())
        for (const filename of parsed.imageFilenames) {
          // Try the full path first (e.g. images/sample-001/landmark.png),
          // then fall back to just the basename (e.g. images/landmark.png)
          // to handle both nested and flat ZIP structures.
          const baseName = filename.includes('/') ? filename.split('/').pop()! : filename
          const entry = zip.files[`images/${filename}`] ?? zip.files[`images/${baseName}`]
          if (!entry) continue
          const data = await entry.async('arraybuffer')
          const storageRef = ref(storage, `import-staging/${user.uid}/${importId}/${filename}`)
          await uploadBytes(storageRef, data)
        }
      }
      // Call Cloud Function to commit import
      const fn = httpsCallable(functions, 'importGamePackage')
      await fn({
        importId,
        adminUid: user.uid,
        manifest: parsed.manifest,
        games:     parsed.games,
        rounds:    parsed.rounds,
        questions: parsed.questions,
        choices:   parsed.choices,
        imageFilenames: parsed.imageFilenames,
      })
      setStep('done')
      toast('Games imported successfully!', 'success')
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Import failed.'
      toast(msg, 'error')
      setStep('error')
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/games')}>← Back</Button>
        <h1 className="text-2xl font-bold text-[var(--text)]">Import Game</h1>
      </div>

      {/* Step: Upload */}
      {(step === 'upload' || step === 'validating') && (
        <Card>
          <h2 className="text-lg font-bold mb-4">Select Import Package</h2>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-6">
            {(['package', 'separate'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  mode === m
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {m === 'package' ? '📦 ZIP Package' : '📄 Separate Files'}
              </button>
            ))}
          </div>

          {mode === 'package' ? (
            <div>
              <p className="text-sm text-[var(--text2)] mb-4">
                Upload a <code className="font-mono bg-[var(--surface2)] px-1 rounded">teambeelding-package.zip</code> containing
                the workbook and images folder.
              </p>
              <input
                ref={packageInputRef}
                type="file"
                accept=".zip"
                onChange={handlePackageChange}
                className="block w-full text-sm text-[var(--text2)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--accent)] file:text-white hover:file:opacity-90 cursor-pointer"
                aria-label="Upload ZIP package"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">
                  Excel Workbook (.xlsx) *
                </label>
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx"
                  className="block w-full text-sm text-[var(--text2)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--surface2)] file:text-[var(--text)] cursor-pointer"
                  aria-label="Upload Excel workbook"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)] block mb-1">
                  Image ZIP (optional)
                </label>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  className="block w-full text-sm text-[var(--text2)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--surface2)] file:text-[var(--text)] cursor-pointer"
                  aria-label="Upload image ZIP"
                />
              </div>
              <Button onClick={handleSeparateValidate} loading={step === 'validating'}>
                Validate Files
              </Button>
            </div>
          )}

          {step === 'validating' && (
            <div className="flex items-center gap-2 mt-4 text-[var(--text2)]">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              Parsing and validating package…
            </div>
          )}
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <div className="flex flex-col gap-6">
          {/* Errors / Warnings */}
          {blockingErrors.length > 0 && (
            <Card className="border-[var(--red)]">
              <h2 className="font-bold text-[var(--red)] mb-3">❌ {blockingErrors.length} Validation Error{blockingErrors.length !== 1 ? 's' : ''}</h2>
              <ErrorList errors={blockingErrors} />
            </Card>
          )}
          {warnings.length > 0 && (
            <Card className="border-[var(--yellow)]">
              <h2 className="font-bold text-[var(--yellow)] mb-3">⚠️ {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}</h2>
              <ErrorList errors={warnings} />
            </Card>
          )}

          {/* Summary */}
          {blockingErrors.length === 0 && (
            <Card>
              <h2 className="text-lg font-bold mb-4">✅ Package Preview — {preview.packageName}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Games',        value: preview.gameCount },
                  { label: 'Rounds',       value: preview.roundCount },
                  { label: 'Questions',    value: preview.questionCount },
                  { label: 'Tiebreakers', value: preview.tiebreakerCount },
                  { label: 'Images',       value: preview.imageCount },
                ].map(s => (
                  <div key={s.label} className="bg-[var(--surface2)] rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-[var(--accent)]">{s.value}</div>
                    <div className="text-xs text-[var(--text2)] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Game details */}
              {preview.games.map(g => (
                <details key={g.gameKey} className="border border-[var(--border)] rounded-xl mb-3">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-[var(--text)] hover:bg-[var(--surface2)] rounded-xl">
                    🎮 {g.title} — {g.roundCount} round{g.roundCount !== 1 ? 's' : ''}, {g.questionCount} questions
                  </summary>
                  <div className="px-4 pb-4">
                    {g.rounds.map(r => (
                      <details key={r.roundKey} className="mt-2 border border-[var(--border)] rounded-lg">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:bg-[var(--surface2)] rounded-lg">
                          Round {r.roundNumber}: {r.title} ({r.gameType}) — {r.questionCount} questions
                        </summary>
                        <ul className="px-4 pb-3 pt-1 flex flex-col gap-1">
                          {r.questions.map(q => (
                            <li key={q.questionKey} className="text-xs text-[var(--text2)]">
                              Q{q.questionNumber}: {q.prompt.slice(0, 60)}{q.prompt.length > 60 ? '…' : ''}
                              {q.isTiebreaker ? ' ⚖️' : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </details>
              ))}

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setStep('upload')}>← Back</Button>
                <Button variant="primary" onClick={() => void handleImport()} fullWidth>
                  📥 Import {preview.gameCount} Game{preview.gameCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </Card>
          )}

          {blockingErrors.length > 0 && (
            <Button variant="secondary" onClick={() => setStep('upload')}>← Fix and Re-upload</Button>
          )}
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card className="text-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[var(--text2)]">Uploading images and saving games…</p>
        </Card>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card className="text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">Import Complete</h2>
          <p className="text-[var(--text2)] mb-6">Your games have been imported and are ready to publish.</p>
          <Button variant="primary" onClick={() => navigate('/admin/games')}>View Games →</Button>
        </Card>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <Card className="text-center py-16 border-[var(--red)]">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">Import Failed</h2>
          <p className="text-[var(--text2)] mb-6">Something went wrong. Please check the errors and try again.</p>
          <Button variant="secondary" onClick={() => setStep('upload')}>← Try Again</Button>
        </Card>
      )}
    </div>
  )
}

function ErrorList({ errors }: { errors: ImportValidationError[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {errors.map((e, i) => (
        <li key={i} className="font-mono text-xs bg-[var(--surface2)] rounded-lg px-3 py-2">
          <span className="font-bold text-[var(--text)]">[{e.sheet}]</span>
          {e.row && ` Row ${e.row}`}
          {e.column && ` / ${e.column}`}
          {' — '}
          <span className="text-[var(--text2)]">{e.message}</span>
          <span className="ml-2 text-[var(--text2)]">({e.errorCode})</span>
        </li>
      ))}
    </ul>
  )
}
