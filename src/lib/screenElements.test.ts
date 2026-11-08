import { describe, expect, it } from 'vitest'
import * as Babel from '@babel/standalone'
import { applyCuts, PICK_SOURCE_PLUGIN, planRemovals, readPickedSource, type PickedSource } from './screenElements'

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
