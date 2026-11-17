import { describe, expect, it } from 'vitest'
import type { FillField } from './fillFields'
import { guessMapping, parseTable, resolvePicture, seriesRows, seriesTemplate } from './fillSeries'

const H1 = 'a'.repeat(64)
const H2 = 'b'.repeat(64)

describe('parseTable', () => {
  it('reads a French Excel CSV: semicolons, BOM, quotes, CRLF', () => {
    const t = parseTable('\uFEFFPlat;Prix;Note\r\n"Bœuf; carottes";12 €;"il a dit ""top"""\r\nSoupe;8 €;\r\n\r\n')
    expect(t).toEqual({
      headers: ['Plat', 'Prix', 'Note'],
      rows: [
        ['Bœuf; carottes', '12 €', 'il a dit "top"'],
        ['Soupe', '8 €', ''],
      ],
    })
  })

  it('reads commas, and a block pasted from a spreadsheet (tabs)', () => {
    expect(parseTable('Nom,Ville\nAna,Nîmes')?.rows).toEqual([['Ana', 'Nîmes']])
    expect(parseTable('Nom\tVille\nAna\tNîmes\nLéo')?.rows).toEqual([
      ['Ana', 'Nîmes'],
      ['Léo', ''],
    ])
  })

  it('keeps a line break inside quotes, names an empty header, refuses a header alone', () => {
    const t = parseTable('Titre;\n"deux\nlignes";x')
    expect(t?.headers).toEqual(['Titre', '#2'])
    expect(t?.rows[0][0]).toBe('deux\nlignes')
    expect(parseTable('Titre;Prix\n')).toBeNull()
    expect(parseTable('')).toBeNull()
  })
})

const fields: FillField[] = [
  { id: 'f1', label: 'Plat du lundi', kind: 'text', value: 'Soupe', nth: 0 },
  { id: 'f2', label: 'Prix', kind: 'text', value: '8 €', nth: 0 },
  { id: 'f3', label: 'Photo', kind: 'image', value: H1, nth: 0 },
]

describe('guessMapping', () => {
  it('matches the same words first, then a name inside a header, each column once', () => {
    expect(guessMapping(fields, ['PRIX', 'plat du Lundi', 'Photo du plat'])).toEqual({ f1: 1, f2: 0, f3: 2 })
    expect(guessMapping(fields, ['Autre'])).toEqual({ f1: -1, f2: -1, f3: -1 })
    expect(guessMapping([fields[1], { ...fields[1], id: 'f4' }], ['Prix'])).toEqual({ f2: 0, f4: -1 })
  })
})

describe('resolvePicture', () => {
  const lib = [
    { hash: H1, prompt: 'Lundi.JPG', createdAt: 1 },
    { hash: H2, prompt: 'lundi.png', createdAt: 2 },
  ]
  it('takes a hash, an address of Mocky, or an imported file name', () => {
    expect(resolvePicture(H1.toUpperCase(), [])).toBe(H1)
    expect(resolvePicture(`https://mocky.example/api/images/${H2}?download=1`, [])).toBe(H2)
    expect(resolvePicture('C:\\photos\\lundi', lib)).toBe(H2)
    expect(resolvePicture('Lundi.jpeg', lib)).toBe(H2)
    expect(resolvePicture('mardi.jpg', lib)).toBeNull()
    expect(resolvePicture('https://ailleurs.example/lundi.jpg', [])).toBeNull()
  })
})

describe('seriesRows', () => {
  it('fills what a row says, keeps what it leaves empty, reports an unknown picture', () => {
    const table = parseTable('Plat du lundi;Prix;Photo;Nom\nGratin;9 €;Lundi.jpg;Menu A\n;10 €;inconnue.png;\nTarte;;;')!
    const rows = seriesRows(table, fields, { f1: 0, f2: 1, f3: 2 }, [{ hash: H2, prompt: 'lundi.jpg', createdAt: 1 }], 3)
    expect(rows[0]).toEqual({ line: 2, values: { f1: 'Gratin', f2: '9 €', f3: H2 }, label: 'Menu A', unknownPictures: [] })
    expect(rows[1]).toEqual({ line: 3, values: { f2: '10 €' }, label: '10 €', unknownPictures: ['inconnue.png'] })
    expect(rows[2].values).toEqual({ f1: 'Tarte' })
    expect(rows[2].label).toBe('Tarte')
  })
})

describe('seriesTemplate', () => {
  it('writes one column per field and today’s values, quoted where needed', () => {
    const csv = seriesTemplate(fields, ['Soupe; pain', '8 €', H1])
    expect(csv).toBe(`\uFEFFPlat du lundi;Prix;Photo\r\n"Soupe; pain";8 €;${H1}\r\n`)
    expect(parseTable(csv)?.rows[0]).toEqual(['Soupe; pain', '8 €', H1])
  })
})
