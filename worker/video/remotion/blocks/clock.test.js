// `clock`, held to arithmetic — to the box it was given, and to the one thing it
// must never do.
//
// A clock that read the render host would burn a fact about the MACHINE into
// somebody's film, and two renders of one timeline would then differ, which the
// content-addressed export store cannot have: the hash is the file's identity.
// So the angles are pinned for a stated time, and both this block's source and
// the module behind it are read for any route to a clock at all. Prose cannot
// fail a build; these can.
//
// The import of `server/video/timeline.js` is TEST-ONLY, exactly as in
// `blocks.test.js`: the Docker build copies `worker/video/` and nothing else.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FPS, composedSafeArea, dimensionsFor, frameBase, textWidth } from '../composition.js'
import { BLOCK_LIMITS, TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import { CLOCK_BLANK, CLOCK_HAND, CLOCK_SWEEP_TURNS, clockFace, clockHands } from './media.js'

const here = path.dirname(fileURLToPath(import.meta.url))
/**
 * The sources with their comments removed, for the reason `blocks.test.js`
 * gives: the house style names the bug a rule exists for, and both headers talk
 * about the very thing the check below forbids. A check that read the prose
 * would fail on the sentence explaining why the code is right, which teaches
 * people to delete the sentence.
 *
 * Two files rather than one, because the arithmetic moved: `media.js` is where a
 * `new Date()` would now be most tempting, and a check that still read only the
 * component would have stopped seeing the code it was written about.
 */
const code = (file) =>
  fs
    .readFileSync(path.join(here, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')

const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)

/** The three shapes a zone turns out to be, in all three ratios. */
const SHAPES = ['16:9', '9:16', '1:1'].flatMap((ratio) => {
  const { width, height } = dimensionsFor(ratio)
  const safe = composedSafeArea(width, height)
  const base = frameBase(width, height)
  return [
    [`${ratio} full`, { width: safe.width, height: safe.height }, base],
    [`${ratio} band`, { width: safe.width, height: Math.round(safe.height / 3) }, base],
    [`${ratio} column`, { width: Math.round(safe.width / 3), height: safe.height }, base],
  ]
})

const BARE = { kind: 'clock', face: 'analog', time: '09:30', sweep: 'fast', label: null }
const LABELLED = { ...BARE, label: 'é'.repeat(BLOCK_LIMITS.clockLabel) }

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
    // A digital face with no stated time says so rather than filling the gap.
    expect(CLOCK_BLANK).toMatch(/^[^0-9]+$/)
  })

  it('cannot reach a clock of its own, in the component or in its arithmetic', () => {
    for (const file of ['clock.jsx', 'media.js']) {
      expect(code(file), file).not.toMatch(/\bDate\b/)
      expect(code(file), file).not.toMatch(/\bnow\s*\(/)
      expect(code(file), file).not.toMatch(/getHours|getMinutes|getSeconds|toLocaleTimeString/)
    }
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

describe('the dial takes the box', () => {
  /**
   * The defect, as arithmetic. `CLOCK_SIZE` was 0.2 of the frame's short edge, so
   * a clock anchored `full` and a clock stacked three deep in a corner drew the
   * same 216 px dial — one of them a fifth of the picture. The dial is now the
   * largest circle that fits what the box has left once the label is measured,
   * which is stated as an equality rather than as a floor because there is
   * nothing else for the room to be spent on.
   */
  it.each([['bare', BARE], ['labelled', LABELLED]])('is the largest circle its %s box allows', (_label, block) => {
    for (const [where, box, base] of SHAPES) {
      const face = clockFace(block, box, undefined, base)
      expect(face.room + face.label.band, where).toBe(box.height)
      expect(face.size, where).toBe(Math.min(box.width, face.room))
      expect(face.size, where).toBeGreaterThan(0)
    }
  })

  /**
   * Double the box, double the dial — the property that says a size came off the
   * box rather than off the frame, and the one a fraction of the short edge fails
   * however plausible the picture it drew.
   *
   * The hand WIDTHS are allowed a pixel, because they are the one part of a dial
   * that rounds: 0.0175 of 600 is 10.5, which is 11, and twice 11 is not
   * `round(0.0175 × 1200)`. A pixel on a hand is not a defect; a hand that stayed
   * the same width in a dial twice the size is.
   */
  it('doubles everything it draws when its box doubles', () => {
    const one = clockFace(BARE, { width: 800, height: 600 }, undefined, 1080)
    const two = clockFace(BARE, { width: 1600, height: 1200 }, undefined, 1080)
    expect(two.size).toBe(2 * one.size)
    for (const hand of Object.keys(CLOCK_HAND)) {
      expect(two[hand].length, hand).toBe(2 * one[hand].length)
      expect(Math.abs(two[hand].width - 2 * one[hand].width), hand).toBeLessThanOrEqual(1)
    }
    expect(two.rim).toBe(2 * one.rim)
    expect(two.tickLength).toBe(2 * one.tickLength)
  })

  it('keeps every hand inside the circle it is drawn in', () => {
    for (const [where, box, base] of SHAPES) {
      const face = clockFace(LABELLED, box, undefined, base)
      for (const name of Object.keys(CLOCK_HAND)) {
        expect(face[name].length, `${where}/${name}`).toBeLessThanOrEqual(face.size / 2)
        expect(face[name].width, `${where}/${name}`).toBeGreaterThanOrEqual(1)
      }
      expect(face.rim, where).toBeGreaterThanOrEqual(1)
      expect(face.tick, where).toBeGreaterThanOrEqual(1)
      expect(face.tickLength, where).toBeLessThanOrEqual(face.size / 2)
    }
  })

  it('draws the hand that carries the hour thickest and the one that sweeps thinnest', () => {
    const face = clockFace(BARE, { width: 950, height: 950 }, undefined, 1080)
    expect(face.hour.width).toBeGreaterThan(face.minute.width)
    expect(face.minute.width).toBeGreaterThan(face.sweep.width)
    expect(face.hour.length).toBeLessThan(face.minute.length)
    expect(face.minute.length).toBeLessThan(face.sweep.length)
  })

  /**
   * A digital face is the digits and nothing else, so they take the room the way
   * a dial does — and stop at the measure, because a time broken over two lines
   * is not a time. `typeScale` with `nowrap` is what enforces both ends of that,
   * and this is the claim that says the line really does fit.
   */
  it('sets the digits as large as the room allows and no wider than the measure', () => {
    for (const [where, box, base] of SHAPES) {
      for (const block of [BARE, { ...BARE, time: null }]) {
        const face = clockFace({ ...block, face: 'digital' }, box, undefined, base)
        expect(face.digits, where).toBeGreaterThan(0)
        // Two pixels of slack: the size is rounded to a whole pixel, and half a
        // pixel of type across five glyphs is what that costs the estimate.
        expect(textWidth(block.time ?? CLOCK_BLANK, face.digits), where).toBeLessThanOrEqual(box.width + 2)
        expect(face.orbit, where).toBeGreaterThan(0)
        expect(face.dot, where).toBeGreaterThanOrEqual(2)
      }
    }
    const small = clockFace({ ...BARE, face: 'digital' }, { width: 400, height: 600 }, undefined, 1080)
    const large = clockFace({ ...BARE, face: 'digital' }, { width: 800, height: 1200 }, undefined, 1080)
    expect(large.digits / small.digits).toBeCloseTo(2, 1)
  })

  /**
   * The label is the block's one RUN, so it is the only thing set at the stack's
   * unit — and it is measured before the face, because the face can only have
   * what is left. A label the component sized differently from the layout is a
   * dial through the bottom of its own box.
   */
  it('measures the label first, and gives the face what is left', () => {
    for (const [where, box, base] of SHAPES) {
      const bare = clockFace(BARE, box, 40, base)
      const labelled = clockFace(LABELLED, box, 40, base)
      expect(bare.label.band, where).toBe(0)
      expect(labelled.label.band, where).toBeGreaterThan(0)
      expect(labelled.room, where).toBe(bare.room - labelled.label.band)
    }
  })
})
