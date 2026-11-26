import { describe, expect, it } from 'vitest'
import { changeScreenVisual, dropVisualValues, findScreenVisuals, setDocFormat } from './read'
import { checkVisualFigures } from './check'

const SCREEN = `export default function App() {
  return (
    <Doc format="slides">
      <Page className="flex flex-col p-12">
        <div className="flex-1 min-h-0">
          <Visual
            family="stats"
            alternatives={["bars", "donut", "nope"]}
            colors={["#0f766e"]}
            doc={{
              title: "Une année en chiffres",
              items: [
                { label: "Élèves suivis", value: 240, unit: "élèves" },
                { label: "Bénévoles", value: 38 },
                { label: "Taux de réussite", value: 92, unit: "%", detail: "au brevet" },
              ],
            }}
            className="w-full h-full"
          />
        </div>
      </Page>
    </Doc>
  )
}`

describe('reading a screen’s visuals', () => {
  it('reads the family, the alternatives it proposed and the content as data', async () => {
    const [v] = await findScreenVisuals(SCREEN)
    expect(v.family).toBe('stats')
    expect(v.variant).toBeNull()
    expect(v.alternatives).toEqual(['bars', 'donut'])
    expect(v.doc?.items.map((i) => i.value)).toEqual([240, 38, 92])
  })

  it('follows a doc held in a top-level const, and refuses one it would have to compute', async () => {
    const named = `const DATA = { items: [{ label: "A" }, { label: "B", value: -3 }] }
export default function App() { return <Visual family="bars" doc={DATA} /> }`
    expect((await findScreenVisuals(named))[0].doc?.items[1].value).toBe(-3)
    const computed = `export default function App() { const n = 3; return <Visual family="bars" doc={{ items: [{ label: "A", value: n }] }} /> }`
    expect((await findScreenVisuals(computed))[0].doc).toBeNull()
    expect(await findScreenVisuals('not ( code')).toEqual([])
  })
})

describe('switching a visual without a model', () => {
  it('rewrites the family, and keeps the family it leaves among the proposals', async () => {
    const next = await changeScreenVisual(SCREEN, 0, { family: 'bars' })
    expect(next).toBe(SCREEN.replace('family="stats"', 'family="bars"').replace('alternatives={["bars", "donut", "nope"]}', 'alternatives={["stats","donut"]}'))
    expect((await findScreenVisuals(next!))[0].alternatives).toEqual(['stats', 'donut'])
  })

  it('adds a variant the code did not write', async () => {
    const next = await changeScreenVisual(SCREEN, 0, { variant: 'outline' })
    expect(next).toContain('<Visual variant="outline"')
    expect((await findScreenVisuals(next!))[0].variant).toBe('outline')
  })

  it('refuses an unknown family, an unknown visual or a change that changes nothing', async () => {
    expect(await changeScreenVisual(SCREEN, 0, { family: 'pie' as never })).toBeNull()
    expect(await changeScreenVisual(SCREEN, 3, { family: 'bars' })).toBeNull()
    expect(await changeScreenVisual(SCREEN, 0, { family: 'stats' })).toBeNull()
  })
})

describe('taking a made-up figure out', () => {
  it('removes value and unit of the named items, and leaves code that parses', async () => {
    const next = await dropVisualValues(SCREEN, 0, [0, 2])
    expect(next).not.toBeNull()
    const [v] = await findScreenVisuals(next!)
    expect(v.doc?.items).toEqual([{ label: 'Élèves suivis' }, { label: 'Bénévoles', value: 38 }, { label: 'Taux de réussite', detail: 'au brevet' }])
  })

  it('keeps every figure the request gave, under the forms a writer uses for it', async () => {
    const text = 'Cette année : 240 élèves suivis, 38 bénévoles, 92 % de réussite au brevet.'
    const out = await checkVisualFigures(SCREEN, text)
    expect(out.dropped).toEqual([])
    expect(out.code).toBe(SCREEN)
  })

  it('drops the figures the request never gave, and says which', async () => {
    const out = await checkVisualFigures(SCREEN, 'Une année avec 240 élèves suivis et beaucoup de bénévoles.')
    expect(out.dropped.map((d) => d.label)).toEqual(['Bénévoles', 'Taux de réussite'])
    const [v] = await findScreenVisuals(out.code)
    expect(v.doc?.items.map((i) => i.value)).toEqual([240, undefined, undefined])
  })
})

describe('making a visual in another size', () => {
  it('rewrites the page format of the document and nothing else', async () => {
    const next = await setDocFormat(SCREEN, 'social-square')
    expect(next).toBe(SCREEN.replace('<Doc format="slides">', '<Doc format="social-square">'))
    expect(await setDocFormat(SCREEN, 'slides')).toBeNull()
    expect(await setDocFormat('export default () => <div />', 'a4')).toBeNull()
    expect(await setDocFormat(SCREEN, 'x" onClick="')).toBeNull()
  })
})
