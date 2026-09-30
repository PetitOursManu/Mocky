import { describe, it, expect } from 'vitest'
import {
  PAGE_FORMATS,
  PAGE_GAP_PX,
  docFrameHeight,
  getPageFormat,
  isFieldType,
  isPageFormat,
  normalizePageFormat,
  pxToPt,
} from './pageFormats'

describe('PAGE_FORMATS', () => {
  it('keeps px and points on the same physical size (96 px = 72 pt per inch)', () => {
    for (const f of PAGE_FORMATS) {
      // Within a pixel: the px are rounded, the points are exact.
      expect(Math.abs(pxToPt(f.w) - f.widthPt)).toBeLessThan(0.75)
      expect(Math.abs(pxToPt(f.h) - f.heightPt)).toBeLessThan(0.75)
    }
  })

  it('pairs each portrait with its landscape', () => {
    const a4 = getPageFormat('a4')
    const a4l = getPageFormat('a4-landscape')
    expect([a4l.w, a4l.h]).toEqual([a4.h, a4.w])
    const l = getPageFormat('letter')
    const ll = getPageFormat('letter-landscape')
    expect([ll.w, ll.h]).toEqual([l.h, l.w])
  })

  it('makes the presentation page the 16:9 widescreen size', () => {
    const s = getPageFormat('slides')
    expect(s.w / s.h).toBeCloseTo(16 / 9, 5)
    expect([s.widthPt, s.heightPt]).toEqual([960, 540])
  })
})

describe('ids', () => {
  it('recognises only known formats and field types', () => {
    expect(isPageFormat('a4')).toBe(true)
    expect(isPageFormat('a5')).toBe(false)
    expect(normalizePageFormat('letter')).toBe('letter')
    expect(normalizePageFormat('gone')).toBeUndefined()
    expect(normalizePageFormat(3)).toBeUndefined()
    expect(isFieldType('checkbox')).toBe(true)
    expect(isFieldType('signature')).toBe(false)
  })
})

describe('docFrameHeight', () => {
  it('stacks pages with the canvas gap between them, never below one page', () => {
    const a4 = getPageFormat('a4')
    expect(docFrameHeight(a4, 1)).toBe(a4.h)
    expect(docFrameHeight(a4, 3)).toBe(3 * a4.h + 2 * PAGE_GAP_PX)
    expect(docFrameHeight(a4, 0)).toBe(a4.h)
  })
})
