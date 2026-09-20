// The arithmetic of the two `misc` blocks: that they inhabit the box they were
// given, and what it is that keeps them alive.
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
  HATCH_MIN_TICKS,
  HATCH_PITCH_TRACKS,
  RULE_DRAWN_AT_ARRIVAL,
  RULE_EXTENTS,
  TRACK_ASPECT,
  TICK_QUIET,
  TRACK_QUIET,
  progressBarGeometry,
  separatorGeometry,
} from './misc.js'
// The contract the two blocks are written against: `blockExtent` is what the
// layout believes they draw, so a component drawing anything else is a stack
// whose zone was divided on a number nobody produced.
import { DECLARED_SHARE, blockAppetite, blockExtent, hairline } from '../composition.js'

/** The short edge of every export in the catalogue: all three ratios are 1080 there. */
const BASE = 1080

/** A scene of six seconds at 30 fps, as the frames a composition actually draws. */
const FRAMES = 180
const lifeAt = (frame) => frame / (FRAMES - 1)

/**
 * Boxes a block really gets, from the whole safe area of a 16:9 frame down to a
 * third of a column in a portrait one.
 *
 * The narrow ones are the case nobody looks at and the one a model produces: a
 * document that anchors three blocks in one row gets thirds, and `anchor`
 * defaults to `center`, so the commonest scene there is puts everything in one
 * stack whose blocks each take a slice of the height.
 */
const BOXES = [
  { width: 1690, height: 950 },
  { width: 907, height: 1300 },
  { width: 950, height: 950 },
  { width: 540, height: 300 },
  { width: 280, height: 160 },
]

