import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  FONT_FAMILIES,
  findFontIn,
  fontByName,
  familyFor,
  typographyFromDescription,
  settleTypography,
  fontCatalogueLines,
  DEFAULT_DISPLAY,
  DEFAULT_BODY,
} from './index.js'
import { findFontIn as findFontInTs, FONT_FAMILIES as TS_FAMILIES } from '../../src/lib/fonts/index'
import { serverProjection } from '../../scripts/vendor-fonts.mjs'

const catalogue = JSON.parse(fs.readFileSync(new URL('../../src/lib/fonts/catalogue.json', import.meta.url), 'utf8'))
const patterns = JSON.parse(fs.readFileSync(new URL('../muse/prompt-patterns/patterns.json', import.meta.url), 'utf8'))

describe('the server copy of the catalogue', () => {
  it('is exactly the projection of the one the browser reads', () => {
    const onDisk = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url), 'utf8'))
    expect(onDisk).toEqual(serverProjection(catalogue))
    expect(FONT_FAMILIES.map((f) => f.family)).toEqual(TS_FAMILIES.map((f) => f.family))
  })

  it('lists every family to the art director, once', () => {
    const text = fontCatalogueLines().join('\n')
    for (const f of FONT_FAMILIES) expect(text).toContain(f.family)
  })
})

describe('findFontIn mirrors the TypeScript one', () => {
  const corpus = [
    'Playfair Display (high-contrast serif)',
    'Inter Tight, 600',
    'Lora / Inter, serif headings',
    'Serif display (Playfair/Freight), humanist sans body',
    'Neo-grotesque sans (Helvetica/Inter), tight tracking',
    'Monospace (JetBrains Mono) primary',
    "font-['Cormorant_Garamond',serif]",
    'Interstate, winter',
    'press start 2p',
    '',
    'Satoshi',
  ]
  for (const text of corpus) {
    it(JSON.stringify(text), () => {
      expect(findFontIn(text)?.family).toBe(findFontInTs(text)?.family)
    })
  }
})

describe('from a description to a face that loads', () => {
  it('maps every word table entry to a real family', () => {
    for (const d of ['blackletter', 'pixel', 'typewriter', 'handwritten', 'script', 'groovy', 'art deco', 'western', 'mono', 'condensed', 'didone', 'slab', 'rounded', 'chunky', 'editorial serif', 'geometric', 'grotesque', 'humanist']) {
      expect(fontByName(familyFor(d, 'display')), d).toBeTruthy()
      const body = familyFor(d, 'body')
      if (body) expect(fontByName(body), d).toBeTruthy()
    }
    expect(fontByName(DEFAULT_DISPLAY)).toBeTruthy()
    expect(fontByName(DEFAULT_BODY)).toBeTruthy()
  })

  it('does not read "sans-serif" as a serif', () => {
    expect(familyFor('Modern sans-serif display', 'display')).toBeUndefined()
    expect(familyFor('clean sans serif', 'body')).toBeUndefined()
  })

  it('splits a pattern line into its two roles', () => {
    expect(typographyFromDescription('Serif display (Playfair/Freight), humanist sans body')).toEqual({ display: 'Playfair Display', body: 'Source Sans 3' })
    expect(typographyFromDescription('Humanist sans, calm serif headings')).toEqual({ display: 'Playfair Display', body: 'Source Sans 3' })
    expect(typographyFromDescription('Elegant deco caps, refined serif body')).toEqual({ display: 'Poiret One', body: 'Source Serif 4' })
    expect(typographyFromDescription('Monospace (JetBrains Mono) primary')).toEqual({ display: 'JetBrains Mono', body: 'JetBrains Mono' })
    expect(typographyFromDescription(undefined)).toEqual({ display: DEFAULT_DISPLAY, body: DEFAULT_BODY })
  })

  it('gives every shipped pattern two catalogue faces', () => {
    const list = Array.isArray(patterns) ? patterns : patterns.patterns
    expect(list.length).toBeGreaterThan(5)
    for (const p of list) {
      const t = typographyFromDescription(p.tokenSeeds?.typography)
      expect(fontByName(t.display), p.name).toBeTruthy()
      expect(fontByName(t.body), p.name).toBeTruthy()
    }
  })
})

describe('settling a dossier\'s typography', () => {
  it('canonicalises a listed name and keeps the rest of the object', () => {
    expect(settleTypography({ display: 'playfair display', body: 'Inter, 400/700', scaleFeel: 'airy' }, null)).toEqual({
      display: 'Playfair Display',
      body: 'Inter',
      scaleFeel: 'airy',
    })
  })

  it('maps a description, then the pattern seed, then the default — never fails', () => {
    expect(settleTypography({ display: 'a refined high-contrast serif', body: 'Satoshi' }, 'Rounded friendly sans')).toEqual({
      display: 'Bodoni Moda',
      body: 'Nunito',
    })
    expect(settleTypography(undefined, undefined)).toEqual({ display: DEFAULT_DISPLAY, body: DEFAULT_BODY })
  })
})
