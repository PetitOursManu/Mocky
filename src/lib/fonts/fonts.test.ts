import { describe, it, expect } from 'vitest'
import {
  FONT_FAMILIES,
  FONT_CATEGORIES,
  FONTS_PROMPT,
  fontsNamedIn,
  fontFaceCss,
  fontFaceCssFor,
  findFontIn,
  fontByName,
  specimenFamily,
} from './index'

const names = (code: string) => fontsNamedIn(code).map((f) => f.family)

describe('which families a screen names', () => {
  it('reads the Tailwind arbitrary class, quoted or not, with underscores', () => {
    expect(names(`<h1 className="font-['Playfair_Display',serif] text-5xl">Hi</h1>`)).toEqual(['Playfair Display'])
    expect(names(`<h1 className="font-[Bebas_Neue]">Hi</h1>`)).toEqual(['Bebas Neue'])
    expect(names(`<h1 className='font-["Space_Grotesk"]'>Hi</h1>`)).toEqual(['Space Grotesk'])
  })

  it('reads an inline style and a stack kept in a constant', () => {
    expect(names(`<p style={{ fontFamily: "'Source Serif 4', serif" }}>x</p>`)).toEqual(['Source Serif 4'])
    expect(names(`const display = "'Fraunces', serif"; <h1 style={{ fontFamily: display }} />`)).toEqual(['Fraunces'])
  })

  it('is case-insensitive', () => {
    expect(names(`font-family: playfair display;`)).toEqual(['Playfair Display'])
  })

  it('never matches inside a longer word', () => {
    // "Inter" is a family; "Interstate", "International" and "winter" are not.
    expect(names(`<p>Interstate, International, winter</p>`)).toEqual([])
    expect(names(`<p>Ryeland, Anthem, Coolio</p>`)).toEqual([])
  })

  it('tells a family from its longer sibling, and declares both when both are named', () => {
    expect(names(`font-['Inter_Tight']`)).toEqual(['Inter Tight'])
    expect(names(`font-['Inter_Tight'] <p style={{ fontFamily: 'Inter Tight' }} />`)).toEqual(['Inter Tight'])
    expect(names(`font-['Cormorant_Garamond']`)).toEqual(['Cormorant Garamond'])
    expect(names(`font-['Inter_Tight'] font-['Inter']`).sort()).toEqual(['Inter', 'Inter Tight'])
  })

  it('names nothing in a screen that names no family', () => {
    expect(fontsNamedIn('export default function A(){ return <div className="font-sans" /> }')).toEqual([])
    expect(fontFaceCssFor('export default function A(){ return <div /> }')).toBe('')
  })
})

describe('the @font-face rules', () => {
  const bebas = fontByName('Bebas Neue')!

  it('declares each subset with its unicode-range, from /fonts, blocking', () => {
    const css = fontFaceCss([bebas], 'http://mocky.test')
    const rules = css.split('\n')
    expect(rules.length).toBe(bebas.faces.length * 2)
    for (const r of rules) {
      expect(r).toMatch(/^@font-face\{font-family:'Bebas Neue';/)
      expect(r).toContain('font-display:block')
      expect(r).toMatch(/src:url\(http:\/\/mocky\.test\/fonts\/bebas-neue\/[a-z0-9-]+\.[0-9a-f]{10}\.woff2\) format\('woff2'\)/)
      expect(r).toMatch(/unicode-range:U\+/)
    }
  })

  it('declares a single-weight face across every weight, so bold is not faked', () => {
    expect(bebas.faces).toHaveLength(1)
    expect(fontFaceCss([bebas])).toContain('font-weight:100 900')
  })

  it('can rename a family, for Mocky\'s own document', () => {
    const inter = fontByName('Inter')!
    const css = fontFaceCss([inter], '', specimenFamily)
    expect(css).toContain(`font-family:'Mocky Specimen Inter'`)
    expect(css).not.toContain(`font-family:'Inter'`)
  })

  it('only ever writes what a CSP-bound <style> can carry: no quote can close the family', () => {
    for (const f of FONT_FAMILIES) {
      expect(f.family).toMatch(/^[A-Za-z0-9 ]+$/)
      for (const face of f.faces) for (const file of Object.values(face.files)) expect(file).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+\.woff2$/)
    }
  })
})

describe('reading a direction\'s typography line', () => {
  it('finds the family in free prose, longest name first', () => {
    expect(findFontIn('Playfair Display (high-contrast serif)')?.family).toBe('Playfair Display')
    expect(findFontIn('Inter Tight, 600')?.family).toBe('Inter Tight')
    expect(findFontIn('Serif display (Playfair/Freight)')).toBeUndefined()
    // The line's own order is its preference, whatever the names' lengths.
    expect(findFontIn('Lora / Inter, serif headings')?.family).toBe('Lora')
    expect(findFontIn('')).toBeUndefined()
  })
})

describe('what the model is told', () => {
  it('lists every family once, under every category', () => {
    for (const f of FONT_FAMILIES) expect(FONTS_PROMPT).toContain(f.family)
    expect(FONTS_PROMPT.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(FONT_CATEGORIES.length)
  })

  it('shows the two spellings the scan is sure to read', () => {
    const example = FONTS_PROMPT.match(/font-\['([A-Za-z_]+)',serif\]/)
    expect(example).not.toBeNull()
    expect(names(example![0])).toEqual(['Playfair Display'])
    expect(names(`fontFamily: "'Playfair Display', serif"`)).toEqual(['Playfair Display'])
  })

  it('stays compact — it is paid on every generation', () => {
    // ~4 characters a token: a ceiling, so a list that doubles is a decision.
    expect(FONTS_PROMPT.length).toBeLessThan(5200)
  })
})
