import { describe, expect, it } from 'vitest'
import { findScreenImages, replaceScreenImage } from './screenImages'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const C = 'c'.repeat(64)
const ORIGIN = 'http://localhost:5173'

/** Replace the one image whose hash is `hash`, the way the UI does. */
async function swap(code: string, hash: string, next: string, origin = ORIGIN) {
  const found = await findScreenImages(code)
  const target = found.find((i) => i.hash === hash)
  expect(target, `no image ${hash.slice(0, 6)} found`).toBeTruthy()
  return replaceScreenImage(code, target!.spans, next, origin)
}

describe('findScreenImages', () => {
  it('finds an image in a JSX src attribute', async () => {
    const code = `function App(){return <img src="${ORIGIN}/api/images/${A}" alt="Hero" className="w-full" />}`
    const found = await findScreenImages(code)
    expect(found).toHaveLength(1)
    expect(found[0].hash).toBe(A)
    expect(found[0].alt).toBe('Hero')
    expect(found[0].spans).toHaveLength(1)
    expect(found[0].spans[0].absolute).toBe(true)
  })

  it('finds several distinct images and keeps their order', async () => {
    const code = `
      function App(){
        return <div>
          <img src="${ORIGIN}/api/images/${A}" alt="One" />
          <img src="${ORIGIN}/api/images/${B}" alt="Two" />
        </div>
      }`
    const found = await findScreenImages(code)
    expect(found.map((i) => i.hash)).toEqual([A, B])
    expect(found.map((i) => i.alt)).toEqual(['One', 'Two'])
  })

  it('groups repeats of one image and keeps every span', async () => {
    // A hero and its thumbnail are one picture shown twice.
    const code = `
      function App(){
        return <div>
          <img src="${ORIGIN}/api/images/${A}" alt="Hero" />
          <img src="${ORIGIN}/api/images/${A}" alt="" className="thumb" />
        </div>
      }`
    const found = await findScreenImages(code)
    expect(found).toHaveLength(1)
    expect(found[0].spans).toHaveLength(2)
    // First alt wins — the hero is written before its thumbnail.
    expect(found[0].alt).toBe('Hero')
  })

  it('finds a relative URL and records that it had no origin', async () => {
    const code = `function App(){return <img src="/api/images/${A}" alt="" />}`
    const found = await findScreenImages(code)
    expect(found[0].spans[0].absolute).toBe(false)
  })

  it('finds a hash written into a template literal', async () => {
    const code = 'const base = "http://x"; function App(){ return <img src={`${base}/api/images/' + A + '`} alt="" /> }'
    const found = await findScreenImages(code)
    expect(found.map((i) => i.hash)).toEqual([A])
  })

  it('reports no alt rather than a wrong one when alt is an expression', async () => {
    const code = `function App({l}){return <img src="/api/images/${A}" alt={l} />}`
    expect((await findScreenImages(code))[0].alt).toBeNull()
  })

  it('ignores a URL inside a comment', async () => {
    // The whole reason this walks an AST. A regex over the file would offer to
    // replace this and then corrupt the screen.
    const code = `
      function App(){
        // was: <img src="${ORIGIN}/api/images/${A}" />
        /* also ${ORIGIN}/api/images/${B} */
        return <div />
      }`
    expect(await findScreenImages(code)).toEqual([])
  })

  it('ignores a short or malformed hash', async () => {
    const code = `function App(){return <img src="/api/images/deadbeef" alt="" />}`
    expect(await findScreenImages(code)).toEqual([])
  })

  it('says nothing about a file it cannot parse', async () => {
    // Guessing with a regex after a failed parse is what the invariant forbids.
    expect(await findScreenImages(`function App(){ return <div ; ; />`)).toEqual([])
  })

  it('is empty for a screen with no images at all', async () => {
    expect(await findScreenImages('function App(){return <div className="bg-red-500" />}')).toEqual([])
  })
})

