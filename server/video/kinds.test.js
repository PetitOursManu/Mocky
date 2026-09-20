import { describe, it, expect } from 'vitest'
import { BLOCK_KINDS } from './timeline.js'
import {
  MOTION_KINDS,
  MOTION_KIND_SPECS,
  motionKindOf,
  isMotionKind,
  unknownMotionKindRefusal,
  narrowBlocks,
  narrowGrounds,
  starvedMotionKind,
  motionKindCard,
  publicMotionKinds,
  motionKindCeilingMs,
} from './kinds.js'
import { BLOCK_KINDS, BACKGROUND_KINDS, TEMPLATE_LIMITS, ASPECT_RATIOS } from './timeline.js'
import { THREE_D_BLOCKS } from './three-d.js'

const COMPOSED = TEMPLATE_LIMITS.composed

describe('the Motion kinds are a doorway into the existing catalogue', () => {
  it('names only blocks that exist', () => {
    // The whole claim of this module: a kind adds nothing to render. A name here
    // that is not in BLOCK_KINDS is a block the worker has no component for, and
    // it would be offered to a model in a prompt built from this table.
    for (const kind of MOTION_KINDS) {
      for (const block of MOTION_KIND_SPECS[kind].blocks) {
        expect(BLOCK_KINDS, `${kind} offers ${block}`).toContain(block)
      }
      for (const ground of MOTION_KIND_SPECS[kind].grounds) {
        expect(BACKGROUND_KINDS, `${kind} offers the ${ground} ground`).toContain(ground)
      }
    }
  })

  it('signs itself with blocks it actually offers', () => {
    // A signature block that is not in `blocks` is a kind that refuses itself:
    // `starvedMotionKind` asks whether any survived the narrowing, and one that
    // was never offered never survives.
    for (const kind of MOTION_KINDS) {
      const spec = MOTION_KIND_SPECS[kind]
      expect(spec.signature.length, `${kind} has a signature`).toBeGreaterThan(0)
      for (const block of spec.signature) {
        expect(spec.blocks, `${kind} signs with ${block}`).toContain(block)
      }
    }
  })

  it('offers something to compose with', () => {
    // A kind narrowing to one block is a kind that composes the same scene every
    // time, which is the choice-among-five the composed template replaced.
    for (const kind of MOTION_KINDS) {
      expect(MOTION_KIND_SPECS[kind].blocks.length, kind).toBeGreaterThan(2)
      expect(MOTION_KIND_SPECS[kind].grounds.length, kind).toBeGreaterThan(1)
    }
  })
})

describe('every bound a kind states is inside the schema it composes into', () => {
  it('holds its scene window inside the composed template', () => {
    // A kind is a NARROWING. A window wider than `TEMPLATE_LIMITS.composed`
    // would print a bound in the prompt that the validator then refuses — a
    // model call already spent when the refusal arrives.
    for (const kind of MOTION_KINDS) {
      const spec = MOTION_KIND_SPECS[kind]
      expect(spec.scenes.min, kind).toBeGreaterThanOrEqual(1)
      expect(spec.scenes.max, kind).toBeLessThanOrEqual(COMPOSED.maxScenes)
      expect(spec.scenes.min, kind).toBeLessThanOrEqual(spec.scenes.max)
      expect(spec.sceneMs.min, kind).toBeGreaterThanOrEqual(COMPOSED.minSceneMs)
      expect(spec.sceneMs.max, kind).toBeLessThanOrEqual(COMPOSED.maxSceneMs)
      expect(spec.sceneMs.min, kind).toBeLessThanOrEqual(spec.sceneMs.max)
    }
  })

  it('names a ratio the schema accepts', () => {
    for (const kind of MOTION_KINDS) {
      expect(ASPECT_RATIOS, kind).toContain(MOTION_KIND_SPECS[kind].aspectRatio)
    }
  })

  it('cannot ask for a film past the total ceiling', () => {
    // scenes.max × sceneMs.max is the longest document this kind can produce.
    // Past MAX_TOTAL_DURATION_MS the schema refuses it whole, and the prompt
    // would have asked for exactly that.
    for (const kind of MOTION_KINDS) {
      expect(motionKindCeilingMs(kind), kind).toBeLessThanOrEqual(120000)
    }
  })
})

