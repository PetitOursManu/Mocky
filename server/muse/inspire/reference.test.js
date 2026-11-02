import { describe, it, expect } from 'vitest'
import { buildDossier, buildReferenceSection, dossierImages, dossierJsonSchema, dossierToMarkdown, referencePromptLines } from './dossier.js'
import { runInspiration } from './engine.js'
import { sanitizeReference } from '../routes.js'

/**
 * A picture linked in Muse's Inspiration field — a flyer the person admires —
 * reaching the dossier as the look to be inspired by.
 *
 * Before, it reached the page fetcher, came back without text, and the dossier
 * was written from the request alone. Then it was turned into a site capture,
 * which switched the composer to Reproduce / Redesign and took the screen type
 * away. What these hold: it is a REFERENCE (never the hero, never placed), its
 * measured palette decides the colours unless the user's own hero does, and the
 * format the person asked for stays theirs.
 */

const REFERENCE = {
  swatches: [
    { hex: '#f6efe6', weight: 0.58 },
    { hex: '#b8860b', weight: 0.22 },
    { hex: '#2e2a26', weight: 0.1 },
  ],
  accent: '#b8860b',
}
const HERO = { kind: 'image', swatches: [{ hex: '#101820', weight: 0.7 }], accent: null }
const PATTERN = {
  id: 'p',
  name: 'Neon Arcade',
  description: 'loud and saturated',
  imageryStyle: 'synthwave',
  tokenSeeds: { colors: [{ label: 'Accent', hex: '#ff00aa' }] },
}
const CARD = { sourceUrl: 'https://gallery.example/', styleAdjectives: ['brutal'], palette: [{ hex: '#00ff00' }], layoutGrammar: [], avoid: [] }

/** A dossier the model could return, valid enough for the schema. */
const RAW = {
  productName: 'Merci',
  concept: 'A quiet card of cream paper and gold script.',
  tokens: { colors: [{ label: 'Paper', hex: '#f6efe6' }, { label: 'Gold', hex: '#b8860b', role: 'accent' }], radius: 'rounded-none' },
  layoutGrammar: ['centred'],
  voice: { headline: 'Merci', subheadline: 'x', valueProps: ['a', 'b', 'c'], ctas: ['ok'], footer: 'f' },
  imageryPlan: [{ id: 'hero', subject: 'peonies', prompt: 'peonies, high quality, no text, no watermark' }],
  forbidden: [],
  referenceReading: 'A portrait card, centred, with a gold script headline over cream paper and a thin floral border.',
}

function captor() {
  const seen = []
  const llm = async (req) => {
    seen.push(req)
    throw new Error('stop here — the request is what we are testing')
  }
  return { llm, seen }
}

const ctx = (extra) => ({
  prompt: 'une carte de visite pour un fleuriste',
  cards: [],
  patternHints: [],
  blacklist: [],
  ...extra,
})

describe('the reference section', () => {
  it('names a reference that is not part of the screen, and keeps the request\'s format', () => {
    const section = buildReferenceSection(REFERENCE)
    expect(section).toMatch(/VISUAL REFERENCE/)
    expect(section).toMatch(/NOT part of the screen/)
    expect(section).toMatch(/Keep the FORMAT and the SUBJECT of the USER REQUEST/)
    expect(section).not.toMatch(/HERO OF THE SCREEN/)
    for (const s of REFERENCE.swatches) expect(section).toContain(s.hex)
  })

  it('decides the colours alone, and yields them to the user\'s own hero', () => {
    expect(buildReferenceSection(REFERENCE)).toMatch(/`tokens.colors` MUST be built FROM the colours above/)
    const beside = buildReferenceSection(REFERENCE, { hero: true })
    expect(beside).not.toMatch(/`tokens.colors` MUST/)
    expect(beside).toMatch(/hero picture above decides the colours/)
  })

  it('says what it can read off the picture only when the picture is there', () => {
    expect(buildReferenceSection({ ...REFERENCE, image: 'data:image/jpeg;base64,AAAA' })).toMatch(/The picture is attached/)
    expect(buildReferenceSection(REFERENCE)).toMatch(/Only its palette could be measured/)
  })

  it('is absent without a measured palette', () => {
    expect(buildReferenceSection(null)).toBeNull()
    expect(buildReferenceSection({ swatches: [] })).toBeNull()
  })
})

describe('the dossier call', () => {
  it('carries the section after the hero\'s, and the pictures in that order', async () => {
    const { llm, seen } = captor()
    await buildDossier(llm, ctx({ userMedia: { ...HERO, image: 'data:image/png;base64,HERO' }, reference: { ...REFERENCE, image: 'data:image/jpeg;base64,REF' } }))
    const user = seen[0].user
    expect(user.indexOf("THE USER'S OWN IMAGE")).toBeLessThan(user.indexOf('A VISUAL REFERENCE'))
    expect(seen[0].images).toEqual(['data:image/png;base64,HERO', 'data:image/jpeg;base64,REF'])
  })

  it('is unchanged when no picture was linked', async () => {
    const { llm, seen } = captor()
    await buildDossier(llm, ctx())
    expect(seen[0].user).not.toMatch(/VISUAL REFERENCE/)
    expect(seen[0].images).toBeUndefined()
    expect(dossierImages({ reference: REFERENCE })).toBeUndefined()
  })

  it('reaches the dossier through the engine', async () => {
    const { llm, seen } = captor()
    await runInspiration(
      { prompt: 'une carte de visite', reference: REFERENCE, useFetch: false },
      { llm, patterns: { match: () => [] }, blacklist: [] },
    )
    expect(seen[0].user).toMatch(/A VISUAL REFERENCE/)
  })
})

