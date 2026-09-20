// The mirror test: `contrast.js` and `src/lib/audit/colors.ts` must answer the
// same number for the same colours, digit for digit.
//
// This is the same discipline `server/video/timeline.test.js` applies to the
// hand-kept schema, and it exists for the same reason: two implementations of
// one formula, in two languages, in two directories, edited months apart. The
// audit's version is the original — it was written for the accessibility panel,
// reviewed there, and is the one a reader will trust. If the worker's copy ever
// disagrees, a film can be exported with text the audit would have failed, and
// nothing would say so.
//
// Importing the TypeScript side from a worker test is fine and is exactly what
// the timeline mirror does: the suite runs in Mocky's checkout, where both files
// exist. The worker's own image never runs tests, and `contrast.js` imports
// nothing, so the coupling lives here and only here.
import { describe, it, expect } from 'vitest'
import { CONTRAST_MIN, CONTRAST_MIN_LARGE, blend, channels, contrastRatio, relativeLuminance } from './contrast.js'
import * as audit from '../../../src/lib/audit/colors'

/**
 * The corpus: every hex spelling, both letter cases, and the inputs that must
 * come back as "cannot be read".
 *
 * The garbage half is not padding. `contrastRatio` returning NaN is the safety
 * mechanism on both sides — every comparison against NaN is false, so a caller
 * that forgets to check cannot conclude anything — and a port that returned 1
 * for an unreadable colour would be the failure the mechanism exists to prevent,
 * on the side nobody looks at.
 */
const CORPUS = [
  '#000000',
  '#ffffff',
  '#FFFFFF',
  '#fff',
  '#FFF',
  '#000',
  '#0b0b0f',
  '#f7f7f4',
  '#17171f',
  '#101014',
  '#6366f1',
  '#14532d',
  '#16a34a',
  '#f6f4ee',
  '#fde047',
  '#767676',
  '#808080',
  '#1a2b3c',
  '#abc',
  '#ABC',
  '  #F6F4EE  ',
  // Four and eight digits: unreachable from a theme, and the reason the port is
  // a mirror rather than a subset. Fully opaque forms have a luminance; the
  // others are translucent, which has none.
  '#ffff',
  '#0000',
  '#123456ff',
  '#12345678',
  '#fffa',
  // Read by neither side, and they must refuse in the same way.
  '',
  '#',
  '#12',
  '#12345',
  '#1234567',
  '#gggggg',
  'transparent',
  'red',
  'nonsense',
  'oklch(0.7 0.1 200)',
  'var(--brand)',
]

/** `toBe` cannot tell two NaNs apart from a mismatch, so the comparison is explicit. */
const same = (a, b) => (Number.isNaN(a) && Number.isNaN(b) ? true : Object.is(a, b))

describe('the worker mirrors the audit, colour for colour', () => {
  it('answers the same relative luminance', () => {
    const drift = CORPUS.filter((c) => !same(relativeLuminance(c), audit.relativeLuminance(c))).map(
      (c) => `${JSON.stringify(c)}: worker ${relativeLuminance(c)} vs audit ${audit.relativeLuminance(c)}`,
    )
    expect(drift.join('\n')).toBe('')
  })

  it('answers the same contrast ratio for every pair in the corpus', () => {
    const drift = []
    for (const a of CORPUS) {
      for (const b of CORPUS) {
        if (!same(contrastRatio(a, b), audit.contrastRatio(a, b))) {
          drift.push(`${JSON.stringify(a)} / ${JSON.stringify(b)}: ${contrastRatio(a, b)} vs ${audit.contrastRatio(a, b)}`)
        }
      }
    }
    expect(drift.slice(0, 10).join('\n')).toBe('')
  })

  /**
   * Guarding the guard. A corpus of colours neither side can read would make
   * both tests above pass on two implementations that agree on nothing: NaN
   * equals NaN everywhere. So at least most of it has to be measurable.
   */
  it('is a corpus that actually measures something', () => {
    const readable = CORPUS.filter((c) => Number.isFinite(relativeLuminance(c)))
    expect(readable.length).toBeGreaterThan(20)
  })

  /**
   * The canonical AA pair, from the audit's own suite. If a refactor ever
   * changed the sRGB transfer function on one side, this is the line that names
   * it rather than reporting a hundred anonymous drifts.
   */
  it('measures the canonical 4.54:1 pair', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#0b0b0f', '#0b0b0f')).toBeCloseTo(1, 10)
  })

  /** The audit's own two floors, restated where the worker reads them. */
  it('holds a film to the same bar as a screen', () => {
    expect(CONTRAST_MIN).toBe(4.5)
    expect(CONTRAST_MIN_LARGE).toBe(3)
  })

  /**
   * Where the mirror deliberately stops, stated so it is a decision and not a
   * gap somebody finds later.
   *
   * The audit reads `rgb()`, `hsl()` and Tailwind class names, because it looks
   * at generated source. A theme colour arrives as hex and has been refused
   * twice if it was anything else, so those syntaxes are unreachable here — and
   * the worker answers "cannot read" rather than half-implementing a colour
   * space, which is how a report ends up confidently wrong.
   */
  it('reads hex and nothing else, including the shapes the schema cannot send', () => {
    expect(relativeLuminance('rgb(0, 0, 0)')).toBeNaN()
    expect(Number.isFinite(audit.relativeLuminance('rgb(0, 0, 0)'))).toBe(true)
    for (const hostile of [null, undefined, 42, {}, ['#fff']]) {
      expect(relativeLuminance(hostile), String(hostile)).toBeNaN()
      expect(contrastRatio(hostile, '#ffffff'), String(hostile)).toBeNaN()
    }
  })
})

describe('blend', () => {
  /**
   * The composite the browser paints, not the one a colour scientist would.
   * CSS alpha compositing happens in the gamma-encoded space, and a "correct"
   * linear mix here would answer a shade away from the frame Chromium actually
   * screenshots — which is the one error a legibility calculation cannot afford.
   */
  it('mixes in the same space the browser composites in', () => {
    expect(blend('#ffffff', '#000000', 0.5)).toBe('#808080')
    expect(blend('#ffffff', '#000000', 0)).toBe('#000000')
    expect(blend('#ffffff', '#000000', 1)).toBe('#ffffff')
    expect(blend('#fff', '#000', 0.5)).toBe('#808080')
  })

  it('clamps an alpha out of range instead of inventing a channel', () => {
    expect(blend('#ffffff', '#000000', 5)).toBe('#ffffff')
    expect(blend('#ffffff', '#000000', -1)).toBe('#000000')
  })

  /**
   * Null, never a guess. Every caller reads it as "cannot measure" and falls
   * back to a value a human chose, which is the honest outcome; a black returned
   * here would silently become the surface a whole scene is judged against.
   */
  it('refuses a colour it cannot read', () => {
    expect(blend('nonsense', '#000000', 0.5)).toBe(null)
    expect(blend('#000000', 'var(--x)', 0.5)).toBe(null)
    expect(channels('#12345')).toBe(null)
    expect(channels('#abc')).toEqual([170, 187, 204])
  })
})
