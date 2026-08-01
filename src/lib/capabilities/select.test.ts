import { describe, it, expect } from 'vitest'
import { selectCapabilities, resolveCapabilities } from './select'

describe('selectCapabilities', () => {
  it('returns only baseline (icons) for a prompt with no matching keywords', () => {
    expect(selectCapabilities('A simple login screen')).toEqual(['icons'])
  })

  it('selects motion when prompt mentions animation', () => {
    const result = selectCapabilities('A page with smooth animation and transitions')
    expect(result).toContain('animate')
  })

  it('selects charts when prompt mentions chart', () => {
    const result = selectCapabilities('An analytics dashboard with a bar chart')
    expect(result).toContain('charts')
  })

  it('does not add a CDN script for an icons prompt (icons come from the baseline pack)', () => {
    // Icons are served by the baseline inline-SVG `icons` pack, so an icons
    // prompt must not pull in any extra (e.g. CDN) capability.
    expect(selectCapabilities('A settings page with icons')).toEqual(['icons'])
  })

  it('selects daisyui when prompt mentions daisy', () => {
    const result = selectCapabilities('A page using daisyui components')
    expect(result).toContain('daisyui')
  })

  it('selects motion when prompt mentions marquee', () => {
    const result = selectCapabilities('A landing page with a marquee')
    expect(result).toContain('animate')
  })

  it('does not select magicui (removed, merged into motion)', () => {
    const result = selectCapabilities('A page with a marquee component')
    expect(result).not.toContain('magicui')
  })

  it('selects multiple capabilities from a rich prompt', () => {
    const result = selectCapabilities('An animated dashboard with charts and icons')
    expect(result).toContain('animate')
    expect(result).toContain('charts')
    expect(result).toContain('icons')
  })

  it('reads keywords from design markdown', () => {
    const result = selectCapabilities('A simple page', '# Design System\n- Uses animation and motion effects')
    expect(result).toContain('animate')
  })

  it('is case-insensitive', () => {
    expect(selectCapabilities('A CHART with ANIMATION')).toContain('charts')
    expect(selectCapabilities('A CHART with ANIMATION')).toContain('animate')
  })
})

describe('resolveCapabilities', () => {
  it('returns empty array for empty input', () => {
    expect(resolveCapabilities([])).toEqual([])
  })

  it('returns capabilities in order', () => {
    const caps = resolveCapabilities(['charts', 'motion'])
    expect(caps).toHaveLength(2)
    expect(caps.map((c) => c.id)).toContain('charts')
    expect(caps.map((c) => c.id)).toContain('motion')
  })

  it('still resolves the retired motion pack, so old screens keep rendering', () => {
    // `Screen.caps` is persisted. A screen generated before <Animated> existed
    // asks for 'motion' at load time; if that stopped resolving, its FadeIn and
    // BentoGrid would be undefined and the screen would throw on render.
    const caps = resolveCapabilities(['motion'])
    expect(caps.map((c) => c.id)).toEqual(['motion'])
    expect(caps[0].snippets?.length).toBeGreaterThan(0)
  })

  it('never offers the retired pack to a new generation', () => {
    for (const prompt of ['an animated landing page', 'a hero with a marquee', 'bento grid with meteors']) {
      expect(selectCapabilities(prompt), prompt).not.toContain('motion')
    }
  })

  it('pulls Motion in whenever the animation vocabulary is selected', () => {
    // <Animated> without the library is a plain <div>; the dependency is what
    // makes the presets mean anything.
    const ids = selectCapabilities('an animated landing page')
    expect(ids).toContain('animate')
    expect(ids).toContain('motion-lib')
  })
})