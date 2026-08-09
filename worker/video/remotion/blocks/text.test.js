// The arithmetic of the text family, as claims.
//
// A `.jsx` cannot be asked a question — there is no renderer in this suite and
// there will not be one, since Remotion's licence is the reason the worker is a
// separate image at all. So everything a text block DECIDES is in `text.js` and
// everything below is a question about it: where a word sits in a cascade, how
// much of a rule has been drawn, which rectangle the marker and the ink on it
// share. A number that only exists inside a component is a number nobody can
// check, which is the rule `composition.js` is written under.
import { describe, it, expect } from 'vitest'
import {
  BOX_PAD_EM,
  EMPHASIS_RATIO,
  HEADING_MEASURE_EMS,
  HEADING_SIZES,
  HIGHLIGHT_SIZE,
  MARK_SOAK_FLOOR,
  MASK_TRAVEL_PERCENT,
  QUOTE_CUES,
  UNDERLINE_DROP_EM,
  boxPadEm,
  headingMeasure,
  headingSize,
  markerClip,
  markerDraw,
  markerSoak,
  markerWipe,
  phase,
  quoteCue,
  ruleExtent,
  ruleThickness,
  splitMark,
  underlineDropEm,
  wordReveal,
} from './text.js'

/** The short edge of all three ratios, and the long edge of the one that is landscape. */
const BASE = 1080
const LANDSCAPE_WIDTH = 1920

const samples = (count) => Array.from({ length: count + 1 }, (_, i) => i / count)

describe('the heading measure', () => {
  it('sets a display line inside two thirds of a landscape frame', () => {
    // The sentence the stub was written against, as arithmetic: past two thirds
    // a display line stops being a heading and becomes a paragraph.
    const width = headingMeasure('display') * headingSize('display') * BASE
    expect(width).toBeLessThanOrEqual((2 / 3) * LANDSCAPE_WIDTH)
  })

  it('gives the smaller roles a longer line, because a measure is a character count', () => {
    expect(HEADING_MEASURE_EMS.display).toBeLessThan(HEADING_MEASURE_EMS.title)
    expect(HEADING_MEASURE_EMS.title).toBeLessThan(HEADING_MEASURE_EMS.subtitle)
    expect(HEADING_SIZES.display).toBeGreaterThan(HEADING_SIZES.title)
    expect(HEADING_SIZES.title).toBeGreaterThan(HEADING_SIZES.subtitle)
  })

  it('keeps every role past the 24 px the 3:1 floor is licensed by', () => {
    // `palette.display` is resolved at CONTRAST_MIN_LARGE, and that floor is only
    // legitimate while the type is large. The smallest role is the one to watch:
    // a subtitle nudged down to look delicate would take a floor it no longer
    // earns, exactly as `KICKER_SIZE` is pinned one file up.
    for (const [level, size] of Object.entries(HEADING_SIZES)) {
      expect(size * BASE, level).toBeGreaterThan(24)
    }
  })

  it('answers for an unknown role, and never for one inherited from Object', () => {
    expect(headingSize('title')).toBe(HEADING_SIZES.title)
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', undefined, null, 7]) {
      expect(headingSize(name), String(name)).toBe(HEADING_SIZES.title)
      expect(headingMeasure(name), String(name)).toBe(HEADING_MEASURE_EMS.title)
    }
  })
})

