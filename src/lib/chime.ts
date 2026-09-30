import type { ChimeKind } from './workChime'

/**
 * The end-of-work chime: two notes synthesised with the Web Audio API.
 *
 * No audio file and no dependency. A file would be one more thing to vendor,
 * hash-pin and serve, for under a second of sound that four oscillators make
 * exactly — and a synthesised note can be checked by a test, which a recording
 * cannot (see `chime.test.ts`: every envelope starts and ends at silence).
 *
 * The hard part is not the sound, it is being ALLOWED to make it. Browsers
 * refuse audio that no user gesture started, and a hidden tab receives no
 * gestures — which is the only time this plays. So the context is created and
 * resumed ("primed") during the click that starts the work, while the page
 * still has the user's activation, and only USED when the work ends. Chrome and
 * Firefox would accept a later start on the strength of any earlier click;
 * Safari wants the context unlocked inside the gesture itself, hence the
 * one-sample silent buffer. Whatever a browser refuses, this degrades to
 * silence: a notification that throws would be worse than none.
 */

/** Per browser, like the theme and the language. Absent means on. */
export const CHIME_PREF_KEY = 'mocky.chime'

export function loadChimeEnabled(): boolean {
  try {
    return localStorage.getItem(CHIME_PREF_KEY) !== '0'
  } catch {
    // Storage blocked: fall back to the default rather than to silence, since
    // the toggle that would explain the silence cannot be saved either.
    return true
  }
}

export function saveChimeEnabled(on: boolean): void {
  try {
    localStorage.setItem(CHIME_PREF_KEY, on ? '1' : '0')
  } catch {
    /* private mode, quota — the choice lasts for this page only */
  }
}

export interface ChimeNote {
  /** Hz. */
  freq: number
  /** Seconds after the chime starts. */
  at: number
  /** Seconds from attack to silence. */
  dur: number
  /** Linear gain at the top of the attack. */
  peak: number
}

/**
 * The two phrases. "done" rises a fifth (E5 → B5), "failed" falls a major third
 * a register lower (A4 → F4): told apart by direction and pitch, so neither
 * needs to be louder or harsher than the other to be recognised. The peaks are
 * quiet on purpose — this plays in someone's ears while they are doing
 * something else.
 */
export const CHIME_NOTES: Record<ChimeKind, ChimeNote[]> = {
  done: [
    { freq: 659.25, at: 0, dur: 0.45, peak: 0.09 },
    { freq: 987.77, at: 0.13, dur: 0.6, peak: 0.08 },
  ],
  failed: [
    { freq: 440, at: 0, dur: 0.42, peak: 0.08 },
    { freq: 349.23, at: 0.16, dur: 0.6, peak: 0.08 },
  ],
}

/** A quiet partial an octave up: what turns a test tone into a bell. */
const OVERTONE = { ratio: 2, share: 0.22 }
/** Attack time. Shorter than this is a click; longer is a swell. */
export const CHIME_ATTACK = 0.012
/**
 * The floor of the exponential decay. An exponential ramp cannot reach zero
 * (the Web Audio API throws on a zero target), and stopping on a non-zero gain
 * is the click this whole envelope exists to avoid — so it decays to a value
 * far below hearing, then the oscillator stops a moment later.
 */
export const CHIME_FLOOR = 0.0001
const STOP_TAIL = 0.03

/** How long a phrase lasts, tail included. */
export function chimeLength(kind: ChimeKind): number {
  return Math.max(...CHIME_NOTES[kind].map((n) => n.at + n.dur)) + STOP_TAIL
}

/** Schedule one phrase on a context, starting at `start` (context time). */
export function scheduleChime(ctx: BaseAudioContext, kind: ChimeKind, start: number): void {
  for (const note of CHIME_NOTES[kind]) {
    for (const [ratio, share] of [
      [1, 1],
      [OVERTONE.ratio, OVERTONE.share],
    ] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = note.freq * ratio
      const t0 = start + note.at
      const end = t0 + note.dur
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(note.peak * share, t0 + CHIME_ATTACK)
      gain.gain.exponentialRampToValueAtTime(CHIME_FLOOR, end)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
      osc.start(t0)
      osc.stop(end + STOP_TAIL)
    }
  }
}

type AudioContextCtor = new () => AudioContext

let ctx: AudioContext | null = null

function contextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

/** The page's one context, created on first need. Null where there is none. */
function context(): AudioContext | null {
  if (ctx && ctx.state !== 'closed') return ctx
  const Ctor = contextCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

// A function, not an inline comparison: TypeScript narrows `state` after the
// first check and would call the second one, after an await, impossible.
const running = (c: AudioContext) => c.state === 'running'

/**
 * Call inside a user gesture. Cheap once the context runs, so it can be called
 * on every click that might start work. Does nothing when the chime is off: a
 * preference of "no sound" should not open an audio device either.
 */
export function primeChime(): void {
  if (!loadChimeEnabled()) return
  // A gesture means work may be starting: a release still pending from the
  // last burst must not suspend the context under it.
  cancelRelease()
  const c = context()
  if (!c || running(c)) return
  try {
    void c.resume().catch(() => {})
    const silent = c.createBuffer(1, 1, 22050)
    const src = c.createBufferSource()
    src.buffer = silent
    src.connect(c.destination)
    src.start(0)
  } catch {
    /* refused — play() will find out and stay silent */
  }
}

/**
 * Suspending once the page is idle again.
 *
 * Primed on the first click and never suspended, the context kept the audio
 * thread and the output device open for the life of the tab — a steady cost on
 * a laptop, paid for a sound that plays once, at the end of work, in a tab
 * nobody is looking at. It is released only at moments a fresh gesture is sure
 * to come before the next need: after a chime has played, when a burst ended
 * with nothing to play, and when the person comes back to an idle tab. The
 * click that starts the next piece of work primes it again.
 */
let releaseTimer: ReturnType<typeof setTimeout> | null = null
const RELEASE_TAIL_MS = 250

function cancelRelease(): void {
  if (releaseTimer !== null) clearTimeout(releaseTimer)
  releaseTimer = null
}

export function releaseChime(afterMs = 0): void {
  cancelRelease()
  releaseTimer = setTimeout(() => {
    releaseTimer = null
    const c = ctx
    if (c && running(c)) void c.suspend().catch(() => {})
  }, afterMs)
}

/** How long to wait for a suspended context to agree to run. */
const RESUME_WAIT_MS = 250

/**
 * Play a phrase. Resolves true when it was scheduled, false when the browser
 * would not let it (no Web Audio, no activation, a closed device).
 *
 * `force` skips the preference: the settings panel's "Test" button must sound
 * even while the switch beside it is off, or the person deciding cannot hear
 * what they are deciding about.
 */
export async function playChime(kind: ChimeKind, opts: { force?: boolean } = {}): Promise<boolean> {
  if (!opts.force && !loadChimeEnabled()) return false
  const c = context()
  if (!c) return false
  try {
    if (!running(c)) {
      // A resume the browser refuses may never settle, so it gets a deadline
      // rather than an await.
      await Promise.race([c.resume(), new Promise((r) => setTimeout(r, RESUME_WAIT_MS))])
    }
    if (!running(c)) return false
    scheduleChime(c, kind, c.currentTime + 0.02)
    releaseChime(chimeLength(kind) * 1000 + RELEASE_TAIL_MS)
    return true
  } catch {
    return false
  }
}
