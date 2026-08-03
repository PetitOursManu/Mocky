/**
 * Playback arithmetic for a frame sequence.
 *
 * Mocky's clips are not video files. `server/videos/frames.js` cuts every clip
 * into numbered JPEGs, and `PUBLIC_VIDEO_PATH` deliberately exposes only
 * `poster.jpg` and `f/N.jpg` — `source.mp4` is unreachable over HTTP and a test
 * holds it that way, because these URLs are unauthenticated so that a preview
 * iframe (opaque origin, no cookie) can still show a scroll sequence. So there
 * is no `<video>` element to hand this to: playing means advancing an index.
 *
 * Kept apart from the component because this repo has no DOM test harness — no
 * jsdom, no testing-library — so anything that needs testing has to be a plain
 * function. The timing rules below are exactly the part worth testing.
 */

/** Frames are 1-based on the wire: `/f/1.jpg` … `/f/<frames>.jpg`. */
export const FIRST_FRAME = 1

/**
 * Which frame should be showing after `elapsedMs` of playback.
 *
 * Derived from elapsed time rather than incremented per tick. A counter driven
 * by `setInterval` accumulates every scheduling delay it ever suffers, so a clip
 * played in a busy tab finishes visibly late and two clips started together
 * drift apart. Time is the source of truth; the frame is a function of it.
 *
 * Returns a 1-based index, clamped to the sequence.
 */
export function frameAt(elapsedMs: number, fps: number, frames: number, loop = true): number {
  if (!(frames > 0)) return FIRST_FRAME
  // A clip whose metadata lost its fps would otherwise divide by zero and show
  // frame Infinity, i.e. a blank player with no error anywhere.
  const rate = fps > 0 ? fps : 12
  const advanced = Math.floor((Math.max(0, elapsedMs) * rate) / 1000)
  if (loop) return (advanced % frames) + FIRST_FRAME
  return Math.min(frames, advanced + FIRST_FRAME)
}

/** How long the whole sequence runs, in milliseconds. */
export function durationMs(frames: number, fps: number): number {
  if (!(frames > 0)) return 0
  return (frames * 1000) / (fps > 0 ? fps : 12)
}

/** Where playback should resume from to show `frame` next. */
export function elapsedForFrame(frame: number, fps: number): number {
  const rate = fps > 0 ? fps : 12
  return ((Math.max(FIRST_FRAME, frame) - FIRST_FRAME) * 1000) / rate
}

/**
 * `m:ss` for a position on the scrub bar.
 *
 * Frames, not seconds, are what the user is scrubbing through, but a frame
 * number means nothing to anyone reading it. Both are shown.
 */
export function timecode(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * The order to fetch frames in, starting from where playback is.
 *
 * A sequence can run to 150 frames, and requesting all of them at once buries
 * the frames actually about to be shown behind the browser's connection limit.
 * This walks forward from the current position and wraps, so the next thing
 * needed is always the next thing asked for.
 */
export function fetchOrder(frames: number, from = FIRST_FRAME): number[] {
  if (!(frames > 0)) return []
  const start = Math.min(Math.max(FIRST_FRAME, from), frames)
  const out: number[] = []
  for (let i = 0; i < frames; i++) out.push(((start - FIRST_FRAME + i) % frames) + FIRST_FRAME)
  return out
}

/**
 * Enough frames buffered to start without stuttering?
 *
 * Waiting for the whole sequence means staring at a spinner for several seconds
 * on a long clip; starting at one frame means playing straight into a gap. Half
 * a second of material, or the whole clip when it is shorter than that.
 */
export function readyToPlay(loaded: number, frames: number, fps: number): boolean {
  if (!(frames > 0)) return false
  const want = Math.min(frames, Math.max(2, Math.ceil((fps > 0 ? fps : 12) / 2)))
  return loaded >= want
}
