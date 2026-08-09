// The arithmetic of the four animated-text blocks, against the cues a composed
// scene really produces.
//
// It imports `../composition.js` rather than re-deriving the beat, and that is
// the point of the file: `layerCues`, `cueProgress` and `MIN_CUE_TAIL_FRAMES` are
// what decide when a block is on screen, so a claim about "before the cut" that
// used its own idea of a cue would prove nothing about a render. Nothing here
// touches a `.jsx`: the components draw what these numbers say and own no beat of
// their own, which is what makes every sentence below checkable at all.
import { describe, it, expect } from 'vitest'
import {
  CARET_BLINKS_PER_SCENE,
  COUNT_SHARE,
  FIGURE_SIZE,
  GROUP_SEPARATOR,
  LETTER_SPAN,
  LIST_SHARE,
  LOGO_SHARE,
  LOGO_SIZE,
  TYPE_SHARE,
  caretOn,
  counterValue,
  fittedSize,
  groupedNumber,
  letterShift,
  letters,
  markerLabel,
  revealRamp,
  staggerRamp,
  typedCount,
  typedSplit,
  wordGlyphs,
} from './animatedText.js'
import { CUE_ENTER_FRAMES, EMPHASIS_ENTER_FRAMES, MIN_CUE_TAIL_FRAMES, cueProgress, layerCues, msToFrames } from '../composition.js'

/** The two ends of what `ComposedSceneSchema` accepts, and one ordinary scene. */
const SHORTEST = msToFrames(1500)
const ORDINARY = msToFrames(4000)
const LONGEST = msToFrames(15000)
const DURATIONS = [SHORTEST, ORDINARY, LONGEST]

/**
 * One composed scene, as the pair of clocks a block is handed.
 *
 * `life` is copied from `ComposedSceneVideo.progressOf` and `progress` from
 * `composedMotion`: a test that invented either would be measuring itself.
 */
function timeline(count, durationInFrames, span = CUE_ENTER_FRAMES) {
  const layers = Array.from({ length: count }, () => ({ kind: 'typewriter' }))
  const cues = layerCues(layers, durationInFrames)
  const life = (frame) => Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)))
  return {
    cues,
    durationInFrames,
    frames: Array.from({ length: durationInFrames }, (_, frame) => frame),
    ramp: (index, frame, share) => revealRamp(cueProgress(frame, cues[index], span), life(frame), share),
    life,
  }
}

/** The first frame on which a block's reveal is finished, or -1. */
const settledAt = (film, index, share) =>
  film.frames.find((frame) => film.ramp(index, frame, share) === 1) ?? -1

describe('the family clock', () => {
  /**
   * The gate, and the failure it exists to prevent.
   *
   * The reveal runs on the scene's clock so that a hundred and twenty characters
   * are not typed in nine frames. That clock starts at the top of the scene and
   * a block's cue does not, so without `progress` in the minimum a block ranked
   * last would fade in with its line already typed — the scene's clock having run
   * while it was not on screen.
   */
  it('is nothing at all before the block’s own cue', () => {
    for (const duration of DURATIONS) {
      const film = timeline(8, duration)
      for (let index = 0; index < 8; index++) {
        for (const frame of film.frames.filter((f) => f <= film.cues[index])) {
          expect(film.ramp(index, frame, TYPE_SHARE), `${duration}f rank ${index} frame ${frame}`).toBe(0)
        }
      }
    }
  })

  it('is the case worth checking: a late block still types, on a scene whose clock has already passed the share', () => {
    const film = timeline(8, SHORTEST)
    const last = 7
    // The cue really is past the point where the reveal would otherwise be over:
    // this is the frame at which the naive version handed back a finished line.
    expect(film.life(film.cues[last])).toBeGreaterThan(LOGO_SHARE)
    expect(film.life(film.cues[last]) / TYPE_SHARE).toBeGreaterThan(0.95)
    expect(typedCount('a line that has to be typed', film.ramp(last, film.cues[last], TYPE_SHARE))).toBe(0)
    expect(typedCount('a line that has to be typed', film.ramp(last, film.cues[last] + 3, TYPE_SHARE))).toBeGreaterThan(0)
  })

  it('never runs backwards, on any frame of any scene', () => {
    for (const duration of DURATIONS) {
      for (const count of [1, 3, 8]) {
        const film = timeline(count, duration)
        for (let index = 0; index < count; index++) {
          let previous = 0
          for (const frame of film.frames) {
            const at = film.ramp(index, frame, TYPE_SHARE)
            expect(at, `${duration}f rank ${index} frame ${frame}`).toBeGreaterThanOrEqual(previous)
            previous = at
          }
        }
      }
    }
  })

  /**
   * "Before the cut" as arithmetic rather than as an intention.
   *
   * `cueFrames` places no cue later than `MIN_CUE_TAIL_FRAMES` before the end, so
   * the worst case is a block cued exactly there: it is finished at
   * `cue + CUE_ENTER_FRAMES`, which leaves the difference between the two — six
   * frames, a fifth of a second — of scene after the last character lands. Every
   * earlier rank has more.
   */
  it('finishes with the whole tail of the scene left, for every rank and every legal duration', () => {
    const tail = MIN_CUE_TAIL_FRAMES - CUE_ENTER_FRAMES
    for (const duration of DURATIONS) {
      for (const count of [1, 4, 8]) {
        const film = timeline(count, duration)
        for (let index = 0; index < count; index++) {
          for (const share of [TYPE_SHARE, LIST_SHARE, COUNT_SHARE, LOGO_SHARE]) {
            const done = settledAt(film, index, share)
            expect(done, `${duration}f rank ${index} share ${share}`).toBeGreaterThan(-1)
            expect(duration - 1 - done, `${duration}f rank ${index} share ${share}`).toBeGreaterThanOrEqual(tail)
          }
        }
      }
    }
  })

  /**
   * The slow entrance is the one case that cannot be given a margin, and it is
   * still not allowed to run past the cut.
   *
   * `composedMotion` gives `EMPHASIS_ENTER_FRAMES` to the block that arrives last
   * and alone. That span equals `MIN_CUE_TAIL_FRAMES` exactly, so a block cued at
   * the very last legal frame lands ON the cut rather than before it — which is
   * why this asks for the rendered line rather than for the ramp.
   */
  it('has typed every character by the last frame, even on the slow entrance', () => {
    const text = 'a hundred and twenty characters is the longest line the schema will take, and it is the one worth checking here'
    for (const duration of DURATIONS) {
      const film = timeline(8, duration, EMPHASIS_ENTER_FRAMES)
      for (let index = 0; index < 8; index++) {
        expect(typedCount(text, film.ramp(index, duration - 1, TYPE_SHARE)), `${duration}f rank ${index}`).toBe(letters(text).length)
      }
    }
  })
})

