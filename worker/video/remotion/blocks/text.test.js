// The arithmetic of the text family, as claims.
//
// A `.jsx` cannot be asked a question — there is no renderer in this suite and
// there will not be one, since Remotion's licence is the reason the worker is a
// separate image at all. So everything a text block DECIDES is in `text.js` and
// everything below is a question about it: how much of its box it draws, where a
// word sits in a cascade, how much of a rule has been drawn, which rectangle the
// marker and the ink on it share. A number that only exists inside a component is
// a number nobody can check, which is the rule `composition.js` is written under.
//
// The import of `server/video/timeline.js` is TEST-ONLY, exactly as it is in
// `blocks.test.js` and `validate.test.js`: the Docker build copies `worker/video/`
// and nothing else, so a runtime import of anything under `server/` produces a
// container that boots and then fails every render on a missing module.
import { describe, it, expect } from 'vitest'
import {
  BLOCK_APPETITE,
  BOX_FILL_FLOOR,
  CONSTANT_CEILING,
  TYPE_ROLES,
  blockExtent,
  blockShape,
  composedLayout,
  dimensionsFor,
  frameBase,
  hairline,
  textWidth,
  wordCeiling,
} from '../composition.js'
import { ANCHORS, ASPECT_RATIOS, BLOCK_LIMITS } from '../../../../server/video/timeline.js'
import {
  BOX_PAD_EM,
  BOX_TRAVEL_EM,
  EMPHASIS_RATIO,
  HIGHLIGHT_ROOM_SHARE,
  MARK_SOAK_FLOOR,
  MASK_TRAVEL_PERCENT,
  QUOTE_CUES,
  QUOTE_MARK_ASPECT,
  RULE_HEAVY_WEIGHT,
  RUN_RISE_EM,
  UNDERLINE_DROP_EM,
  UNDERLINE_TRAVEL_EM,
  boxPadEm,
  highlightRoom,
  markerClip,
  markerDraw,
  markerRadius,
  markerSoak,
  markerWipe,
  phase,
  quoteCue,
  quoteMark,
  ruleExtent,
  ruleWeights,
  runAt,
  runRise,
  splitMark,
  textLayout,
  underlineDropEm,
  wordReveal,
} from './text.js'

/** The short edge of all three ratios. */
const BASE = 1080

const samples = (count) => Array.from({ length: count + 1 }, (_, i) => i / count)

/** The bold licence the 3:1 floor rests on, and the plain-text bar above it. */
const BOLD_LARGE_PX = 18.66
const LARGE_PX = 24

/**
 * The family, at both ends of what the schema allows.
 *
 * Both ends because they fail differently: the poorest block is where a size
 * solved against a box runs away — one word in a full frame — and the longest
 * legal one is where it wraps, which is the case a size read off the frame used
 * to get wrong in the other direction.
 */
const CORPUS = [
  ['heading, one word', { kind: 'heading', text: 'Blocs', level: 'display' }],
  ['heading, the longest legal line', { kind: 'heading', text: 'É'.repeat(BLOCK_LIMITS.heading), level: 'title' }],
  ['heading, a subtitle', { kind: 'heading', text: 'Une ligne de sous-titre', level: 'subtitle' }],
  ['kicker, one word', { kind: 'kicker', text: 'Motion' }],
  ['kicker, the longest legal line', { kind: 'kicker', text: 'É'.repeat(BLOCK_LIMITS.kicker) }],
  ['quote, no attribution', { kind: 'quote', text: 'Une phrase que quelqu’un a dite.', attribution: null }],
  [
    'quote, the longest legal pair',
    {
      kind: 'quote',
      text: 'É'.repeat(BLOCK_LIMITS.quote),
      attribution: 'É'.repeat(BLOCK_LIMITS.attribution),
    },
  ],
  ['textHighlight, marked', { kind: 'textHighlight', text: 'une ligne marquée ici', mark: 'marquée', treatment: 'marker' }],
  [
    'textHighlight, the longest legal line',
    { kind: 'textHighlight', text: 'É'.repeat(BLOCK_LIMITS.highlight), mark: null, treatment: 'underline' },
  ],
]

