import { describe, it, expect } from 'vitest'
import {
  THREE_D_BLOCKS,
  FLAT_BLOCKS,
  MAX_THREE_D_LAYERS,
  isThreeDBlock,
  threeDBlocksIn,
  threeDLoadOf,
  threeDLoadRefusal,
  threeDRefusal,
} from './three-d.js'
import { BLOCK_KINDS, VideoTimelineSchema } from './timeline.js'

const ID_A = 'a'.repeat(64)

/** A composed document, exactly as the schema hands it back. */
const composed = (...layerStacks) =>
  VideoTimelineSchema.parse({
    template: 'composed',
    scenes: layerStacks.map((layers) => ({ durationMs: 3000, layers })),
  })

describe('the list itself', () => {
  it('names only blocks that exist', () => {
    // A rename in the catalogue would otherwise leave a permission guarding a
    // block nobody can write, which fails open on the block that replaced it.
    for (const kind of THREE_D_BLOCKS) expect(BLOCK_KINDS, kind).toContain(kind)
  })

  it('splits the catalogue in two, with nothing in both and nothing in neither', () => {
    expect([...THREE_D_BLOCKS, ...FLAT_BLOCKS].sort()).toEqual([...BLOCK_KINDS].sort())
    expect(FLAT_BLOCKS.filter(isThreeDBlock)).toEqual([])
  })
})

describe('threeDBlocksIn', () => {
  it('finds a solid wherever it sits in the stack', () => {
    const doc = composed([{ kind: 'heading', text: 'The kettle' }, { kind: 'solidScene', solid: 'torus' }])
    expect(threeDBlocksIn(doc)).toEqual(['solidScene'])
  })

  it('answers nothing for a flat film', () => {
    expect(threeDBlocksIn(composed([{ kind: 'heading', text: 'The kettle' }]))).toEqual([])
  })

  /**
   * The document shape that has to keep working: a slideshow, which is what a
   * document with no `template` is, and what the queue's journal is full of. It
   * has scenes and no `layers` at all, so a walker that assumed a composed film
   * would throw on the oldest document on disk.
   */
  it('answers nothing for a document that has no layers at all', () => {
    const slideshow = VideoTimelineSchema.parse({ scenes: [{ imageId: ID_A, durationMs: 3000 }] })
    expect(threeDBlocksIn(slideshow)).toEqual([])
    expect(threeDBlocksIn(null)).toEqual([])
    expect(threeDBlocksIn(undefined)).toEqual([])
    expect(threeDBlocksIn({})).toEqual([])
  })

  it('reports one name however many scenes carry it', () => {
    const doc = composed([{ kind: 'solidScene', solid: 'cube' }], [{ kind: 'solidScene', solid: 'sphere' }])
    expect(threeDBlocksIn(doc)).toEqual(['solidScene'])
  })
})

describe('threeDRefusal', () => {
  /**
   * The rule the whole module is written around: a refusal names what is still
   * possible. It is `compose.js`'s rule about a picture-bearing film over an
   * empty selection, applied to the case where a bare "no" is most tempting —
   * the person reading it did not choose the block, a model did.
   */
  it('says what was refused, who can change it, and what is still possible', () => {
    const said = threeDRefusal(['solidScene'], 'Nothing was queued.')
    expect(said).toContain('solidScene')
    expect(said).toMatch(/administrator/)
    expect(said).toContain(`the other ${FLAT_BLOCKS.length} blocks`)
    expect(said).toContain('Nothing was queued.')
  })

  it('still names what is possible when no block is quoted', () => {
    // The /compose case: the request ASKED for 3D, so there is no document and
    // no block to name — and the sentence that matters is the second half.
    const said = threeDRefusal([], 'Nothing was proposed.')
    expect(said).toContain(`the other ${FLAT_BLOCKS.length} blocks`)
    expect(said).not.toContain('undefined')
  })
})