describe('the typewriter', () => {
  it('always holds the whole line between what is typed and what is waiting', () => {
    const text = 'Type, and the rest of the line is already holding its space.'
    for (let step = 0; step <= 100; step++) {
      const { typed, rest } = typedSplit(text, step / 100)
      expect(typed + rest).toBe(text)
    }
  })

  /**
   * The cut is on CHARACTERS and not on UTF-16 units.
   *
   * `slice` on a `.length` cuts a surrogate pair in two, and half a pair is a
   * hollow box at the end of the line on exactly the frame somebody is reading
   * it. The schema's text is the user's prose, so an emoji in it is legal and
   * ordinary.
   */
  it('never cuts a character in half', () => {
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    const text = 'Ship it 🚀 — every frame 🎬'
    for (let step = 0; step <= 100; step++) {
      const { typed, rest } = typedSplit(text, step / 100)
      expect(lone.test(typed), `typed at ${step}`).toBe(false)
      expect(lone.test(rest), `rest at ${step}`).toBe(false)
    }
  })

  it('holds the caret solid while the line is still arriving', () => {
    const film = timeline(1, ORDINARY)
    for (const frame of film.frames) {
      const ramp = film.ramp(0, frame, TYPE_SHARE)
      if (ramp < 1) expect(caretOn(ramp, film.life(frame)), `frame ${frame}`).toBe(true)
    }
  })

  it('blinks once the line is finished, and only ever fully painted or absent', () => {
    const film = timeline(1, ORDINARY)
    const after = film.frames.filter((frame) => film.ramp(0, frame, TYPE_SHARE) === 1)
    const states = after.map((frame) => caretOn(1, film.life(frame)))
    for (const state of states) expect(typeof state).toBe('boolean')
    expect(states).toContain(true)
    expect(states).toContain(false)
    // A blink is two flips, and the tail of the scene holds at least one of them.
    const flips = states.filter((state, i) => i > 0 && state !== states[i - 1]).length
    expect(flips).toBeGreaterThanOrEqual(1)
    expect(flips).toBeLessThanOrEqual(CARET_BLINKS_PER_SCENE * 2)
  })
})

