import { describe, expect, it } from 'vitest'
import {
  MAX_SHEETS,
  MAX_SHEET_PAGES,
  MAX_TOTAL_PAGES,
  addInsideSheet,
  boundSheets,
  latestPublication,
  shapePlan,
  fallbackSheets,
  firstPages,
  normalizePublication,
  normalizeScreenPublication,
  parsePlan,
  publicationSection,
  totalPages,
  upsertPublication,
  type Publication,
} from './publication'

const PUB: Publication = {
  id: 'pub-1',
  kind: 'book',
  title: 'Neige sur Fourvière',
  brief: 'Un court roman policier à Lyon en hiver',
  page: 'a5',
  sheets: [
    { id: 's1', title: 'Couverture', role: 'cover', pages: 1, brief: '' },
    { id: 's2', title: 'Pages de titre', role: 'front matter', pages: 4, brief: '' },
    { id: 's3', title: 'Chapitre 1', role: 'chapter', pages: 5, brief: 'Le corps sur les quais' },
  ],
  createdAt: 1,
}

describe('the plan', () => {
  it('is bounded rather than trusted', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `S${i}`, role: 'section', pages: 99, brief: 'x' }))
    const sheets = boundSheets(many)
    expect(sheets.length).toBeLessThanOrEqual(MAX_SHEETS)
    expect(sheets.every((s) => s.pages >= 1 && s.pages <= MAX_SHEET_PAGES)).toBe(true)
    expect(totalPages(sheets)).toBeLessThanOrEqual(MAX_TOTAL_PAGES)
    expect(boundSheets([{ title: '' }, null, 'x', { title: 'Ok', pages: -3 }])).toEqual([
      { id: 's1', title: 'Ok', role: 'section', pages: 1, brief: '' },
    ])
    expect(boundSheets('nope')).toEqual([])
  })

  it('reads the model\'s JSON, fenced or not, and refuses a plan of one sheet', () => {
    const p = parsePlan('Voici :\n```json\n{"title":"Lent","sheets":[{"title":"Couverture","role":"cover","pages":1},{"title":"Açores","role":"feature","pages":4,"brief":"Le grand reportage"}]}\n```')
    expect(p?.title).toBe('Lent')
    expect(p?.sheets.map((s) => s.pages)).toEqual([1, 4])
    expect(parsePlan('{"sheets":[{"title":"Seule"}]}')).toBeNull()
    expect(parsePlan('pas de json')).toBeNull()
  })

  it('falls back on a sensible shape per kind, cover first', () => {
    for (const kind of ['magazine', 'book'] as const) {
      const sheets = fallbackSheets(kind)
      expect(sheets[0].role).toBe('cover')
      expect(sheets[0].pages).toBe(1)
      expect(sheets.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('numbers the pages: the cover is page 1 and each sheet follows the last', () => {
    expect(firstPages(PUB.sheets)).toEqual([1, 2, 6])
    expect(totalPages(PUB.sheets)).toBe(10)
  })
})

describe('a sheet\'s place in the prompt', () => {
  it('says which pages it holds, how many to write, and the whole table of contents', () => {
    const s = publicationSection(PUB, 2)
    expect(s).toContain('sheet 3 of 3 of the book "Neige sur Fourvière", 10 pages in all')
    expect(s).toContain('It holds pages 6 to 10: write exactly 5 <Page>s.')
    expect(s).toContain('Le corps sur les quais')
    expect(s).toMatch(/even numbers on left-hand pages/)
    expect(s).toContain('→ pages 6–10: Chapitre 1 (chapter)')
    expect(s).toContain('<<<BRIEF\nUn court roman policier')
  })

  it('keeps folio and running head off the cover', () => {
    const s = publicationSection(PUB, 0)
    expect(s).toContain('It is the front cover: no folio')
    expect(s).toContain('write exactly 1 <Page>.')
  })
})

describe('storage', () => {
  it('keeps a publication whole, sheet ids included, and drops a broken one', () => {
    expect(normalizePublication({ ...PUB, direction: '# Direction' })).toEqual({ ...PUB, direction: '# Direction' })
    expect(normalizePublication({ ...PUB, kind: 'zine' })).toBeUndefined()
    expect(normalizePublication({ ...PUB, page: 'b5' })).toBeUndefined()
    expect(normalizePublication({ ...PUB, sheets: [] })).toBeUndefined()
    expect(normalizePublication({ ...PUB, direction: '   ' })?.direction).toBeUndefined()
  })

  it('reads a screen\'s place back, or nothing', () => {
    expect(normalizeScreenPublication({ id: 'pub-1', sheet: 's3', index: 2, firstPage: 6 })).toEqual({ id: 'pub-1', sheet: 's3', index: 2, firstPage: 6 })
    expect(normalizeScreenPublication({ id: 'pub-1', sheet: 's3', index: -1, firstPage: 6 })).toBeUndefined()
    expect(normalizeScreenPublication('x')).toBeUndefined()
  })

  it('replaces a publication by id', () => {
    const list = upsertPublication([PUB], { ...PUB, title: 'Autre' })
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Autre')
  })
})

describe('a publication starts small and grows one page at a time', () => {
  it('fits any plan onto four one-page sheets: covers outside, two inside pages between', () => {
    const planned = boundSheets([
      { title: 'Sommaire', role: 'contents', pages: 3 },
      { title: 'Couv', role: 'cover', pages: 2 },
      { title: 'Açores', role: 'feature', pages: 6 },
      { title: 'Lisbonne', role: 'feature', pages: 4 },
      { title: 'Dos', role: 'back cover', pages: 1 },
    ])
    const four = shapePlan(planned, 'magazine')
    expect(four.map((s) => [s.title, s.pages])).toEqual([
      ['Couv', 1],
      ['Sommaire', 1],
      ['Açores', 1],
      ['Dos', 1],
    ])
    // Nothing usable: the fallback's four.
    expect(shapePlan([], 'book').map((s) => s.role)).toEqual(['cover', 'front matter', 'chapter', 'back cover'])
    expect(fallbackSheets('magazine')).toHaveLength(4)
  })

  it('adds an inside page before the back cover, with an id of its own', () => {
    const pub = { ...PUB, sheets: shapePlan([], 'book') }
    const { publication, index } = addInsideSheet(pub, 'Chapitre 2', 'La filature')
    expect(index).toBe(3)
    expect(publication.sheets.map((s) => s.role)).toEqual(['cover', 'front matter', 'chapter', 'inside page', 'back cover'])
    expect(new Set(publication.sheets.map((s) => s.id)).size).toBe(5)
    expect(publicationSection(publication, 3)).toContain('It holds pages 4: write exactly 1 <Page>.')
    // The back cover keeps no folio, wherever it has moved to.
    expect(publicationSection(publication, 4)).toContain('It is the back cover: no folio')
  })

  it('grows the latest publication of the kind asked for', () => {
    const a = { ...PUB, id: 'a', createdAt: 1 }
    const b = { ...PUB, id: 'b', createdAt: 2 }
    expect(latestPublication([a, b], 'book')?.id).toBe('b')
    expect(latestPublication([a, b], 'magazine')).toBeUndefined()
    expect(latestPublication(undefined, 'book')).toBeUndefined()
  })
})
