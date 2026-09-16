import { describe, it, expect } from 'vitest'
import {
  AXES,
  OPENINGS,
  STACKS_SHOWN,
  WORKED_SCENES,
  anchorColumn,
  drawStacks,
  drawStartingPoint,
  filmUsage,
  historyLines,
  revisionMode,
  stackLines,
  startingPointLines,
} from './variety.js'
import { ANCHORS, ARRIVALS, BACKGROUND_KINDS, BLOCK_KINDS } from './timeline.js'
import { MOTION_KIND_SPECS } from './kinds.js'

/** A seeded generator, so a statistical claim is the same claim on every run. */
function lcg(seed) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const film = (...scenes) => ({
  template: 'composed',
  scenes: scenes.map(([ground, ...layers]) => ({
    durationMs: 3000,
    background: { kind: ground },
    layers: layers.map(([kind, anchor]) => ({ kind, anchor })),
  })),
})

describe('the vocabulary names only what exists', () => {
  /**
   * An example naming a block the schema does not have teaches the one refusal
   * that costs a whole paid call — and a renamed block would do it silently.
   */
  it('every worked scene is made of real blocks, grounds and zones', () => {
    for (const s of WORKED_SCENES) {
      expect(BACKGROUND_KINDS, s.why).toContain(s.ground)
      for (const [kind, anchor] of s.layers) {
        expect(BLOCK_KINDS, s.why).toContain(kind)
        expect(ANCHORS, s.why).toContain(anchor)
      }
    }
    for (const entry of [...OPENINGS, ...AXES]) {
      for (const kind of entry.needs ?? []) expect(BLOCK_KINDS, entry.id).toContain(kind)
    }
  })

  /**
   * A doorway that narrows the catalogue must still leave a RANGE of examples,
   * or the draw is a fixed list again one level down — which is what `mark` and
   * `background` were before they were given their own.
   */
  it('leaves every kind of Motion enough examples to draw from', () => {
    for (const [kind, spec] of Object.entries(MOTION_KIND_SPECS)) {
      const stacks = drawStacks({ kinds: spec.blocks, grounds: spec.grounds, random: lcg(1), count: 99 })
      expect(stacks.length, kind).toBeGreaterThanOrEqual(STACKS_SHOWN)
    }
  })

  it('leaves every kind that sets type an opening and an axis', () => {
    for (const [kind, spec] of Object.entries(MOTION_KIND_SPECS)) {
      const point = drawStartingPoint({ kinds: spec.blocks, random: lcg(2), maxScenes: spec.scenes.max, motionKind: kind })
      if (kind === 'background') {
        // No block that sets type, so "where the words go" means nothing.
        expect(point.opening).toBeNull()
        expect(point.axis).toBeNull()
      } else {
        expect(point.opening, kind).not.toBeNull()
        expect(point.axis, kind).not.toBeNull()
      }
    }
  })
})

describe('the draw', () => {
  it('only shows examples this request can compose', () => {
    const kinds = ['heading', 'button', 'counter', 'kicker']
    const grounds = ['hairlines', 'gridPulse']
    for (let seed = 1; seed < 20; seed++) {
      for (const s of drawStacks({ kinds, grounds, random: lcg(seed) })) {
        expect(grounds).toContain(s.ground)
        for (const [kind] of s.layers) expect(kinds).toContain(kind)
      }
    }
  })

  it('never features the blocks every film already carries', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { featured } = drawStartingPoint({ kinds: BLOCK_KINDS, random: lcg(seed) })
      expect(featured).not.toContain('heading')
      expect(featured).not.toContain('kicker')
      expect(featured).not.toContain('separator')
    }
  })

  /**
   * The measured habit was the left column. With a history made of nothing else,
   * the left axis must come up markedly less often than the right one.
   */
  it('draws a habitual placement less often', () => {
    const usage = filmUsage(Array.from({ length: 6 }, () => film(['gradient', ['heading', 'center-left'], ['kicker', 'top-left']])))
    const random = lcg(7)
    const counts = { left: 0, right: 0 }
    for (let i = 0; i < 2000; i++) {
      const { axis } = drawStartingPoint({ kinds: BLOCK_KINDS, usage, random })
      if (axis.id in counts) counts[axis.id] += 1
    }
    expect(counts.left * 3).toBeLessThan(counts.right)
  })

  it('does not promise a second scene to a kind that has one', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { opening } = drawStartingPoint({ kinds: BLOCK_KINDS, random: lcg(seed), maxScenes: 1 })
      expect(opening.id).not.toBe('subject')
    }
  })

  it('prints examples with no digit in them', () => {
    // The catalogue's rule — every bound is read from the schema — holds here
    // too: an example is where a model would pick up a number to copy.
    const lines = stackLines(WORKED_SCENES)
    for (const line of lines) expect(line).not.toMatch(/\d/)
  })
})

