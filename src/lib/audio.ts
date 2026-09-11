/**
 * Web Audio API sound engine — zero external dependencies.
 * Mirrors the approach from Buzzinga but extended for TeamBeelding events.
 * All sounds are synthesized; no copyrighted audio is used.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioCtx
}

function playSynth(
  freq: number,
  type: OscillatorType,
  gainVal: number,
  durMs: number,
  sweep = false
): void {
  const ctx = getAudioContext()
  const osc = ctx.createOscillator()
  const gn = ctx.createGain()
  osc.connect(gn)
  gn.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  if (sweep) {
    osc.frequency.linearRampToValueAtTime(freq * 1.5, ctx.currentTime + durMs / 2000)
  }
  gn.gain.setValueAtTime(gainVal, ctx.currentTime)
  gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
  osc.start()
  osc.stop(ctx.currentTime + durMs / 1000)
}

function playChime(freqs: number[] = [523, 659, 784]): void {
  freqs.forEach((f, i) => setTimeout(() => playSynth(f, 'sine', 0.15, 300), i * 90))
}

function playAirHorn(): void {
  const ctx = getAudioContext()
  const osc = ctx.createOscillator()
  const gn = ctx.createGain()
  osc.connect(gn)
  gn.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.15)
  osc.frequency.linearRampToValueAtTime(280, ctx.currentTime + 0.4)
  gn.gain.setValueAtTime(0.3, ctx.currentTime)
  gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc.start()
  osc.stop(ctx.currentTime + 0.5)
}

export type SoundEvent =
  | 'answer_submit'    // player submits answer
  | 'question_open'    // question opens for answers
  | 'question_close'   // timer expires / question closed
  | 'answer_reveal'    // correct answer revealed
  | 'correct_answer'   // player got it right
  | 'incorrect_answer' // player got it wrong
  | 'leaderboard'      // leaderboard shown
  | 'winner'           // winner announcement
  | 'tick_warning'     // last 5 seconds warning
  | 'join'             // player joins room

const SOUND_MAP: Record<SoundEvent, () => void> = {
  answer_submit:    () => playSynth(600, 'sine', 0.1, 80),
  question_open:    () => playSynth(440, 'square', 0.18, 120),
  question_close:   () => playSynth(220, 'sawtooth', 0.2, 200),
  answer_reveal:    () => playChime([523, 659, 784, 1047]),
  correct_answer:   () => playChime([659, 784, 1047]),
  incorrect_answer: () => playSynth(180, 'square', 0.15, 300),
  leaderboard:      () => playSynth(440, 'square', 0.18, 120),
  winner:           () => playAirHorn(),
  tick_warning:     () => playSynth(880, 'sine', 0.08, 60),
  join:             () => playSynth(523, 'sine', 0.12, 100),
}

let soundEnabled = false

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

export function playSound(event: SoundEvent): void {
  if (!soundEnabled) return
  try {
    SOUND_MAP[event]()
  } catch {
    // Audio context errors are non-fatal
  }
}

/** Call this on a user gesture to resume suspended AudioContext */
export function resumeAudioContext(): void {
  if (audioCtx?.state === 'suspended') {
    void audioCtx.resume()
  }
}
