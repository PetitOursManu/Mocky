import { describe, it, expect } from 'vitest'
import { FILM_COVERS, filmCovers, filmSectionIn, findScreenSections } from './screenSections'
import { CAPABILITIES } from './capabilities/registry'

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

/**
 * Where a placed film ended up.
 *
 * The placement pass rewrites the page around the film, and one came back with
 * the film in a band of its own at the top: the site began below the fold and
 * the first screen was a video with nothing on it. The instruction says not to;
 * this is what lets the caller tell whether it did.
 */
describe('the section a film landed in', () => {
  const page = (body: string) => `export default function Screen() { return (\n${body}\n) }`

  it('names the nearest enclosing element that has an id', async () => {
    const code = page(`  <main>
    <section id="hero" className="relative">
      <div className="absolute inset-0">
        <MotionFilm src="/api/video/abc" fit="cover" className="h-full w-full" />
      </div>
      <h1>Serveurs</h1>
    </section>
  </main>`)
    expect(await filmSectionIn(code)).toBe('hero')
  })

  it('answers null when the film is in a band of its own', async () => {
    // A brand new <section> with no id — the defect this exists to catch.
    const code = page(`  <main>
    <section className="w-full">
      <MotionFilm src="/api/video/abc" fit="cover" className="w-full" />
    </section>
    <section id="hero"><h1>Serveurs</h1></section>
  </main>`)
    expect(await filmSectionIn(code)).toBeNull()
  })

  it('answers null when there is no film, and never throws', async () => {
    expect(await filmSectionIn(page(`  <section id="hero"><h1>Rien</h1></section>`))).toBeNull()
    expect(await filmSectionIn('function ( { <<< not javascript')).toBeNull()
    expect(await filmSectionIn('')).toBeNull()
  })
})

/**
 * A picture laid ON the film.
 *
 * `<MotionFilm>` puts its children in a layer above the video, which is what a
 * hero wants: a headline and a button standing on a moving ground. A placement
 * read that as a container and wrapped the whole hero in it — an interactive
 * map, its photograph, its pins — over a film that had already burnt its own
 * title into the frames. The instruction now says the overlay is type and
 * buttons; this is what can tell whether it was.
 */
describe('a picture the placement laid on the film', () => {
  const page = (body: string) => `export default function Screen() { return (\n${body}\n) }`

  it('names the photograph the reported screen put over its film', async () => {
    // The shape that was really shipped, cut down: the film wraps the hero's
    // grid, and the right column is a 620px map with a picture in it.
    const code = page(`  <main>
    <section id="hero" className="px-10">
      <MotionFilm src="/api/video/abc" fit="contain" className="relative aspect-video w-full overflow-hidden">
        <div className="grid grid-cols-2 gap-12">
          <div><button>Commencer</button></div>
          <div id="product" className="relative h-[620px]">
            <img src="/api/images/def" alt="" className="absolute inset-0 h-full w-full object-cover" />
            {places.map((place) => (<button key={place.name} style={{ left: place.x }}>{place.name}</button>))}
          </div>
        </div>
      </MotionFilm>
    </section>
  </main>`)
    expect(await filmCovers(code)).toBe('img')
  })

  it('keeps the overlay a film was written for', async () => {
    // Type, an icon in a button, a figure: none of them hides the picture, and
    // refusing them would refuse the component's whole reason for taking
    // children.
    const code = page(`  <main>
    <section id="hero">
      <MotionFilm src="/api/video/abc" fit="contain" className="aspect-video w-full">
        <p className="text-xs uppercase">Nîmes, France</p>
        <button className="rounded-xl px-6 py-3"><Icon.ArrowRight className="h-4 w-4" /> Explorer</button>
      </MotionFilm>
    </section>
  </main>`)
    expect(await filmCovers(code)).toBeNull()
  })

  it('reads a picture painted in a class or a style, not only a tag', async () => {
    const classed = page(`  <MotionFilm src="/api/video/abc"><div className="h-full w-full bg-[url('/api/images/x')] bg-cover" /></MotionFilm>`)
    expect(await filmCovers(classed)).toBe('background-image')
    const styled = page(`  <MotionFilm src="/api/video/abc"><div style={{ backgroundImage: 'url(/api/images/x)' }} /></MotionFilm>`)
    expect(await filmCovers(styled)).toBe('background-image')
  })

  it('catches the other moving surfaces, and not the film itself', async () => {
    for (const tag of ['Scene3D preset="globe"', 'ScrollSequence base="/api/videos/x" frames={60}', 'MotionFilm src="/api/video/y"', 'video src="/x.mp4"', 'canvas', 'iframe src="/x"']) {
      const name = tag.split(' ')[0]
      const code = page(`  <MotionFilm src="/api/video/abc"><${tag} /></MotionFilm>`)
      expect(await filmCovers(code), name).toBe(name)
    }
    // The film on its own is not its own intruder — the walk starts at its
    // children.
    expect(await filmCovers(page(`  <MotionFilm src="/api/video/abc" className="aspect-video w-full" />`))).toBeNull()
  })

  it('leaves a picture that stayed OUTSIDE the film alone', async () => {
    // The page keeps its own illustrations; what is refused is one laid on the
    // film, not one in the section beside it.
    const code = page(`  <main>
    <section id="hero">
      <MotionFilm src="/api/video/abc" fit="contain" className="aspect-video w-full" />
      <img src="/api/images/def" alt="" className="mt-8 w-full" />
    </section>
  </main>`)
    expect(await filmCovers(code)).toBeNull()
  })

  it('answers null when there is no film, and never throws', async () => {
    expect(await filmCovers(page(`  <section id="hero"><img src="/x" /></section>`))).toBeNull()
    expect(await filmCovers('function ( { <<< not javascript')).toBeNull()
    expect(await filmCovers('')).toBeNull()
    expect(await filmCovers(undefined as unknown as string)).toBeNull()
  })

  it('names components this app really ships', async () => {
    // A mirror, held to its source: a component renamed in the registry would
    // otherwise leave this list matching nothing at all, silently.
    const known = new Set(CAPABILITIES.flatMap((cap) => (cap.components ?? []).map((c) => c.name)))
    for (const name of FILM_COVERS.filter((n) => /^[A-Z]/.test(n))) {
      expect(known.has(name), name).toBe(true)
    }
  })
})
