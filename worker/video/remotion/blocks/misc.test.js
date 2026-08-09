// The arithmetic of the two `misc` blocks, and what it is that keeps them alive.
//
// Co-located with `misc.js` rather than folded into `blocks.test.js`, for the
// reason that file states about `index.js`: six people own six families in this
// directory at once, and a shared test file is a shared merge conflict. What is
// TRUE OF EVERY BLOCK stays there — the registry, the import rule, the colour
// rule; what is true of a rule and a bar is here.
//
// Everything below is a number. A `.jsx` cannot be imported at all in this suite
// (Remotion is not installed and never will be), which is exactly why the two
// components hold no arithmetic of their own: what a test cannot reach is what
// ships wrong, and "does this rule ever stop moving" is not a question anybody
// should be answering by watching an mp4.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FILL_TICK_QUIET,
  HATCH_MARCH,
  RULE_DRAWN_AT_ARRIVAL,
  RULE_EXTENTS,
  TICK_QUIET,
  TRACK_QUIET,
  progressBarGeometry,
  separatorGeometry,
} from './misc.js'

/** The short edge of every export in the catalogue: all three ratios are 1080 there. */
const BASE = 1080

/** A scene of six seconds at 30 fps, as the frames a composition actually draws. */
const FRAMES = 180
const lifeAt = (frame) => frame / (FRAMES - 1)