describe('what the recent films did', () => {
  it('counts blocks and grounds per film, placement per layer', () => {
    const usage = filmUsage([
      film(['gradient', ['heading', 'center-left']], ['gradient', ['heading', 'center-left']]),
      film(['solid', ['counter', 'full']]),
      { template: 'slideshow', scenes: [{ imageId: 'x' }] },
      null,
    ])
    expect(usage.films).toBe(2)
    expect(usage.blocks).toEqual({ heading: 1, counter: 1 })
    expect(usage.grounds).toEqual({ gradient: 1, solid: 1 })
    expect(usage.columns).toEqual({ left: 2, center: 0, right: 0, full: 1 })
    expect(usage.openings).toEqual({ 'gradient: heading@center-left': 1, 'solid: counter@full': 1 })
  })

  it('reads an absent anchor as the centre, which is the schema default', () => {
    expect(anchorColumn(undefined)).toBe('center')
    expect(anchorColumn('bottom-right')).toBe('right')
    expect(anchorColumn('full')).toBe('full')
  })

  it('prints nothing for a quiet history, and names the habit for a loud one', () => {
    expect(historyLines(filmUsage([]))).toEqual([])
    const loud = historyLines(
      filmUsage(Array.from({ length: 4 }, () => film(['gradient', ['kicker', 'center-left'], ['heading', 'center-left']]))),
    )
    const text = loud.join('\n')
    expect(text).toContain('gradient: kicker@center-left + heading@center-left (4 times)')
    expect(text).toContain('"heading" (4 of 4)')
    expect(text).toContain('100% of their blocks sat in the left column')
    expect(text).toContain('"gradient" (4 of 4)')
  })
})

describe('fresh, again, or a revision', () => {
  it('needs a current film to be anything but fresh', () => {
    expect(revisionMode(null, true)).toBe('fresh')
    expect(revisionMode({ brief: 'x' }, true)).toBe('fresh')
    expect(revisionMode({ brief: 'x', timeline: {} }, true)).toBe('revise')
    // `=== true`: a hand-made body sending "true" asks for another film, which
    // is the reading that costs nothing if it is wrong.
    expect(revisionMode({ brief: 'x', timeline: {} }, 'true')).toBe('again')
    expect(revisionMode({ brief: 'x', timeline: {} }, false)).toBe('again')
  })
})

describe('how the film moves, and how a scene is coloured', () => {
  /**
   * Two arrivals, distinct, out of the schema's own list: one is the old film
   * with another verb, and more than two is a demonstration reel.
   */
  it('draws two different arrivals for a film that sets type', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { arrivals } = drawStartingPoint({ kinds: BLOCK_KINDS, random: lcg(seed) })
      expect(arrivals).toHaveLength(2)
      expect(new Set(arrivals).size).toBe(2)
      for (const a of arrivals) expect(ARRIVALS).toContain(a)
    }
  })

  it('draws rise, which silence already gives, less often than the others', () => {
    const random = lcg(11)
    let rise = 0
    let fade = 0
    for (let i = 0; i < 3000; i++) {
      const { arrivals } = drawStartingPoint({ kinds: BLOCK_KINDS, random })
      if (arrivals.includes('rise')) rise += 1
      if (arrivals.includes('fade')) fade += 1
    }
    expect(rise).toBeLessThan(fade)
  })

  /**
   * A background sits under the page's own type, set for the project's ground;
   * an inverted one is the one colouring whose consequence this film cannot see.
   */
  it('gives a background neither an arrival nor a tone', () => {
    const spec = MOTION_KIND_SPECS.background
    for (let seed = 1; seed < 40; seed++) {
      const point = drawStartingPoint({ kinds: spec.blocks, random: lcg(seed), maxScenes: 1, motionKind: 'background' })
      expect(point.arrivals).toEqual([])
      expect(point.tone).toBeNull()
    }
  })

  it('sometimes, and only sometimes, suggests a tone', () => {
    const random = lcg(5)
    const tones = { inverse: 0, accent: 0, none: 0 }
    for (let i = 0; i < 1000; i++) tones[drawStartingPoint({ kinds: BLOCK_KINDS, random, maxScenes: 6 }).tone ?? 'none'] += 1
    expect(tones.none).toBeGreaterThan(200)
    expect(tones.inverse).toBeGreaterThan(100)
    expect(tones.accent).toBeGreaterThan(100)
  })

  it('prints the arrivals and the tone as lines the brief still outranks', () => {
    const lines = startingPointLines({ opening: null, axis: null, featured: [], arrivals: ['fade', 'wipe'], tone: 'inverse', several: true })
    const text = lines.join('\n')
    expect(text).toContain('arrive with "fade", and give the one that matters most "wipe"')
    expect(text).toContain('Give one scene "tone": "inverse"')
    expect(lines[lines.length - 1]).toMatch(/The BRIEF outranks/)
  })
})