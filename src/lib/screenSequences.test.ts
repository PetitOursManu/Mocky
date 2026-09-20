import { describe, expect, it } from 'vitest'
import { findScreenSequences, replaceScreenSequence } from './screenSequences'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const ORIGIN = 'http://localhost:5173'

const HERO = `
  function App(){
    return <div>
      <ScrollSequence base="${ORIGIN}/api/videos/${A}" frames={60} height={300}>
        <h1>Hello</h1>
      </ScrollSequence>
      <section className="p-8">Rest of the page</section>
    </div>
  }`

describe('findScreenSequences', () => {
  it('finds the hero sequence of a screen that has one', async () => {
    const found = await findScreenSequences(HERO)
    expect(found).toHaveLength(1)
    expect(found[0].hash).toBe(A)
    // The count is half the identity — a sequence found without it is not found.
    expect(found[0].frames).toBe(60)
    expect(found[0].element).toBe('ScrollSequence')
    expect(found[0].base.absolute).toBe(true)
    expect(found[0].line).toBe(4)
  })

  it('invents nothing on a screen with no sequence', async () => {
    const code = `function App(){return <img src="/api/images/${A}" alt="" />}`
    expect(await findScreenSequences(code)).toEqual([])
  })

  it('says nothing about a file it cannot parse', async () => {
    // Guessing with a regex after a failed parse is what invariant I1 forbids —
    // and the address is right there in the text, so a fallback would "work".
    const broken = `function App(){ return <ScrollSequence base="/api/videos/${A}" frames={60} ; ; /> }`
    expect(await findScreenSequences(broken)).toEqual([])
  })

  it('ignores an address inside a comment', async () => {
    const code = `
      function App(){
        // was: <ScrollSequence base="/api/videos/${A}" frames={60} />
        return <div />
      }`
    expect(await findScreenSequences(code)).toEqual([])
  })

  it('ignores an address with no frame count beside it', async () => {
    // Half a sequence is not a sequence: offering to re-point it would write an
    // address whose count nothing states.
    const code = `function App(){return <a href="/api/videos/${A}">clip</a>}`
    expect(await findScreenSequences(code)).toEqual([])
  })

  it('ignores a count it cannot rewrite', async () => {
    // `frames={total}` cannot be re-authored without guessing what `total` will
    // be, and rewriting the address alone draws the last frame for the rest of
    // the scroll. Not reported rather than reported as replaceable.
    const code = `function App({total}){return <ScrollSequence base="/api/videos/${A}" frames={total} />}`
    expect(await findScreenSequences(code)).toEqual([])
  })

  it('finds a count written as a string attribute', async () => {
    // Legal JSX, and the component parseInt()s its props, so such a screen works
    // and has to stay replaceable.
    const code = `function App(){return <ScrollSequence base="/api/videos/${A}" frames="42" />}`
    const [seq] = await findScreenSequences(code)
    expect(seq.frames).toBe(42)
  })

  it('finds a sequence under a component name of the model’s own', async () => {
    // The pair is what identifies a sequence, not the element name: a model that
    // wrapped the component in one of its own still wrote a hero the user must
    // be able to re-point.
    const code = `function App(){return <Hero base="/api/videos/${A}" frames={12} />}`
    const [seq] = await findScreenSequences(code)
    expect(seq.hash).toBe(A)
    expect(seq.element).toBe('Hero')
  })

  it('records a relative address as having no origin', async () => {
    const code = `function App(){return <ScrollSequence base="/api/videos/${A}" frames={30} />}`
    expect((await findScreenSequences(code))[0].base.absolute).toBe(false)
  })

  it('finds an address written into a template literal', async () => {
    const code =
      'function App({origin}){return <ScrollSequence base={`${origin}/api/videos/' + A + '`} frames={8} />}'
    const [seq] = await findScreenSequences(code)
    expect(seq.hash).toBe(A)
    expect(seq.frames).toBe(8)
  })

  it('ignores a malformed hash', async () => {
    const code = `function App(){return <ScrollSequence base="/api/videos/deadbeef" frames={60} />}`
    expect(await findScreenSequences(code)).toEqual([])
  })

  it('lists two heroes separately rather than grouping them', async () => {
    // Unlike images: two sequences are two sections with two counts, and a
    // "replace everywhere" would put one clip's count on the other's address.
    const code = `
      function App(){
        return <div>
          <ScrollSequence base="/api/videos/${A}" frames={60} />
          <ScrollSequence base="/api/videos/${A}" frames={24} />
        </div>
      }`
    const found = await findScreenSequences(code)
    expect(found.map((s) => s.frames)).toEqual([60, 24])
  })
})

