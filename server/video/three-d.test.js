import { describe, it, expect } from 'vitest'
import { THREE_D_BLOCKS, FLAT_BLOCKS, isThreeDBlock, threeDBlocksIn, threeDRefusal } from './three-d.js'
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
