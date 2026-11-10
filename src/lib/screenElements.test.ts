import { describe, expect, it } from 'vitest'
import * as Babel from '@babel/standalone'
import { applyCuts, PICK_SOURCE_PLUGIN, planGridPlacement, planMove, planRemovals, readMoveRequest, readPickedSource, type PickedSource } from './screenElements'

/** The rank the frame gives each element, by running the frame's own plugin. */
function ranksInFrame(source: string, prelude = ''): Record<string, number> {
  const combined = prelude ? `${prelude}\n${source}` : source
  // eslint-disable-next-line no-new-func
  const makePlugin = new Function(`return (${PICK_SOURCE_PLUGIN})`)() as (start: number) => any
  const start = prelude ? prelude.length + 1 : 0
  const seen: Record<string, number> = {}
  const collect = () => ({
    visitor: {
      JSXOpeningElement: {
        exit(p: any) {
          const attr = p.node.attributes.find((a: any) => a.name?.name === 'data-mocky-src')
          if (attr) seen[`${p.node.name.name}#${attr.value.value}`] = Number(attr.value.value)
        },
      },
    },
  })
  Babel.transform(combined, { plugins: [makePlugin(start), collect], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'x.jsx' })
  return seen
}

async function remove(source: string, chain: PickedSource[]) {
  const [plan] = await planRemovals(source, [chain])
  return plan
}

const SCREEN = `function App() {
  return (
    <main>
      <h1>Titre</h1>
      <p>Texte</p>
    </main>
  )
}`

describe('the rank a frame reports', () => {
  it('is the rank this file resolves, behind a prelude that has JSX of its own', () => {
    const prelude = 'function Snippet(){ return <div><span/></div> }'
    const ranks = ranksInFrame(SCREEN, prelude)
    expect(ranks).toEqual({ 'main#0': 0, 'h1#1': 1, 'p#2': 2 })
  })

  it('counts a Fragment without tagging it', () => {
    const ranks = ranksInFrame('function A(){ return <Fragment><b/></Fragment> }')
    expect(ranks).toEqual({ 'b#1': 1 })
  })
})

describe('removing an element', () => {
  it('takes a plain element and its line out', async () => {
    const plan = await remove(SCREEN, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }])
    expect(plan.kind).toBe('single')
    const out = await applyCuts(SCREEN, (plan as any).cuts)
    expect(out).toBe(SCREEN.replace('      <h1>Titre</h1>\n', ''))
  })

  it('refuses the root of the screen', async () => {
    expect(await remove(SCREEN, [{ rank: 0, index: 0 }])).toEqual({ kind: 'refused', reason: 'root' })
  })

  it('takes one item out of a written list, and only that one', async () => {
    const code = `const items = [{ t: 'a' }, { t: 'b' }, { t: 'c' }]
function App() {
  return <ul>{items.map((i) => <li key={i.t}>{i.t}</li>)}</ul>
}`
    const plan = await remove(code, [{ rank: 1, index: 1 }, { rank: 0, index: 0 }])
    expect(plan.kind).toBe('single')
    const out = await applyCuts(code, (plan as any).cuts)
    expect(out).toContain("[{ t: 'a' }, { t: 'c' }]")
  })

  it('removes the last item with its comma', async () => {
    const code = `function App() { return <ul>{['a', 'b'].map((x) => <li key={x}>{x}</li>)}</ul> }`
    const plan = await remove(code, [{ rank: 1, index: 1 }, { rank: 0, index: 0 }])
    expect(await applyCuts(code, (plan as any).cuts)).toContain("['a'].map")
  })

  it('asks about a list the code computes', async () => {
    const code = `function App() { return <ul>{Array.from({ length: 6 }).map((_, i) => <li key={i}>x</li>)}</ul> }`
    const plan = await remove(code, [{ rank: 1, index: 2 }, { rank: 0, index: 0 }])
    expect(plan).toMatchObject({ kind: 'repeated', count: null })
    expect((plan as any).item).toBeUndefined()
    expect(await applyCuts(code, (plan as any).cuts)).toBe('function App() { return <ul></ul> }')
  })

  it('offers the item or all of them for something inside a written list', async () => {
    const code = `function App() {
  const cards = ['a', 'b', 'c']
  return <div>{cards.map((c) => <article key={c}><h3>{c}</h3></article>)}</div>
}`
    const plan = await remove(code, [{ rank: 2, index: 0 }, { rank: 1, index: 2 }, { rank: 0, index: 0 }])
    expect(plan).toMatchObject({ kind: 'repeated', count: 3 })
    expect(await applyCuts(code, (plan as any).item)).toContain("['a', 'b']")
    expect(await applyCuts(code, (plan as any).cuts)).toContain('<article key={c}></article>')
  })

  it('resolves a component\'s root to the place that uses it', async () => {
    const code = `function Card() { return <section>x</section> }
function App() {
  return (
    <div>
      <Card />
      <Card />
    </div>
  )
}`
    const plan = await remove(code, [{ rank: 0, index: 0 }, { rank: 3, index: 1 }, { rank: 1, index: 0 }])
    const out = await applyCuts(code, (plan as any).cuts)
    expect(out?.match(/<Card \/>/g)).toHaveLength(1)
  })

  it('takes a condition out with its element', async () => {
    const code = `function App({ on }) {
  return (
    <div>
      {on && <b>x</b>}
    </div>
  )
}`
    const plan = await remove(code, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }])
    expect(await applyCuts(code, (plan as any).cuts)).not.toContain('on &&')
  })

  it('leaves a ternary valid', async () => {
    const code = `function App({ on }) { return <div>{on ? <b>x</b> : <i>y</i>}</div> }`
    const plan = await remove(code, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }])
    expect(await applyCuts(code, (plan as any).cuts)).toContain('on ? null : <i>y</i>')
  })

  it('merges two picks that overlap', async () => {
    expect(
      await applyCuts('abcdefgh', [
        { start: 1, end: 6, text: '' },
        { start: 2, end: 3, text: '' },
      ]),
    ).toBe('agh')
  })
})

