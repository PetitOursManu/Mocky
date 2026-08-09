// `clock`, held to arithmetic — and to the one thing it must never do.
//
// A clock that read the render host would burn a fact about the MACHINE into
// somebody's film, and two renders of one timeline would then differ, which the
// content-addressed export store cannot have: the hash is the file's identity.
// So the angles are pinned for a stated time, and the source is read for any
// route to a clock at all. Prose cannot fail a build; these can.
//
// The import of `server/video/timeline.js` is TEST-ONLY, exactly as in
// `blocks.test.js`: the Docker build copies `worker/video/` and nothing else.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FPS } from '../composition.js'
import { TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import { CLOCK_HAND, CLOCK_SWEEP_TURNS, clockDial, clockHands } from './clock.jsx'

const here = path.dirname(fileURLToPath(import.meta.url))
/**
 * The source with its comments removed, for the reason `blocks.test.js` gives:
 * the house style names the bug a rule exists for, and this file's header talks
 * about the very thing the check below forbids. A check that read the prose
 * would fail on the sentence explaining why the code is right, which teaches
 * people to delete the sentence.
 */
const code = fs
  .readFileSync(path.join(here, 'clock.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1')

const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)

describe('the time comes from the document and from nowhere else', () => {
  /**
   * The angles are PINNED, which is what makes this a test about determinism
   * rather than about trigonometry: 09:30 is the hour hand a quarter past its
   * own mark, and no run of this suite on any machine in any timezone can answer
   * anything else.
   */
  it('reads the stated time, exactly', () => {
    const at = clockHands('09:30', 'fast', 0)
    expect(at.stated).toBe(true)
    // Nine hours is 270 degrees and half an hour carries the hand another 15.
    expect(at.hour).toBe(285)
    expect(at.minute).toBe(180)
    expect(at.sweep).toBe(0)
  })

  it('draws no numerals when the document stated no time', () => {
    for (const absent of [null, undefined, '']) {
      expect(clockHands(absent, 'fast', 0).stated, String(absent)).toBe(false)
    }
    // And the hands start at twelve rather than at an hour nobody asked for.
    expect(clockHands(null, 'fast', 0).hour).toBe(0)
    expect(clockHands(null, 'fast', 0).minute).toBe(0)
  })

  it('cannot reach a clock of its own', () => {
    expect(code).not.toMatch(/\bDate\b/)
    expect(code).not.toMatch(/\bnow\s*\(/)
    expect(code).not.toMatch(/getHours|getMinutes|getSeconds|toLocaleTimeString/)
  })

  it('answers the same thing twice, which is what the export store is addressed on', () => {
    expect(clockHands('23:59', 'real', 0.37)).toEqual(clockHands('23:59', 'real', 0.37))
  })
})

describe('the sweep hand', () => {
  /**
   * Per-frame over the longest scene the composed variant accepts, which is
   * where the step is smallest. A hand that advanced once a second would repeat
   * twenty-nine frames out of thirty — the stalled render this whole feature
   * stopped producing, in miniature.
   */
  it('is somewhere else on every frame, at either rate', () => {
    for (const sweep of Object.keys(CLOCK_SWEEP_TURNS)) {
      const seen = new Set()
      for (let frame = 0; frame < LONGEST; frame++) {
        seen.add(clockHands('09:30', sweep, frame / (LONGEST - 1)).sweep)
      }
      expect(seen.size, sweep).toBe(LONGEST)
    }
  })

  it('never advances by a whole second of dial in one frame', () => {
    const SECOND = 360 / 60
    for (const sweep of Object.keys(CLOCK_SWEEP_TURNS)) {
      const step = clockHands('09:30', sweep, 1 / (LONGEST - 1)).sweep - clockHands('09:30', sweep, 0).sweep
      expect(step, sweep).toBeGreaterThan(0)
      expect(step, sweep).toBeLessThan(SECOND)
    }
  })

  /**
   * And the movement is geared: one turn of the sweep is one minute, so it is
   * six degrees of minute hand and half a degree of hour hand. A clock whose
   * second hand turns under a minute hand nailed to its mark is a clock nobody
   * believes — and it is the sort of thing only ever noticed in the finished mp4.
   */
  it('carries the other two hands with it', () => {
    const start = clockHands('09:30', 'fast', 0)
    const end = clockHands('09:30', 'fast', 1)
    const turns = CLOCK_SWEEP_TURNS.fast
    expect(end.sweep - start.sweep).toBeCloseTo(turns * 360, 10)
    expect(end.minute - start.minute).toBeCloseTo(turns * 6, 10)
    expect(end.hour - start.hour).toBeCloseTo(turns * 0.5, 10)
  })

  it('falls back to the schema’s own default rate rather than to a still hand', () => {
    for (const unknown of ['slow', undefined, 'constructor']) {
      expect(clockHands('09:30', unknown, 1).sweep, String(unknown)).toBe(clockHands('09:30', 'fast', 1).sweep)
    }
  })
})

describe('the dial', () => {
  it('keeps every hand inside the circle it is drawn in', () => {
    for (const base of [1080, 1920]) {
      const dial = clockDial(base)
      for (const name of Object.keys(CLOCK_HAND)) {
        expect(dial[name].length, `${base}/${name}`).toBeLessThanOrEqual(dial.size / 2)
        expect(dial[name].width, `${base}/${name}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('draws the hand that carries the hour thickest and the one that sweeps thinnest', () => {
    const dial = clockDial(1080)
    expect(dial.hour.width).toBeGreaterThan(dial.minute.width)
    expect(dial.minute.width).toBeGreaterThan(dial.sweep.width)
    expect(dial.hour.length).toBeLessThan(dial.minute.length)
    expect(dial.minute.length).toBeLessThan(dial.sweep.length)
  })
})