describe('threeDLoadOf — the cost is per FRAME, so it is the worst SCENE', () => {
  it('answers zero for a film that carries none, and for the flat templates', () => {
    expect(threeDLoadOf(composed([{ kind: 'heading', text: 'Plat' }]))).toBe(0)
    // The five original templates have no `layers` at all. A special case for
    // them would be a special case that rots; walking an absent array does not.
    expect(threeDLoadOf({ scenes: [{ imageId: ID_A, durationMs: 3000 }] })).toBe(0)
    expect(threeDLoadOf(null)).toBe(0)
    expect(threeDLoadOf({})).toBe(0)
  })

  it('counts a scene, not a film — eight scenes of one cost what one scene of one costs', () => {
    // The whole argument for a per-scene bound. A per-film cap would refuse the
    // cheap film (many scenes, one block each) and wave through the expensive
    // one (a single scene stacking them).
    const spread = composed(...Array.from({ length: 8 }, () => [{ kind: 'solidScene' }]))
    const stacked = composed(Array.from({ length: 8 }, () => ({ kind: 'solidScene' })))
    expect(threeDLoadOf(spread)).toBe(1)
    expect(threeDLoadOf(stacked)).toBe(8)
  })

  it('counts repeats, unlike threeDBlocksIn which deduplicates by kind', () => {
    // The two functions answer different questions and it is easy to reach for
    // the wrong one: the permission asks WHICH blocks, the deadline asks HOW
    // MANY. Three solids in a scene is one kind and three renders.
    const three = composed([{ kind: 'solidScene' }, { kind: 'solidScene' }, { kind: 'solidScene' }])
    expect(threeDBlocksIn(three)).toEqual(['solidScene'])
    expect(threeDLoadOf(three)).toBe(3)
  })

  it('takes the worst scene and ignores the flat layers beside it', () => {
    const mixed = composed(
      [{ kind: 'heading', text: 'Un' }, { kind: 'globe' }],
      [{ kind: 'globe' }, { kind: 'waveMesh' }, { kind: 'kicker', text: 'Deux' }],
      [{ kind: 'heading', text: 'Trois' }],
    )
    expect(threeDLoadOf(mixed)).toBe(2)
  })

  it('recognises every block the list names, one at a time', () => {
    // Guards the same direction the permission test guards: a 3D block added to
    // the catalogue and forgotten here is a block whose cost nobody counts.
    //
    // Each kind is parsed by the real schema rather than hand-built, so a
    // required field added to one of them fails here loudly instead of leaving
    // this loop quietly measuring a document the validator would refuse. That
    // is why the four kinds with required fields carry them: they are the
    // schema's demand, not this test's decoration.
    const required = {
      photoStage: { imageIds: [ID_A] },
      photoRing: { imageIds: [ID_A, ID_A, ID_A] },
      solidChart: { values: [10, 20] },
      extrudedType: { text: 'Relief' },
    }
    for (const kind of THREE_D_BLOCKS) {
      expect(threeDLoadOf(composed([{ kind, ...(required[kind] || {}) }])), kind).toBe(1)
    }
  })
})

describe('threeDLoadRefusal', () => {
  it('names the arithmetic and the fix, not the rule', () => {
    // "at most two" on its own sounds arbitrary and invites raising it. The
    // sentence has to carry why, and what to do instead — spreading is free,
    // which is the part nobody guesses from a bare limit.
    const said = threeDLoadRefusal(5, 'Nothing was queued.')
    expect(said).toContain('5')
    expect(said).toContain(String(MAX_THREE_D_LAYERS))
    expect(said).toMatch(/separate scenes/i)
    expect(said).toContain('Nothing was queued.')
    expect(said).not.toContain('undefined')
  })
})

describe('the bound itself', () => {
  it('leaves the measured cost inside the deadline the queue grants', () => {
    // The numbers this bound was derived from, written down so that raising it
    // means arguing with them. Measured in the worker container, two cores:
    // a flat film renders at 1.78 s per second of film, each 3D block on screen
    // adds about 1.63, and `jobBudgetMs` grants 6.
    const FLAT = 1.78
    const PER_BLOCK = 1.63
    const GRANTED = 6
    expect(FLAT + MAX_THREE_D_LAYERS * PER_BLOCK).toBeLessThan(GRANTED)
    // And one more does not fit — which is the film that was actually measured
    // at 6.68 and killed at nine tenths of the way through.
    expect(FLAT + (MAX_THREE_D_LAYERS + 1) * PER_BLOCK).toBeGreaterThan(GRANTED)
  })
})
