import { describe, it, expect } from 'vitest'
import {
  planSlices,
  partsUsed,
  refuseSiteFile,
  describeSiteImages,
  buildSiteReferenceSection,
  SITE_PART_WIDTH,
  SITE_PARTS_MAX,
  SITE_SHOTS_MAX,
  SITE_FILE_MAX_BYTES,
  type SiteShot,
} from './siteReference'

const shot = (parts: number): SiteShot => ({ id: String(Math.random()), name: '', parts: Array(parts).fill('data:') })

describe('planSlices', () => {
  it('sends a screen-sized capture whole', () => {
    const p = planSlices(1440, 900, 8)
    expect(p.slices).toEqual([{ y: 0, h: 900 }])
    expect(p.width).toBe(SITE_PART_WIDTH)
  })

  it('never upscales a narrow capture', () => {
    const p = planSlices(390, 800, 8)
    expect(p.width).toBe(390)
    expect(p.scale).toBe(1)
  })

  it('cuts a full-page capture into parts that cover it top to bottom, overlapping', () => {
    const p = planSlices(1440, 9000, 8)
    expect(p.slices.length).toBeGreaterThan(1)
    expect(p.slices[0].y).toBe(0)
    const last = p.slices[p.slices.length - 1]
    expect(last.y + last.h).toBe(9000)
    for (let i = 1; i < p.slices.length; i++) {
      const prev = p.slices[i - 1]
      // Overlap: each part starts before the previous one ends — no line is lost on a cut.
      expect(p.slices[i].y).toBeLessThan(prev.y + prev.h)
    }
  })

  it('keeps each part near the shape of a screen when the budget allows', () => {
    const p = planSlices(1440, 9000, 8)
    for (const s of p.slices) expect(s.h / 1440).toBeLessThan(1.6)
  })

  it('makes taller parts rather than exceeding the budget', () => {
    const p = planSlices(1440, 20000, 3)
    expect(p.slices).toHaveLength(3)
    const last = p.slices[2]
    expect(last.y + last.h).toBe(20000)
  })

  it('sends the page whole when only one part is left', () => {
    expect(planSlices(1440, 9000, 1).slices).toEqual([{ y: 0, h: 9000 }])
  })
})

describe('refuseSiteFile', () => {
  it('accepts a screenshot', () => {
    expect(refuseSiteFile({ type: 'image/png', size: 1000 }, [])).toBeNull()
  })

  it('refuses what is not an image, what is too big, and what does not fit', () => {
    expect(refuseSiteFile({ type: 'application/pdf', size: 10 }, [])).toBe('project.siteNotImage')
    expect(refuseSiteFile({ type: 'image/jpeg', size: SITE_FILE_MAX_BYTES + 1 }, [])).toBe('project.siteTooLarge')
    expect(refuseSiteFile({ type: 'image/jpeg', size: 10 }, Array.from({ length: SITE_SHOTS_MAX }, () => shot(1)))).toBe('project.siteFull')
    expect(refuseSiteFile({ type: 'image/jpeg', size: 10 }, [shot(SITE_PARTS_MAX)])).toBe('project.siteFull')
  })

  it('counts parts across shots', () => {
    expect(partsUsed([shot(3), shot(2)])).toBe(5)
  })
})

describe('describeSiteImages', () => {
  it('numbers from after the annotations', () => {
    expect(describeSiteImages([1], 3)).toContain('[3]')
    expect(describeSiteImages([3], 2)).toContain('[2]–[4]')
  })

  it('lists each screenshot with its own range', () => {
    const d = describeSiteImages([2, 1], 1)
    expect(d).toContain('screenshot 1: [1]–[2]')
    expect(d).toContain('screenshot 2: [3]')
  })

  it('warns about the overlap only when a page was cut', () => {
    expect(describeSiteImages([1, 1], 1)).not.toContain('overlap')
    expect(describeSiteImages([2], 1)).toContain('overlap')
  })
})

describe('buildSiteReferenceSection', () => {
  it('asks a reproduction for the copy AND the look, overriding taste', () => {
    const s = buildSiteReferenceSection('reproduce', [1], 1)
    expect(s).toContain('REPRODUCE')
    expect(s).toMatch(/transcribe every visible text/)
    expect(s).toMatch(/OVERRIDES every stylistic rule/)
  })

  it('asks a redesign for the content and forbids the old look', () => {
    const s = buildSiteReferenceSection('redesign', [1], 1)
    expect(s).toContain('REDESIGN')
    expect(s).toMatch(/KEEP/)
    expect(s).toMatch(/Do not carry over the old look/)
    expect(s).not.toMatch(/OVERRIDES every stylistic rule/)
  })
})
