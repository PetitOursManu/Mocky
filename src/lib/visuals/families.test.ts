import { describe, expect, it } from 'vitest'
import { VISUAL_BOUNDS, VISUAL_FAMILIES, VISUAL_VARIANTS, VISUALS_CAP, VISUAL_THEME, accepts, familyRefusal } from './families'
import { CAPABILITY_MAP } from '../capabilities/registry'
import { capabilitiesUsedBy } from '../capabilities/select'
import { getScreenTheme } from '../screenThemes'
import { partsEn, partsFr } from '../../i18n/parts'

describe('the visual families', () => {
  it('bound every family sensibly', () => {
    for (const f of VISUAL_FAMILIES) {
      const b = VISUAL_BOUNDS[f]
      // A pictogram may make ONE proportion its whole point.
      expect(b.min, f).toBeGreaterThanOrEqual(f === 'pictogram' ? 1 : 2)
      expect(b.max, f).toBeGreaterThanOrEqual(b.min)
      if (b.exact) expect(b.max, f).toBe(b.min)
    }
  })

  it('name and describe every family and variant in both languages', () => {
    for (const dict of [partsFr, partsEn]) {
      for (const f of VISUAL_FAMILIES) {
        expect(dict[`visuals.family.${f}`], f).toBeTruthy()
        expect(dict[`visuals.family.${f}.desc`], f).toBeTruthy()
      }
      for (const v of VISUAL_VARIANTS) expect(dict[`visuals.variant.${v}`], v).toBeTruthy()
    }
  })

  it('say why a family refuses a content, and every refusal can happen', () => {
    const two = { items: [{ label: 'a' }, { label: 'b' }] }
    expect(familyRefusal('cycle', two)).toEqual({ reason: 'tooFew', n: 3 })
    expect(familyRefusal('matrix', two)).toEqual({ reason: 'exact', n: 4 })
    expect(familyRefusal('bars', two)).toEqual({ reason: 'values', n: 0 })
    expect(familyRefusal('comparison', two)).toEqual({ reason: 'children', n: 0 })
    expect(familyRefusal('pros-cons', { items: [{ label: 'a', children: ['x'] }, { label: 'b', children: ['y'] }] })).toBeNull()
    expect(familyRefusal('donut', { items: Array.from({ length: 9 }, (_, i) => ({ label: `${i}`, value: i })) })).toEqual({ reason: 'tooMany', n: 6 })
    expect(accepts('steps', two)).toBe(true)
  })
})

describe('the Visual pack and the Visual screen type', () => {
  it('offer every family, with its bound, on the model’s card', () => {
    const card = CAPABILITY_MAP[VISUALS_CAP].components!.find((c) => c.name === 'Visual')!.description
    for (const f of VISUAL_FAMILIES) expect(card, f).toContain(`"${f}"`)
  })

  it('is never inferred from a screen’s code: a model’s own `Visual` must not load it', () => {
    expect(capabilitiesUsedBy('const Visual = () => <div/>; export default () => <Visual />')).not.toContain(VISUALS_CAP)
  })

  it('makes a visual a document, on a slide by default', () => {
    const theme = getScreenTheme(VISUAL_THEME)
    expect(theme?.document?.page).toBe('slides')
    expect(theme?.brief).toContain('<Visual>')
  })
})