describe('readPickedSource', () => {
  it('refuses what a frame should not be able to say', () => {
    expect(readPickedSource('x')).toBeUndefined()
    expect(readPickedSource([{ rank: -1, index: 0 }])).toBeUndefined()
    expect(readPickedSource([{ rank: 'a', index: 0 }])).toBeUndefined()
    expect(readPickedSource([{ rank: 2, index: 'x' }])).toEqual([{ rank: 2, index: 0 }])
  })
})

describe('readMoveRequest', () => {
  it('keeps a well-formed reorder and a well-formed cell, and nothing else', () => {
    expect(readMoveRequest({ from: [{ rank: 1, index: 0 }], to: [{ rank: 2, index: 1 }], before: true, selector: 's', after: 'a' })).toEqual({
      from: [{ rank: 1, index: 0 }],
      to: [{ rank: 2, index: 1 }],
      before: true,
      selector: 's',
      after: 'a',
      step: false,
    })
    expect(readMoveRequest({ from: [{ rank: 1, index: 0 }], grid: { col: 2, row: 3, colSpan: 99 } })?.grid).toEqual({
      colStart: 2,
      rowStart: 3,
      colSpan: undefined,
      rowSpan: undefined,
    })
    expect(readMoveRequest({ from: [{ rank: 1, index: 0 }], grid: { col: 0, row: 1 } })).toBeUndefined()
    expect(readMoveRequest({ from: [{ rank: 1, index: 0 }] })).toBeUndefined()
    expect(readMoveRequest({ from: 'x', to: [{ rank: 1, index: 0 }] })).toBeUndefined()
  })
})

async function moved(source: string, from: PickedSource[], to: PickedSource[], position: 'before' | 'after') {
  const plan = await planMove(source, from, to, position)
  if (plan.kind !== 'moved') return plan
  return applyCuts(source, plan.cuts)
}

const LIST = `function App() {
  return (
    <main>
      <h1>Titre</h1>
      <p>Texte</p>
      <section>
        <b>x</b>
      </section>
    </main>
  )
}`

