// The arithmetic of the four animated-text blocks: the cues a composed scene
// really produces, and the boxes `composedLayout` really hands out.
//
// It imports `../composition.js` rather than re-deriving either, and that is the
// point of the file. `layerCues`, `cueProgress` and `MIN_CUE_TAIL_FRAMES` are
// what decide when a block is on screen, so a claim about "before the cut" that
// used its own idea of a cue would prove nothing about a render; `composedLayout`
// and `TYPE_ROLES` are what decide how big it is, so a claim about "it fills its
// box" measured against a box this file invented would prove nothing about a
// frame. Nothing here touches a `.jsx`: the components draw what these numbers
// say and own neither the beat nor a size, which is what makes every sentence
// below checkable at all.
import { describe, it, expect } from 'vitest'
import {
  CARET_BLINKS_PER_SCENE,
  COUNTER_LABEL_ROLE,
  COUNTER_ROLE,
  COUNT_SHARE,
  GROUP_SEPARATOR,
  LETTER_SPAN,
  LIST_ROLE,
  LIST_SHARE,
  LOGO_ROLE,
  LOGO_SHARE,
  MARK_SLASH_SKEW_DEG,
  TYPEWRITER_ROLE,
  TYPE_SHARE,
  caretOn,
  counterLayout,
  counterText,
  counterValue,
  counterWidest,
  groupedNumber,
  letterShift,
  letters,
  listLayout,
  logoLayout,
  markerLabel,
  revealRamp,
  staggerRamp,
  typedCount,
  typedSplit,
  typewriterLayout,
  wordGlyphs,
} from './animatedText.js'
import {
  BLOCK_APPETITE,
  BOX_FILL_FLOOR,
  CUE_ENTER_FRAMES,
  EMPHASIS_ENTER_FRAMES,
  MIN_CUE_TAIL_FRAMES,
  blockShape,
  composedLayout,
  composedSafeArea,
  cueProgress,
  frameBase,
  layerCues,
  msToFrames,
  textWidth,
  typeSize,
} from '../composition.js'

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

// ── The geometry: a block inhabits the box it is given ──────────────────────
//
// Six real exports were rendered and looked at, and every scene in them was a
// small element floating in a large void. A `typewriter` alone in a frame was a
// line of text in the middle of a black one; a `counter` was an eighth of the
// picture; a `counter` beside a `heading` was three times its neighbour. Every
// one of those is the same defect — a size that was a fraction of the FRAME —
// and the claims below are what stop it coming back one block at a time.

const KINDS = ['typewriter', 'animatedList', 'counter', 'logoType']

/** The poorest block of each kind the schema accepts, and the richest. */
const POOREST = {
  typewriter: { kind: 'typewriter', text: 'Ship it.', caret: true },
  animatedList: { kind: 'animatedList', items: ['One'], marker: 'numeral' },
  counter: { kind: 'counter', from: 0, to: 7, prefix: null, suffix: null, label: null },
  logoType: { kind: 'logoType', text: 'M', mark: 'square' },
}
const ITEM = 'a list item that runs right up to the bound the schema sets'.slice(0, 60)
const RICHEST = {
  typewriter: { kind: 'typewriter', text: 'typing '.repeat(17).trim(), caret: true },
  animatedList: { kind: 'animatedList', items: Array.from({ length: 6 }, () => ITEM), marker: 'numeral' },
  counter: {
    kind: 'counter',
    from: 0,
    to: 1000000,
    prefix: '€',
    suffix: ' / an',
    label: 'requests served in the last quarter, all'.slice(0, 40),
  },
  logoType: { kind: 'logoType', text: 'Mocky Studio Amsterdam', mark: 'slash' },
}

const FRAMES = [
  { name: '16:9', width: 1920, height: 1080 },
  { name: '9:16', width: 1080, height: 1920 },
  { name: '1:1', width: 1080, height: 1080 },
]

/**
 * The shapes of box a block really gets, and the last three are the ones nobody
 * looks at: a third of a column, a band across the bottom, a narrow strip. They
 * are what a model produces the moment it anchors two blocks in one row.
 */
function boxesOf(frame) {
  const safe = composedSafeArea(frame.width, frame.height)
  return [
    ['the whole safe area', safe],
    ['a third of a column', { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 3) }],
    ['a low band', { ...safe, height: Math.round(safe.height / 6) }],
    ['a narrow strip', { ...safe, width: Math.round(safe.width / 4) }],
  ]
}

const layoutOf = (block, box, unit, base) => {
  if (block.kind === 'typewriter') return typewriterLayout(block, box, unit)
  if (block.kind === 'animatedList') return listLayout(block, box, unit, base)
  if (block.kind === 'counter') return counterLayout(block, box, unit)
  return logoLayout(block, box, unit)
}

