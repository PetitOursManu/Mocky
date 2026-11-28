import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { BLANK_SD, FAINT_SD, analyseFrames, checkFilm, frameStats, qcSize } from './qc.js'

/**
 * The look at a finished film: what counts as a hole, a washed-out passage and a
 * freeze, and that none of it fails a render.
 */

const W = 96
const H = 54
const flat = (v) => new Uint8Array(W * H).fill(v)
/** A frame with content: a gradient shifted by `k`, so two of them differ. */
const busy = (k) => Uint8Array.from({ length: W * H }, (_, i) => ((i % W) * 2 + k * 7 + Math.floor(i / W)) % 256)
const washed = (k) => Uint8Array.from({ length: W * H }, (_, i) => 128 + (((i % W) + k) % 12) - 6)

describe('reading the frames', () => {
  it('tells a flat frame, a washed-out one and a real one apart', () => {
    expect(frameStats(flat(0)).sd).toBe(0)
    expect(frameStats(washed(0)).sd).toBeGreaterThanOrEqual(BLANK_SD)
    expect(frameStats(washed(0)).sd).toBeLessThan(FAINT_SD)
    expect(frameStats(busy(0)).sd).toBeGreaterThan(FAINT_SD)
  })

  it('reports nothing on a film that moves all the way through', () => {
    expect(analyseFrames(Array.from({ length: 12 }, (_, i) => busy(i)))).toEqual([])
  })

  it('allows one blank second — a fade from black — and reports two', () => {
    expect(analyseFrames([flat(0), busy(1), busy(2), busy(3)])).toEqual([])
    expect(analyseFrames([busy(0), flat(0), flat(0), busy(3)])).toEqual([{ kind: 'blank', from: 1, to: 3 }])
  })

  it('reports a freeze of three seconds, not two identical frames at a loop’s turn', () => {
    const still = busy(5)
    expect(analyseFrames([busy(0), still, still, busy(3)])).toEqual([])
    expect(analyseFrames([busy(0), still, still, still, still, busy(9)])).toEqual([{ kind: 'frozen', from: 1, to: 4 }])
  })

  it('does not report a blank passage a second time as frozen', () => {
    const issues = analyseFrames([flat(0), flat(0), flat(0), flat(0), busy(1)])
    expect(issues.map((i) => i.kind)).toEqual(['blank'])
  })

  it('reports a washed-out passage', () => {
    expect(analyseFrames([busy(0), washed(1), washed(2), washed(3), busy(4)])).toEqual([{ kind: 'faint', from: 1, to: 4 }])
  })

  it('decodes at the film’s own ratio, on even sizes', () => {
    expect(qcSize(1920, 1080)).toEqual({ w: 96, h: 54 })
    expect(qcSize(1080, 1920)).toEqual({ w: 96, h: 170 })
    expect(qcSize(1080, 1080)).toEqual({ w: 96, h: 96 })
  })
})

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

describe('looking at a real file', () => {
  it('never throws: bytes that are not a film are "not checked"', async () => {
    const out = await checkFilm(Buffer.from('not a film'), { format: 'mp4', width: 1920, height: 1080 })
    expect(out.checked).toBe(false)
    expect(typeof out.detail).toBe('string')
    // ffmpeg is spawned even on bytes that are not a film, and a loaded machine
    // starts it slowly: the default 5 s made this flaky in the full suite.
  }, 30_000)

  it.skipIf(!hasFfmpeg)('finds the black hole and the freeze ffmpeg was asked to make', async () => {
    // Three seconds of black, three of a moving test card, four of one frame held.
    const make = spawnSync(
      'ffmpeg',
      [
        '-v', 'error',
        '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=25:d=3',
        '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=3',
        '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=0.04,tpad=stop_mode=clone:stop_duration=4',
        '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1',
      ],
      { maxBuffer: 50 * 1024 * 1024 },
    )
    expect(make.status, String(make.stderr)).toBe(0)
    const out = await checkFilm(make.stdout, { format: 'mp4', width: 320, height: 180 })
    expect(out.checked).toBe(true)
    const kinds = out.issues.map((i) => i.kind)
    expect(kinds).toContain('blank')
    expect(kinds).toContain('frozen')
    const blank = out.issues.find((i) => i.kind === 'blank')
    expect(blank.from).toBe(0)
    expect(blank.to).toBeGreaterThanOrEqual(2)
  }, 30_000)
})
