// `imageFrame`, held to arithmetic.
//
// A block cannot be rendered in this suite — Remotion is not installed here and
// never will be — so what is checkable about one is exactly what it computes
// before React sees it. Three ways this block could be wrong in a file nobody
// watches: a camera move that has drifted from the one the rest of the film
// makes, a picture that stops moving inside its frame, and — the defect this
// pass is about — a picture that draws a fraction of the frame instead of the
// box it was handed.
//
// The import of `server/video/timeline.js` is TEST-ONLY, exactly as it is in
// `blocks.test.js` and `validate.test.js`: the Docker build copies
// `worker/video/` and nothing else, so a runtime import of anything under
// `server/` produces a container that boots and then fails every render on a
// missing module.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOX_FILL_FLOOR, FPS, composedSafeArea, dimensionsFor, frameBase, kenBurnsTransform } from '../composition.js'
import { BLOCK_LIMITS, KEN_BURNS, TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import { FRAME_CAPTION_CEILING, FRAME_INNER_RADIUS, frameTreatment, framedMove, imageFrameBox } from './media.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, 'imageFrame.jsx'), 'utf8')

/** The longest scene the composed variant accepts, in frames: the finest step `life` can take. */
const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)
const SHORTEST = Math.round((TEMPLATE_LIMITS.composed.minSceneMs / 1000) * FPS)

const MOVES = KEN_BURNS.filter((kind) => kind !== 'static')
const TREATMENTS = ['bleed', 'inset', 'card']

/**
 * The boxes a zone can actually turn out to be, in all three ratios.
 *
 * The whole safe area is what an anchor of `full` gives; a third of a band and a
 * third of a column are what a crowded scene gives. The narrow ones are the case
 * nobody looks at and the one the model produces, which is why they are swept
 * with the same weight as the generous ones.
 */
const SHAPES = ['16:9', '9:16', '1:1'].flatMap((ratio) => {
  const { width, height } = dimensionsFor(ratio)
  const safe = composedSafeArea(width, height)
  const base = frameBase(width, height)
  return [
    [`${ratio} full`, { left: 0, top: 0, width: safe.width, height: safe.height }, base],
    [`${ratio} band`, { left: 0, top: 0, width: safe.width, height: Math.round(safe.height / 3) }, base],
    [`${ratio} column`, { left: 0, top: 0, width: Math.round(safe.width / 3), height: safe.height }, base],
  ]
})

/** The poorest legal block and the longest one: no caption, and a caption at its bound. */
const POOREST = { kind: 'imageFrame', imageId: 'img-1', move: 'zoom-in', caption: null }
const LONGEST_BLOCK = { ...POOREST, caption: 'é'.repeat(BLOCK_LIMITS.caption) }

describe('the move a framed picture makes', () => {
  /**
   * The claim `framedMove` exists to make: it is the FILM's Ken Burns, not a
   * second one written at block scale.
   *
   * Two of them would be discovered to disagree by watching an mp4 — a slideshow
   * scene and a composed scene of the same picture drifting at different rates,
   * with nothing anywhere naming the difference. It is also what BOUNDS the
   * amplitude: a pan spends 4% of travel on a 12% overscale, so nothing visible
   * at rest slides out of the frame, and a block that rewrote the move at its own
   * scale is the one place that guarantee could be lost.
   */
  it('is the same transform a slideshow scene gets at the same point of its own duration', () => {
    for (const frames of [SHORTEST, 90, LONGEST]) {
      for (const kind of KEN_BURNS) {
        for (const frame of [0, 1, Math.floor(frames / 3), frames - 1]) {
          const life = frame / (frames - 1)
          expect(framedMove(kind, life), `${kind} at ${frame}/${frames}`).toBe(kenBurnsTransform(kind, frame, frames))
        }
      }
    }
  })

  /**
   * Nothing holds still, and the frame this is really about is the second one.
   *
   * A picture that arrives and then sits is what the reported defect actually
   * was — every part of it legal — so the check is per-frame across the longest
   * scene the schema accepts, where the step is smallest and a rounding that
   * flattened the move would show up first.
   */
  it('is somewhere else on every frame of the longest scene it can be given', () => {
    for (const kind of MOVES) {
      const seen = new Set()
      for (let frame = 0; frame < LONGEST; frame++) seen.add(framedMove(kind, frame / (LONGEST - 1)))
      expect(seen.size, kind).toBe(LONGEST)
    }
  })

  /**
   * And `static` still means still. It is in the enum because a capture of an
   * interface has real reasons to be held, and a block that overrode it would be
   * refusing a document that said what it wanted.
   */
  it('holds when the document asks it to', () => {
    expect(framedMove('static', 0)).toBe('none')
    expect(framedMove('static', 1)).toBe('none')
  })
})

