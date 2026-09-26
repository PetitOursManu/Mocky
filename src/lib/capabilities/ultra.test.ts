import { describe, it, expect } from 'vitest'
import * as Babel from '@babel/standalone'
import { CAPABILITIES } from './registry'
import { capabilitiesUsedBy, resolveCapabilities } from './select'
import { ULTRA_CLASSES, ULTRA_CSS, UltraSource, BACKDROP_PRESETS, ULTRA_EXPORTS } from './snippets/Ultra'

const cap = (id: string) => CAPABILITIES.find((c) => c.id === id)

/**
 * The Ultra kit, held to the list the model is shown.
 *
 * A class the prompt offers and the stylesheet does not define is a screen
 * whose frosted card is a plain box and nobody is told — the silent version of
 * the failure every closed vocabulary in this directory exists to prevent.
 */
describe('the Ultra kit', () => {
  it('defines every class it offers, and offers every class it defines', () => {
    for (const cls of Object.keys(ULTRA_CLASSES)) {
      expect(ULTRA_CSS, cls).toMatch(new RegExp(`\\.${cls}(?![\\w-])`))
    }
    const defined = new Set(
      [...ULTRA_CSS.matchAll(/\.(u-[a-z0-9-]+)/g)]
        .map((m) => m[1])
        // Internal to <Backdrop> and to the hold-still switches, never offered.
        .filter((c) => !/^u-(backdrop|blob|tone|grain-layer|still|capture)/.test(c)),
    )
    expect([...defined].sort()).toEqual(Object.keys(ULTRA_CLASSES).sort())
  })

  it('computes no colour — html2canvas throws on color-mix(), and a capture that throws is a blank thumbnail', () => {
    expect(ULTRA_CSS).not.toMatch(/color-mix|oklch|oklab|lab\(|lch\(/)
  })

  /**
   * An entrance must REST visible whenever motion is held: under reduced motion,
   * under "Sans animation", and in the capture shell. A scroll-driven reveal is
   * the dangerous one — a duration the preview collapses does not exist for it.
   */
  it('holds every loop still and every entrance at its final state when motion is off', () => {
    expect(ULTRA_CSS).toMatch(/\.u-still \.u-reveal[^{]*\{animation:none!important;opacity:1!important/)
    expect(ULTRA_CSS).toMatch(/prefers-reduced-motion: reduce\)\{.*?\}\.u-reveal[^{]*\{animation:none!important;opacity:1!important/)
    // Scroll-driven motion only where the browser has it — never a fallback at opacity 0.
    expect(ULTRA_CSS).toMatch(/@supports \(animation-timeline: view\(\)\)\{\n\.u-reveal\{/)
  })

  it('draws every backdrop preset the card offers', () => {
    const card = cap('ultra')?.components?.[0]?.description ?? ''
    for (const preset of BACKDROP_PRESETS) {
      expect(card, preset).toContain(`"${preset}"`)
      expect(ULTRA_CSS, preset).toContain(preset === 'aurora' ? '.u-blob-1' : `.u-backdrop-${preset} `)
    }
  })

  it('compiles, and is a force-added pack that brings <Animated> with it', () => {
    expect(() => Babel.transform(UltraSource, { presets: [['react', { runtime: 'classic' }]] })).not.toThrow()
    const ultra = cap('ultra')
    expect(ultra?.kind).toBe('snippet-pack')
    expect(ultra?.triggers).toEqual({ keywords: [], intents: [] })
    expect(ultra?.snippets?.[0].exports).toEqual([...ULTRA_EXPORTS])
    expect(resolveCapabilities(['ultra']).map((c) => c.id)).toEqual(expect.arrayContaining(['ultra', 'animate', 'motion-lib']))
  })

  /** The reason `Capability.classes` exists — see its comment. */
  it('is recognised in a screen that uses its classes without its component', () => {
    expect(capabilitiesUsedBy('<div className="u-glass rounded-2xl p-6">')).toContain('ultra')
    expect(capabilitiesUsedBy('<h1 className={"u-display"}>')).toContain('ultra')
    expect(capabilitiesUsedBy('<Backdrop preset="mesh" />')).toContain('ultra')
    expect(capabilitiesUsedBy('<div className="menu-glass u-glassy">')).not.toContain('ultra')
  })
})
