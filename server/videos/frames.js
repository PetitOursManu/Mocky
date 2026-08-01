// Turning a generated clip into a scroll sequence.
//
// WHY FRAMES AND NOT A <video>
//
// The effect asked for is the one Apple uses on its product pages: the clip
// advances and rewinds with the scroll wheel, frame by frame, pinned while the
// sequence plays out. Driving `video.currentTime` from a scroll handler looks
// right in a demo and stutters in practice — a browser seeking an inter-frame
// compressed MP4 has to decode from the nearest keyframe every time, and a
// generated clip has very few of those.
//
// So the clip is cut into JPEGs once, server-side, and the preview swaps
// pictures. That is what makes the scrubbing exact, and it has a second effect
// worth as much: the sandboxed preview never needs a media source. The frames
// are images, and `img-src` is already allowed — the iframe's CSP does not move
// an inch to support this feature.
//
// FIXED RATE, NOT A FIXED COUNT
//
// Extracting "exactly 60 frames spread over the clip" needs the duration, which
// needs a probe pass. A fixed sample rate needs nothing: a 5-second clip at 12
// fps is 60 frames, a 3-second clip is 36, and both scrub identically because
// the sequence is driven by progress, not by time. The cap is what keeps a
// surprise 30-second clip from writing 400 files.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Frames per second sampled from the clip. */
export const DEFAULT_FPS = 12
/** Long edge of a stored frame, in pixels. */
export const DEFAULT_FRAME_WIDTH = 960
/** Hard ceiling on frames per sequence — see the note above. */
export const MAX_FRAMES = 150
/** JPEG quality for ffmpeg's -q:v (2 = best, 31 = worst). */
const JPEG_Q = 4
/** A clip should take seconds to cut; this only catches a wedged process. */
const FFMPEG_TIMEOUT_MS = 120_000

export class FfmpegMissingError extends Error {
  constructor(reason) {
    super(reason || 'ffmpeg is not available')
    this.name = 'FfmpegMissingError'
    this.code = 'FFMPEG_MISSING'
  }
}

let cached = null

/**
 * Is ffmpeg installed and runnable?
 *
 * Probed once and remembered: the answer decides whether the whole feature is
 * offered in the UI, and it is asked on every page load. `force` re-probes,
 * which is what the admin "test" button needs.
 *
 * Never throws — a missing binary is a normal state here, not an error.
 */
export async function ffmpegStatus({ exec = execFileAsync, force = false } = {}) {
  if (cached && !force) return cached
  try {
    const { stdout } = await exec('ffmpeg', ['-version'], { timeout: 10_000 })
    const version = String(stdout || '').split('\n')[0].trim()
    cached = { available: true, version: version.slice(0, 120) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    cached = {
      available: false,
      // ENOENT is the ordinary case (not installed) and deserves plain words;
      // anything else is worth showing verbatim to whoever has to fix it.
      reason: /ENOENT|not found|not recognized/i.test(msg)
        ? 'ffmpeg is not installed in this container'
        : msg.slice(0, 200),
    }
  }
  return cached
}

/** Forget the probe — for tests, and for the admin re-check. */
export function resetFfmpegStatus() {
  cached = null
}

/** `f0001.jpg` — zero-padded so a plain directory listing sorts correctly. */
export function frameName(index) {
  return `f${String(index).padStart(4, '0')}.jpg`
}

/**
 * Cuts `videoPath` into `outDir` as a numbered JPEG sequence plus a poster.
 *
 * Returns `{ frames, width, poster }` where `frames` is how many were actually
 * written — the caller must use that number rather than assume one, because it
 * depends on the length of the clip the model produced.
 *
 * @param {string} videoPath   an existing file on disk
 * @param {string} outDir      created if absent; must be empty or reusable
 * @param {object} [opts]
 * @param {number} [opts.fps]
 * @param {number} [opts.width]
 * @param {number} [opts.max]
 * @param {Function} [opts.exec]  injected for tests
 */
export async function extractFrames(videoPath, outDir, opts = {}) {
  const status = await ffmpegStatus({ exec: opts.exec })
  if (!status.available) throw new FfmpegMissingError(status.reason)

  const fps = Number(opts.fps) > 0 ? Math.min(30, Number(opts.fps)) : DEFAULT_FPS
  const width = Number(opts.width) > 0 ? Math.min(1920, Math.round(Number(opts.width))) : DEFAULT_FRAME_WIDTH
  const max = Number(opts.max) > 0 ? Math.min(600, Math.round(Number(opts.max))) : MAX_FRAMES
  const exec = opts.exec || execFileAsync

  fs.mkdirSync(outDir, { recursive: true })

  // -2 on the height keeps the aspect ratio AND lands on an even number, which
  // the JPEG encoder requires for chroma subsampling.
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-i', videoPath,
    '-vf', `fps=${fps},scale=${width}:-2`,
    '-frames:v', String(max),
    '-q:v', String(JPEG_Q),
    path.join(outDir, 'f%04d.jpg'),
  ]
  await exec('ffmpeg', args, { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 })

  const written = fs
    .readdirSync(outDir)
    .filter((f) => /^f\d{4}\.jpg$/.test(f))
    .sort()
  if (written.length === 0) {
    throw new Error('ffmpeg produced no frame — the clip may be empty or in an unsupported format')
  }

  // The poster is the first frame, copied rather than re-encoded: it is what
  // the screen shows before the sequence has finished preloading, and it must
  // be byte-identical to frame 1 so there is no visible jump when it does.
  const poster = path.join(outDir, 'poster.jpg')
  fs.copyFileSync(path.join(outDir, written[0]), poster)

  return { frames: written.length, width, fps, poster }
}
