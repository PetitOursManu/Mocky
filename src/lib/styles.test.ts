import { describe, it, expect } from 'vitest'
import { STYLE_PRESETS, presetVariant, isDarkColor, type ThemeMode } from './styles'

describe('presetVariant', () => {
  it("'auto' returns each preset unchanged", () => {
    for (const p of STYLE_PRESETS) {
      const v = presetVariant(p, 'auto')
      expect(v.markdown).toBe(p.markdown)
      expect(v.preview).toEqual(p.preview)
    }
  })

  it("forces a light background for every preset in 'light' mode", () => {
    for (const p of STYLE_PRESETS) {
      const v = presetVariant(p, 'light')
      expect(isDarkColor(v.preview.bg), `${p.id} light bg should be light`).toBe(false)
    }
  })

  it("forces a dark background for every preset in 'dark' mode", () => {
    for (const p of STYLE_PRESETS) {
      const v = presetVariant(p, 'dark')
      expect(isDarkColor(v.preview.bg), `${p.id} dark bg should be dark`).toBe(true)
    }
  })

  it('keeps the accent color across variants', () => {
    for (const p of STYLE_PRESETS) {
      expect(presetVariant(p, 'light').preview.accent).toBe(p.preview.accent)
      expect(presetVariant(p, 'dark').preview.accent).toBe(p.preview.accent)
    }
  })

  it('appends a Theme mode directive only on the derived (opposite) variant', () => {
    for (const p of STYLE_PRESETS) {
      const naturallyDark = isDarkColor(p.preview.bg)
      const opposite: ThemeMode = naturallyDark ? 'light' : 'dark'
      const same: ThemeMode = naturallyDark ? 'dark' : 'light'
      expect(presetVariant(p, opposite).markdown).toContain('## Theme mode')
      // same-as-natural mode returns the original (no directive added)
      expect(presetVariant(p, same).markdown).toBe(p.markdown)
    }
  })

  it('never throws and always returns a non-empty markdown', () => {
    for (const p of STYLE_PRESETS) {
      for (const m of ['auto', 'light', 'dark'] as ThemeMode[]) {
        expect(() => presetVariant(p, m)).not.toThrow()
        expect(presetVariant(p, m).markdown.length).toBeGreaterThan(0)
      }
    }
  })
})
