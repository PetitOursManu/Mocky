import { describe, expect, it } from 'vitest'
import { VISUAL_BOUNDS, VISUAL_FAMILIES, VISUAL_VARIANTS, VISUALS_CAP, VISUAL_THEME, accepts, familyRefusal, requestAsksForVisual, screenDrawsVisuals, VISUAL_ASKED_SECTION, VISUAL_CREATIVE_SECTION, VISUAL_LOOKS, creativeLookFor } from './families'
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

describe('a diagram asked for in words', () => {
  it('is heard in French and English', () => {
    for (const ask of [
      'Ajoute une seconde version du premier écran mais qui utilise des schemas',
      'un flyer avec un schéma des étapes', 'mets les chiffres dans des graphiques', 'une infographie sur le tri',
      'a poster with a diagram of the process', 'add a chart of the sales', 'une frise chronologique', 'notre feuille de route 2027',
      "l'organigramme de l'équipe",
    ]) expect(requestAsksForVisual(ask), ask).toBe(true)
  })
  it('is not heard in a style word', () => {
    for (const plain of [
      'un flyer très graphique et coloré', 'respecte la charte graphique', 'un poster au style graphique suisse',
      'a graphic, bold poster', 'un menu pour une pizzeria',
    ]) expect(requestAsksForVisual(plain), plain).toBe(false)
  })
  it('adds the kit to a document that asks, never to an app screen', () => {
    expect(screenDrawsVisuals('flyer', true, 'avec un schéma')).toBe(true)
    expect(screenDrawsVisuals('flyer', true, 'pour un concert')).toBe(false)
    expect(screenDrawsVisuals('instagram', true, 'pour un concert')).toBe(true)
    expect(screenDrawsVisuals('dashboard', false, 'avec un schéma')).toBe(false)
  })
})

describe('the section a document gets when the request asks for diagrams', () => {
  /**
   * A festival flyer "with diagrams" came back with every fact written as text
   * and a strip at the foot drawing three of its slogans again.
   */
  it('makes the facts the diagrams’ content, never a repeat, never a strip', () => {
    expect(VISUAL_ASKED_SECTION).toMatch(/do NOT also write them out/)
    expect(VISUAL_ASKED_SECTION).toMatch(/never repeats what the page already says/)
    expect(VISUAL_ASKED_SECTION).toMatch(/never a strip/)
    expect(VISUAL_ASKED_SECTION).toMatch(/colors/)
  })
})

describe('Créatif diagrams', () => {
  it('asks for an expressive family and a look that is not flat, facts unchanged', () => {
    expect(VISUAL_CREATIVE_SECTION).toMatch(/most expressive/)
    expect(VISUAL_CREATIVE_SECTION).toMatch(/Never the flat look/)
    expect(VISUAL_CREATIVE_SECTION).toMatch(/never in facts/)
    // Every look it names is one the kit draws.
    for (const look of ['block', 'raised', 'gradient', 'glass', 'neon']) expect(VISUAL_LOOKS).toContain(look)
  })

  it('picks glass on a dark ground and faces on a light one', () => {
    expect(creativeLookFor('#0b0d12')).toBe('glass')
    expect(creativeLookFor('#FFF3D6')).toBe('block')
    expect(creativeLookFor(null)).toBe('block')
    expect(creativeLookFor('red')).toBe('block')
  })
})
