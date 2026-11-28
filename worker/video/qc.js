/**
 * The film, looked at once it exists.
 *
 * Every guarantee upstream is arithmetic on a DOCUMENT — legibility measured
 * against the surface a run is painted on, a motion proved by `sceneMotion`, a
 * box proved inside the safe area. None of it can see what an engine did with
 * the document: a GL scene that never drew its first frame, a page that stopped
 * answering the seek and repeated one frame for twenty seconds, an image that
 * failed to decode and left a scene of flat ground. Those are what this looks
 * for, in the file, after the render: one frame a second, small and grey, and
 * three questions about them.
 *
 *  - BLANK: a frame with no content at all — every pixel within a hair of the
 *    same value. Black, white or the ground's own colour, it says the same thing.
 *  - FAINT: content so washed out that nothing on the frame stands from anything
 *    else. Above blank, under anything a person reads.
 *  - FROZEN: consecutive frames that are the same frame. The compositions move
 *    by construction, so an identical second is an engine that stopped, not a
 *    calm scene: the threshold is near equality, not "little movement", because
 *    an overlay's 1.2 % drift is a legitimate scene that moves very little.
 *
 * Each is reported only as a RUN of whole seconds (`MIN_RUN`): a film that fades
 * in from black has one blank second by design, and two identical frames at the
 * turn of a mirrored loop are the loop.
 *
 * It never fails a render (Q1). A film with a frozen run is still a film the
 * person may want; what they are owed is to be told before they post it. And a
 * worker that cannot look — no ffmpeg, a format it cannot decode, a check that
 * overruns `CHECK_TIMEOUT_MS` — answers `checked: false`, which the panel says
 * nothing about rather than claiming a clean film.
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** One frame a second: a freeze or a hole shorter than that is not worth a warning. */
export const QC_FPS = 1
/** The width the frames are looked at: enough for a mean and a spread, nothing more. */
export const QC_WIDTH = 96
/** Below this standard deviation (0–255), a frame has no content. */
export const BLANK_SD = 2.5
/** Below this, it has content nobody can make out. */
export const FAINT_SD = 7
/** Below this mean absolute difference, two frames are the same frame. */
export const FROZEN_DIFF = 0.05
/** How many seconds a condition must last, by kind. */
export const MIN_RUN = { blank: 2, faint: 3, frozen: 3 }
/** How long the look may take, whatever the film. */
export const CHECK_TIMEOUT_MS = 30_000
/** At most this many issues travel back: a header is not a report. */
export const MAX_ISSUES = 8

export const QC_KINDS = ['blank', 'faint', 'frozen']

/** Mean and standard deviation of one grey frame. */
export function frameStats(frame) {
  const n = frame.length || 1
  let sum = 0
  for (let i = 0; i < frame.length; i++) sum += frame[i]
  const mean = sum / n
  let sq = 0
  for (let i = 0; i < frame.length; i++) sq += (frame[i] - mean) ** 2
  return { mean, sd: Math.sqrt(sq / n) }
}

/** Mean absolute difference between two frames of one size. */
export function frameDiff(a, b) {
  const n = Math.min(a.length, b.length) || 1
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i])
  return sum / n
}

/**
 * The issues in a film's frames, as runs of seconds.
 *
 * A frozen run is counted on the DIFFERENCES: three identical seconds is four
 * frames that are one frame, and the run covers the seconds between them.
 *
 * @param {Uint8Array[]} frames  one grey frame per second, in order
 * @returns {{ kind: 'blank'|'faint'|'frozen', from: number, to: number }[]}
 */
export function analyseFrames(frames, fps = QC_FPS) {
  const stats = frames.map(frameStats)
  const issues = []
  const runs = (kind, flags, offset = 0) => {
    let start = -1
    for (let i = 0; i <= flags.length; i++) {
      if (i < flags.length && flags[i]) {
        if (start < 0) start = i
      } else if (start >= 0) {
        if (i - start >= MIN_RUN[kind]) issues.push({ kind, from: (start + offset) / fps, to: (i + offset) / fps })
        start = -1
      }
    }
  }
  runs('blank', stats.map((s) => s.sd < BLANK_SD))
  runs('faint', stats.map((s) => s.sd >= BLANK_SD && s.sd < FAINT_SD))
  // A blank frame next to a blank frame is not ALSO a freeze: it was reported once.
  const diffs = []
  for (let i = 1; i < frames.length; i++) diffs.push(frameDiff(frames[i - 1], frames[i]) < FROZEN_DIFF && stats[i].sd >= BLANK_SD)
  runs('frozen', diffs, 0)
  return issues.sort((a, b) => a.from - b.from).slice(0, MAX_ISSUES)
}

/** The size the frames are decoded at: `QC_WIDTH` wide, the film's ratio, even. */
export function qcSize(width, height) {
  const w = QC_WIDTH
  const h = Math.max(2, Math.round((QC_WIDTH * (Number(height) || 9)) / (Number(width) || 16) / 2) * 2)
  return { w, h }
}

/** ffmpeg's grey frames for a file, one a second, split by size. */
function decodeFrames(file, { w, h }, { ffmpeg = 'ffmpeg', timeoutMs = CHECK_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vf', `fps=${QC_FPS},scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', 'pipe:1'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const chunks = []
    let err = ''
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`the check took longer than ${Math.round(timeoutMs / 1000)} s`))
    }, timeoutMs)
    timer.unref?.()
    proc.stdout.on('data', (c) => chunks.push(c))
    proc.stderr.on('data', (c) => {
      if (err.length < 2000) err += c
    })
    proc.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}${err ? `: ${err.trim().slice(0, 200)}` : ''}`))
      const all = Buffer.concat(chunks)
      const size = w * h
      const frames = []
      for (let at = 0; at + size <= all.length; at += size) frames.push(new Uint8Array(all.subarray(at, at + size)))
      resolve(frames)
    })
  })
}

/**
 * Look at a rendered film. Never throws.
 *
 * @param {Buffer} buffer  the file the engine wrote
 * @param {{ format?: string, width?: number, height?: number }} film
 * @returns {Promise<{ checked: true, seconds: number, issues: object[] } | { checked: false, detail: string }>}
 */
export async function checkFilm(buffer, film = {}, opts = {}) {
  const ext = film.format === 'webm' ? 'webm' : 'mp4'
  const file = path.join(os.tmpdir(), `mocky-qc-${crypto.randomBytes(8).toString('hex')}.${ext}`)
  try {
    await fs.writeFile(file, buffer)
    const frames = await decodeFrames(file, qcSize(film.width, film.height), opts)
    if (!frames.length) return { checked: false, detail: 'no frame could be decoded' }
    return { checked: true, seconds: frames.length, issues: analyseFrames(frames) }
  } catch (err) {
    return { checked: false, detail: (err instanceof Error ? err.message : String(err)).slice(0, 200) }
  } finally {
    await fs.rm(file, { force: true }).catch(() => {})
  }
}