describe('the masked word cascade', () => {
  it('hides a word completely before it arrives', () => {
    // The travel is a percentage of the word's own line box and it is past 100
    // on purpose: the box is padded below the baseline so a descender survives
    // `overflow: hidden`, and a word moved by exactly its height still shows a
    // sliver in that padding.
    expect(MASK_TRAVEL_PERCENT).toBeGreaterThan(100)
    expect(wordReveal(0, 0, 5)).toBe(0)
  })

  it('never runs a window past the block’s own arrival', () => {
    // `progress` stops at 1 and stays there for the rest of the scene, so a word
    // scheduled past it is a headline missing its last word for the whole film.
    for (let count = 1; count <= 12; count += 1) {
      for (let i = 0; i < count; i += 1) {
        expect(wordReveal(1, i, count), `${i}/${count}`).toBeCloseTo(1, 10)
      }
    }
  })

  it('only ever moves forward', () => {
    for (const count of [1, 2, 5, 12]) {
      for (let i = 0; i < count; i += 1) {
        let previous = -1
        for (const at of samples(200)) {
          const now = wordReveal(at, i, count)
          expect(now, `${i}/${count}@${at}`).toBeGreaterThanOrEqual(previous)
          previous = now
        }
      }
    }
  })

  it('arrives in the order the words are written in', () => {
    for (const count of [2, 3, 8]) {
      for (const at of samples(100)) {
        for (let i = 1; i < count; i += 1) {
          expect(wordReveal(at, i - 1, count), `${i}/${count}@${at}`).toBeGreaterThanOrEqual(wordReveal(at, i, count))
        }
      }
    }
  })

  it('gives the last word a longer travel, and it is the two frame counts that say how much', () => {
    // The stress mark of a cascade: the window is longer, not later, so the
    // emphasis costs no beat. `EMPHASIS_RATIO` is read off
    // `EMPHASIS_ENTER_FRAMES` and `CUE_ENTER_FRAMES` rather than retyped, so it
    // cannot drift from the entrance the five templates give the same word.
    expect(EMPHASIS_RATIO).toBeGreaterThan(1)
    const count = 4
    const ordinary = samples(400).filter((at) => wordReveal(at, count - 2, count) > 0 && wordReveal(at, count - 2, count) < 1)
    const last = samples(400).filter((at) => wordReveal(at, count - 1, count) > 0 && wordReveal(at, count - 1, count) < 1)
    expect(last.length).toBeGreaterThan(ordinary.length)
  })

  it('leaves a single word alone: it is the block’s own arrival, unchanged', () => {
    for (const at of samples(20)) expect(wordReveal(at, 0, 1)).toBe(at)
  })

  it('answers 0 rather than NaN for the counts a caller should never pass', () => {
    for (const bad of [undefined, null, -3, 'two', Number.NaN]) {
      expect(wordReveal(bad, 0, 4), String(bad)).toBe(0)
      expect(Number.isFinite(wordReveal(0.5, 0, bad)), String(bad)).toBe(true)
    }
  })
})

describe('one arrival, in stages', () => {
  it('renormalises a slice and clamps both ends', () => {
    expect(phase(0, 0.5, 1)).toBe(0)
    expect(phase(0.5, 0.5, 1)).toBe(0)
    expect(phase(0.75, 0.5, 1)).toBeCloseTo(0.5, 10)
    expect(phase(1, 0.5, 1)).toBe(1)
    expect(phase(2, 0.5, 1)).toBe(1)
  })

  it('answers the whole arrival for a window that is not one', () => {
    for (const [from, to] of [
      [1, 0],
      [0.5, 0.5],
      [Number.NaN, 1],
    ]) {
      expect(phase(0.4, from, to)).toBe(0.4)
    }
  })

  it('runs the quote’s three stages in order, all of them finished when the block is', () => {
    const order = ['mark', 'text', 'attribution']
    for (let i = 1; i < order.length; i += 1) {
      expect(QUOTE_CUES[order[i - 1]][0]).toBeLessThan(QUOTE_CUES[order[i]][0])
    }
    for (const name of order) {
      expect(quoteCue(name, 0)).toBe(0)
      expect(quoteCue(name, 1)).toBe(1)
      expect(QUOTE_CUES[name][1]).toBeLessThanOrEqual(1)
    }
    // The attribution follows the sentence rather than landing with it, which is
    // the whole of "and then, who said it".
    for (const at of samples(50)) {
      expect(quoteCue('attribution', at), String(at)).toBeLessThanOrEqual(quoteCue('text', at))
    }
  })
})

describe('a rule that is still being drawn on the last frame', () => {
  it('draws nothing before its block has arrived', () => {
    for (const at of samples(10)) expect(ruleExtent(0, at, 0.3)).toBe(0)
  })

  it('advances on every frame of the scene, which is what stops the block freezing', () => {
    // The claim this whole term exists for. `progress` is 1 for almost the whole
    // scene by design, so a block whose only moving part is its entrance is a
    // still with an entrance on it — the defect `tests/video-motion.test.js`
    // catches one level up and a component can reintroduce on its own.
    for (const rest of [0, 0.26, 0.34, 0.55]) {
      let previous = -1
      for (const at of samples(300)) {
        const now = ruleExtent(1, at, rest)
        expect(now, `${rest}@${at}`).toBeGreaterThan(previous)
        expect(now).toBeLessThanOrEqual(1)
        previous = now
      }
      expect(ruleExtent(1, 0, rest)).toBeCloseTo(rest, 10)
      expect(ruleExtent(1, 1, rest)).toBeCloseTo(1, 10)
    }
  })

  it('is a hairline at 1080 and never disappears at any frame size', () => {
    expect(ruleThickness(BASE)).toBe(3)
    for (const size of [0, 1, 120, 540, 1080, 1920]) expect(ruleThickness(size)).toBeGreaterThanOrEqual(1)
    expect(ruleThickness(undefined)).toBe(1)
  })
})