describe('the prose argues and the numbers are read', () => {
  it('carries three sentences per kind', () => {
    for (const kind of MOTION_KINDS) {
      const spec = MOTION_KIND_SPECS[kind]
      for (const field of ['what', 'right', 'wrong']) {
        expect(typeof spec[field], `${kind}.${field}`).toBe('string')
        expect(spec[field].trim().length, `${kind}.${field}`).toBeGreaterThan(20)
      }
    }
  })

  it('states no number in prose', () => {
    // The same rule `BLOCK_NOTES` follows: a bound retyped in a sentence drifts
    // from the field the card prints, and the call is already spent when it does.
    for (const kind of MOTION_KINDS) {
      const spec = MOTION_KIND_SPECS[kind]
      for (const field of ['what', 'right', 'wrong']) {
        expect(spec[field], `${kind}.${field}`).not.toMatch(/\d/)
      }
    }
  })

  it('prints its own bounds on the card', () => {
    for (const kind of MOTION_KINDS) {
      const spec = MOTION_KIND_SPECS[kind]
      const card = motionKindCard(kind).join('\n')
      expect(card).toContain(String(spec.scenes.max))
      expect(card).toContain(String(spec.sceneMs.min))
      expect(card).toContain(spec.aspectRatio)
      expect(card).toContain(spec.what)
    }
  })

  it('prints nothing at all for no kind', () => {
    expect(motionKindCard(null)).toEqual([])
    expect(motionKindCard('not-a-kind')).toEqual([])
  })
})

describe('reading a kind off a request', () => {
  it('accepts exactly the names it publishes', () => {
    for (const kind of MOTION_KINDS) expect(motionKindOf(kind)).toBe(kind)
  })

  it('reads anything else as no kind at all', () => {
    // Absent and unknown are told apart by the CALLER: this answers null for
    // both, and the route is what turns the second into a 400.
    for (const value of [null, undefined, '', 'HERO', 'heros', 42, {}, ['hero']]) {
      expect(motionKindOf(value)).toBeNull()
      expect(isMotionKind(value)).toBe(false)
    }
  })

  it('names the whole enum when it refuses one', () => {
    const message = unknownMotionKindRefusal('trailer', 'Nothing was proposed.')
    expect(message).toContain('"trailer"')
    for (const kind of MOTION_KINDS) expect(message).toContain(kind)
    expect(message).toContain('Nothing was proposed.')
  })

  it('bounds what it quotes back', () => {
    // The value comes from a request body and lands in a message. A caller
    // sending a kilobyte would be quoted a kilobyte.
    const message = unknownMotionKindRefusal('x'.repeat(500), 'Nothing was proposed.')
    expect(message).not.toContain('x'.repeat(41))
  })
})