describe('moving an element among its siblings', () => {
  it('puts a line after another and keeps every margin', async () => {
    const out = await moved(LIST, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], [{ rank: 2, index: 1 }, { rank: 0, index: 0 }], 'after')
    expect(out).toBe(LIST.replace('      <h1>Titre</h1>\n      <p>Texte</p>', '      <p>Texte</p>\n      <h1>Titre</h1>'))
  })

  it('carries a block of several lines', async () => {
    const out = await moved(LIST, [{ rank: 3, index: 2 }, { rank: 0, index: 0 }], [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], 'before')
    expect(out).toBe(`function App() {
  return (
    <main>
      <section>
        <b>x</b>
      </section>
      <h1>Titre</h1>
      <p>Texte</p>
    </main>
  )
}`)
  })

  it('says so when the drop leaves it in place', async () => {
    expect(await planMove(LIST, [{ rank: 1, index: 0 }], [{ rank: 2, index: 1 }], 'before')).toEqual({ kind: 'refused', reason: 'same' })
  })

  it('moves siblings written on one line', async () => {
    const code = 'function App() { return <nav><a>1</a><a>2</a><a>3</a></nav> }'
    const out = await moved(code, [{ rank: 1, index: 0 }], [{ rank: 3, index: 2 }], 'after')
    expect(out).toBe('function App() { return <nav><a>2</a><a>3</a><a>1</a></nav> }')
  })

  it('moves a condition with its element', async () => {
    const code = `function App({ on }) {
  return (
    <div>
      <p>a</p>
      {on && <b>x</b>}
    </div>
  )
}`
    const out = await moved(code, [{ rank: 2, index: 1 }, { rank: 0, index: 0 }], [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], 'before')
    expect(out).toContain('<div>\n      {on && <b>x</b>}\n      <p>a</p>\n    </div>')
  })

  it('moves the use of a component, not its inside', async () => {
    const code = `function Card({ t }) { return <section>{t}</section> }
function App() {
  return (
    <div>
      <Card t="a" />
      <Card t="b" />
    </div>
  )
}`
    const out = await moved(
      code,
      [{ rank: 0, index: 0 }, { rank: 3, index: 1 }, { rank: 1, index: 0 }],
      [{ rank: 0, index: 0 }, { rank: 2, index: 0 }, { rank: 1, index: 0 }],
      'before',
    )
    expect(out).toContain('<Card t="b" />\n      <Card t="a" />')
  })

  it('reorders the entries of a written list', async () => {
    const code = `const items = [
  { t: 'a' },
  { t: 'b' },
  { t: 'c' },
]
function App() {
  return <ul>{items.map((i) => <li key={i.t}>{i.t}</li>)}</ul>
}`
    const out = await moved(code, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], [{ rank: 1, index: 2 }, { rank: 0, index: 0 }], 'after')
    expect(out).toContain("[\n  { t: 'b' },\n  { t: 'c' },\n  { t: 'a' },\n]")
  })

  it('reorders an inline array the map is called on', async () => {
    const code = `function App() { return <ul>{['a', 'b', 'c'].map((x) => <li key={x}>{x}</li>)}</ul> }`
    const out = await moved(code, [{ rank: 1, index: 2 }, { rank: 0, index: 0 }], [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], 'before')
    expect(out).toContain("['c', 'a', 'b'].map")
  })

  it('refuses a list the code computes', async () => {
    const code = `function App() { return <ul>{Array.from({ length: 3 }).map((_, i) => <li key={i}>x</li>)}</ul> }`
    expect(await planMove(code, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], [{ rank: 1, index: 2 }, { rank: 0, index: 0 }], 'after')).toEqual({
      kind: 'refused',
      reason: 'computed',
    })
  })

  it('refuses to take an element out of its container', async () => {
    expect(await planMove(LIST, [{ rank: 4, index: 0 }, { rank: 3, index: 2 }], [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], 'before')).toEqual({
      kind: 'refused',
      reason: 'container',
    })
  })

  it('refuses the root of the screen', async () => {
    expect(await planMove(LIST, [{ rank: 0, index: 0 }], [{ rank: 1, index: 0 }], 'before')).toEqual({ kind: 'refused', reason: 'root' })
  })

  it('refuses what a loop draws for every item', async () => {
    const code = `function App() {
  return <div>{['a', 'b'].map((c) => <article key={c}><h3>{c}</h3><p>x</p></article>)}</div>
}`
    expect(
      await planMove(code, [{ rank: 2, index: 0 }, { rank: 1, index: 0 }, { rank: 0, index: 0 }], [{ rank: 3, index: 1 }, { rank: 1, index: 0 }, { rank: 0, index: 0 }], 'after'),
    ).toEqual({ kind: 'refused', reason: 'repeated' })
  })

  it('refuses what a component used twice draws', async () => {
    const code = `function Card() { return <section><h3>a</h3><p>b</p></section> }
function App() { return <div><Card /><Card /></div> }`
    expect(
      await planMove(
        code,
        [{ rank: 1, index: 0 }, { rank: 0, index: 0 }, { rank: 4, index: 0 }, { rank: 3, index: 0 }],
        [{ rank: 2, index: 1 }, { rank: 0, index: 0 }, { rank: 4, index: 0 }, { rank: 3, index: 0 }],
        'after',
      ),
    ).toEqual({ kind: 'refused', reason: 'repeated' })
  })
})

