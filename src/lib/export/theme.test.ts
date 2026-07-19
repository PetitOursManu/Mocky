import { describe, it, expect } from 'vitest'
import { STYLE_PRESETS } from '../styles'
import {
  parseDesignTokens,
  buildGlobalsCss,
  globalsCssFromDesign,
  hexToHslTriplet,
  DEFAULT_TOKENS,
} from './theme'

const HSL = /^\d{1,3} \d{1,3}% \d{1,3}%$/
/** Extract a `--primary: <value>;` from a globals.css string. */
function primaryOf(css: string): string | null {
  const m = /--primary:\s*([^;]+);/.exec(css)
  return m ? m[1].trim() : null
}

describe('theme: hexToHslTriplet', () => {
  it('converts known colors', () => {
    expect(hexToHslTriplet('#ffffff')).toBe('0 0% 100%')
    expect(hexToHslTriplet('#000000')).toBe('0 0% 0%')
    expect(hexToHslTriplet('#4f46e5')).toMatch(HSL)
  })
  it('tolerates shorthand and alpha', () => {
    expect(hexToHslTriplet('#fff')).toBe('0 0% 100%')
    expect(hexToHslTriplet('#4f46e5ff')).toMatch(HSL)
  })
})

describe('theme: parseDesignTokens is tolerant', () => {
  it('falls back to defaults for empty / garbage input', () => {
    expect(parseDesignTokens('')).toEqual(DEFAULT_TOKENS)
    expect(parseDesignTokens('no colors here at all')).toEqual(DEFAULT_TOKENS)
    expect(() => parseDesignTokens(undefined)).not.toThrow()
  })
  it('reads a "- Primary: #hex (name)" line case-insensitively', () => {
    expect(parseDesignTokens('- PRIMARY: #123abc (whatever)').primary).toBe('#123abc')
    expect(parseDesignTokens('* accent — #abcdef').primary).toBe('#abcdef')
  })
})

// The real acceptance criterion: every built-in preset must yield a valid
// --primary in the emitted globals.css, and must never throw.
describe('theme: every built-in style preset produces a valid --primary', () => {
  it('has 17 presets', () => {
    expect(STYLE_PRESETS.length).toBe(17)
  })
  for (const preset of STYLE_PRESETS) {
    it(`preset "${preset.id}" → valid --primary`, () => {
      let css = ''
      expect(() => {
        css = globalsCssFromDesign(preset.markdown)
      }).not.toThrow()
      const primary = primaryOf(css)
      expect(primary, `no --primary emitted for ${preset.id}`).not.toBeNull()
      expect(primary, `--primary not a valid HSL triplet for ${preset.id}`).toMatch(HSL)
      // sanity: light + dark blocks both present
      expect(css).toContain(':root {')
      expect(css).toContain('.dark {')
    })
  }
})

describe('theme: buildGlobalsCss shape', () => {
  it('emits all required shadcn tokens', () => {
    const css = buildGlobalsCss(DEFAULT_TOKENS)
    for (const v of [
      '--background', '--foreground', '--card', '--primary', '--primary-foreground',
      '--muted', '--muted-foreground', '--border', '--ring', '--radius',
    ]) {
      expect(css, `missing ${v}`).toContain(v)
    }
  })
})