describe('replaceScreenSequence', () => {
  it('rewrites the address and the count together', async () => {
    // THE defect this module exists for. Rewriting one and not the other leaves
    // a player that draws its last frame for the rest of the scroll, with no
    // error anywhere and source that still parses.
    const [seq] = await findScreenSequences(HERO)
    const out = replaceScreenSequence(HERO, seq, { hash: B, frames: 90 }, ORIGIN)
    expect(out).toContain(`/api/videos/${B}`)
    expect(out).toContain('frames={90}')
    expect(out).not.toContain(A)
    expect(out).not.toContain('frames={60}')
  })

  it('leaves every other byte of the element alone', async () => {
    const [seq] = await findScreenSequences(HERO)
    const out = replaceScreenSequence(HERO, seq, { hash: B, frames: 90 }, ORIGIN)
    expect(out).toBe(HERO.replace(A, B).replace('frames={60}', 'frames={90}'))
  })

  it('produces source that still parses, and finds the new pair in it', async () => {
    // The round trip is the real assertion: a splice that broke the syntax would
    // leave a screen that renders nothing, and the offsets here straddle two
    // attributes rather than one.
    const [seq] = await findScreenSequences(HERO)
    const out = replaceScreenSequence(HERO, seq, { hash: B, frames: 90 }, ORIGIN)
    const again = await findScreenSequences(out)
    expect(again).toHaveLength(1)
    expect(again[0].hash).toBe(B)
    expect(again[0].frames).toBe(90)
    expect(again[0].element).toBe('ScrollSequence')
  })

  it('rewrites a stale origin to the current one', async () => {
    const code = `function App(){return <ScrollSequence base="http://192.168.1.9:5173/api/videos/${A}" frames={60} />}`
    const [seq] = await findScreenSequences(code)
    const out = replaceScreenSequence(code, seq, { hash: B, frames: 12 }, 'https://mocky.example.com')
    expect(out).toContain(`https://mocky.example.com/api/videos/${B}`)
    expect(out).not.toContain('192.168.1.9')
  })

  it('does not give an origin to an address that had none', async () => {
    // Inside the preview iframe the origin is opaque (I2); adding one would
    // change what the string resolves to.
    const code = `function App(){return <ScrollSequence base="/api/videos/${A}" frames={60} />}`
    const [seq] = await findScreenSequences(code)
    expect(replaceScreenSequence(code, seq, { hash: B, frames: 12 }, ORIGIN)).toBe(
      `function App(){return <ScrollSequence base="/api/videos/${B}" frames={12} />}`,
    )
  })

  it('keeps the interpolation around a template chunk', async () => {
    const code =
      'function App({origin}){return <ScrollSequence base={`${origin}/api/videos/' + A + '`} frames={8} />}'
    const [seq] = await findScreenSequences(code)
    const out = replaceScreenSequence(code, seq, { hash: B, frames: 9 }, ORIGIN)
    expect(out).toBe(
      'function App({origin}){return <ScrollSequence base={`${origin}/api/videos/' + B + '`} frames={9} />}',
    )
  })

  it('rewrites a string count inside its quotes', async () => {
    const code = `function App(){return <ScrollSequence base="/api/videos/${A}" frames="42" />}`
    const [seq] = await findScreenSequences(code)
    const out = replaceScreenSequence(code, seq, { hash: B, frames: 7 }, ORIGIN)
    expect(out).toContain('frames="7"')
    expect((await findScreenSequences(out))[0].frames).toBe(7)
  })

  it('touches only the occurrence it was given', async () => {
    const code = `
      function App(){
        return <div>
          <ScrollSequence base="/api/videos/${A}" frames={60} />
          <ScrollSequence base="/api/videos/${A}" frames={24} />
        </div>
      }`
    const found = await findScreenSequences(code)
    const out = replaceScreenSequence(code, found[1], { hash: B, frames: 5 }, ORIGIN)
    const after = await findScreenSequences(out)
    expect(after.map((s) => [s.hash, s.frames])).toEqual([
      [A, 60],
      [B, 5],
    ])
  })

  it('rewrites the pair when the model wrote frames before base', async () => {
    // Attribute order is the model's choice, and the two splices are sorted
    // right-to-left for exactly this case: with `frames` first, rewriting the
    // address before the count shifts the count's offsets and the digits land
    // in the middle of the URL. Nothing else in the module would notice.
    const code = `function App(){return <ScrollSequence frames={60} base="/api/videos/${A}" height={300} />}`
    const [seq] = await findScreenSequences(code)
    const out = replaceScreenSequence(code, seq, { hash: B, frames: 7 }, ORIGIN)
    expect(out).toBe(
      `function App(){return <ScrollSequence frames={7} base="/api/videos/${B}" height={300} />}`,
    )
    expect((await findScreenSequences(out))[0]).toMatchObject({ hash: B, frames: 7 })
  })

  it('survives the shape a real generated screen has', async () => {
    // Everything at once, because that is how it arrives: attributes over four
    // lines, the origin interpolated into a template, a count of three digits
    // becoming one — and two decoys naming the SAME clip, a commented-out note
    // and a download link. Neither carries a count, so neither is a sequence,
    // and neither may be touched by the swap.
    const code = `
      function App() {
        return (
          <div className="min-h-screen">
            <ScrollSequence
              base={\`\${window.location.origin}/api/videos/${A}\`}
              frames={124}
              height={300}
            >
              <h1 className="text-6xl">Cimes</h1>
            </ScrollSequence>
            {/* hero clip: /api/videos/${A} */}
            <a href="/api/videos/${A}">download</a>
          </div>
        )
      }`
    const found = await findScreenSequences(code)
    expect(found).toHaveLength(1)
    const out = replaceScreenSequence(code, found[0], { hash: B, frames: 9 }, 'https://mocky.example.com')
    // The pair moved together...
    expect(out).toContain(`\${window.location.origin}/api/videos/${B}`)
    expect(out).toContain('frames={9}')
    // ...the decoys did not, and the interpolation is intact.
    expect(out).toContain(`{/* hero clip: /api/videos/${A} */}`)
    expect(out).toContain(`<a href="/api/videos/${A}">`)
    const again = await findScreenSequences(out)
    expect(again).toHaveLength(1)
    expect(again[0]).toMatchObject({ hash: B, frames: 9, element: 'ScrollSequence' })
  })

  it('refuses a hash or a count that is not one', async () => {
    const code = `function App(){return <ScrollSequence base="/api/videos/${A}" frames={60} />}`
    const [seq] = await findScreenSequences(code)
    expect(replaceScreenSequence(code, seq, { hash: '../../etc/passwd', frames: 12 }, ORIGIN)).toBe(code)
    expect(replaceScreenSequence(code, seq, { hash: '', frames: 12 }, ORIGIN)).toBe(code)
    // A count of zero renders a black box three viewports tall: the component
    // bails out of loading entirely when `total` is 0.
    expect(replaceScreenSequence(code, seq, { hash: B, frames: 0 }, ORIGIN)).toBe(code)
    expect(replaceScreenSequence(code, seq, { hash: B, frames: 1.5 }, ORIGIN)).toBe(code)
  })
})
