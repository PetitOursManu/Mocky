import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { brandMuseLine, brandSection, hasBrand, normalizeBrand } from './brand'

const LOGO = 'a'.repeat(64)

describe('normalizeBrand', () => {
  it('keeps what can be written into a prompt safely, and drops the rest', () => {
    const b = normalizeBrand({
      name: '  Boulangerie   Martin ',
      colors: { primary: '#C2410C', secondary: 'red', accent: '#fff', text: 'url(x)' },
      fonts: { heading: 'playfair display', body: 'Comic Sans MS' },
      logo: { hash: LOGO, w: 400, h: 120 },
      website: 'https://martin.fr',
      updatedAt: 5,
    })!
    expect(b.name).toBe('Boulangerie Martin')
    expect(b.colors).toEqual({ primary: '#c2410c', accent: '#fff' })
    // A catalogue name, in the catalogue's own spelling; anything else is not kept.
    expect(b.fonts).toEqual({ heading: 'Playfair Display', body: undefined })
    expect(b.logo).toEqual({ hash: LOGO, w: 400, h: 120 })
    expect(b.website).toBe('https://martin.fr')
  })

  it('is no brand without a name or a logo, and refuses a logo that is not a library hash', () => {
    expect(normalizeBrand({ name: '', colors: { primary: '#000' } })).toBeUndefined()
    expect(normalizeBrand({ name: '', logo: { hash: '../../etc' } })).toBeUndefined()
    expect(hasBrand(normalizeBrand({ logo: { hash: LOGO } }))).toBe(true)
    expect(normalizeBrand('x')).toBeUndefined()
  })
})

describe('brandSection', () => {
  const brand = normalizeBrand({
    name: 'Martin',
    tagline: 'Le pain comme autrefois',
    colors: { primary: '#c2410c' },
    fonts: { heading: 'Playfair Display' },
    tone: 'chaleureux',
    logo: { hash: LOGO, w: 400, h: 100 },
  })!

  it('fences what the owner typed as data, and says the brand wins over the direction', () => {
    const s = brandSection(brand, `https://mocky.test/api/images/${LOGO}`)
    expect(s).toMatch(/THE BRAND WINS/)
    expect(s).toContain('<<<BRAND\nName: Martin')
    expect(s).toContain('BRAND>>>')
    expect(s).toContain(`<img src="https://mocky.test/api/images/${LOGO}"`)
    expect(s).toMatch(/Never redraw it/)
    expect(s).toContain('ratio 4.00')
    expect(s).toContain("font-['Family_Name']")
  })

  it('asks for a wordmark when there is no logo file', () => {
    const s = brandSection({ ...brand, logo: undefined })
    expect(s).not.toContain('<img')
    expect(s).toMatch(/clean wordmark/)
  })

  it('tells Muse what to keep', () => {
    const line = brandMuseLine(brand)
    expect(line).toContain('Brand: Martin — Le pain comme autrefois.')
    expect(line).toContain('primary #c2410c')
    expect(line).toContain('do not invent one')
  })
})

describe('the brand in the design blob', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
  })
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('is written by saveBrand only: a stale copy of the design saved later keeps it, or keeps it gone', async () => {
    const { loadBrand, loadDesign, saveBrand, saveDesign } = await import('./design')
    const stale = loadDesign()
    saveBrand(normalizeBrand({ name: 'Martin', updatedAt: 1 })!)
    saveDesign({ ...stale, markdown: '# Direction' })
    expect(loadBrand()?.name).toBe('Martin')
    expect(loadDesign().markdown).toBe('# Direction')
    const withBrand = loadDesign()
    saveBrand(null)
    saveDesign(withBrand)
    expect(loadBrand()).toBeUndefined()
  })
})
