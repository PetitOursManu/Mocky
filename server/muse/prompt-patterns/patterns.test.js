import { describe, it, expect } from 'vitest'
import { createPatternLibrary, PromptPatternLibrary } from './index.js'

describe('PromptPatternLibrary', () => {
  it('loads the curated patterns from disk', () => {
    const lib = createPatternLibrary()
    expect(lib.all().length).toBeGreaterThanOrEqual(15)
    expect(lib.get('swiss-grid')).toBeTruthy()
    expect(lib.get('nope')).toBeNull()
  })

  it('every pattern has DESIGN.md-compatible token seeds', () => {
    for (const p of createPatternLibrary().all()) {
      expect(Array.isArray(p.tokenSeeds?.colors)).toBe(true)
      for (const c of p.tokenSeeds.colors) {
        expect(c.hex).toMatch(/^#[0-9a-fA-F]{3,8}$/)
        expect(typeof c.label).toBe('string')
      }
      expect(Array.isArray(p.tags)).toBe(true)
    }
  })

  it('matches by tag overlap, best first', () => {
    const lib = createPatternLibrary()
    const m = lib.match('a warm artisan bakery restaurant landing page', 3)
    expect(m.length).toBeGreaterThan(0)
    expect(m[0].tags).toEqual(expect.arrayContaining([expect.stringMatching(/restaurant|food|bakery|cafe/)]))
  })

  it('always returns at least one pattern (offline fallback guarantee)', () => {
    const lib = createPatternLibrary()
    expect(lib.match('zzzz nonsense qqqq', 3).length).toBeGreaterThanOrEqual(1)
  })

  it('respects the limit', () => {
    const lib = new PromptPatternLibrary([
      { id: 'a', name: 'A', description: '', tags: ['saas'], tokenSeeds: { colors: [] } },
      { id: 'b', name: 'B', description: '', tags: ['saas'], tokenSeeds: { colors: [] } },
      { id: 'c', name: 'C', description: '', tags: ['saas'], tokenSeeds: { colors: [] } },
    ])
    expect(lib.match('saas', 2).length).toBe(2)
  })
})