describe('the list', () => {
  it('gives one item at a time, in the order the document wrote them', () => {
    const film = timeline(1, ORDINARY)
    for (const count of [1, 2, 6]) {
      for (const frame of film.frames) {
        const ramp = film.ramp(0, frame, LIST_SHARE)
        const items = Array.from({ length: count }, (_, i) => staggerRamp(count, i, ramp))
        for (let i = 1; i < count; i++) {
          expect(items[i - 1], `${count} items, frame ${frame}`).toBeGreaterThanOrEqual(items[i])
        }
      }
    }
  })

  it('has every item arrived once the reveal is over, whatever the count', () => {
    for (const count of [1, 2, 3, 6]) {
      for (let i = 0; i < count; i++) expect(staggerRamp(count, i, 1)).toBe(1)
    }
  })

  it('does not delay a list of one: there is nothing for it to wait for', () => {
    for (let step = 0; step <= 10; step++) expect(staggerRamp(1, 0, step / 10)).toBeCloseTo(step / 10, 10)
  })

  it('never goes backwards, item by item', () => {
    const film = timeline(3, LONGEST)
    for (let i = 0; i < 6; i++) {
      let previous = 0
      for (const frame of film.frames) {
        const at = staggerRamp(6, i, film.ramp(1, frame, LIST_SHARE))
        expect(at).toBeGreaterThanOrEqual(previous)
        previous = at
      }
    }
  })

  /**
   * The two markers that are not numerals are shapes the component draws. A
   * label returned for them would be a glyph, and a glyph `fonts-liberation` does
   * not carry is a hollow box beside every item at once.
   */
  it('answers with a numeral only for the numeral marker', () => {
    expect(markerLabel('numeral', 0)).toBe('01')
    expect(markerLabel('numeral', 5)).toBe('06')
    expect(markerLabel('dot', 0)).toBe(null)
    expect(markerLabel('rule', 0)).toBe(null)
  })
})

