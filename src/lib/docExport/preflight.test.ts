import { describe, expect, it } from 'vitest'
import { getPageFormat } from '../pageFormats'
import {
  PX_PER_MM,
  edgesReached,
  fitOf,
  inUnsafeBand,
  namesQr,
  pictureDensity,
  preflightChecks,
  unsafeBands,
  type PageFacts,
} from './preflight'

const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  page: 1,
  pictures: [],
  external: [],
  nearEdge: [],
  edges: [],
  overflow: [],
  clipped: [],
  qrCodes: [],
  qrPlaceholders: 0,
  flattened: 0,
  tilted: 0,
  ...over,
})

describe('pictureDensity', () => {
  it('reads cover by the axis stretched most, contain by the least', () => {
    // 1200 × 800 covering an 800 square: scaled to 1200 × 1200 → 1 px per CSS px.
    expect(pictureDensity({ w: 1200, h: 800 }, { w: 800, h: 800 }, 'cover')).toBeCloseTo(1)
    expect(pictureDensity({ w: 1200, h: 800 }, { w: 800, h: 800 }, 'contain')).toBeCloseTo(1.5)
    expect(pictureDensity({ w: 400, h: 400 }, { w: 800, h: 200 }, 'fill')).toBeCloseTo(0.5)
    expect(pictureDensity({ w: 400, h: 400 }, { w: 800, h: 800 }, 'none')).toBe(1)
    expect(pictureDensity({ w: 400, h: 400 }, { w: 800, h: 800 }, 'scale-down')).toBe(1)
    expect(pictureDensity({ w: 0, h: 400 }, { w: 80, h: 80 }, 'cover')).toBeNull()
  })

  it('reads object-fit and background-size', () => {
    expect(fitOf('cover')).toBe('cover')
    expect(fitOf('fill')).toBe('fill')
    expect(fitOf('auto', true)).toBe('none')
    expect(fitOf('contain', true)).toBe('contain')
    expect(fitOf('50% auto', true)).toBeNull()
  })
})

describe('edges and bands', () => {
  it('finds the edges a painted box reaches inside the page', () => {
    expect(edgesReached({ x: -20, y: 0, w: 120, h: 50 }, 100, 200)).toEqual(['top', 'right', 'left'])
    expect(edgesReached({ x: 10, y: 10, w: 20, h: 20 }, 100, 200)).toEqual([])
    expect(edgesReached({ x: 120, y: 10, w: 20, h: 20 }, 100, 200)).toEqual([])
  })

  it('keeps 3 mm on paper, Instagram’s bands on a story, nothing on a post', () => {
    const a4 = getPageFormat('a4')
    const bands = unsafeBands(a4)!
    expect(bands.top).toBeCloseTo(3 * PX_PER_MM)
    expect(inUnsafeBand({ x: 5, y: 100, w: 200, h: 20 }, a4.w, a4.h, bands)).toBe(true)
    expect(inUnsafeBand({ x: 40, y: 100, w: 200, h: 20 }, a4.w, a4.h, bands)).toBe(false)
    const story = unsafeBands(getPageFormat('social-story'))!
    expect(story).toEqual({ top: 250, right: 0, bottom: 250, left: 0 })
    expect(inUnsafeBand({ x: 0, y: 1700, w: 1080, h: 40 }, 1080, 1920, story)).toBe(true)
    expect(unsafeBands(getPageFormat('social-square'))).toBeNull()
  })
})

describe('namesQr', () => {
  it('hears a QR code and not a word that contains the letters', () => {
    for (const s of ['QR code', 'qr-code.png', 'Scannez le QR', 'qrcode', 'code_QR']) expect(namesQr(s)).toBe(true)
    for (const s of ['Qrisp', 'aqra', 'Photo du plat', '']) expect(namesQr(s)).toBe(false)
  })
})

describe('preflightChecks', () => {
  const a4 = getPageFormat('a4')

  it('says everything is fine when nothing was found, and n/a where the format has no such question', () => {
    const checks = preflightChecks([page()], getPageFormat('social-square'))
    expect(Object.fromEntries(checks.map((c) => [c.id, c.status]))).toEqual({
      pictures: 'ok',
      margins: 'na',
      bleed: 'na',
      text: 'ok',
      qr: 'na',
      canva: 'ok',
    })
  })

  it('judges a printed photo in dpi, and a post’s in the share of the pixels it needs', () => {
    const facts = [page({ pictures: [{ label: 'Assiette', nth: 1, density: 1 }, { label: '', nth: 2, density: 1.8 }, { label: '', nth: 3, density: 3 }] })]
    const print = preflightChecks(facts, a4, (n) => `image ${n}`)[0]
    expect(print.status).toBe('warn')
    expect(print.notes.map((n) => [n.code, n.items])).toEqual([
      ['lowRes', ['Assiette (96 dpi)']],
      ['softRes', ['image 2 (173 dpi)']],
    ])
    const post = preflightChecks([page({ pictures: [{ label: 'Plat', nth: 1, density: 0.6 }] })], getPageFormat('social-square'))[0]
    expect(post.notes[0].items).toEqual(['Plat (60 %)'])
  })

  it('reports text near the cut, cut text and the bleed, by page', () => {
    const checks = preflightChecks(
      [page({ nearEdge: ['04 66 05 10 11'], edges: ['top', 'left'] }), page({ page: 2, overflow: ['Mentions'], clipped: ['Une phrase trop longue…'] })],
      a4,
    )
    const by = Object.fromEntries(checks.map((c) => [c.id, c]))
    expect(by.margins.notes[0]).toMatchObject({ code: 'nearEdge', pages: [1], items: ['04 66 05 10 11'] })
    expect(by.bleed).toMatchObject({ status: 'info', notes: [{ code: 'bleed', pages: [1] }] })
    expect(by.text.notes.map((n) => n.code)).toEqual(['overflow', 'clipped'])
    expect(by.text.notes[0].pages).toEqual([2])
  })

  it('tells a QR placeholder from a real code, and a printed code too small to scan', () => {
    const small = 15 * PX_PER_MM
    const big = 30 * PX_PER_MM
    const checks = preflightChecks(
      [page({ qrPlaceholders: 1 }), page({ page: 2, qrCodes: [{ label: 'QR menu', side: small }, { label: 'QR site', side: big }] })],
      a4,
    )
    const qr = checks.find((c) => c.id === 'qr')!
    expect(qr.status).toBe('warn')
    expect(qr.notes).toEqual([
      { code: 'qrPlaceholder', level: 'warn', pages: [1], items: [], n: 1 },
      { code: 'qrSmall', level: 'warn', pages: [2], items: ['QR menu (15 mm)'] },
      { code: 'qrOk', level: 'info', pages: [2], items: ['QR site (30 mm)'] },
    ])
  })

  it('counts what Canva will get as pictures, and warns of tilted text', () => {
    const canva = preflightChecks([page({ flattened: 2 }), page({ page: 2, flattened: 1, tilted: 4 })], a4).find((c) => c.id === 'canva')!
    expect(canva.notes).toEqual([
      { code: 'flattened', level: 'info', pages: [1, 2], items: [], n: 3 },
      { code: 'tilted', level: 'warn', pages: [2], items: [], n: 4 },
    ])
    expect(preflightChecks([page({ flattened: null })], a4).find((c) => c.id === 'canva')!.status).toBe('na')
  })
})