describe('separator: a rule the length of its own box', () => {
  /**
   * The defect this file was rewritten for, in one assertion. The rule used to be
   * a percentage of whatever CSS box it happened to land in and a thickness read
   * off the frame; now the length is the measure `composedLayout` published for
   * that block, which is the number `blockExtent` hands the layout.
   */
  it('draws exactly the length `blockExtent` promised the layout', () => {
    for (const box of BOXES) {
      for (const extent of Object.keys(RULE_EXTENTS)) {
        const rule = separatorGeometry({ extent }, box, BASE, 1, 1)
        const promised = blockExtent({ kind: 'separator', extent }, { left: 0, top: 0, ...box }, BASE)
        expect(rule.length, `${extent} in ${box.width}x${box.height}`).toBe(Math.round(promised.width))
        expect(rule.thickness).toBe(promised.thickness)
      }
    }
  })

  it('is twice as long in a box twice as wide', () => {
    const narrow = separatorGeometry({ extent: 'full' }, { width: 400, height: 200 }, BASE, 1, 1)
    const wide = separatorGeometry({ extent: 'full' }, { width: 800, height: 200 }, BASE, 1, 1)
    expect(wide.length / narrow.length).toBe(2)
  })

  /**
   * And the thickness is the one thing that does NOT scale with the box: it is a
   * constant metric, because a rule 3 px thick under one headline and 9 px under
   * a smaller one in the next scene is two design systems in one film. Bounded
   * all the same — `hairline` thins it inside a box too small to hold it.
   */
  it('keeps one thickness across every box, and thins inside a box that cannot hold it', () => {
    const thicknesses = BOXES.map((box) => separatorGeometry({}, box, BASE, 1, 1).thickness)
    expect(new Set(thicknesses).size).toBe(1)
    expect(separatorGeometry({}, { width: 40, height: 4 }, BASE, 1, 1).thickness).toBe(hairline(BASE, { width: 40, height: 4 }))
  })

  it('reads its extents from the one table the layout divides zones by', () => {
    expect(RULE_EXTENTS).toBe(DECLARED_SHARE.separator)
  })

  it('has drawn nothing before it has arrived', () => {
    expect(separatorGeometry({ treatment: 'rule', extent: 'measure' }, BOXES[0], BASE, 0, 0).reveal).toBe(0)
  })

  it('is fully drawn only at the end of the scene, never at the end of its entrance', () => {
    const arrived = separatorGeometry({ extent: 'measure' }, BOXES[0], BASE, 1, 0)
    const ended = separatorGeometry({ extent: 'measure' }, BOXES[0], BASE, 1, 1)
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
      const { reveal } = separatorGeometry({ extent: 'measure' }, BOXES[0], BASE, 1, lifeAt(frame))
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
    for (const box of BOXES) {
      for (const extent of Object.keys(RULE_EXTENTS)) {
        for (let frame = 0; frame < FRAMES; frame++) {
          for (const progress of [0, 0.37, 0.99, 1]) {
            const rule = separatorGeometry({ extent }, box, BASE, progress, lifeAt(frame))
            expect(rule.reveal, `${extent} @ ${progress}`).toBeLessThanOrEqual(1)
            expect(rule.width).toBeLessThanOrEqual(1)
            expect(rule.length).toBeLessThanOrEqual(box.width)
          }
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
      const rule = separatorGeometry({ extent: inherited, treatment: inherited }, BOXES[0], BASE, 1, 1)
      expect(rule.width, inherited).toBe(RULE_EXTENTS.measure)
      expect(rule.treatment, inherited).toBe('rule')
    }
    expect(separatorGeometry(undefined, BOXES[0], BASE, 1, 1).width).toBe(RULE_EXTENTS.measure)
    expect(separatorGeometry({}, BOXES[0], BASE, 1, 1).treatment).toBe('rule')
  })

  it('keeps a hairline visible on a frame smaller than any this catalogue offers', () => {
    for (const base of [0, 1, 120, 360, BASE]) {
      expect(separatorGeometry({}, BOXES[0], base, 1, 1).thickness, `base ${base}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('spaces a dotted band wider than it is tall, so the dots are dots', () => {
    const rule = separatorGeometry({ treatment: 'dots' }, BOXES[0], BASE, 1, 1)
    expect(rule.treatment).toBe('dots')
    expect(rule.dotPitch).toBeGreaterThan(rule.dotHeight)
    expect(rule.dotHeight).toBeGreaterThanOrEqual(rule.thickness)
  })
})

describe('progressBar: a bar the size of its own box', () => {
  /** The type units a stack really solves, from a lone block in a safe area down to a crowded column. */
  const UNITS = [14, 22, 40, 96, 240, 450]

  /**
   * Everything the block draws adds up to the appetite `stackIn` divided the zone
   * by — no more, and no LESS, which is the half that was wrong: a bar sized at
   * 1.2% of the frame's short edge drew 13 px of furniture in a box that had been
   * allotted three hundred, and every scene came out as a small element floating
   * in a large void.
   */
  it('spends exactly the furniture the layout allotted it', () => {
    for (const box of BOXES) {
      for (const unit of UNITS) {
        for (const label of ['Rendu', null]) {
          const bar = progressBarGeometry({ to: 60, label }, box, unit, 1, 0.5)
          const furniture = Math.round(unit * blockAppetite('progressBar').fixed)
          const drawn = bar.track + bar.gap + 2 * bar.pad
          expect(drawn, `${unit} in ${box.width}x${box.height}`).toBeGreaterThanOrEqual(Math.max(furniture, bar.track) - 1)
          expect(drawn).toBeLessThanOrEqual(Math.max(furniture, bar.track) + 1)
        }
      }
    }
  })

  /**
   * And the air goes AROUND the group, not inside it.
   *
   * A bar capped by `TRACK_ASPECT` in a narrow column leaves most of its
   * allotment unspent, and the first draft put all of it under the label: a
   * label, half a frame of nothing, and a rule. The gap is the house's own
   * `RUN_GAP` whatever is left over, and the leftover is padding.
   */
  it('keeps the label and the bar together when the track was capped', () => {
    const bar = progressBarGeometry({ to: 60, label: 'A' }, { width: 541, height: 950 }, 457, 1, 0.5)
    expect(bar.gap).toBeLessThan(bar.track * 6)
    expect(bar.pad).toBeGreaterThan(0)
    expect(progressBarGeometry({ to: 60, label: null }, { width: 541, height: 950 }, 457, 1, 0.5).gap).toBe(0)
  })

  it('grows with the unit its stack solved, not with the frame', () => {
    const box = { width: 1690, height: 950 }
    expect(progressBarGeometry({ to: 50 }, box, 40, 1, 0).track).toBeLessThan(
      progressBarGeometry({ to: 50 }, box, 80, 1, 0).track,
    )
    // Same unit, same bar: the frame is not an input any more.
    const wide = progressBarGeometry({ to: 50 }, { width: 1690, height: 950 }, 40, 1, 0)
    const tall = progressBarGeometry({ to: 50 }, { width: 1690, height: 400 }, 40, 1, 0)
    expect(wide.track).toBe(tall.track)
  })

  /**
   * A progress bar is a LINEAR object. A lone one in a whole safe area solves a
   * unit of about 450 px, and a slab a third as thick as it is long says nothing
   * about how far along anything is.
   */
  it('stays a bar: never thicker than a twelfth of its own length', () => {
    for (const box of BOXES.filter((b) => b.width >= TRACK_ASPECT * 3)) {
      for (const unit of UNITS) {
        const bar = progressBarGeometry({ to: 50 }, box, unit, 1, 0)
        expect(bar.track, `${unit} in ${box.width}`).toBeLessThanOrEqual(box.width / TRACK_ASPECT)
        expect(bar.track).toBeLessThanOrEqual(box.height)
      }
    }
  })

  /**
   * ── The defect this block was named for ────────────────────────────────────
   *
   * The ruler's pitch was 1.4% of the frame's short edge and the track 1.2% of
   * it: a step 1.15 times the thickness of the bar it crossed, which at 1080p
   * turns the bar into a hatched band — the ticks eat the fill and the eye counts
   * stripes instead of measuring a length. The pitch now comes from the
   * thickness, which comes from the box, and the two constants are chosen so the
   * inequality survives the clamp at the other end.
   */
  it('never steps tighter than the bar is thick, on any box or any unit', () => {
    for (const box of BOXES.filter((b) => b.width >= TRACK_ASPECT * 3)) {
      for (const unit of UNITS) {
        const bar = progressBarGeometry({ to: 50 }, box, unit, 1, 0)
        expect(bar.hatchPitch / bar.track, `${unit} in ${box.width}x${box.height}`).toBeGreaterThanOrEqual(2)
        expect(bar.hatchPitch).toBeLessThanOrEqual(Math.round(bar.track * HATCH_PITCH_TRACKS))
      }
    }
  })

  /** And the other end: a pair of marching blocks is not a ruler either. */
  it('carries at least six marks across the bar, however thick it got', () => {
    for (const box of BOXES.filter((b) => b.width >= 120)) {
      for (const unit of UNITS) {
        const bar = progressBarGeometry({ to: 50 }, box, unit, 1, 0)
        expect(Math.floor(box.width / bar.hatchPitch), `${unit} in ${box.width}`).toBeGreaterThanOrEqual(HATCH_MIN_TICKS)
      }
    }
  })

  /**
   * A number beside a bar that disagrees with the bar is a defect nobody catches
   * by watching, because each half is plausible alone. Computed once and asserted
   * equal, it cannot happen.
   */
  it('prints the value the bar has actually reached', () => {
    for (const to of [0, 1, 37, 62, 99, 100]) {
      for (let frame = 0; frame < FRAMES; frame++) {
        const bar = progressBarGeometry({ to }, BOXES[0], 40, frame / 9, lifeAt(frame))
        expect(bar.value, `${to}% @ ${frame}`).toBe(Math.round(bar.fill))
        expect(bar.fill).toBeLessThanOrEqual(to)
      }
    }
  })

  it('clamps a value the schema would never have let through', () => {
    expect(progressBarGeometry({ to: 140 }, BOXES[0], 40, 1, 0).fill).toBe(100)
    expect(progressBarGeometry({ to: -20 }, BOXES[0], 40, 1, 0).fill).toBe(0)
    expect(progressBarGeometry({}, BOXES[0], 40, 1, 0).fill).toBe(0)
    expect(progressBarGeometry({ to: 'quatre-vingts' }, BOXES[0], 40, 1, 0).fill).toBe(0)
  })

  /** A box or a unit this file should never see still answers with a drawable bar (Q1). */
  it('draws something rather than nothing for a box it cannot read', () => {
    for (const box of [undefined, {}, { width: 0, height: 0 }, { width: 'large', height: null }]) {
      const bar = progressBarGeometry({ to: 40 }, box, 40, 1, 0.4)
      expect(Number.isFinite(bar.track) && bar.track >= 3, JSON.stringify(box)).toBe(true)
      expect(Number.isFinite(bar.hatchPitch) && bar.hatchPitch >= 3).toBe(true)
      expect(bar.tick).toBeLessThan(bar.hatchPitch)
    }
    expect(progressBarGeometry({ to: 40 }, BOXES[0], undefined, 1, 0).track).toBeGreaterThanOrEqual(3)
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
        const { hatchOffset } = progressBarGeometry({ to }, BOXES[0], 40, 1, lifeAt(frame))
        if (previous !== null) expect(hatchOffset, `${to}% @ ${frame}`).not.toBe(previous)
        previous = hatchOffset
      }
    }
  })

  it('loops seamlessly: the ruler ends a scene exactly where it started it', () => {
    const start = progressBarGeometry({ to: 60 }, BOXES[0], 40, 1, 0)
    const end = progressBarGeometry({ to: 60 }, BOXES[0], 40, 1, 1)
    expect(start.hatchOffset).toBe(0)
    expect(end.hatchOffset).toBe(0)
    // Whole pitches across the scene is what makes that true rather than a
    // coincidence of the numbers: a fractional march jumps on the last frame.
    expect(Number.isInteger(HATCH_MARCH)).toBe(true)
    for (let frame = 0; frame < FRAMES; frame++) {
      const { hatchOffset, hatchPitch } = progressBarGeometry({ to: 60 }, BOXES[0], 40, 1, lifeAt(frame))
      expect(hatchOffset).toBeGreaterThanOrEqual(0)
      expect(hatchOffset).toBeLessThan(hatchPitch)
    }
  })

  /** A tick as wide as its own cell is not a ruler, it is a second opaque layer. */
  it('never lets a tick fill its pitch, at any box or unit', () => {
    for (const box of BOXES) {
      for (const unit of UNITS) {
        const bar = progressBarGeometry({ to: 40 }, box, unit, 1, 0.3)
        expect(bar.tick, `${unit} in ${box.width}`).toBeGreaterThanOrEqual(1)
        expect(bar.tick, `${unit} in ${box.width}`).toBeLessThan(bar.hatchPitch)
      }
    }
  })

  /**
   * The value is set to the bar rather than to the label, because it sits beside
   * the track: a caption-sized numeral next to a bar capped by `TRACK_ASPECT` is
   * a row taller than the track, which is height the block never asked for.
   */
  it('never lets the printed value make the row taller than the bar', () => {
    for (const box of BOXES) {
      for (const unit of UNITS) {
        const bar = progressBarGeometry({ to: 40, showValue: true }, box, unit, 1, 0)
        expect(bar.valueSize, `${unit} in ${box.width}`).toBeLessThanOrEqual(bar.track)
        expect(bar.valueSize).toBeLessThanOrEqual(bar.labelSize)
      }
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
      const bar = progressBarGeometry({ to: 40 }, BOXES[0], 40, 1, 0, radius)
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
