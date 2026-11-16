import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { brandByName, brandMuseLine, brandOfProject, brandSection, brandsOfDesign, defaultBrandId, hasBrand, newBrandId, normalizeBrand } from './brand'

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
    const s = brandSection(brand, (h) => `https://mocky.test/api/images/${h}`)
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
    const { loadBrands, loadDesign, saveBrand, saveDesign } = await import('./design')
    const stale = loadDesign()
    saveBrand(normalizeBrand({ id: 'main', name: 'Martin', updatedAt: 1 })!)
    saveDesign({ ...stale, markdown: '# Direction' })
    expect(loadBrands().map((b) => b.name)).toEqual(['Martin'])
    expect(loadDesign().markdown).toBe('# Direction')
    const withBrand = loadDesign()
    saveBrand(null, 'main')
    saveDesign(withBrand)
    expect(loadBrands()).toEqual([])
  })

  it('reads the single brand of before as the first of the list, and writes a list back', async () => {
    const { loadBrands, loadDesign, saveBrand } = await import('./design')
    store.set('mocky.design.v1', JSON.stringify({ markdown: '', enabled: true, brand: { name: 'Elisa30', updatedAt: 1 } }))
    expect(loadBrands().map((b) => [b.id, b.name])).toEqual([['main', 'Elisa30']])
    saveBrand(normalizeBrand({ id: 'chez', name: 'Chez Elisa30' })!)
    expect(loadBrands().map((b) => b.name)).toEqual(['Elisa30', 'Chez Elisa30'])
    expect(loadDesign().brand).toBeUndefined()
    // Saving one again replaces it in place.
    saveBrand(normalizeBrand({ id: 'main', name: 'ESAT Elisa30' })!)
    expect(loadBrands().map((b) => b.name)).toEqual(['ESAT Elisa30', 'Chez Elisa30'])
  })
})

describe('several brands', () => {
  const main = normalizeBrand({ id: 'main', name: 'Elisa30' })!
  const chez = normalizeBrand({ id: 'chez', name: 'Chez Elisa30' })!
  const brands = [main, chez]

  it('gives a project its own brand, the main one when it names none, and NONE when its brand was deleted', () => {
    expect(brandOfProject({ useBrand: true, brandId: 'chez' }, brands)).toBe(chez)
    expect(brandOfProject({ useBrand: true }, brands)).toBe(main)
    expect(brandOfProject({ useBrand: false, brandId: 'chez' }, brands)).toBeUndefined()
    expect(brandOfProject({ useBrand: true, brandId: 'gone' }, brands)).toBeUndefined()
    // Removing the main brand does not move a project from before to another client.
    expect(brandOfProject({ useBrand: true }, [chez])).toBeUndefined()
  })

  it('chooses a default for a project being switched on', () => {
    expect(defaultBrandId({ brandId: 'chez' }, brands)).toBe('chez')
    expect(defaultBrandId({ brandId: 'gone' }, brands)).toBe('main')
    expect(defaultBrandId({}, [chez])).toBe('chez')
    expect(defaultBrandId({}, [])).toBeUndefined()
  })

  it('finds a brand by the name a person says, accents and case aside', () => {
    expect(brandByName(brands, 'chez elisa30')).toBe(chez)
    expect(brandByName(brands, 'ELISA30')).toBe(main)
    expect(brandByName(brands, 'Kosmy')).toBeUndefined()
  })

  it('makes ids unique, and names the first brand main', () => {
    const list = brandsOfDesign({ brands: [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }, { name: '' }] })
    expect(list.map((b) => b.id)).toEqual(['x', 'x-2'])
    expect(newBrandId([])).toBe('main')
    expect(newBrandId(brands)).not.toBe('main')
  })

  it('keeps the rules line by line and the pictures as library hashes, and gives both to the model', () => {
    const b = normalizeBrand({
      name: 'Chez Elisa30',
      rules: '  Assiette entièrement visible \n\n Aucun visage\r\n',
      media: [LOGO, 'nope', LOGO, 'b'.repeat(64)],
    })!
    expect(b.rules).toBe('Assiette entièrement visible\nAucun visage')
    expect(b.media).toEqual([LOGO, 'b'.repeat(64)])
    const s = brandSection(b, (h) => `https://mocky.test/api/images/${h}`)
    expect(s).toContain('- Aucun visage')
    expect(s).toContain(`https://mocky.test/api/images/${'b'.repeat(64)}`)
    expect(brandMuseLine(b)).toContain('Brand rules: Assiette entièrement visible; Aucun visage.')
    // No absolute addresses, no pictures offered.
    expect(brandSection(b)).not.toContain('/api/images/')
  })
})