describe('separator: a rule that never stops drawing itself', () => {
  it('has drawn nothing before it has arrived', () => {
    expect(separatorGeometry({ treatment: 'rule', extent: 'measure' }, BASE, 0, 0).reveal).toBe(0)
  })

  it('is fully drawn only at the end of the scene, never at the end of its entrance', () => {
    const arrived = separatorGeometry({ extent: 'measure' }, BASE, 1, 0)
    const ended = separatorGeometry({ extent: 'measure' }, BASE, 1, 1)
    expect(arrived.reveal).toBeCloseTo(RULE_DRAWN_AT_ARRIVAL, 10)
    expect(ended.reveal).toBe(1)
  })

  /**
   * The one this block was rewritten for.
   *
   * `progress` is spent in nine frames — `CUE_ENTER_FRAMES` — and a separator
   * that read nothing but `progress` was a still image for the other hundred and
   * seventy-one. A film in which nothing moves must not be producible by
   * accident, and "it moved once" is that film with a better first second.
   */
  it('grows on every frame of a scene it arrived in nine frames ago', () => {
    let previous = -1
    for (let frame = 0; frame < FRAMES; frame++) {
      const { reveal } = separatorGeometry({ extent: 'measure' }, BASE, 1, lifeAt(frame))
      expect(reveal, `frame ${frame}`).toBeGreaterThan(previous)
      previous = reveal
    }
  })

  /**
   * A reveal past 1 is a rule longer than the box `composedLayout` measured, and
   * the safe area is a promise about somebody else's interface rather than a
   * taste in margins.
   */
  it('never runs past the extent its zone gave it, at any point of any entrance', () => {
    for (const extent of Object.keys(RULE_EXTENTS)) {
      for (let frame = 0; frame < FRAMES; frame++) {
        for (const progress of [0, 0.37, 0.99, 1]) {
          const rule = separatorGeometry({ extent }, BASE, progress, lifeAt(frame))
          expect(rule.reveal, `${extent} @ ${progress}`).toBeLessThanOrEqual(1)
          expect(rule.width).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  /**
   * `Object.hasOwn` and `Array.includes`, for the reason `blockComponent` gives:
   * a plain lookup answers for the prototype chain, so `extent: "constructor"`
   * hands back a FUNCTION where a width was expected — and a function is truthy,
   * so `?? default` never fires and nothing notices until React styles a box with
   * `Object()`.
   */
  it('falls back to the measure for a name it inherited from Object', () => {
    for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      const rule = separatorGeometry({ extent: inherited, treatment: inherited }, BASE, 1, 1)
      expect(rule.width, inherited).toBe(RULE_EXTENTS.measure)
      expect(rule.treatment, inherited).toBe('rule')
    }
    expect(separatorGeometry(undefined, BASE, 1, 1).width).toBe(RULE_EXTENTS.measure)
    expect(separatorGeometry({}, BASE, 1, 1).treatment).toBe('rule')
  })

  it('keeps a hairline visible on a frame smaller than any this catalogue offers', () => {
    for (const base of [0, 1, 120, 360, BASE]) {
      expect(separatorGeometry({}, base, 1, 1).thickness, `base ${base}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('spaces a dotted band wider than it is tall, so the dots are dots', () => {
    const rule = separatorGeometry({ treatment: 'dots' }, BASE, 1, 1)
    expect(rule.treatment).toBe('dots')
    expect(rule.dotPitch).toBeGreaterThan(rule.dotHeight)
    expect(rule.dotHeight).toBeGreaterThanOrEqual(rule.thickness)
  })
})

describe('progressBar: one quantity, read twice', () => {
  /**
   * A number beside a bar that disagrees with the bar is a defect nobody catches
   * by watching, because each half is plausible alone. Computed once and asserted
   * equal, it cannot happen.
   */
  it('prints the value the bar has actually reached', () => {
    for (const to of [0, 1, 37, 62, 99, 100]) {
      for (let frame = 0; frame < FRAMES; frame++) {
        const bar = progressBarGeometry({ to }, BASE, frame / 9, lifeAt(frame))
        expect(bar.value, `${to}% @ ${frame}`).toBe(Math.round(bar.fill))
        expect(bar.fill).toBeLessThanOrEqual(to)
      }
    }
  })

  it('clamps a value the schema would never have let through', () => {
    expect(progressBarGeometry({ to: 140 }, BASE, 1, 0).fill).toBe(100)
    expect(progressBarGeometry({ to: -20 }, BASE, 1, 0).fill).toBe(0)
    expect(progressBarGeometry({}, BASE, 1, 0).fill).toBe(0)
    expect(progressBarGeometry({ to: 'quatre-vingts' }, BASE, 1, 0).fill).toBe(0)
  })

  /**
   * The two ends of the range are the whole reason the ruler crosses the whole
   * track. A march confined to the remainder freezes at 100; one confined to the
   * fill freezes at 0. Both are values a document is allowed to write.
   */
  it('marches on every frame, at both ends of its own range', () => {
    for (const to of [0, 50, 100]) {
      let previous = null
      for (let frame = 0; frame < FRAMES; frame++) {
        const { hatchOffset } = progressBarGeometry({ to }, BASE, 1, lifeAt(frame))
        if (previous !== null) expect(hatchOffset, `${to}% @ ${frame}`).not.toBe(previous)
        previous = hatchOffset
      }
    }
  })

  it('loops seamlessly: the ruler ends a scene exactly where it started it', () => {
    const start = progressBarGeometry({ to: 60 }, BASE, 1, 0)
    const end = progressBarGeometry({ to: 60 }, BASE, 1, 1)
    expect(start.hatchOffset).toBe(0)
    expect(end.hatchOffset).toBe(0)
    // Whole pitches across the scene is what makes that true rather than a
    // coincidence of the numbers: a fractional march jumps on the last frame.
    expect(Number.isInteger(HATCH_MARCH)).toBe(true)
    for (let frame = 0; frame < FRAMES; frame++) {
      const { hatchOffset, hatchPitch } = progressBarGeometry({ to: 60 }, BASE, 1, lifeAt(frame))
      expect(hatchOffset).toBeGreaterThanOrEqual(0)
      expect(hatchOffset).toBeLessThan(hatchPitch)
    }
  })

  /** A tick as wide as its own cell is not a ruler, it is a second opaque layer. */
  it('never lets a tick fill its pitch, at any frame size', () => {
    for (const base of [0, 1, 90, 360, BASE, 2160]) {
      const bar = progressBarGeometry({ to: 40 }, base, 1, 0.3)
      expect(bar.tick, `base ${base}`).toBeGreaterThanOrEqual(1)
      expect(bar.tick, `base ${base}`).toBeLessThan(bar.hatchPitch)
    }
  })

  /**
   * The radius is the direction's, bounded by the geometry: a project that stated
   * `radiusPx: 0` designed a squared film and gets a squared bar, and one that
   * stated a radius larger than the bar is thick gets a pill rather than an
   * arithmetic no browser agrees on.
   */
  it('takes the direction’s radius, and never more than half its own track', () => {
    for (const radius of [0, 4, 12, 9999]) {
      const bar = progressBarGeometry({ to: 40 }, BASE, 1, 0, radius)
      expect(bar.radius, `radius ${radius}`).toBeLessThanOrEqual(bar.track / 2)
      expect(bar.radius).toBe(Math.min(bar.track / 2, radius))
    }
  })

  /**
   * Every layer this block paints is quieter than the strength the palette
   * measured — the asymmetry `groundDensity` states in one sentence: a layer that
   * can only ever get fainter cannot spend contrast the measurement promised.
   */
  it('paints nothing at more than the strength that was measured', () => {
    for (const quiet of [TRACK_QUIET, TICK_QUIET, FILL_TICK_QUIET]) {
      expect(quiet).toBeGreaterThan(0)
      expect(quiet).toBeLessThan(1)
    }
    expect(FILL_TICK_QUIET).toBeLessThan(TICK_QUIET)
  })
})

/**
 * `blocks.test.js` reads every `.jsx` in this directory and no `.js`, which is
 * correct — it is a test about components. It also means a helper file could
 * carry the one thing a block may not: a colour nobody measured, or an easing
 * curve that is a twenty-fifth notion of how things arrive. So the same two
 * checks, scoped to the file this suite owns.
 */
describe('what this file may not contain', () => {
  const source = fs
    .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'misc.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')

  it('writes no colour of its own', () => {
    expect(source.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)).toBe(null)
  })

  it('eases nothing: the curve arrives already applied', () => {
    expect(/\beasing\b|cubic-bezier|easeIn|easeOut/.test(source)).toBe(false)
  })

  it('imports no Remotion package', () => {
    expect(/from\s+['"](@remotion\/[^'"]+|remotion)['"]/.test(source)).toBe(false)
  })
})
