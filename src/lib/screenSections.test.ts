import { describe, it, expect } from 'vitest'
import { findScreenSections } from './screenSections'

describe('findScreenSections', () => {
  it('lists the ids a screen really carries, in source order', async () => {
    const src = `
      export default function App() {
        return (
          <main>
            <header id="nav" className="flex"><a href="#pricing">Prix</a></header>
            <section id="hero"><h1>Softly</h1></section>
            <section id="product"><img src="/api/images/abc" /></section>
            <footer id="footer">©</footer>
          </main>
        )
      }`
    const found = await findScreenSections(src)
    expect(found.map((s) => s.id)).toEqual(['nav', 'hero', 'product', 'footer'])
    expect(found.map((s) => s.tag)).toEqual(['header', 'section', 'section', 'footer'])
  })

  it('takes an id off a local component too', async () => {
    // A screen built out of <Card> and <Panel> would otherwise report no
    // sections at all, and the placement pass would be back to guessing.
    const found = await findScreenSections(`<div><Card id="product">x</Card></div>`)
    expect(found).toEqual([{ id: 'product', tag: 'Card', index: 0 }])
  })

  it('ignores an id it cannot know the value of', async () => {
    // `id={slug}` is decided at render. Quoting a handle that may not be the one
    // in the DOM is worse than quoting none: the placement pass would name a
    // section the screen does not have.
    const found = await findScreenSections(`<section id={slug}><section id="real" /></section>`)
    expect(found.map((s) => s.id)).toEqual(['real'])
  })

  it('is not fooled by the word id inside a string or a class', async () => {
    // The whole reason this is a parse and not a regex (invariant I1).
    const src = `<div className="grid id-4" title='id="ghost"'><section id="true" /></div>`
    const found = await findScreenSections(src)
    expect(found.map((s) => s.id)).toEqual(['true'])
  })

  it('reports a repeated id once, so a list reads as one place', async () => {
    const found = await findScreenSections(`<div><section id="cta"/><section id="cta"/></div>`)
    expect(found.map((s) => s.id)).toEqual(['cta'])
  })

  it('says nothing rather than guessing when the source will not parse', async () => {
    // Degrades (Q1): the caller falls back to the instruction it had before.
    expect(await findScreenSections('<div className=')).toEqual([])
    expect(await findScreenSections('')).toEqual([])
    expect(await findScreenSections(undefined as unknown as string)).toEqual([])
  })
})