/**
 * Twelve box shapes, and none of them is a frame.
 *
 * A block is handed a share of a zone, so the shapes that matter are a full safe
 * area, a half, a third of a row, a band at the foot of a stack — wide and short,
 * narrow and tall, and one that is barely there. The last is the one the old
 * fixed fractions never met: a block sized off the frame's short edge inside a
 * 200 px box drew four times its own room and nothing said so.
 */
const BOXES = [
  { width: 1690, height: 950 },
  { width: 1690, height: 300 },
  { width: 830, height: 950 },
  { width: 830, height: 460 },
  { width: 540, height: 950 },
  { width: 280, height: 410 },
  { width: 907, height: 1305 },
  { width: 907, height: 420 },
  { width: 440, height: 1305 },
  { width: 950, height: 950 },
  { width: 300, height: 200 },
  { width: 1690, height: 120 },
]

/** How far the component's own arithmetic may sit from the layout's: half a pixel of type per line. */
function rounding(layout) {
  return layout.runs.reduce((sum, run) => sum + run.lines * run.leading * 0.5, 0) + 1
}

describe('a text block inhabits the box it is given', () => {
  /**
   * The claim the whole pass is about, and it is checked from BOTH ends.
   *
   * `blockExtent` answers "what should this block draw in this box" from the
   * weight table; `textLayout` answers "what am I about to draw" from the sizes
   * the component actually sets. Six real exports were one defect wearing three
   * costumes — `base * 0.18` whatever the box — and a single arithmetic would not
   * have caught any of them, because the component was never asked. Two
   * computations from opposite directions is what catches a weight table drifting
   * from a type scale.
   */
  it.each(CORPUS)('draws the height the layout reserved for %s', (_label, block) => {
    for (const box of BOXES) {
      for (const unit of [undefined, 12, 40, 96]) {
        const mine = textLayout(block, box, unit)
        const theirs = blockExtent(block, box, BASE, unit)
        // `blockExtent` clamps to the box; a unit handed in from outside a stack
        // can be larger than the box can carry, and the clamp is its answer.
        const drawn = Math.min(box.height, mine.height)
        expect(Math.abs(drawn - theirs.height), `${box.width}x${box.height} @${unit}`).toBeLessThanOrEqual(rounding(mine))
      }
    }
  })

  /**
   * A block alone in a box fills it — which is the sentence the user kept writing
   * as "rudimentaire".
   *
   * On the axis its own row claims, because `fills: 'either'` is honest rather
   * than tidy for a run of type: two letters cannot fill a landscape measure
   * without being taller than the box, and a line that has filled its measure has
   * left the height on a tread of the staircase. `BOX_FILL_FLOOR` is the number
   * `composition.test.js` measured across all twenty-seven kinds; this is the
   * same bar asked of the four this file owns, through the component's own
   * arithmetic rather than through the table's.
   */
  it.each(CORPUS)('fills its box on the axis it claims, for %s', (_label, block) => {
    expect(BLOCK_APPETITE[block.kind].fills).toBe('either')
    for (const box of BOXES) {
      const mine = textLayout(block, box, undefined)
      const width = blockExtent(block, box, BASE, undefined).width
      const fill = Math.max(mine.height / box.height, width / box.width)
      expect(fill, `${block.kind} in ${box.width}x${box.height}`).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
    }
  })

  /**
   * Twice the box, twice the drawing.
   *
   * The property a fixed fraction of the frame cannot have, stated as arithmetic:
   * the wrap is scale-invariant — the size and the measure double together, so
   * the line count is the same — and every term of the height is linear in the
   * unit. What is left is CSS's own rounding to a whole pixel, which is why this
   * is a per-cent and not an equality.
   *
   * `wordCeiling` keeps that property, deliberately: it takes no absolute
   * allowance for `typeSize`'s rounding, precisely so that doubling a measure
   * doubles a bound. Its FLOOR is the one thing here that is a number of pixels,
   * and a threshold in pixels cannot be scale-invariant — a word too long to hold
   * at a legible size in one box is holdable in a box twice as wide. So the
   * corpus's single-word entries cross it, and what is checked there is the
   * crossing rather than the ratio. It is a real discontinuity and naming it is
   * the whole of the decision: under the floor the block draws what its box
   * allowed and the word breaks; over it, the word is whole and the block is as
   * small as the word requires.
   */
  it.each(CORPUS)('doubles what it draws when its box doubles, for %s', (_label, block) => {
    for (const box of BOXES) {
      const wide = { width: box.width * 2, height: box.height * 2 }
      const once = textLayout(block, box, undefined)
      const twice = textLayout(block, wide, undefined)
      const runs = blockShape(block).runs
      // A run is bound in the wider box and not in the narrower one exactly when
      // the floor sits between the two, since doubling a measure doubles the size
      // at which the word would fit.
      const crosses = runs.some(
        (run) => Number.isFinite(wordCeiling([run], box.width)) !== Number.isFinite(wordCeiling([run], wide.width)),
      )
      if (crosses) {
        // The doubled box is the one that keeps the word whole, and the type is
        // what pays: it never reads MORE than twice the unit, and it reads at most
        // what the word allows. On the corpus's longest single words that is a
        // twentieth of the ratio; on the ones the narrow box was already too small
        // for, it is exactly two, which is the crossing costing nothing.
        expect(twice.unit, `${box.width}x${box.height}`).toBeLessThanOrEqual(once.unit * 2 + 1e-9)
        expect(wordCeiling(runs, wide.width)).toBeLessThan(Infinity)
        expect(twice.unit, `${box.width}x${box.height}`).toBeLessThanOrEqual(wordCeiling(runs, wide.width) + 1e-9)
        continue
      }
      expect(twice.height / once.height, `${box.width}x${box.height}`).toBeCloseTo(2, 1)
      expect(twice.unit / once.unit).toBeCloseTo(2, 6)
    }
  })

  /**
   * Two blocks in one zone read ONE unit, and their sizes are two steps of it.
   *
   * This is the second defect the pass was called on: `headingSize`, the
   * counter's figure, the typewriter's line and the wordmark were four fractions
   * of the frame decided by four authors, so a `counter` and a `heading` stacked
   * in one zone came out at 0.13 and 0.042 of the short edge. Inside this family
   * it was the same failure, quieter — a quote's attribution and a kicker beside
   * it had no relationship at all. Now the ratio between any two runs is the
   * ratio between two entries of `TYPE_ROLES`, whatever box they landed in.
   */
  it('sets a kicker and the heading under it at two steps of one scale', () => {
    const scene = {
      layers: [
        { kind: 'kicker', text: 'Chapitre', anchor: 'center' },
        { kind: 'heading', text: 'Une ligne qui porte le film', level: 'display', anchor: 'center' },
      ],
    }
    for (const aspectRatio of ASPECT_RATIOS) {
      const { width, height } = dimensionsFor(aspectRatio)
      const [zone] = composedLayout(scene, width, height).zones
      const [kicker, heading] = zone.layers
      expect(kicker.unit, aspectRatio).toBe(heading.unit)
      const small = runAt(textLayout(kicker.block, kicker.box, kicker.unit), 0)
      const large = runAt(textLayout(heading.block, heading.box, heading.unit), 0)
      expect(small.size / large.size, aspectRatio).toBeCloseTo(TYPE_ROLES.caption.step / TYPE_ROLES.display.step, 2)
    }
  })
})

