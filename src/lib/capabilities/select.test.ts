import { describe, it, expect } from 'vitest'
import { selectCapabilities, resolveCapabilities } from './select'

describe('selectCapabilities', () => {
  it('returns empty array for a prompt with no matching keywords', () => {
    expect(selectCapabilities('A simple login screen')).toEqual([])
  })

  it('selects motion when prompt mentions animation', () => {
    const result = selectCapabilities('A page with smooth animation and transitions')
    expect(result).toContain('motion')
  })

  it('selects recharts when prompt mentions chart', () => {
    const result = selectCapabilities('An analytics dashboard with a bar chart')
    expect(result).toContain('recharts')
  })

  it('selects lucide when prompt mentions icons', () => {
    const result = selectCapabilities('A settings page with icons')
    expect(result).toContain('lucide')
  })

  it('selects daisyui when prompt mentions daisy', () => {
    const result = selectCapabilities('A page using daisyui components')
    expect(result).toContain('daisyui')
  })

  it('selects magicui when prompt mentions marquee', () => {
    const result = selectCapabilities('A landing page with a marquee')
    expect(result).toContain('magicui')
  })

  it('pulls motion dependency when magicui is selected', () => {
    const result = selectCapabilities('A page with a marquee component')
    expect(result).toContain('magicui')
    expect(result).toContain('motion')
  })

  it('selects multiple capabilities from a rich prompt', () => {
    const result = selectCapabilities('An animated dashboard with charts and icons')
    expect(result).toContain('motion')
    expect(result).toContain('recharts')
    expect(result).toContain('lucide')
  })

  it('reads keywords from design markdown', () => {
    const result = selectCapabilities('A simple page', '# Design System\n- Uses animation and motion effects')
    expect(result).toContain('motion')
  })

  it('is case-insensitive', () => {
    expect(selectCapabilities('A CHART with ANIMATION')).toContain('recharts')
    expect(selectCapabilities('A CHART with ANIMATION')).toContain('motion')
  })
})

describe('resolveCapabilities', () => {
  it('resolves dependencies for magicui', () => {
    const caps = resolveCapabilities(['magicui'])
    expect(caps.map((c) => c.id)).toContain('magicui')
    expect(caps.map((c) => c.id)).toContain('motion')
  })

  it('returns empty array for empty input', () => {
    expect(resolveCapabilities([])).toEqual([])
  })

  it('returns capabilities in order', () => {
    const caps = resolveCapabilities(['recharts', 'motion'])
    expect(caps).toHaveLength(2)
    expect(caps.map((c) => c.id)).toContain('recharts')
    expect(caps.map((c) => c.id)).toContain('motion')
  })
})