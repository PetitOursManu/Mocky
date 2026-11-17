import { describe, expect, it } from 'vitest'
import {
  BLOCK_ATTR,
  attrValue,
  blockInstances,
  behind,
  extractBlock,
  insertBlock,
  markInstance,
  readAttrValue,
  refreshInstances,
  revOf,
  type BlockContent,
} from './blocks'
import { elementsOf } from './screenElements'
import { parses } from './sourceText'

const SOURCE = `const partners = ['Sherco', 'Amosan']

function Logo() {
  return <img src="/api/images/logo.png" alt="Logo" className="h-10" />
}

export default function App() {
  const [open, setOpen] = useState(false)
  const phone = '04 66 05 10 11'
  return (
    <main className="p-8">
      <header className="flex items-center" data-mocky-lock="k1">
        <Logo />
        <span>Elisa30</span>
      </header>
      <section className="flex gap-4">
        {partners.map((p) => (
          <span key={p} className="chip">{p}</span>
        ))}
      </section>
      <footer className="text-sm">Tél {phone}</footer>
      <button onClick={() => setOpen(!open)}>Menu</button>
    </main>
  )
}
`

const TARGET = `export default function Post() {
  const partners = 'autre chose'
  return (
    <div className="p-6">
      <h1 className="text-4xl">Portes ouvertes</h1>
      <p>{partners}</p>
    </div>
  )
}
`

async function rankOf(code: string, tag: string, nth = 0): Promise<number> {
  const paths = (await elementsOf(code))!
  return paths.map((p, i) => [p.node.openingElement.name.name, i] as const).filter(([n]) => n === tag)[nth][1]
}

const at = (...ranks: number[]) => ranks.map((rank) => ({ rank, index: 0 }))

async function extract(code: string, tag: string) {
  const out = await extractBlock(code, at(await rankOf(code, tag)))
  if (out.kind !== 'ok') throw new Error(`refused: ${out.reason}`)
  return out
}

const block = (content: BlockContent, id = 'b' + 'a'.repeat(24)) => ({ id, rev: revOf(content), ...content })

describe('extractBlock', () => {
  it('takes the element and the top-level declarations it reads, without lock attributes', async () => {
    const out = await extract(SOURCE, 'header')
    expect(out.content.jsx.startsWith('<header className="flex items-center">')).toBe(true)
    expect(out.content.jsx).not.toContain('data-mocky-lock')
    expect(out.content.decls).toHaveLength(1)
    expect(out.content.decls[0]).toMatch(/^function Logo\(\)/)
    expect(out.guess).toBe('header')
  })

  it('lifts a local constant of plain data, and copies a top-level array', async () => {
    const footer = await extract(SOURCE, 'footer')
    expect(footer.content.decls).toEqual(["const phone = '04 66 05 10 11';"])
    const band = await extract(SOURCE, 'section')
    expect(band.content.decls).toEqual(["const partners = ['Sherco', 'Amosan'];"])
  })

  it('refuses the screen itself, an item of a loop, and an element reading state', async () => {
    expect(await extractBlock(SOURCE, at(await rankOf(SOURCE, 'main')))).toMatchObject({ kind: 'refused', reason: 'root' })
    expect(await extractBlock(SOURCE, at(await rankOf(SOURCE, 'span', 1)))).toMatchObject({ kind: 'refused', reason: 'loop' })
    expect(await extractBlock(SOURCE, at(await rankOf(SOURCE, 'button')))).toMatchObject({
      kind: 'refused',
      reason: 'local',
      names: expect.arrayContaining(['setOpen', 'open']),
    })
  })

  it('ignores whitespace and locks in the rev', () => {
    const a = revOf({ jsx: '<a>\n  x\n</a>', decls: [] })
    expect(revOf({ jsx: '<a> x </a>', decls: [] })).toBe(a)
    expect(revOf({ jsx: '<a> y </a>', decls: [] })).not.toBe(a)
    expect(readAttrValue(attrValue('b' + '0'.repeat(24), a))?.rev).toBe(a)
    expect(readAttrValue('nope')).toBeNull()
  })
})