describe('placing an element on a grid cell', () => {
  const grid = (cls: string) => `function App() {
  return (
    <div className="grid grid-cols-3">
      <div ${cls}>a</div>
      <div>b</div>
    </div>
  )
}`
  const place = async (code: string, cell: Parameters<typeof planGridPlacement>[2]) => {
    const plan = await planGridPlacement(code, [{ rank: 1, index: 0 }, { rank: 0, index: 0 }], cell)
    return plan.kind === 'moved' ? applyCuts(code, plan.cuts) : plan
  }

  it('replaces the placement classes and keeps the rest', async () => {
    const out = await place(grid('className="p-4 col-start-1 md:col-start-2 row-start-1 col-span-2 bg-white"'), { colStart: 3, rowStart: 2 })
    expect(out).toContain('<div className="p-4 col-span-2 bg-white col-start-3 row-start-2">a</div>')
  })

  it('writes the span the frame measured', async () => {
    const out = await place(grid('className="col-start-1 col-end-3"'), { colStart: 2, rowStart: 1, colSpan: 2 })
    expect(out).toContain('className="col-start-2 row-start-1 col-span-2"')
  })

  it('adds a class to an element with none', async () => {
    const out = await place(grid(''), { colStart: 2, rowStart: 1 })
    expect(out).toContain('<div className="col-start-2 row-start-1" >a</div>')
  })

  it('writes into a string in braces', async () => {
    const out = await place(grid("className={'p-2 row-start-3'}"), { colStart: 1, rowStart: 20 })
    expect(out).toContain("className={'p-2 col-start-1 row-start-[20]'}")
  })

  it('writes into the written parts of a template literal', async () => {
    const out = await place(grid('className={`p-2 ${on ? "a" : "b"} col-start-2`}'), { colStart: 3, rowStart: 1 })
    expect(out).toContain('className={`p-2 ${on ? "a" : "b"} col-start-3 row-start-1`}')
  })

  it('refuses a placement half written in code', async () => {
    expect(await place(grid('className={`p-2 col-start-${n}`}'), { colStart: 3, rowStart: 1 })).toEqual({ kind: 'refused', reason: 'className' })
  })

  it('refuses a class computed by a call', async () => {
    expect(await place(grid('className={cn("p-2", on && "x")}'), { colStart: 3, rowStart: 1 })).toEqual({ kind: 'refused', reason: 'className' })
  })

  it("refuses an item of a list: its class is every item's", async () => {
    const code = `function App() { return <div className="grid">{['a', 'b'].map((x) => <div key={x}>{x}</div>)}</div> }`
    expect(await planGridPlacement(code, [{ rank: 1, index: 1 }, { rank: 0, index: 0 }], { colStart: 2, rowStart: 1 })).toEqual({
      kind: 'refused',
      reason: 'repeated',
    })
  })

  it('writes on the root of a component used once', async () => {
    const code = `function Hero() { return <section className="p-8">h</section> }
function App() { return <div className="grid"><Hero /><p>x</p></div> }`
    const plan = await planGridPlacement(code, [{ rank: 0, index: 0 }, { rank: 2, index: 0 }, { rank: 1, index: 0 }], { colStart: 2, rowStart: 1 })
    expect(plan.kind).toBe('moved')
    expect(await applyCuts(code, (plan as any).cuts)).toContain('<section className="p-8 col-start-2 row-start-1">')
  })

  it('refuses a component used twice', async () => {
    const code = `function Hero() { return <section>h</section> }
function App() { return <div className="grid"><Hero /><Hero /></div> }`
    expect(await planGridPlacement(code, [{ rank: 0, index: 0 }, { rank: 2, index: 0 }, { rank: 1, index: 0 }], { colStart: 2, rowStart: 1 })).toEqual({
      kind: 'refused',
      reason: 'component',
    })
  })
})