describe('what a box-solved size does to the legibility floors', () => {
  /**
   * The guarantee that moved when the sizes stopped being constants.
   *
   * `KICKER_SIZE` was 2.6% of the short edge with an assertion next to it, and
   * that assertion is what licensed `palette.accent`'s 3:1 floor: the audit calls
   * bold type past 18.66 px large. A size solved against a box has no such
   * constant, so the licence has to be re-earned from the arithmetic of the grid —
   * and it is, with room, in every arrangement a document is likely to produce.
   * The residual is named in each block's own header rather than hidden here: a
   * stack of six blocks in one corner cell of a portrait frame is a box small
   * enough to bring a caption near that bar, and there the type is what yields.
   */
  const scenes = [
    ['one block, alone', [{ kind: 'heading', text: 'Conçu par blocs' }]],
    [
      'the ordinary scene',
      [
        { kind: 'kicker', text: 'Chapitre deux', anchor: 'center' },
        { kind: 'heading', text: 'Une ligne qui porte le film', anchor: 'center' },
        { kind: 'textHighlight', text: 'et la ligne qui la marque', mark: 'marque', anchor: 'center' },
      ],
    ],
    [
      'every zone the schema can name',
      ANCHORS.slice(0, 5).map((anchor, i) => ({ ...CORPUS[i * 2][1], anchor })),
    ],
  ]

  /**
   * The runs that carry the 3:1 floor are the FIRST run of each of the four, and
   * that is a property of the family rather than a coincidence: a heading's line,
   * a kicker's surtitle, a quotation and a marked line are painted from
   * `palette.display`, `palette.accent` and `palette.onFill`, all resolved at the
   * display floor. Every second run — a quote's attribution — is `palette.body`
   * at 4.5:1, which no size licences and none has to.
   */
  it.each(scenes)('keeps every run of %s past the bold licence', (_label, layers) => {
    for (const aspectRatio of ASPECT_RATIOS) {
      const { width, height } = dimensionsFor(aspectRatio)
      for (const zone of composedLayout({ layers }, width, height).zones) {
        for (const layer of zone.layers) {
          const first = runAt(textLayout(layer.block, layer.box, layer.unit), 0)
          expect(first?.size, `${aspectRatio} ${layer.block.kind}`).toBeGreaterThan(BOLD_LARGE_PX)
        }
      }
    }
  })

  /**
   * And at the schema's absolute ceiling, what yields is the TYPE.
   *
   * Eight blocks stacked into one cell is the poorest scene the schema will
   * accept — the compose prompt's own advice is two or three — and there the unit
   * a stack can afford is around 26 px on a square frame. The box still holds,
   * because the box is a promise about somebody else's interface and the type is
   * a preference; that is `verticalCaptionSize`'s trade, made by the layout
   * instead of by a ramp. What can drop under the bold licence there is the
   * `caption` step and only it, which is the smallest step on the scale by
   * definition and, in this family, exactly the kicker's surtitle. It is stated
   * here rather than repaired in a component: a block reads a run and does not
   * pick one, and a floor under the unit belongs to `solveTypeUnit` — where every
   * one of the twenty-seven kinds would get it at once.
   */
  it('yields the type and never the box when a stack reaches the schema’s ceiling', () => {
    const layers = Array.from({ length: BLOCK_LIMITS.layersPerScene }, (_, i) => ({ ...CORPUS[i % CORPUS.length][1] }))
    for (const aspectRatio of ASPECT_RATIOS) {
      const { width, height } = dimensionsFor(aspectRatio)
      for (const zone of composedLayout({ layers }, width, height).zones) {
        for (const layer of zone.layers) {
          const mine = textLayout(layer.block, layer.box, layer.unit)
          const where = `${aspectRatio} ${layer.block.kind}`
          expect(mine.height, where).toBeLessThanOrEqual(layer.box.height + rounding(mine))
          for (const run of mine.runs) {
            expect(run.size, where).toBeGreaterThan(0)
            if (run.size < BOLD_LARGE_PX) expect(run.role, `${where} under the licence`).toBe('caption')
          }
        }
      }
    }
  })

  /** And a lone block is not merely legible: it is a poster. */
  it('sets a lone heading far past the size a frame-sized fraction gave it', () => {
    for (const aspectRatio of ASPECT_RATIOS) {
      const { width, height } = dimensionsFor(aspectRatio)
      const [zone] = composedLayout({ layers: [{ kind: 'heading', text: 'Conçu par blocs' }] }, width, height).zones
      const [layer] = zone.layers
      const run = runAt(textLayout(layer.block, layer.box, layer.unit), 0)
      // The old constant: `HEADING_SIZES.display` was 0.096 of the short edge.
      expect(run.size, aspectRatio).toBeGreaterThan(frameBase(width, height) * 0.096)
      expect(run.size).toBeGreaterThan(LARGE_PX)
    }
  })
})