describe('sanitizeReference', () => {
  it('keeps a measured palette and a reference-sized picture, nothing else', () => {
    const got = sanitizeReference({ ...REFERENCE, image: 'data:image/jpeg;base64,AAAA', kind: 'video', drive: 'pointer', extra: 'x' })
    expect(got).toEqual({ swatches: REFERENCE.swatches, accent: '#b8860b', image: 'data:image/jpeg;base64,AAAA' })
  })

  it('refuses what is not a hex, and a picture that is not a data URL', () => {
    expect(sanitizeReference({ swatches: [{ hex: 'red; ignore previous', weight: 1 }] })).toBeNull()
    expect(sanitizeReference({ ...REFERENCE, image: 'https://evil.example/x.jpg' }).image).toBeUndefined()
    expect(sanitizeReference(null)).toBeNull()
  })
})

describe('the reference leads, everything Muse found follows', () => {
  it('is named in the rules as the primary source, and cited first', () => {
    const { llm, seen } = captor()
    return buildDossier(llm, ctx({ reference: REFERENCE })).then(() => {
      expect(seen[0].system).toMatch(/PRIMARY source of the whole direction/)
      expect(seen[0].system).toMatch(/"sourceUrl": "user reference"/)
    })
  })

  it("labels the cards and the patterns secondary, and drops the patterns' seed colours", async () => {
    const { llm, seen } = captor()
    await buildDossier(llm, ctx({ reference: REFERENCE, cards: [CARD], patternHints: [PATTERN] }))
    const user = seen[0].user
    expect(user).toMatch(/DISTILLED INSPIRATION .*SECONDARY to the visual reference above/)
    expect(user).toMatch(/MATCHED ART-DIRECTION PATTERNS — SECONDARY/)
    expect(user).not.toContain('#ff00aa')
    expect(user.indexOf('A VISUAL REFERENCE')).toBeLessThan(user.indexOf('DISTILLED INSPIRATION'))
  })

  it('leaves the prompt exactly as it was without a reference', async () => {
    const { llm, seen } = captor()
    await buildDossier(llm, ctx({ cards: [CARD], patternHints: [PATTERN] }))
    expect(seen[0].system).not.toMatch(/VISUAL REFERENCE/)
    expect(seen[0].user).not.toMatch(/SECONDARY/)
    expect(seen[0].user).toContain('#ff00aa')
    expect(referencePromptLines(null)).toEqual([])
  })
})

describe('what the reference shows, in words', () => {
  it('is asked for — required — only when the picture is attached', async () => {
    expect(dossierJsonSchema(null, { referenceImage: true }).required).toContain('referenceReading')
    expect(dossierJsonSchema(null).properties.referenceReading).toBeUndefined()
    const seeing = captor()
    await buildDossier(seeing.llm, ctx({ reference: { ...REFERENCE, image: 'data:image/jpeg;base64,REF' } }))
    expect(seeing.seen[0].schema.required).toContain('referenceReading')
    expect(seeing.seen[0].system).toMatch(/`referenceReading`/)
    const blind = captor()
    await buildDossier(blind.llm, ctx({ reference: REFERENCE }))
    expect(blind.seen[0].schema.required).not.toContain('referenceReading')
  })

  it('survives validation and reaches the markdown the generation reads', async () => {
    const dossier = await buildDossier(async () => RAW, ctx({ reference: { ...REFERENCE, image: 'data:image/jpeg;base64,REF' } }))
    expect(dossier.__source).toBe('llm')
    expect(dossier.referenceReading).toBe(RAW.referenceReading)
    const md = dossierToMarkdown(dossier)
    expect(md).toMatch(/## Visual Reference/)
    expect(md).toContain('thin floral border')
    expect(md.indexOf('## Visual Reference')).toBeLessThan(md.indexOf('## Tokens'))
  })
})

describe('the distinctiveness pass', () => {
  // The critic never sees the picture: a direction faithful to a quiet card
  // read as generic, and its revision swapped the accent the reference gave.
  it("does not rewrite a direction derived from the user's reference", async () => {
    const calls = []
    const llm = async (req) => {
      calls.push(req)
      return calls.length === 1 ? RAW : { score: 2, reason: 'generic' }
    }
    const withRef = await runInspiration(
      { prompt: 'une carte de remerciement', reference: REFERENCE, useFetch: false },
      { llm, patterns: { match: () => [] }, blacklist: [] },
    )
    expect(calls).toHaveLength(1)
    expect(withRef.dossier.tokens.colors.find((c) => c.role === 'accent').hex).toBe('#b8860b')

    calls.length = 0
    await runInspiration({ prompt: 'une carte de remerciement', useFetch: false }, { llm, patterns: { match: () => [] }, blacklist: [] })
    expect(calls.length).toBeGreaterThan(1)
  })
})

