import { describe, expect, it } from 'vitest'
import { applyFill, defaultLabel, fieldStatus, fillCandidates, locate, normalizeFill, type FillField } from './fillFields'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

const MENU = `export default function App() {
  const DAYS = [
    { id: 'lun', day: 'Lundi', dish: 'Salade de saison' },
    { id: 'mar', day: 'Mardi', dish: 'Salade de saison' },
  ]
  return (
    <main className="p-8 bg-[#FFFFFF]">
      <h1 className="text-5xl">
        Menu de la semaine
      </h1>
      <p title='Prix d&apos;un menu'>Menu complet : 12,50 €</p>
      <img src="/api/images/${A}" alt="Le plat du jour" />
      {DAYS.map((d) => <p key={d.id}>{d.day} — {d.dish}</p>)}
    </main>
  )
}
`

const field = (over: Partial<FillField> & Pick<FillField, 'value'>): FillField => ({ id: over.value, label: over.value, kind: 'text', nth: 0, ...over })

describe('fillCandidates', () => {
  it('lists what a reader sees and every picture, never the machinery', async () => {
    const c = await fillCandidates(MENU)
    expect(c).not.toBeNull()
    const texts = c!.filter((x) => x.kind === 'text').map((x) => x.text)
    expect(texts).toEqual(expect.arrayContaining(['Menu de la semaine', 'Menu complet : 12,50 €', 'Le plat du jour', 'Lundi', 'Salade de saison', "Prix d'un menu"]))
    expect(texts.some((t) => t.includes('p-8') || t.includes('/api/images') || t === 'lun')).toBe(false)
    expect(c!.filter((x) => x.kind === 'image').map((x) => x.value)).toEqual([A])
  })

  it('numbers the same words twice as two places', async () => {
    const c = (await fillCandidates(MENU))!.filter((x) => x.value === 'Salade de saison')
    expect(c.map((x) => x.nth)).toEqual([0, 1])
  })

  it('does not read a source that does not parse', async () => {
    expect(await fillCandidates('export default function App() { return <div> }')).toBeNull()
  })
})

describe('applyFill', () => {
  it('writes one occurrence and leaves its twin, the layout and the rest of the file alone', async () => {
    const fields = [field({ id: 'mardi', value: 'Salade de saison', nth: 1 })]
    const out = await applyFill(MENU, fields, { mardi: 'Lasagnes maison' }, 'https://mocky.test')
    expect(out.written).toEqual(['mardi'])
    expect(out.code).toBe(MENU.replace("dish: 'Salade de saison' },\n  ]", "dish: 'Lasagnes maison' },\n  ]"))
    expect(out.fields[0]).toMatchObject({ value: 'Lasagnes maison', nth: 0 })
  })

  it('keeps the line breaks around JSX text and escapes for where it writes', async () => {
    const fields = [field({ id: 'h', value: 'Menu de la semaine' }), field({ id: 'p', value: 'Menu complet : 12,50 €' }), field({ id: 't', value: 'Prix d&apos;un menu' })]
    const out = await applyFill(MENU, fields, { h: 'Menu du 23 au 27 novembre', p: "Menu l'hiver : 13 €", t: "Prix d'un menu en hiver" }, '')
    expect(out.code).toContain('<h1 className="text-5xl">\n        Menu du 23 au 27 novembre\n      </h1>')
    expect(out.code).toContain(">Menu l'hiver : 13 €</p>")
    expect(out.code).toContain("title='Prix d&apos;un menu en hiver'")
    // The next fill starts from this one.
    const again = await fieldStatus(out.code, out.fields)
    expect(again?.missing).toEqual([])
  })

  it('swaps a picture slot, keeping a relative address relative', async () => {
    const fields = [field({ id: 'photo', kind: 'image', value: A })]
    const out = await applyFill(MENU, fields, { photo: B }, 'https://mocky.test')
    expect(out.code).toContain(`src="/api/images/${B}"`)
    expect(out.fields[0].value).toBe(B)
    const bad = await applyFill(MENU, fields, { photo: 'pas-un-hash' }, '')
    expect(bad.refused).toEqual([{ id: 'photo', reason: 'notImage' }])
  })

  it('refuses what it cannot write safely, and writes the rest', async () => {
    const fields = [field({ id: 'h', value: 'Menu de la semaine' }), field({ id: 'p', value: 'Menu complet : 12,50 €' }), field({ id: 'gone', value: 'Dessert' })]
    const out = await applyFill(MENU, fields, { h: 'Menu {spécial}', p: '   ', gone: 'Tarte' }, '')
    expect(out.refused).toEqual([
      { id: 'h', reason: 'unsafe' },
      { id: 'p', reason: 'empty' },
      { id: 'gone', reason: 'missing' },
    ])
    expect(out.code).toBe(MENU)
  })

  it('treats an unchanged value as no change', async () => {
    const out = await applyFill(MENU, [field({ id: 'h', value: 'Menu de la semaine' })], { h: ' Menu de la semaine ' }, '')
    expect(out.written).toEqual([])
    expect(out.code).toBe(MENU)
  })
})

describe('locate and status', () => {
  it('reports a field an edit rewrote as missing, never a neighbour', async () => {
    const edited = MENU.replace('Menu de la semaine', 'Notre carte')
    const st = await fieldStatus(edited, [field({ id: 'h', value: 'Menu de la semaine' }), field({ id: 'l', value: 'Lundi' })])
    expect(st?.missing).toEqual(['h'])
    expect(locate((await fillCandidates(edited))!, { kind: 'text', value: 'Lundi', nth: 0 })).toBeDefined()
  })
})

describe('normalizeFill and labels', () => {
  it('keeps well-formed fields and drops the rest', () => {
    expect(
      normalizeFill([
        { id: 'a', label: ' Plat ', kind: 'text', value: 'Salade', nth: 1 },
        { id: 'a', label: 'twin', kind: 'text', value: 'x', nth: 0 },
        { id: 'b', kind: 'image', value: 'nope', nth: 0 },
        { id: 'c', kind: 'video', value: 'x', nth: 0 },
        { id: 'd', kind: 'text', value: 'Prix', nth: -2 },
      ]),
    ).toEqual([
      { id: 'a', label: 'Plat', kind: 'text', value: 'Salade', nth: 1 },
      { id: 'd', label: 'Prix', kind: 'text', value: 'Prix', nth: 0 },
    ])
    expect(normalizeFill([])).toBeUndefined()
    expect(normalizeFill('x')).toBeUndefined()
  })

  it('names a field by its first words', () => {
    expect(defaultLabel({ kind: 'text', text: 'Velouté de potiron, crème fraîche et graines' }, 'Photo')).toBe('Velouté de potiron, crème fraîche')
    expect(defaultLabel({ kind: 'image', text: '' }, 'Photo')).toBe('Photo')
  })
})