describe('the marker, which is drawn and never posed', () => {
  it('waits for the line before it starts', () => {
    expect(markerDraw(0)).toBe(0)
    expect(markerDraw(0.3)).toBe(0)
    expect(markerDraw(1)).toBe(1)
  })

  it('soaks upwards for the whole scene, and only upwards', () => {
    // Only upwards, and that is the legibility half rather than the look: an
    // uncovered slice of a glyph shows the copy painted on the GROUND, which is
    // legible. A covered slice with no fill under it would not be.
    expect(markerSoak(0)).toBeCloseTo(MARK_SOAK_FLOOR, 10)
    expect(markerSoak(1)).toBeCloseTo(1, 10)
    let previous = -1
    for (const at of samples(300)) {
      const now = markerSoak(at)
      expect(now, String(at)).toBeGreaterThan(previous)
      previous = now
    }
  })

  it('hands the fill and the ink on it one rectangle, hiding everything before the wipe', () => {
    // One string, called once and given to both layers: two clips would be the
    // third state — an ink measured against the accent, sitting on the ground.
    expect(markerClip(0, 0)).toBe(markerClip(0, 0))
    expect(markerClip(0, 0).split(' ')[1]).toBe('100%')
    expect(markerClip(1, 1)).toBe('inset(0% 0% 0% 0%)')
    expect(markerWipe(1)).toBe('inset(0% 0% 0% 0%)')
    expect(markerWipe(0).split(' ')[1]).toBe('100%')
  })

  it('gives the two ornaments a horizontal wipe with no vertical term', () => {
    // A rule two device pixels tall clipped by 28% of its own height is a rule
    // nobody sees, so the underline and the box move by position instead.
    for (const at of samples(20)) expect(markerWipe(at).startsWith('inset(0% ')).toBe(true)
  })

  it('closes the underline and the box onto the word across the scene', () => {
    let drop = Number.POSITIVE_INFINITY
    let pad = Number.POSITIVE_INFINITY
    for (const at of samples(200)) {
      expect(underlineDropEm(at), String(at)).toBeLessThan(drop)
      expect(boxPadEm(at), String(at)).toBeLessThan(pad)
      drop = underlineDropEm(at)
      pad = boxPadEm(at)
    }
    expect(underlineDropEm(1)).toBeCloseTo(UNDERLINE_DROP_EM, 10)
    expect(boxPadEm(1)).toBeCloseTo(BOX_PAD_EM, 10)
    // Under the baseline and outside the glyphs at every point of that travel:
    // a rule that crossed the word would be an ornament eating the run it marks.
    expect(underlineDropEm(0)).toBeGreaterThan(0)
    expect(boxPadEm(0)).toBeGreaterThan(0)
  })

  it('keeps the marked run large enough for the floor its ink was resolved at', () => {
    // `palette.onFill` is resolved at the 3:1 display floor, and a marked run is
    // running text. Weight 700 is what licences it — the audit calls bold text
    // past 18.66 px large — so the size has to stay past that with room.
    expect(HIGHLIGHT_SIZE * BASE).toBeGreaterThan(18.66)
  })
})

describe('finding the marked run', () => {
  it('reassembles the line it was given, whatever it found', () => {
    for (const [text, mark] of [
      ['a marked line', 'marked'],
      ['a marked line', 'absent'],
      ['a marked line', null],
      ['marked at the start', 'marked'],
      ['marked at the end', 'end'],
      ['repeated repeated', 'repeated'],
    ]) {
      expect(splitMark(text, mark).join('')).toBe(text)
    }
  })

  it('leaves the line unmarked when the run does not occur — never an error, never a repair', () => {
    expect(splitMark('a marked line', 'absent')).toEqual(['a marked line', '', ''])
    expect(splitMark('a marked line', null)).toEqual(['a marked line', '', ''])
    expect(splitMark('a marked line', '')).toEqual(['a marked line', '', ''])
  })

  it('takes the first occurrence, because a search over prose is not a parse', () => {
    expect(splitMark('one two one', 'one')).toEqual(['', 'one', ' two one'])
  })
})
