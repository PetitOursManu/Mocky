import { describe, it, expect } from 'vitest'
import { buildDossier, buildReferenceSection, dossierImages } from './dossier.js'
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
