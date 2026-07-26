import { describe, it, expect } from 'vitest'
import { lintSlop } from './lint'

describe('lintSlop', () => {
  it('passes clean, real copy', () => {
    expect(lintSlop('<h1>Boulangerie Lyonnaise</h1><p>Le pain qui sent la tradition</p>')).toEqual({ ok: true, violations: [] })
  })

  it('flags Lorem ipsum (case-insensitive, any spacing)', () => {
    expect(lintSlop('<p>Lorem Ipsum dolor sit amet</p>').ok).toBe(false)
    expect(lintSlop('lorem   ipsum').ok).toBe(false)
    expect(lintSlop('<p>LOREM IPSUM</p>').violations).toContain('Lorem ipsum')
  })

  it('flags common placeholder phrases', () => {
    expect(lintSlop('Sample text').ok).toBe(false)
    expect(lintSlop('Your text here').ok).toBe(false)
    expect(lintSlop('Content goes here').ok).toBe(false)
    expect(lintSlop('placeholder text').ok).toBe(false)
  })

  it('does not false-positive on legitimate words', () => {
    // "content" alone, "sample" of products, etc. must not trip the lint.
    expect(lintSlop('<p>Our content strategy and product samples</p>').ok).toBe(true)
    expect(lintSlop('<p>Découvrez notre sélection</p>').ok).toBe(true)
  })

  it('reports every distinct violation', () => {
    const r = lintSlop('Lorem ipsum. Sample text. Your content here.')
    expect(r.ok).toBe(false)
    expect(r.violations.length).toBeGreaterThanOrEqual(3)
  })
})