describe('the counter', () => {
  it('stops on its value and never passes it, on any frame of any scene', () => {
    for (const duration of DURATIONS) {
      const film = timeline(4, duration)
      for (const [from, to] of [
        [0, 1000000],
        [12, 13],
        [0, 7],
        [900, 100],
      ]) {
        for (const frame of film.frames) {
          const value = counterValue(from, to, film.ramp(2, frame, COUNT_SHARE))
          expect(value, `${from}→${to} frame ${frame}`).toBeLessThanOrEqual(Math.max(from, to))
          expect(value, `${from}→${to} frame ${frame}`).toBeGreaterThanOrEqual(Math.min(from, to))
        }
        expect(counterValue(from, to, film.ramp(2, duration - 1, COUNT_SHARE))).toBe(to)
      }
    }
  })

  it('starts where the document starts it', () => {
    expect(counterValue(120, 900, 0)).toBe(120)
    expect(counterValue(0, 900, 0)).toBe(0)
  })

  it('counts up without ever counting back', () => {
    const film = timeline(1, ORDINARY)
    let previous = 0
    for (const frame of film.frames) {
      const value = counterValue(0, 4321, film.ramp(0, frame, COUNT_SHARE))
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
    expect(previous).toBe(4321)
  })

  /**
   * The separator is a decision, not a formatting default: `toLocaleString` would
   * make the figure depend on the render container's locale, and two renders of
   * one timeline differing is the one thing a content-addressed export store
   * cannot have.
   */
  it('groups its thousands with a non-breaking space, and nothing a locale chose', () => {
    expect(GROUP_SEPARATOR).toBe('\u00a0')
    expect(GROUP_SEPARATOR).not.toBe('\u0020')
    expect(GROUP_SEPARATOR).not.toBe('\u202f')
    expect(groupedNumber(0)).toBe('0')
    expect(groupedNumber(7)).toBe('7')
    expect(groupedNumber(999)).toBe('999')
    expect(groupedNumber(1000)).toBe(`1${GROUP_SEPARATOR}000`)
    expect(groupedNumber(1000000)).toBe(`1${GROUP_SEPARATOR}000${GROUP_SEPARATOR}000`)
    expect(groupedNumber(12345)).toBe(`12${GROUP_SEPARATOR}345`)
  })

  it('reads the same digits back, whatever the grouping', () => {
    for (const value of [0, 5, 99, 1000, 90210, 1000000]) {
      expect(groupedNumber(value).split(GROUP_SEPARATOR).join('')).toBe(String(value))
    }
  })
})

describe('the wordmark', () => {
  it('closes every letter onto its own measure', () => {
    for (const count of [1, 4, 24]) {
      for (let i = 0; i < count; i++) {
        expect(staggerRamp(count, i, 1, LETTER_SPAN), `${count} letters, ${i}`).toBe(1)
        // `Math.abs`, because the letters left of centre close on a negative
        // zero — which is 0 everywhere except in `Object.is`, and `-0px` is a
        // perfectly ordinary transform.
        expect(Math.abs(letterShift(count, i, 1)), `${count} letters, ${i}`).toBe(0)
      }
    }
  })

  /**
   * The travel is bounded whatever the word, and that is the whole reason it is
   * normalised: a per-letter spread multiplied by twenty-four letters starts a
   * wordmark outside its own box, which in 9:16 is behind a feed's interface
   * rather than merely near an edge.
   */
  it('never travels further than one fixed distance, however long the word', () => {
    for (const count of [1, 2, 7, 24]) {
      for (let i = 0; i < count; i++) {
        for (let step = 0; step <= 20; step++) {
          expect(Math.abs(letterShift(count, i, step / 20)), `${count}/${i}@${step}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('gathers from both sides at once, and leaves the middle letter where it is', () => {
    expect(letterShift(5, 0, 0)).toBe(-letterShift(5, 4, 0))
    expect(letterShift(5, 2, 0)).toBe(0)
    expect(letterShift(1, 0, 0)).toBe(0)
    expect(letterShift(4, 0, 0)).toBeLessThan(0)
    expect(letterShift(4, 3, 0)).toBeGreaterThan(0)
  })

  it('breaks a wordmark between its words and never inside one', () => {
    const groups = wordGlyphs('Mocky Studio')
    expect(groups.map((g) => g.glyphs.map((entry) => entry.glyph).join(''))).toEqual(['Mocky', ' ', 'Studio'])
    expect(groups.filter((g) => g.space)).toHaveLength(1)
    // The indices are the flat letter indices, in order and complete: they are
    // what each letter's own cue is computed from.
    expect(groups.flatMap((g) => g.glyphs.map((entry) => entry.index))).toEqual(letters('Mocky Studio').map((_, i) => i))
  })

  it('keeps a wordmark of one word in one group', () => {
    expect(wordGlyphs('Mocky')).toHaveLength(1)
    expect(wordGlyphs('')).toEqual([])
  })
})

describe('the type size a long string gets', () => {
  it('falls as the string grows, and stops at both ends', () => {
    const base = 1080
    for (const ramp of [LOGO_SIZE, FIGURE_SIZE]) {
      const short = fittedSize('x'.repeat(ramp.short), base, ramp)
      const long = fittedSize('x'.repeat(ramp.long), base, ramp)
      expect(short).toBe(Math.round(base * ramp.max))
      expect(long).toBe(Math.round(base * ramp.min))
      expect(fittedSize('x', base, ramp)).toBe(short)
      expect(fittedSize('x'.repeat(ramp.long * 4), base, ramp)).toBe(long)
      expect(fittedSize('x'.repeat(Math.round((ramp.short + ramp.long) / 2)), base, ramp)).toBeLessThan(short)
      expect(fittedSize('x'.repeat(Math.round((ramp.short + ramp.long) / 2)), base, ramp)).toBeGreaterThan(long)
    }
  })

  it('measures characters and not UTF-16 units', () => {
    expect(fittedSize('🚀'.repeat(LOGO_SIZE.short), 1080, LOGO_SIZE)).toBe(Math.round(1080 * LOGO_SIZE.max))
  })
})

/**
 * The family's own answer to the rule that nothing holds still.
 *
 * A block that fades in over nine frames and then sits there for fourteen
 * seconds is what these four were as stubs. The claim here is the opposite one
 * and it is deliberately weak enough to be true of all four: each of them changes
 * on many separate frames of an ordinary scene, and its last frame differs from
 * its first. What none of them has is a second continuous breath afterwards —
 * `COMPOSED_BLOCK_DRIFT` reserves that for the stack, because two notions of "a
 * block breathes" is one of them drifting.
 */
describe('nothing in this family is a single fade', () => {
  const film = timeline(1, ORDINARY)
  const distinct = (values) => new Set(values.map((v) => JSON.stringify(v))).size

  it('changes on many frames of an ordinary scene, block by block', () => {
    const line = 'Every character of this line arrives on its own frame.'
    const typed = film.frames.map((f) => typedCount(line, film.ramp(0, f, TYPE_SHARE)))
    const items = film.frames.map((f) => Array.from({ length: 6 }, (_, i) => staggerRamp(6, i, film.ramp(0, f, LIST_SHARE))))
    const count = film.frames.map((f) => counterValue(0, 4321, film.ramp(0, f, COUNT_SHARE)))
    const word = film.frames.map((f) => Array.from({ length: 8 }, (_, i) => letterShift(8, i, film.ramp(0, f, LOGO_SHARE))))

    for (const [name, series] of [
      ['typewriter', typed],
      ['animatedList', items],
      ['counter', count],
      ['logoType', word],
    ]) {
      expect(distinct(series), name).toBeGreaterThan(8)
      expect(JSON.stringify(series[series.length - 1]), name).not.toBe(JSON.stringify(series[0]))
    }
  })

  it('keeps the caret moving after everything else has settled', () => {
    const settled = film.frames.filter((f) => film.ramp(0, f, TYPE_SHARE) === 1)
    expect(distinct(settled.map((f) => caretOn(1, film.life(f))))).toBe(2)
  })
})