describe('insertBlock', () => {
  it('puts the block after the picked element and its declarations above the component', async () => {
    const band = await extract(SOURCE, 'section')
    const b = block(band.content)
    const out = await insertBlock(TARGET, b, at(await rankOf(TARGET, 'h1')))
    if (!('code' in out)) throw new Error('refused')
    expect(await parses(out.code)).toBe(true)
    // The screen already says `partners` for something else: the block's is renamed.
    expect(out.code).toContain("const partners2 = ['Sherco', 'Amosan'];\n\nexport default function Post()")
    expect(out.code).toContain('{partners2.map((p) => (')
    expect(out.code).toContain("const partners = 'autre chose'")
    expect(out.code).toContain(`<section ${BLOCK_ATTR}="${attrValue(b.id, b.rev)}" className="flex gap-4">`)
    expect(out.code.indexOf('<section')).toBeGreaterThan(out.code.indexOf('</h1>'))
    expect(out.code.indexOf('<section')).toBeLessThan(out.code.indexOf('<p>{partners}'))
  })

  it('goes at the end of the root with no pick, inside the last page of a document', async () => {
    const footer = block((await extract(SOURCE, 'footer')).content)
    const doc = `export default function Flyer() {
  return (
    <Doc format="a4">
      <Page>
        <h1>Un</h1>
      </Page>
      <Page>
        <h1>Deux</h1>
      </Page>
    </Doc>
  )
}
`
    const out = await insertBlock(doc, footer)
    if (!('code' in out)) throw new Error('refused')
    const footerAt = out.code.indexOf('<footer')
    expect(footerAt).toBeGreaterThan(out.code.indexOf('Deux'))
    expect(footerAt).toBeLessThan(out.code.lastIndexOf('</Page>'))
    expect(out.code).toContain("const phone = '04 66 05 10 11';")
  })

  it('does not copy a declaration twice when a second copy goes in', async () => {
    const header = block((await extract(SOURCE, 'header')).content)
    const once = await insertBlock(TARGET, header)
    if (!('code' in once)) throw new Error('refused')
    const twice = await insertBlock(once.code, header)
    if (!('code' in twice)) throw new Error('refused')
    expect(twice.code.match(/function Logo\(\)/g)).toHaveLength(1)
    expect(twice.code.match(/<header /g)).toHaveLength(2)
  })
})

describe('copies and updates', () => {
  it('marks the source element, sees a copy behind the library, and tells a hand edit apart', async () => {
    const ex = await extract(SOURCE, 'footer')
    const b = block(ex.content)
    const marked = (await markInstance(SOURCE, ex, b.id, b.rev))!
    let found = (await blockInstances(marked))!
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ blockId: b.id, rev: b.rev, edited: false, locked: false })

    const edited = marked.replace('Tél {phone}', 'Téléphone {phone}')
    found = (await blockInstances(edited))!
    expect(found[0].edited).toBe(true)

    const next = block({ ...ex.content, jsx: ex.content.jsx.replace('text-sm', 'text-base') }, b.id)
    expect(behind(found, next)).toHaveLength(1)
    expect(behind(found, b)).toHaveLength(0)
  })

  it('brings every copy up to date, drops what only the old copies read, and leaves a locked copy alone', async () => {
    const band = await extract(SOURCE, 'section')
    const v1 = block(band.content)
    const once = await insertBlock(TARGET, v1, at(await rankOf(TARGET, 'h1')))
    if (!('code' in once)) throw new Error('refused')
    const v2 = block(
      {
        decls: ["const sponsors = ['Sherco', 'Amosan', 'Asklé'];"],
        jsx: band.content.jsx.replace(/partners/g, 'sponsors').replace('gap-4', 'gap-6'),
      },
      v1.id,
    )
    const out = (await refreshInstances(once.code, v2))!
    expect(out.updated).toBe(1)
    expect(await parses(out.code)).toBe(true)
    expect(out.code).toContain("const sponsors = ['Sherco', 'Amosan', 'Asklé'];")
    expect(out.code).not.toContain('partners2')
    expect(out.code).toContain("const partners = 'autre chose'")
    expect(out.code).toContain(`${BLOCK_ATTR}="${attrValue(v1.id, v2.rev)}"`)
    expect((await blockInstances(out.code))![0]).toMatchObject({ rev: v2.rev, edited: false })

    const locked = once.code.replace('<span key={p}', '<span data-mocky-lock="z" key={p}')
    const kept = (await refreshInstances(locked, v2))!
    expect(kept).toMatchObject({ updated: 0, locked: 1, code: locked })
  })
})
