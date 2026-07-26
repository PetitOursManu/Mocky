import { describe, it, expect } from 'vitest'
import { classifyTags, selectSources, loadSources } from './sources.js'

describe('classifyTags', () => {
  it('maps request keywords to tags', () => {
    const tags = classifyTags('a landing page for a fintech saas dashboard')
    expect(tags).toEqual(expect.arrayContaining(['landing', 'fintech', 'saas', 'dashboard']))
  })
  it('returns [] when nothing matches', () => {
    expect(classifyTags('qqqq zzzz')).toEqual([])
  })
})

describe('selectSources', () => {
  it('picks registry sources overlapping the request tags', () => {
    const sources = selectSources('a saas product landing page', { max: 3 })
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.length).toBeLessThanOrEqual(3)
    // every returned source shares at least one tag with the request
    const wanted = new Set(classifyTags('a saas product landing page'))
    for (const s of sources) expect(s.tags.some((t) => wanted.has(t))).toBe(true)
  })

  it('falls back to landing galleries for an unmatched request', () => {
    const sources = selectSources('qqqq zzzz nonsense')
    expect(sources.length).toBeGreaterThan(0)
    for (const s of sources) expect(s.tags).toContain('landing')
  })

  it('loadSources returns the curated registry', () => {
    const all = loadSources()
    expect(all.length).toBeGreaterThanOrEqual(4)
    for (const s of all) {
      expect(typeof s.url).toBe('string')
      expect(Array.isArray(s.tags)).toBe(true)
    }
  })
})
