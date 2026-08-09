// `dateStamp`, held to arithmetic — and to the same rule as the clock next door.
//
// A date read off the render host is a fact about the MACHINE, and it makes two
// renders of one timeline differ, which the content-addressed export store
// cannot have. `block.text` is a line the model wrote; there is no second
// source, and the check below is what says so in a way a build can fail on.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FPS,
  LINE_SAFETY,
  MEAN_GLYPH_EM,
  blockHeight,
  blockShape,
  composedSafeArea,
  dimensionsFor,
  frameBase,
  hairline,
  solveTypeUnit,
  textWidth,
} from '../composition.js'
import { BLOCK_LIMITS, TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import { DATE_HEAD_PERCENT, dateStampBox, dateStampHead } from './media.js'

const here = path.dirname(fileURLToPath(import.meta.url))
/**
 * Comments stripped, for the reason `blocks.test.js` gives: the prose names what
 * the code may not do. Both files, because the arithmetic moved — a check that
 * still read only the component would have stopped seeing the code it was
 * written about.
 */
const code = (file) =>
  fs
    .readFileSync(path.join(here, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')

const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)
const TREATMENTS = ['plain', 'boxed', 'rule']

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

const SHORT = { kind: 'dateStamp', text: 'Mars 2026', treatment: 'rule' }
const LONG = { ...SHORT, text: 'é'.repeat(BLOCK_LIMITS.dateStamp) }

/**
 * The box `stackIn` would give this block in a zone of that width — the unit
 * solved against the zone, then the height the block draws at it.
 *
 * Built here rather than asserted against an arbitrary box, because that is the
 * only box the exact-fill claim is about: a block handed MORE height than it can
 * spend is the case the furniture cap covers, and it is a different claim.
 */
function fitted(block, width, room) {
  const unit = solveTypeUnit([blockShape(block)], width, room)
  return { box: { width, height: Math.round(blockHeight(block, width, unit)) }, unit }
}

describe('the date comes from the document and from nowhere else', () => {
  it('cannot reach a clock of its own, in the component or in its arithmetic', () => {
    for (const file of ['dateStamp.jsx', 'media.js']) {
      expect(code(file), file).not.toMatch(/\bDate\b/)
      expect(code(file), file).not.toMatch(/\bnow\s*\(/)
      expect(code(file), file).not.toMatch(/toLocaleDateString|getFullYear|getMonth/)
    }
  })
})

describe('the stamp inhabits the box it is given', () => {
  /**
   * The line and its furniture put the box back together, on the box the layout
   * actually hands over. `DATE_SIZE` was 0.026 of the frame's short edge, so a
   * stamp given a whole band set itself at 28 px in the middle of it and a stamp
   * given a narrow column ran out of the box — one constant for two boxes with
   * nothing in common, which is the defect this whole pass is about.
   */
  it.each([['short', SHORT], ['long', LONG]])('spends every pixel of it, with a %s date', (_label, block) => {
    for (const treatment of TREATMENTS) {
      for (const [where, box] of SHAPES) {
        const layer = { ...block, treatment }
        const { box: own, unit } = fitted(layer, box.width, box.height)
        const stamp = dateStampBox(layer, own, unit, 1080, 12)
        const drawn = stamp.line + (stamp.boxed ? 2 * stamp.padY : stamp.gap) + stamp.rule
        const at = `${treatment} @ ${where}`
        expect(drawn, at).toBeLessThanOrEqual(own.height)
        // Three pixels of slack, and each of them is named: the type size is
        // rounded to a whole pixel, its line box is rounded again, and a boxed
        // stamp halves what is left. None of the three is a fraction of the
        // frame, which is the thing this assertion is really about.
        expect(drawn, at).toBeGreaterThanOrEqual(own.height - 3)
      }
    }
  })

  /**
   * And the type is solved against the box rather than chosen: a wider box is a
   * larger date, up to the point where the box has no more height to give.
   */
  it('sets the same date larger in a larger box', () => {
    const small = fitted(SHORT, 400, 2000)
    const large = fitted(SHORT, 800, 2000)
    const one = dateStampBox(SHORT, small.box, small.unit, 1080, 12)
    const two = dateStampBox(SHORT, large.box, large.unit, 1080, 12)
    expect(two.size / one.size).toBeCloseTo(2, 1)
  })

  /**
   * A date that cannot wrap is bounded by its MEASURE, which is what `nowrap`
   * buys: past a certain size there is no taller version of the line, and the
   * block stops growing rather than running through the edge of its box. A date
   * broken over two lines is not a date.
   *
   * Measured with no tracking, because the block sets none — `BLOCK_APPETITE`
   * declares a plain body run here, and a letter-spacing on top of it is exactly
   * the 15% this assertion would catch.
   */
  it('never sets a line wider than the box it runs across', () => {
    for (const block of [SHORT, LONG]) {
      for (const [where, box] of SHAPES) {
        const { box: own, unit } = fitted(block, box.width, box.height)
        const stamp = dateStampBox(block, own, unit, 1080, 12)
        // The slack is the shared scale's own rounding, stated rather than
        // guessed: `typeScale` answers in whole pixels, so a size may be half a
        // pixel larger than the measure solved for, and half a pixel of type is
        // half an advance per glyph. It is not an overflow — `LINE_SAFETY` keeps
        // 6% of the measure in hand, forty times what this costs.
        const slack = block.text.length * MEAN_GLYPH_EM * LINE_SAFETY * 0.5
        expect(textWidth(block.text, stamp.size), `${block.text.length} @ ${where}`).toBeLessThanOrEqual(own.width + slack)
      }
    }
  })

  /**
   * The furniture is capped at what `BLOCK_APPETITE` budgeted, and this is the
   * case: a stamp handed a box twice its own height put the whole difference
   * under its rule — 380 px of air below eleven characters, which is a void of a
   * different shape rather than a fix. Capped, the block is its own size and the
   * zone's alignment centres it.
   */
  it('does not grow a void under itself when handed a box it cannot spend', () => {
    const { box: own, unit } = fitted(SHORT, 900, 2000)
    const tight = dateStampBox(SHORT, own, unit, 1080, 12)
    const roomy = dateStampBox(SHORT, { width: 900, height: own.height * 3 }, unit, 1080, 12)
    expect(roomy.gap).toBe(tight.gap)
    expect(roomy.size).toBe(tight.size)
  })

  /**
   * The rule is the one number here that must NOT follow the box: it is the
   * hairline `CONSTANT_METRICS` names, so 3 px under a date in one scene and 6 px
   * under a smaller one in the next would be two design systems in one film.
   */
  it('keeps its rule the thickness a hairline is, whatever the box', () => {
    for (const [where, box, base] of SHAPES) {
      const { box: own, unit } = fitted(SHORT, box.width, box.height)
      expect(dateStampBox(SHORT, own, unit, base, 12).rule, where).toBe(hairline(base, own))
    }
    expect(dateStampBox(SHORT, { width: 900, height: 200 }, 60, 1080, 12).rule).toBe(
      dateStampBox(SHORT, { width: 1800, height: 400 }, 60, 1080, 12).rule,
    )
  })

  it('answers in whole pixels, and never in negative ones', () => {
    for (const treatment of [...TREATMENTS, 'stamped']) {
      for (const box of [{ width: 0, height: 0 }, { width: 40, height: 12 }, { width: 1688, height: 120 }]) {
        const stamp = dateStampBox({ ...LONG, treatment }, box, undefined, 1080, 9999)
        // Everything that reaches a CSS declaration. `rise` is not among them:
        // it is a type unit, and it reaches a transform through `enterRise`.
        for (const key of ['size', 'line', 'rule', 'padY', 'padX', 'gap', 'radius']) {
          expect(Number.isInteger(stamp[key]), `${treatment}.${key}`).toBe(true)
          expect(stamp[key], `${treatment}.${key}`).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})

describe('the head that runs along the measure', () => {
  /**
   * Per-frame over the longest scene the composed variant accepts.
   *
   * This block is one short line of text, so it is the block most likely to
   * arrive and then sit there for fifteen seconds — which is the defect a user
   * reported in four sentences and every part of which was legal. The ornament
   * is what moves; the date itself is painted at full strength on every frame,
   * because an ink that dims spends contrast the palette promised.
   */
  it('is somewhere else on every frame, whatever the treatment', () => {
    for (const treatment of TREATMENTS) {
      const seen = new Set()
      for (let frame = 0; frame < LONGEST; frame++) {
        const head = dateStampHead(treatment, frame / (LONGEST - 1))
        seen.add(`${head.left}/${head.width}`)
      }
      expect(seen.size, treatment).toBe(LONGEST)
    }
  })

  /**
   * And it never leaves the measure it runs along. A head that overran would sit
   * outside the box on a `boxed` stamp and past the rule on the other two —
   * visible only in the finished file, and only in the last second of a scene.
   */
  it('stays inside the measure at every point of the scene', () => {
    for (const treatment of TREATMENTS) {
      for (let step = 0; step <= 40; step++) {
        const head = dateStampHead(treatment, step / 40)
        expect(head.left, `${treatment}@${step}`).toBeGreaterThanOrEqual(0)
        expect(head.width, `${treatment}@${step}`).toBeGreaterThanOrEqual(0)
        expect(head.left + head.width, `${treatment}@${step}`).toBeLessThanOrEqual(100)
      }
    }
  })

  /**
   * `plain` has no track, so its head IS the rule: a treatment that starts bare
   * and ends underlined, rather than a second copy of `rule`. That difference is
   * the whole reason the two are separate values in the enum.
   */
  it('draws the rule itself when there is no track to run along', () => {
    expect(dateStampHead('plain', 0)).toEqual({ left: 0, width: 0 })
    expect(dateStampHead('plain', 1)).toEqual({ left: 0, width: 100 })
  })

  it('travels a fixed length along the track when there is one', () => {
    for (const treatment of ['rule', 'boxed']) {
      expect(dateStampHead(treatment, 0), treatment).toEqual({ left: 0, width: DATE_HEAD_PERCENT })
      expect(dateStampHead(treatment, 1), treatment).toEqual({ left: 100 - DATE_HEAD_PERCENT, width: DATE_HEAD_PERCENT })
    }
  })

  /**
   * An unknown treatment reads as the travelling head rather than as the rule
   * that draws itself, which is the schema's own default (`rule`). Same reason
   * `anchorName` has a fallback at all: the value was refused by `validate.js`
   * long before a frame, so reaching that branch means two lists disagree (Q1).
   */
  it('falls back to the schema’s default rather than to nothing', () => {
    for (const unknown of ['stamped', undefined, 'constructor']) {
      expect(dateStampHead(unknown, 0.5), String(unknown)).toEqual(dateStampHead('rule', 0.5))
    }
  })

  it('is clamped by the clock it is handed, never extrapolated past it', () => {
    expect(dateStampHead('plain', 2)).toEqual(dateStampHead('plain', 1))
    expect(dateStampHead('rule', -1)).toEqual(dateStampHead('rule', 0))
  })
})
