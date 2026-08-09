// `imageFrame`, held to arithmetic.
//
// A block cannot be rendered in this suite — Remotion is not installed here and
// never will be — so what is checkable about one is exactly what it computes
// before React sees it. The two claims below are the two ways this block could
// be wrong in a file nobody watches: a camera move that has drifted from the one
// the rest of the film makes, and a picture that stops moving inside its frame.
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
import { FPS, kenBurnsTransform } from '../composition.js'
import { KEN_BURNS, TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import { FRAME_PICTURE_HEIGHT, FRAME_WIDTH_PERCENT, framedMove, imageFrameBox } from './imageFrame.jsx'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, 'imageFrame.jsx'), 'utf8')

/** The longest scene the composed variant accepts, in frames: the finest step `life` can take. */
const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)
const SHORTEST = Math.round((TEMPLATE_LIMITS.composed.minSceneMs / 1000) * FPS)

const MOVES = KEN_BURNS.filter((kind) => kind !== 'static')

describe('the move a framed picture makes', () => {
  /**
   * The claim `framedMove` exists to make: it is the FILM's Ken Burns, not a
   * second one written at block scale.
   *
   * Two of them would be discovered to disagree by watching an mp4 — a slideshow
   * scene and a composed scene of the same picture drifting at different rates,
   * with nothing anywhere naming the difference. So the delegation is checked
   * rather than described: at the same fraction of a scene, the two answers are
   * the same string, for every kind and at both ends of the duration window.
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

describe('the box a treatment makes', () => {
  it('gives a panel to `card` alone, and rounds nothing that bleeds', () => {
    expect(imageFrameBox('card', 1080, 12).panel).toBe(true)
    expect(imageFrameBox('inset', 1080, 12).panel).toBe(false)
    expect(imageFrameBox('bleed', 1080, 12).panel).toBe(false)
    expect(imageFrameBox('bleed', 1080, 12).pictureRadius).toBe(0)
    expect(imageFrameBox('card', 1080, 12).pictureRadius).toBeGreaterThan(0)
  })

  /**
   * An unknown treatment reads as `card`, the schema's own default, for the
   * reason `anchorName` and `blockComponent` both give: the value was refused by
   * `validate.js` long before a frame, so reaching that branch means two lists
   * disagree — and a picture in a card beats a picture that vanished from a film
   * somebody waited for (Q1).
   */
  it('falls back to the schema’s default rather than to nothing', () => {
    expect(imageFrameBox('poster', 1080, 12)).toEqual(imageFrameBox('card', 1080, 12))
    expect(imageFrameBox(undefined, 1080, 12)).toEqual(imageFrameBox('card', 1080, 12))
    // A name off `Object.prototype` answers for the prototype chain under a plain
    // lookup, which is the failure `blockComponent` is written against.
    expect(imageFrameBox('constructor', 1080, 12)).toEqual(imageFrameBox('card', 1080, 12))
  })

  it('spends more height the less framing it draws', () => {
    expect(FRAME_PICTURE_HEIGHT.bleed).toBeGreaterThan(FRAME_PICTURE_HEIGHT.inset)
    expect(FRAME_PICTURE_HEIGHT.inset).toBeGreaterThan(FRAME_PICTURE_HEIGHT.card)
    for (const treatment of Object.keys(FRAME_WIDTH_PERCENT)) {
      expect(FRAME_WIDTH_PERCENT[treatment], treatment).toBeLessThanOrEqual(100)
    }
  })

  it('answers in whole pixels, and never in negative ones', () => {
    for (const treatment of ['bleed', 'inset', 'card']) {
      for (const base of [0, 1080, 1920]) {
        const box = imageFrameBox(treatment, base, 9999)
        for (const [key, value] of Object.entries(box)) {
          if (typeof value !== 'number' || key === 'widthPercent') continue
          expect(Number.isInteger(value), `${treatment}.${key}`).toBe(true)
          expect(value, `${treatment}.${key}`).toBeGreaterThanOrEqual(0)
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