describe('narrowing', () => {
  it('keeps the catalogue order rather than the kind\'s', () => {
    // The prompt prints families in schema order; a narrowing that reordered
    // them would print one family's blocks under another's header.
    const narrowed = narrowBlocks(BLOCK_KINDS, 'hero')
    const positions = narrowed.map((name) => BLOCK_KINDS.indexOf(name))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('never adds a block back that was already withheld', () => {
    // The selection and the 3D permission have already spoken. A doorway that
    // re-opened either would be a permission written twice — and the second one
    // is the one nobody tests.
    const flat = BLOCK_KINDS.filter((name) => !THREE_D_BLOCKS.includes(name))
    for (const kind of MOTION_KINDS) {
      for (const name of narrowBlocks(flat, kind)) {
        expect(THREE_D_BLOCKS, `${kind} leaked ${name}`).not.toContain(name)
      }
    }
  })

  it('leaves an unnamed kind exactly as it was', () => {
    expect(narrowBlocks(BLOCK_KINDS, null)).toEqual(BLOCK_KINDS)
    expect(narrowGrounds(BACKGROUND_KINDS, undefined)).toEqual(BACKGROUND_KINDS)
  })

  it('drops the grounds the kind is not made of', () => {
    // `background` is the case worth pinning: it must never be offered the
    // `image` ground, because a photograph under type the PAGE sets is the
    // defect the kind exists to avoid.
    expect(narrowGrounds(BACKGROUND_KINDS, 'background')).not.toContain('image')
  })

  it('offers a background no block that sets type', () => {
    const typed = ['heading', 'kicker', 'quote', 'funTitle', 'typewriter', 'logoType', 'lowerThird']
    for (const name of narrowBlocks(BLOCK_KINDS, 'background')) {
      expect(typed, `background offers ${name}`).not.toContain(name)
    }
  })
})

describe('a kind that can no longer be itself is refused by name', () => {
  it('refuses a globe with no 3D', () => {
    const flat = BLOCK_KINDS.filter((name) => !THREE_D_BLOCKS.includes(name))
    const message = starvedMotionKind('globe', narrowBlocks(flat, 'globe'), 'Nothing was proposed.')
    // Not empty: `map`, `heading` and `kicker` all survive, which is exactly why
    // the question is asked of the signature and not of the count.
    expect(narrowBlocks(flat, 'globe').length).toBeGreaterThan(0)
    expect(message).toContain('globe')
    expect(message).toContain('Nothing was proposed.')
  })

  it('refuses a showcase with no picture', () => {
    // Every signature block of `showcase` needs an image, so an empty selection
    // starves it — and the film that would otherwise be composed is a card of
    // type calling itself a product shot.
    const message = starvedMotionKind('showcase', ['heading', 'kicker', 'button'], 'Nothing was queued.')
    expect(message).toContain('showcase')
    expect(message).toContain('Nothing was queued.')
  })

  it('says nothing when one signature block survives', () => {
    expect(starvedMotionKind('hero', ['heading'], 'x')).toBeNull()
    expect(starvedMotionKind('background', ['waveMesh'], 'x')).toBeNull()
  })

  it('says nothing about a kind nobody asked for', () => {
    expect(starvedMotionKind(null, [], 'x')).toBeNull()
  })
})

describe('what /status publishes', () => {
  it('publishes every kind, and no prose', () => {
    const published = publicMotionKinds()
    expect(published.map((k) => k.id)).toEqual(MOTION_KINDS)
    for (const entry of published) {
      expect(Object.keys(entry).sort()).toEqual(
        ['aspectRatio', 'id', 'maxSceneMs', 'maxScenes', 'minSceneMs', 'minScenes'].sort(),
      )
      // The three sentences are a prompt in English addressed to a model. A
      // panel that printed one would show a French user a machine instruction.
      expect(JSON.stringify(entry)).not.toContain(MOTION_KIND_SPECS[entry.id].what)
    }
  })
})

/**
 * A type is a DOOR into the catalogue, so the doors together must open onto all
 * of it — and each one must not open onto something absurd.
 *
 * Both directions matter and they fail differently. A block no door reaches is
 * paid for and unreachable: `solidScene` cost a real dependency (three,
 * @react-three/fiber, +32 MB of image) and was offered by no type at all, so
 * nothing composed through a kind could ever name it. A block behind the WRONG
 * door is worse than absent — it is offered, chosen, rendered, and then read as
 * a mistake by whoever watches the film.
 */
describe('the doors open onto the whole catalogue, and onto nothing absurd', () => {
  const offered = new Set(Object.values(MOTION_KIND_SPECS).flatMap((k) => k.blocks))

  it('leaves no block unreachable through every type', () => {
    expect(BLOCK_KINDS.filter((b) => !offered.has(b))).toEqual([])
  })

  it('offers only blocks that exist', () => {
    // The other direction: a name misspelled in a type list is a block silently
    // withheld, and the catalogue it builds is one entry short with no error.
    for (const [id, spec] of Object.entries(MOTION_KIND_SPECS)) {
      for (const block of spec.blocks) {
        expect(BLOCK_KINDS, `${id} → ${block}`).toContain(block)
      }
    }
  })

  it('keeps a control out of a film that is only a picture of one', () => {
    // The user's own rule, and their own example: "on ne met pas de bouton si
    // le style Héro est demandé — de toute façon on ne peut pas cliquer dessus,
    // et pour un héro on cherche un autre type de contenu."
    //
    // Not banned everywhere, deliberately: `showcase` is a film that SHOWS an
    // interface, so a button, a form and a notification are objects being
    // filmed rather than controls being offered. The line is drawn per type.
    expect(MOTION_KIND_SPECS.hero.blocks).not.toContain('button')
    expect(MOTION_KIND_SPECS.mark.blocks).not.toContain('button')
    expect(MOTION_KIND_SPECS.globe.blocks).not.toContain('button')
    expect(MOTION_KIND_SPECS.showcase.blocks).toContain('button')
  })

  it('keeps a background wordless, which is what makes it a background', () => {
    // Mechanical rather than instructed: a type that offers no block setting
    // type cannot come back as a hero, whatever the model intended.
    const SETS_TYPE = ['heading', 'kicker', 'quote', 'typewriter', 'funTitle', 'logoType', 'lowerThird']
    for (const block of SETS_TYPE) {
      expect(MOTION_KIND_SPECS.background.blocks, block).not.toContain(block)
    }
  })

  it('gives every type a signature its own block list can satisfy', () => {
    // A signature naming a block the type does not offer is a promise it cannot
    // keep: the composer would insist on something absent from the catalogue.
    for (const [id, spec] of Object.entries(MOTION_KIND_SPECS)) {
      for (const block of spec.signature) {
        expect(spec.blocks, `${id} → signature ${block}`).toContain(block)
      }
    }
  })
})
