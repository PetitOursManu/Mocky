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
import { FPS } from '../composition.js'
import { TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import { DATE_HEAD_PERCENT, dateStampHead } from './dateStamp.jsx'

const here = path.dirname(fileURLToPath(import.meta.url))
/** Comments stripped, for the reason `blocks.test.js` gives: the prose names what the code may not do. */
const code = fs
  .readFileSync(path.join(here, 'dateStamp.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1')

const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)
const TREATMENTS = ['plain', 'boxed', 'rule']

describe('the date comes from the document and from nowhere else', () => {
  it('cannot reach a clock of its own', () => {
    expect(code).not.toMatch(/\bDate\b/)
    expect(code).not.toMatch(/\bnow\s*\(/)
    expect(code).not.toMatch(/toLocaleDateString|getFullYear|getMonth/)
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