/** The type size a kind's own subject is set at — the figure for a counter, the line for the rest. */
const sizeOf = (kind, layout) => (kind === 'counter' ? layout.figure : layout.size)

/** What the block puts on the frame horizontally, where that is not simply the measure. */
function drawnWidth(kind, layout) {
  if (kind === 'counter') return layout.width
  if (kind === 'logoType') return layout.width + 2 * layout.travel
  return 0
}

describe('a block inhabits the box it is given', () => {
  /**
   * The two tables have to name the same roles, and this is the only thing
   * holding them together.
   *
   * `BLOCK_APPETITE` is what measured each of these blocks into its box, run by
   * run — a typewriter's line as a `title`, a counter's label as a `caption`. A
   * component that drew the same run one step up would be past the bottom of a
   * box that was measured without it, and the box is a promise rather than a
   * clip: nothing would say so.
   */
  it('draws every run at the role the weight table budgeted for it', () => {
    expect(blockShape(RICHEST.typewriter).runs.map((run) => run.role)).toEqual([TYPEWRITER_ROLE])
    expect(blockShape(RICHEST.animatedList).runs.map((run) => run.role)).toEqual(RICHEST.animatedList.items.map(() => LIST_ROLE))
    expect(blockShape(RICHEST.counter).runs.map((run) => run.role)).toEqual([COUNTER_ROLE, COUNTER_LABEL_ROLE])
    expect(blockShape(RICHEST.logoType).runs.map((run) => run.role)).toEqual([LOGO_ROLE])
  })

  it('never draws taller than its box, in any ratio, on any shape of box', () => {
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      for (const [shape, box] of boxesOf(frame)) {
        for (const kind of KINDS) {
          for (const sample of [POOREST[kind], RICHEST[kind]]) {
            const layout = layoutOf(sample, box, undefined, base)
            const where = `${kind} in ${shape} of ${frame.name}`
            expect(sizeOf(kind, layout), where).toBeGreaterThan(0)
            expect(layout.content, where).toBeGreaterThan(0)
            // Two pixels of tolerance and no more: every quantity is rounded
            // once, and a rounding that could grow is a block whose overflow
            // nobody would ever notice on a frame.
            expect(layout.content, where).toBeLessThanOrEqual(box.height + 2)
          }
        }
      }
    }
  })

  /**
   * The leftover is spent, and it is spent as air rather than left at the
   * bottom: a block pinned to the top of a box it did not fill is the void this
   * whole pass is about, arriving through the alignment instead of the size.
   */
  it('occupies its whole box, and gives up its rhythm before it gives up the box', () => {
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      for (const [shape, box] of boxesOf(frame)) {
        for (const kind of KINDS) {
          for (const sample of [POOREST[kind], RICHEST[kind]]) {
            const layout = layoutOf(sample, box, undefined, base)
            const where = `${kind} in ${shape} of ${frame.name}`
            if (layout.content <= box.height) expect(Math.abs(layout.height - box.height), where).toBeLessThanOrEqual(2)
            else expect(layout.air, where).toBe(0)
          }
        }
      }
    }
  })

  it('never draws wider than its box either', () => {
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      for (const [shape, box] of boxesOf(frame)) {
        for (const kind of ['counter', 'logoType']) {
          for (const sample of [POOREST[kind], RICHEST[kind]]) {
            const layout = layoutOf(sample, box, undefined, base)
            expect(drawnWidth(kind, layout), `${kind} in ${shape} of ${frame.name}`).toBeLessThanOrEqual(box.width)
          }
        }
      }
    }
    // And the list's marker column is a column, not the box: an item with no
    // measure left to wrap in is a list of single characters down the frame.
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      for (const [shape, box] of boxesOf(frame)) {
        const layout = listLayout(RICHEST.animatedList, box, undefined, base)
        expect(layout.column, `${shape} of ${frame.name}`).toBeLessThan(box.width / 2)
      }
    }
  })

  /**
   * The claim that makes "it comes off the box" checkable rather than stated:
   * the same block in a box twice the size draws twice as large. It is exact
   * arithmetic rather than a tendency — a line count is `floor(width / advance)`
   * and both halves double — so the tolerance is rounding and nothing else.
   */
  it('draws twice as large in a box twice the size', () => {
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      const [, small] = boxesOf(frame)[1]
      const large = { ...small, width: small.width * 2, height: small.height * 2 }
      for (const kind of KINDS) {
        for (const sample of [POOREST[kind], RICHEST[kind]]) {
          const one = sizeOf(kind, layoutOf(sample, small, undefined, base))
          const two = sizeOf(kind, layoutOf(sample, large, undefined, base * 2))
          expect(Math.abs(two - 2 * one), `${kind} in ${frame.name}`).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  /**
   * And the headline case, end to end: a block alone in a scene is handed the
   * frame and has to occupy it.
   *
   * Measured through `composedLayout` rather than against a box this file made
   * up, because the box is half the answer — `stackIn` divides a zone by appetite
   * and publishes one unit per stack, and a claim about filling that used its own
   * idea of a box would prove nothing about a frame.
   *
   * On EITHER axis, which is `BLOCK_APPETITE`'s own word for all four of these
   * kinds and not a weakening of the claim. A wordmark of one letter beside its
   * mark fills the measure of a portrait frame and is one line tall; a hundred
   * and eighteen characters fill the height. Which of the two happens is the
   * content's business rather than the layout's, and a block forced to fill both
   * would be a block stretching type. The height is compared against the ink PLUS
   * the furniture the weight table budgeted, because that is what the box was
   * measured to hold; `BOX_FILL_FLOOR` is the same three quarters `blockExtent`
   * is held to, a floor rather than an equality because a line count is an
   * integer.
   */
  it('fills the frame when it is the only block in the scene', () => {
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      for (const kind of KINDS) {
        for (const sample of [POOREST[kind], RICHEST[kind]]) {
          const plan = composedLayout({ layers: [sample] }, frame.width, frame.height)
          const only = plan.zones[0].layers[0]
          const layout = layoutOf(sample, only.box, only.unit, base)
          const where = `${kind} alone in ${frame.name}`
          const down = (layout.content + BLOCK_APPETITE[kind].fixed * layout.unit) / only.box.height
          const across = layout.width / only.box.width
          expect(Math.max(down, across), `${where} (${down.toFixed(2)} down, ${across.toFixed(2)} across)`).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
        }
      }
    }
  })

  /**
   * The second defect, as a number: 0.13 of the short edge against 0.042 of it
   * was a figure crushing the title beside it by a factor of three, in a frame
   * nobody had asked for that emphasis in. Two steps of one scale are 1.8, and
   * the ratio is now a property of `TYPE_ROLES` rather than of whoever wrote the
   * two blocks.
   */
  it('no longer crushes the heading stacked beside it', () => {
    const scene = {
      layers: [
        { kind: 'counter', from: 0, to: 4200, prefix: null, suffix: null, label: null },
        { kind: 'heading', text: 'Requests served every second', level: 'title' },
      ],
    }
    for (const frame of FRAMES) {
      const plan = composedLayout(scene, frame.width, frame.height)
      const [counter, heading] = plan.zones[0].layers
      const figure = counterLayout(counter.block, counter.box, counter.unit).figure
      const title = typeSize('title', heading.unit)
      expect(counter.unit, frame.name).toBe(heading.unit)
      expect(figure, frame.name).toBeLessThanOrEqual(typeSize(COUNTER_ROLE, counter.unit))
      expect(figure / title, frame.name).toBeLessThan(2)
      expect(figure / title, frame.name).toBeGreaterThan(1)
    }
  })
})

describe('the two blocks that measure something the weight table cannot see', () => {
  /**
   * A counter is grouped for reading, and `counterFace` counts the digits it was
   * given: `1000000` is seven characters and `1 000 000` is nine. Measured on the
   * table's own string, the widest figure a document can produce would be set 28%
   * wider than the measure it was cleared for — which in a narrow column is a
   * figure with its thousands outside the frame.
   */
  it('measures the counter on the figure it actually paints, separators and affixes included', () => {
    expect(counterWidest(RICHEST.counter)).toBe(counterText(RICHEST.counter, 1000000))
    expect(counterWidest(RICHEST.counter)).toContain(GROUP_SEPARATOR)
    for (const frame of FRAMES) {
      for (const [shape, box] of boxesOf(frame)) {
        const layout = counterLayout(RICHEST.counter, box, undefined)
        const painted = textWidth(counterWidest(RICHEST.counter), layout.figure)
        expect(painted, `${shape} of ${frame.name}`).toBeLessThanOrEqual(box.width)
      }
    }
  })

  /**
   * A counter may count DOWN, and `from` defaults to 0 rather than being absent:
   * a block measured on `to` alone would be set for `100` and paint `900` on its
   * first frame, a third wider than the box it was cleared for.
   */
  it('measures the counter on the wider of its two ends, not on the one it stops at', () => {
    const down = { kind: 'counter', from: 900000, to: 100, prefix: null, suffix: null, label: null }
    expect(counterWidest(down)).toBe(counterText(down, 900000))
    const box = { left: 0, top: 0, width: 600, height: 400 }
    expect(textWidth(counterWidest(down), counterLayout(down, box, undefined).figure)).toBeLessThanOrEqual(box.width)
  })

  /**
   * A wordmark has three claims on its measure and `shapeCeiling` can see one of
   * them. The mark beside the word is width the table has no term for, and the
   * room the letters need to start apart in is the animation itself: solved
   * against the bare measure, a wordmark that fills its box closes onto nothing,
   * and a block that has stopped moving is what the whole `sceneMotion` section
   * exists to prevent.
   */
  it('leaves a wordmark room for its mark and for its own assembly', () => {
    for (const frame of FRAMES) {
      for (const [shape, box] of boxesOf(frame)) {
        for (const mark of ['none', 'square', 'circle', 'slash']) {
          const block = { ...RICHEST.logoType, mark }
          const layout = logoLayout(block, box, undefined)
          const where = `${mark} in ${shape} of ${frame.name}`
          expect(layout.width + 2 * layout.travel, where).toBeLessThanOrEqual(box.width)
          expect(layout.travel, where).toBeGreaterThan(0)
          expect(layout.mark.width > 0, where).toBe(mark !== 'none')
          // The slash is a slash and not a thin square: same height, less width.
          if (mark === 'slash') expect(layout.mark.width, where).toBeLessThan(layout.mark.height)
        }
      }
    }
  })

  /**
   * A slash draws outside its own width, and that overhang is measure.
   *
   * `skewX` about an element's centre pushes its top corner out one side and its
   * bottom corner out the other, and neither is in the width a flex row reserves.
   * Counted as advance alone, a 1920 export put the mark 12 px past the left safe
   * margin — an ornament outside the promise the whole safe area is, arriving
   * through the one shape in this family that is not a rectangle.
   *
   * The margin is what turns it back into advance, so the claim is in two halves:
   * the bleed is real and only on the slash, and `width` already holds it — which
   * is what makes the test above (`width + 2·travel ≤ box.width`) a claim about
   * what the frame CONTAINS rather than about what the layout reserved.
   */
  it('counts the overhang of a slash as measure, not just its advance width', () => {
    const box = { left: 116, top: 65, width: 1688, height: 950 }
    for (const mark of ['none', 'square', 'circle']) {
      expect(logoLayout({ ...RICHEST.logoType, mark }, box, undefined).mark.bleed, mark).toBe(0)
    }
    const slash = logoLayout({ ...RICHEST.logoType, mark: 'slash' }, box, undefined)
    // Half of `height · tan(θ)` per side, off the mark's own height — within the
    // pixel the two roundings can be apart. It is 12 px on this box, which is the
    // 12 px the export was outside its margin by.
    const overhang = (slash.mark.height * Math.tan((MARK_SLASH_SKEW_DEG * Math.PI) / 180)) / 2
    expect(Math.abs(slash.mark.bleed - overhang)).toBeLessThanOrEqual(1)
    expect(slash.mark.bleed).toBeGreaterThan(0)
    // And it is in the width, which is the number every other claim is made on.
    expect(slash.width).toBeGreaterThanOrEqual(slash.mark.width + 2 * slash.mark.bleed + slash.mark.gap)
    // The shape a frame contains, corner to corner, is inside the box.
    expect(slash.width + 2 * slash.travel).toBeLessThanOrEqual(box.width)
  })

  /**
   * The list is the third, and the one that would have overflowed rather than
   * merely spilled a little: six items each landing within a marker's width of a
   * line break are six lines the weight table did not budget — 8.4 units against
   * 1.75 of give. The list takes the smaller of its stack's unit and its own,
   * which is what `shapeCeiling` already does for a run that cannot break.
   */
  it('wraps its items against the measure its markers leave, and never past its box', () => {
    for (const frame of FRAMES) {
      const base = frameBase(frame.width, frame.height)
      for (const [shape, box] of boxesOf(frame)) {
        const plan = composedLayout({ layers: [RICHEST.animatedList] }, frame.width, frame.height)
        const only = plan.zones[0].layers[0]
        for (const [name, at, unit] of [
          [shape, box, undefined],
          ['its own zone', only.box, only.unit],
        ]) {
          const layout = listLayout(RICHEST.animatedList, at, unit, base)
          const where = `${name} of ${frame.name}`
          expect(layout.rows, where).toHaveLength(6)
          expect(layout.content, where).toBeLessThanOrEqual(at.height + 2)
          expect(layout.unit, where).toBeLessThanOrEqual(unit ?? Infinity)
          for (const row of layout.rows) expect(row.height, where).toBeGreaterThan(0)
        }
      }
    }
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