describe('replaceScreenImage', () => {
  it('swaps the hash and leaves every other byte alone', async () => {
    const code = `function App(){return <img src="${ORIGIN}/api/images/${A}" alt="Hero" className="w-full rounded" />}`
    const out = await swap(code, A, B)
    expect(out).toBe(code.replace(A, B))
  })

  it('swaps every occurrence of the same image', async () => {
    const code = `
      function App(){
        return <div>
          <img src="${ORIGIN}/api/images/${A}" alt="Hero" />
          <img src="${ORIGIN}/api/images/${A}" alt="" />
        </div>
      }`
    const out = await swap(code, A, B)
    expect(out).not.toContain(A)
    expect(out.match(new RegExp(B, 'g'))).toHaveLength(2)
  })

  it('leaves the other images untouched', async () => {
    const code = `
      function App(){
        return <div>
          <img src="${ORIGIN}/api/images/${A}" alt="" />
          <img src="${ORIGIN}/api/images/${B}" alt="" />
        </div>
      }`
    const out = await swap(code, A, C)
    expect(out).toContain(`/api/images/${C}`)
    expect(out).toContain(`/api/images/${B}`)
    expect(out).not.toContain(A)
  })

  it('rewrites a stale origin to the current one', async () => {
    // The URL is being authored now. Carrying the old origin over would write a
    // link that has never worked on this host.
    const code = `function App(){return <img src="http://192.168.1.9:5173/api/images/${A}" alt="" />}`
    const out = await swap(code, A, B, 'https://mocky.example.com')
    expect(out).toContain(`https://mocky.example.com/api/images/${B}`)
    expect(out).not.toContain('192.168.1.9')
  })

  it('does not give an origin to a URL that had none', async () => {
    // Inside the preview iframe the origin is opaque (I2); adding one would
    // change what the string resolves to.
    const code = `function App(){return <img src="/api/images/${A}" alt="" />}`
    const out = await swap(code, A, B)
    expect(out).toBe(`function App(){return <img src="/api/images/${B}" alt="" />}`)
  })

  it('keeps the interpolation around a template chunk', async () => {
    const code = 'function App({base}){ return <img src={`${base}/api/images/' + A + '`} alt="" /> }'
    const out = await swap(code, A, B)
    expect(out).toBe('function App({base}){ return <img src={`${base}/api/images/' + B + '`} alt="" /> }')
  })

  it('refuses a replacement hash that is not a content address', async () => {
    // The hash goes straight into a URL the iframe will fetch; anything that is
    // not 64 hex has come from somewhere it should not have.
    const code = `function App(){return <img src="/api/images/${A}" alt="" />}`
    const found = await findScreenImages(code)
    expect(replaceScreenImage(code, found[0].spans, '../../etc/passwd', ORIGIN)).toBe(code)
    expect(replaceScreenImage(code, found[0].spans, '', ORIGIN)).toBe(code)
  })

  it('produces source that still parses, and finds the new image in it', async () => {
    // The round trip is the real assertion: a splice that broke the syntax
    // would leave a screen that renders nothing.
    const code = `
      function App(){
        return <section className="p-8">
          <img src="${ORIGIN}/api/images/${A}" alt="Hero" />
        </section>
      }`
    const out = await swap(code, A, B)
    const again = await findScreenImages(out)
    expect(again.map((i) => i.hash)).toEqual([B])
    expect(again[0].alt).toBe('Hero')
  })
})

/**
 * Giving one screen several different pictures.
 *
 * Muse produces ONE image per screen, so a page needing a hero, a card and an
 * avatar gets the same file in all three. Replacing them as a group is right
 * when they are one picture shown twice, and wrong when they were meant to be
 * different pictures Muse could not supply.
 */
describe('replacing one occurrence out of several', () => {
  const THREE = `
    function App(){
      return <div>
        <img src="${ORIGIN}/api/images/${A}" alt="Hero" className="h-64 w-full object-cover" />
        <img src="${ORIGIN}/api/images/${A}" alt="" className="h-12 w-12 rounded-full" />
        <img src="${ORIGIN}/api/images/${A}" alt="Card" className="h-32 w-full" />
      </div>
    }`

  it('describes each occurrence well enough to tell them apart', async () => {
    const [img] = await findScreenImages(THREE)
    expect(img.spans).toHaveLength(3)
    expect(img.spans.map((s) => s.alt)).toEqual(['Hero', '', 'Card'])
    // alt="" is correct on a decorative image, so many slots have no alt to be
    // named by — the classes are the fallback handle.
    expect(img.spans[1].context).toBe('h-12 w-12 rounded-full')
    // And each knows where it is, so it can be found in the Code view.
    expect(img.spans.map((s) => s.line)).toEqual([4, 5, 6])
  })

  it('swaps only the occurrence it was given', async () => {
    const [img] = await findScreenImages(THREE)
    const out = replaceScreenImage(THREE, [img.spans[1]], B, ORIGIN)
    const after = await findScreenImages(out)
    expect(after.map((i) => i.hash).sort()).toEqual([A, B].sort())
    // The avatar became B; the hero and the card are still A.
    expect(after.find((i) => i.hash === B)!.spans[0].context).toBe('h-12 w-12 rounded-full')
    expect(after.find((i) => i.hash === A)!.spans.map((s) => s.alt)).toEqual(['Hero', 'Card'])
  })

  it('lets each slot end up with a different picture', async () => {
    // The whole point of the feature: one screen, three slots, three images.
    // Re-read between passes, exactly as the dialog does — the offsets move.
    const avatar = (await findScreenImages(THREE)).find((i) => i.hash === A)!.spans[1]
    let code = replaceScreenImage(THREE, [avatar], B, ORIGIN)

    const card = (await findScreenImages(code)).find((i) => i.hash === A)!.spans[1]
    expect(card.alt).toBe('Card')
    code = replaceScreenImage(code, [card], C, ORIGIN)

    const final = await findScreenImages(code)
    expect(final.map((i) => i.hash).sort()).toEqual([A, B, C].sort())
    // And each landed in the slot it was aimed at.
    expect(final.find((i) => i.hash === A)!.spans[0].alt).toBe('Hero')
    expect(final.find((i) => i.hash === B)!.spans[0].context).toBe('h-12 w-12 rounded-full')
    expect(final.find((i) => i.hash === C)!.spans[0].alt).toBe('Card')
  })

  it('still moves them as a unit when handed the whole set', async () => {
    const [img] = await findScreenImages(THREE)
    const out = replaceScreenImage(THREE, img.spans, B, ORIGIN)
    expect(out).not.toContain(A)
    expect((await findScreenImages(out))[0].spans).toHaveLength(3)
  })
})