describe('the picture inhabits the box it is given', () => {
  /**
   * The three sums put the box back together, which is the whole of the rule at
   * the top of `composition.js` for this block: the picture takes the box less
   * its margin and less the band the caption needs, and there is no third case.
   * A leftover here is a picture floating in its own allotment — the "small
   * element in a large void" six real exports came back as.
   */
  it.each([['poorest', POOREST], ['longest', LONGEST_BLOCK]])('spends every pixel of it, with the %s block', (_label, block) => {
    for (const treatment of TREATMENTS) {
      for (const [where, box, base] of SHAPES) {
        const geometry = imageFrameBox({ ...block, treatment }, box, undefined, base, 12)
        const at = `${treatment} @ ${where}`
        expect(geometry.picture.width + 2 * geometry.margin, at).toBe(box.width)
        expect(geometry.picture.height + geometry.caption.band + 2 * geometry.margin, at).toBe(box.height)
      }
    }
  })

  /**
   * And the picture, not its framing, is what the box is made of.
   *
   * `BOX_FILL_FLOOR` is the number `composition.test.js` holds `blockExtent` to,
   * reused here on the drawn geometry: the two are computed by different code
   * from different directions, and a block whose framing had quietly eaten a
   * third of its box would satisfy the sums above and still be the defect. On the
   * block with no caption the picture IS the block, so the floor applies to it
   * whole — which is the case a `bleed` picture handed the safe area used to fail
   * by drawing 42% of the short edge.
   */
  it('gives a captionless block’s whole box to its picture', () => {
    for (const treatment of TREATMENTS) {
      for (const [where, box, base] of SHAPES) {
        const geometry = imageFrameBox({ ...POOREST, treatment }, box, undefined, base, 12)
        const at = `${treatment} @ ${where}`
        expect(geometry.picture.width / box.width, at).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
        expect(geometry.picture.height / box.height, at).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
      }
    }
  })

  /**
   * A caption at the schema's bound in a narrow column really does want half the
   * box, and it is allowed to have it — but not more. `FRAME_CAPTION_CEILING` is
   * the degradation for a caption and a box that disagree, and its direction is
   * the point: a picture block whose picture has been squeezed to nothing has
   * failed, whereas a caption clipped by a line is still a caption (Q1).
   */
  it('never lets a caption squeeze the picture out of its own box', () => {
    for (const treatment of TREATMENTS) {
      for (const [where, box, base] of SHAPES) {
        const geometry = imageFrameBox({ ...LONGEST_BLOCK, treatment }, box, undefined, base, 12)
        const at = `${treatment} @ ${where}`
        expect(geometry.caption.band, at).toBeLessThanOrEqual(Math.floor(box.height * FRAME_CAPTION_CEILING))
        expect(geometry.picture.height, at).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Double the box, double the picture — the property that says a size came off
   * the box rather than off the frame, and the one a fraction of the short edge
   * fails however plausible the picture it drew. Stated as an equality rather
   * than as a ratio because the margin is the named exception: it is a constant
   * metric, so it is spent once whatever the box, and a ratio would have hidden
   * it inside a tolerance.
   */
  it('doubles the picture when the box doubles, and leaves the margin alone', () => {
    for (const treatment of TREATMENTS) {
      const one = imageFrameBox({ ...POOREST, treatment }, { width: 800, height: 400 }, undefined, 1080, 12)
      const two = imageFrameBox({ ...POOREST, treatment }, { width: 1600, height: 800 }, undefined, 1080, 12)
      expect(two.margin, treatment).toBe(one.margin)
      expect(two.picture.width, treatment).toBe(2 * one.picture.width + 2 * one.margin)
      expect(two.picture.height, treatment).toBe(2 * one.picture.height + 2 * one.margin)
    }
  })

  /** A longer caption takes more of the box, and the picture is what pays for it. */
  it('lets the caption take its band out of the picture and out of nothing else', () => {
    const box = { width: 900, height: 600 }
    const bare = imageFrameBox(POOREST, box, undefined, 1080, 12)
    const captioned = imageFrameBox(LONGEST_BLOCK, box, undefined, 1080, 12)
    expect(captioned.caption.band).toBeGreaterThan(0)
    expect(bare.caption.band).toBe(0)
    expect(bare.picture.height - captioned.picture.height).toBe(captioned.caption.band)
  })
})

describe('the box a treatment makes', () => {
  it('gives a panel to `card` alone, and rounds nothing that bleeds', () => {
    const at = (treatment) => imageFrameBox({ ...POOREST, treatment }, { width: 900, height: 600 }, undefined, 1080, 12)
    expect(at('card').panel).toBe(true)
    expect(at('inset').panel).toBe(false)
    expect(at('bleed').panel).toBe(false)
    expect(at('bleed').pictureRadius).toBe(0)
    expect(at('bleed').margin).toBe(0)
    expect(at('card').pictureRadius).toBe(Math.round(at('card').radius * FRAME_INNER_RADIUS))
    // `inset` is the one that stands off its box with the ground showing, which
    // is what the word names — and it is one gutter now, not 12% of the measure.
    expect(at('inset').margin).toBeGreaterThan(0)
    expect(at('inset').margin).toBe(at('card').margin)
  })

  /**
   * An unknown treatment reads as `card`, the schema's own default, for the
   * reason `anchorName` and `blockComponent` both give: the value was refused by
   * `validate.js` long before a frame, so reaching that branch means two lists
   * disagree — and a picture in a card beats a picture that vanished from a film
   * somebody waited for (Q1).
   */
  it('falls back to the schema’s default rather than to nothing', () => {
    for (const unknown of ['poster', undefined, 'constructor', '__proto__']) {
      expect(frameTreatment(unknown), String(unknown)).toBe('card')
    }
  })

  it('answers in whole pixels, and never in negative ones', () => {
    for (const treatment of [...TREATMENTS, 'poster']) {
      for (const box of [{ width: 0, height: 0 }, { width: 40, height: 12 }, { width: 1688, height: 950 }]) {
        const geometry = imageFrameBox({ ...LONGEST_BLOCK, treatment }, box, undefined, 1080, 9999)
        for (const value of [geometry.margin, geometry.radius, geometry.pictureRadius, geometry.picture.width, geometry.picture.height, geometry.caption.band]) {
          expect(Number.isInteger(value), `${treatment} ${JSON.stringify(box)}`).toBe(true)
          expect(value, `${treatment} ${JSON.stringify(box)}`).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})

describe('what the picture is never painted on', () => {
  /**
   * The one legibility rule this block owns.
   *
   * A photograph is not in the theme, so no run was measured against it — which
   * is why `composedPalette` has no entry for text on a bare picture, and why a
   * caption laid over one would be the dark-green-on-near-black defect arriving
   * through a component instead of through a palette. The caption is a sibling
   * of the picture box in the source, never a child of it.
   */
  it('keeps the caption out of the picture box', () => {
    const box = source.indexOf('<img')
    const caption = source.indexOf('<figcaption')
    expect(box).toBeGreaterThan(-1)
    expect(caption).toBeGreaterThan(box)
    expect(source.slice(box, caption)).toContain('</div>')
  })
})
