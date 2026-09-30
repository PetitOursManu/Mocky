import { describe, expect, it } from 'vitest'
import { FIELD_ATTR, PAGE_ATTR, PAGE_FORMATS, getPageFormat } from '../pageFormats'
import { fileBaseName, pageFileName, safeLinkHref } from './files'
import { orderPages, transformTilts } from './measure'
import { MAX_RASTER_PIXELS, clipTextInk, hideCss, rasterScale } from './raster'
import { isWinAnsi, toWinAnsi } from './winAnsi'

describe('toWinAnsi', () => {
  it('keeps French intact', () => {
    const s = 'Fête d’été — « Œuvre » : 12 € … naïveté, ça coûte'
    expect(toWinAnsi(s)).toBe(s)
  })

  it('replaces what has a near spelling and drops what has none', () => {
    expect(toWinAnsi('10 000 → 2 − 1 ≥ 0')).toBe('10 000 -> 2 - 1 >= 0')
    // ó is in WinAnsi and stays; Ł and ź are not and lose only their mark.
    expect(toWinAnsi('Łódź')).toBe('Lódz')
    expect(toWinAnsi('ő ș')).toBe('o s')
    expect(toWinAnsi('Fête 🎉 中文')).toBe('Fête  ')
  })

  it('turns line breaks into spaces unless asked to keep them', () => {
    expect(toWinAnsi('a\r\nb\tc')).toBe('a b c')
    expect(toWinAnsi('a\nb', true)).toBe('a\nb')
  })

  it('only ever outputs encodable characters', () => {
    const out = toWinAnsi('ÀÿŸ€™ 😀 ∑ ∞ ✓ ●')
    expect([...out].every((c) => c === '\n' || isWinAnsi(c))).toBe(true)
  })
})

describe('rasterScale', () => {
  it('rasterises paper at ~250 dpi and slides for a 1080p screen', () => {
    expect(rasterScale(getPageFormat('a4'), 'pdf')).toBeCloseTo(250 / 96, 5)
    expect(rasterScale(getPageFormat('slides'), 'pdf')).toBe(1.5)
    expect(rasterScale(getPageFormat('a4'), 'pptx')).toBe(2)
  })

  it('never asks for a canvas above the ceiling', () => {
    for (const f of PAGE_FORMATS) {
      for (const p of ['pdf', 'pptx', 'png'] as const) {
        const s = rasterScale(f, p)
        expect(f.w * s * f.h * s).toBeLessThanOrEqual(MAX_RASTER_PIXELS)
      }
    }
    const poster = { w: 4000, h: 6000, kind: 'print' as const }
    const s = rasterScale(poster, 'pdf')
    expect(poster.w * s * poster.h * s).toBeLessThanOrEqual(MAX_RASTER_PIXELS + 1)
  })
})

describe('hideCss', () => {
  it('hides nothing for a PNG, the fields’ ink for a PDF, all text for a slide', () => {
    expect(hideCss('none')).toBe('')
    const fields = hideCss('fields')
    expect(fields).toContain(`[${PAGE_ATTR}] [${FIELD_ATTR}]`)
    expect(fields).toContain('::placeholder')
    expect(fields).not.toContain(`[${PAGE_ATTR}] *{`)
    const text = hideCss('text')
    expect(text).toContain(`[${PAGE_ATTR}] *{`)
    expect(text).toContain('color:transparent!important')
  })
})

describe('orderPages', () => {
  it('orders by the index the kit wrote, document order breaking ties', () => {
    const el = (id: string, idx: string | null) => ({ id, getAttribute: (n: string) => (n === PAGE_ATTR ? idx : null) })
    const out = orderPages([el('c', '2'), el('a', '0'), el('b', '1'), el('b2', '1'), el('x', null)])
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'b2', 'c', 'x'])
  })
})

describe('files', () => {
  it('names a file after the screen, accents kept, forbidden characters out', () => {
    expect(fileBaseName('Flyer — Fête d’été')).toBe('Flyer — Fête d’été')
    expect(fileBaseName('a/b:c*?"<>|d.')).toBe('a b c d')
    expect(fileBaseName('   ')).toBe('document')
    expect(fileBaseName('CON')).toBe('document')
    expect(fileBaseName('x'.repeat(200)).length).toBe(80)
  })

  it('pads page numbers so they sort', () => {
    expect(pageFileName(0, 3)).toBe('page-01.png')
    expect(pageFileName(9, 120)).toBe('page-010.png')
  })

  it('keeps web, mail and phone links only', () => {
    expect(safeLinkHref('https://exemple.fr/fête')).toBe('https://exemple.fr/f%C3%AAte')
    expect(safeLinkHref('mailto:a@b.fr')).toBe('mailto:a@b.fr')
    expect(safeLinkHref('tel:+33123456789')).toBe('tel:+33123456789')
    expect(safeLinkHref('javascript:alert(1)')).toBeNull()
    expect(safeLinkHref('/relative')).toBeNull()
    expect(safeLinkHref('')).toBeNull()
    expect(safeLinkHref('#')).toBeNull()
    // An SVG <a>'s `.href` is an object: dropped, never a throw.
    expect(safeLinkHref({ baseVal: 'https://x.fr' })).toBeNull()
  })
})

describe('transformTilts', () => {
  it('lets a pure translation through — centring is everywhere', () => {
    expect(transformTilts('none')).toBe(false)
    expect(transformTilts('matrix(1, 0, 0, 1, -397, 0)')).toBe(false)
    expect(transformTilts('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, -4, 0, 1)')).toBe(false)
    expect(transformTilts(undefined, 'none', 'none')).toBe(false)
    expect(transformTilts(undefined, '0deg', '1')).toBe(false)
  })

  it('catches a rotation or a scale, by matrix or by individual property', () => {
    expect(transformTilts('matrix(0.994522, -0.104528, 0.104528, 0.994522, 0, 0)')).toBe(true) // -rotate-6
    expect(transformTilts('matrix(1.1, 0, 0, 1.1, 0, 0)')).toBe(true) // scale-110
    expect(transformTilts('none', '12deg')).toBe(true)
    expect(transformTilts('none', 'none', '1.1')).toBe(true)
    expect(transformTilts('perspective(10px)')).toBe(true)
  })
})

describe('clipTextInk', () => {
  const inherited = { r: 17, g: 17, b: 17, a: 1 }
  it('takes the first opaque stop of the gradient', () => {
    expect(clipTextInk('linear-gradient(to right, rgb(236, 72, 153), rgba(251, 146, 60, 0))', inherited)).toEqual({ r: 236, g: 72, b: 153, a: 1 })
    expect(clipTextInk('linear-gradient(90deg, rgba(0, 0, 0, 0), #fb923c)', inherited)).toEqual({ r: 251, g: 146, b: 60, a: 1 })
  })

  it('falls back to the inherited ink, then to black, never to nothing', () => {
    expect(clipTextInk('url(photo.jpg)', inherited)).toEqual(inherited)
    expect(clipTextInk('none', { r: 0, g: 0, b: 0, a: 0 })).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })
})