describe('the furniture of a text block, and the band it stands in', () => {
  it('is a hairline at 1080, three of them for the heavy segment, and never nothing', () => {
    const box = { width: 1690, height: 950 }
    expect(hairline(BASE, box)).toBe(3)
    expect(ruleWeights(BASE, box, 44)).toEqual({ hair: 3, heavy: 3 * RULE_HEAVY_WEIGHT })
    for (const base of [0, 1, 120, 540, 1080, 1920]) {
      const { hair, heavy } = ruleWeights(base, box, 44)
      expect(hair, String(base)).toBeGreaterThanOrEqual(1)
      expect(heavy).toBeGreaterThanOrEqual(hair)
    }
  })

  /**
   * An exception with no ceiling is the rule going back out of the window.
   *
   * A hairline is one of exactly three quantities still read off the frame,
   * because it has to be the same object from one scene to the next. The band it
   * is drawn in is the bound: nine pixels of rule inside six pixels of furniture
   * is a block drawing past the box the layout measured.
   */
  it('never draws a rule thicker than the band that holds it', () => {
    for (const band of [0, 1, 2, 4, 8, 9, 40]) {
      const { hair, heavy } = ruleWeights(BASE, { width: 1690, height: 950 }, band)
      expect(heavy, String(band)).toBeLessThanOrEqual(Math.max(hair, Math.floor(band)))
    }
  })

  /**
   * The room a marked line holds open covers the deepest excursion of both
   * ornaments.
   *
   * `BLOCK_APPETITE` prices `textHighlight` at half a unit of furniture, and this
   * is what that half is FOR: the drawn box stands off the word by
   * `BOX_PAD_EM + BOX_TRAVEL_EM` at the start of the scene and closes onto it,
   * and the underline drops by its own pair. Both are ems of the run, the run is
   * the body step — one unit — so the two are comparable numbers. An ornament
   * outside the band is an ornament in the stack gap or over the block above it.
   */
  it('holds open enough room for the underline and the drawn box', () => {
    const unit = 40
    const band = BLOCK_APPETITE.textHighlight.fixed * unit
    const room = highlightRoom(band)
    expect(HIGHLIGHT_ROOM_SHARE).toBe(0.5)
    expect(room).toBeGreaterThanOrEqual((BOX_PAD_EM + BOX_TRAVEL_EM) * unit)
    expect(room).toBeGreaterThanOrEqual((UNDERLINE_DROP_EM + UNDERLINE_TRAVEL_EM) * unit)
    expect(boxPadEm(0) * unit).toBeLessThanOrEqual(room)
    expect(underlineDropEm(0) * unit).toBeLessThanOrEqual(room)
  })

  /** The quote's mark is a share of its band, so it grows with the sentence and never with the frame. */
  it('sizes the quotation mark on the band and not on the frame', () => {
    const small = quoteMark(30)
    const large = quoteMark(120)
    expect(large.height / small.height).toBeCloseTo(4, 10)
    expect(large.width / large.height).toBeCloseTo(QUOTE_MARK_ASPECT, 10)
    expect(small.height).toBeLessThan(30)
    expect(small.gap).toBeGreaterThan(0)
    expect(quoteMark(0)).toEqual({ height: 0, width: 0, gap: 0 })
  })

  /** A run rises by an em of itself, so the gesture is the same in a corner cell and in a full frame. */
  it('scales the rise of a run to the run', () => {
    expect(runRise(100, 0)).toBeCloseTo(100 * RUN_RISE_EM, 10)
    expect(runRise(100, 1)).toBe(0)
    expect(runRise(25, 0) * 4).toBeCloseTo(runRise(100, 0), 10)
    expect(runRise(undefined, 0)).toBe(0)
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
    for (const rest of [0, 0.26, 0.33, 0.34, 0.55]) {
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

describe('reading a run the weight table did not fill', () => {
  /**
   * An absent run costs the block nothing, which is how a quote with no
   * attribution gets its whole box instead of a blank line in the middle of it.
   */
  it('leaves out a run with no text, and answers null for it', () => {
    const box = { width: 900, height: 500 }
    const bare = textLayout({ kind: 'quote', text: 'Une phrase.', attribution: null }, box, 40)
    expect(bare.runs).toHaveLength(1)
    expect(runAt(bare, 1)).toBe(null)
    const paired = textLayout({ kind: 'quote', text: 'Une phrase.', attribution: 'Quelqu’un' }, box, 40)
    expect(paired.runs).toHaveLength(2)
    expect(paired.height).toBeGreaterThan(bare.height)
  })

  /** A kind this build does not know is laid out, not dropped (Q1). */
  it('answers for a kind with no row in the weight table', () => {
    const layout = textLayout({ kind: 'video', text: 'x' }, { width: 900, height: 500 }, 40)
    expect(Number.isFinite(layout.height)).toBe(true)
    expect(layout.runs).toEqual([])
  })
})

describe('the marker’s corner, which is a constant metric with a ceiling', () => {
  /**
   * The defect this function was added for, stated as its two halves.
   *
   * A radius comes off the THEME, so the same film draws the same corner in every
   * scene — that is why it is one of the three quantities `CONSTANT_METRICS` still
   * reads off the frame. And it is bounded by whatever it rounds, because an
   * exception with no ceiling is the rule going back out of the window. The
   * component used to write `theme.radiusPx` straight into a style, and
   * `ThemeSchema` accepts a whole number up to 9999: an ordinary "generous
   * corners" of 40 px turned a marked word into a lozenge, and a larger one into
   * an ellipse with a word inside it.
   */
  const run = (size) => ({ size, leading: TYPE_ROLES.body.leading })

  it('gives a modest radius back untouched, on a run with room for it', () => {
    expect(markerRadius(12, run(64), 'marqué')).toBe(12)
  })

  it('never exceeds a quarter of the run it is drawn around, at either dimension', () => {
    // Tall enough that the HEIGHT is not what binds: a one-character mark is
    // narrower than its own line box, and the width is the smaller room.
    for (const [size, mark] of [[64, 'marqué'], [64, 'x'], [18, 'un texte marqué'], [140, 'M']]) {
      const room = Math.min(size * TYPE_ROLES.body.leading, textWidth(mark, size))
      expect(markerRadius(9999, run(size), mark), `${size}px / ${mark}`).toBeLessThanOrEqual(room / 4)
      expect(markerRadius(9999, run(size), mark)).toBe(Math.floor(room * CONSTANT_CEILING))
    }
  })

  /**
   * A stated square corner stays square. Rounding a zero up to a pixel would be
   * the layout overruling the direction, which is the trade `constantMetric` next
   * door refuses in the same words.
   */
  it('leaves a stated zero at zero, and never answers a NaN', () => {
    expect(markerRadius(0, run(64), 'marqué')).toBe(0)
    expect(markerRadius(-8, run(64), 'marqué')).toBe(0)
    expect(markerRadius(undefined, run(64), 'marqué')).toBe(0)
    expect(markerRadius(12, null, 'marqué')).toBe(0)
    expect(markerRadius(12, run(64), '')).toBe(0)
  })
})
