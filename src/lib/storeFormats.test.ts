import { describe, expect, it } from 'vitest'
import { formatFamily, formatsLike, getPageFormat } from './pageFormats'
import { composerPageFormat, documentHint, pageFormatChips } from './documentMode'
import { documentSequenceKind } from './docSequence'

/**
 * App Store screenshots: made like a post (exact pixels, PNG at 1×, a row of
 * pages), offered apart from one. A store checks the pixels and refuses any
 * other size, so the sizes are the stores' own and never sit among a feed's.
 */
describe('the store formats', () => {
  it('are the sizes the stores accept, in their own pixels', () => {
    expect(getPageFormat('store-iphone')).toMatchObject({ w: 1320, h: 2868, kind: 'social', store: true })
    expect(getPageFormat('store-ipad')).toMatchObject({ w: 2064, h: 2752, kind: 'social', store: true })
    expect(getPageFormat('store-android')).toMatchObject({ w: 1080, h: 1920, kind: 'social', store: true })
    for (const id of ['store-iphone', 'store-ipad', 'store-android'] as const) {
      const f = getPageFormat(id)
      expect(f.widthPt).toBeCloseTo(f.w * 0.75)
      expect(f.heightPt).toBeCloseTo(f.h * 0.75)
    }
  })

  it('form a family of their own: a post is never offered a store size, nor the reverse', () => {
    expect(formatFamily('store-iphone')).toBe('store')
    expect(formatsLike('social-portrait').some((f) => f.store)).toBe(false)
    expect(formatsLike('store-ipad').every((f) => f.store)).toBe(true)
    expect(pageFormatChips('social-portrait', 'instagram').map((c) => c.id)).not.toContain('store-iphone')
    expect(pageFormatChips('store-iphone', 'app-store').map((c) => c.id)).toEqual(['store-iphone', 'store-ipad', 'store-android'])
    // A remembered post size is not carried into a set of screenshots.
    expect(composerPageFormat('app-store', 'social-square')).toBe('store-iphone')
    expect(composerPageFormat('app-store', 'store-android')).toBe('store-android')
  })

  it('tell the model it is making store screenshots, a row read side by side', () => {
    const hint = documentHint(getPageFormat('store-iphone'))
    expect(hint).toContain('APP STORE SCREENSHOTS')
    expect(hint).toContain('1320×2868px')
    expect(hint).toMatch(/ROW of screenshots/)
    expect(hint).not.toMatch(/CAROUSEL/)
    expect(documentHint(getPageFormat('social-portrait'))).toMatch(/CAROUSEL/)
  })

  it('are a row of pages, like a carousel', () => {
    expect(documentSequenceKind('app-store', 'store-iphone')).toBe('carousel')
  })
})
