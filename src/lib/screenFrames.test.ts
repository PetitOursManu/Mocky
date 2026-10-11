import { describe, expect, it } from 'vitest'
import { changeScreenFrame, findScreenFrames } from './screenFrames'
import { capabilitiesUsedBy } from './capabilities/select'

const SCREEN = `export default function Post() {
  const items = [{ photo: '/api/images/aaa' }, { photo: '/api/images/bbb' }]
  return (
    <main className="p-10">
      <ShapeFrame shape="blob-3" src="/api/images/hero" alt="Une plage" className="w-[420px]" />
      <img src="/api/images/side" alt="Un café" className="w-40 rounded" />
      <img src={items[0].photo} alt="" />
      {items.map((it) => (
        <ShapeFrame key={it.photo} shape="circle" src={it.photo} shadow />
      ))}
    </main>
  )
}`

describe('the frames of a screen', () => {
  it('lists every frame and every picture with a written address, in source order', async () => {
    const found = await findScreenFrames(SCREEN)
    expect(found).toEqual([
      { kind: 'frame', index: 0, shape: 'blob-3', src: '/api/images/hero', alt: 'Une plage', focus: null, shadow: false, repeated: false },
      { kind: 'img', index: 0, shape: null, src: '/api/images/side', alt: 'Un café', focus: null, shadow: false, repeated: false },
      { kind: 'frame', index: 1, shape: 'circle', src: null, alt: null, focus: null, shadow: true, repeated: true },
    ])
  })

  it('changes a frame’s shape, picture and framing by writing those attributes and nothing else', async () => {
    const out = await changeScreenFrame(
      SCREEN,
      { kind: 'frame', index: 0 },
      { shape: 'arch', src: '/api/images/new', focus: 'top', shadow: true },
    )
    expect(out).not.toBeNull()
    expect(out).toContain('<ShapeFrame focus="top" shadow shape="arch" src="/api/images/new" alt="Une plage" className="w-[420px]" />')
    // Everything else is byte for byte what it was.
    expect(
      out!.replace(
        /<ShapeFrame focus="top" shadow shape="arch" src="\/api\/images\/new"/,
        '<ShapeFrame shape="blob-3" src="/api/images/hero"',
      ),
    ).toBe(SCREEN)
  })

  it('puts a picture in a frame: the tag becomes the component, its attributes stay', async () => {
    const out = await changeScreenFrame(SCREEN, { kind: 'img', index: 0 }, { shape: 'polaroid' })
    expect(out).toContain('<ShapeFrame shape="polaroid" src="/api/images/side" alt="Un café" className="w-40 rounded" />')
    expect(capabilitiesUsedBy(out!)).toContain('frames')
    const framed = await findScreenFrames(out!)
    expect(framed.filter((f) => f.kind === 'frame').map((f) => f.shape)).toEqual(['blob-3', 'polaroid', 'circle'])
  })

  it('renames the closing tag too when the picture was written with one', async () => {
    const out = await changeScreenFrame('const A = () => <img src="/x" alt="y"></img>', { kind: 'img', index: 0 }, { shape: 'heart' })
    expect(out).toBe('const A = () => <ShapeFrame shape="heart" src="/x" alt="y"></ShapeFrame>')
  })

  it('changes the shape of a repeated frame, but never writes a literal over a computed picture', async () => {
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 1 }, { shape: 'star' })).toContain('shape="star" src={it.photo}')
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 1 }, { src: '/api/images/zzz' })).toBeNull()
  })

  it('removes a shadow by writing it false, and adds nothing to say "no shadow" where there was none', async () => {
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 1 }, { shadow: false })).toContain('src={it.photo} shadow={false}')
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 0 }, { shadow: false })).toBeNull()
  })

  it('writes a value with a quote in an expression, because a JSX string has no escapes', async () => {
    const out = await changeScreenFrame(SCREEN, { kind: 'frame', index: 0 }, { alt: 'Le "grand" bleu' })
    expect(out).toContain('alt={"Le \\"grand\\" bleu"}')
  })

  it('refuses what it cannot write: an unknown shape, a missing element, a picture with no shape, a source that does not parse', async () => {
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 0 }, { shape: 'hexagram' })).toBeNull()
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 7 }, { shape: 'arch' })).toBeNull()
    expect(await changeScreenFrame(SCREEN, { kind: 'img', index: 0 }, { focus: 'top' })).toBeNull()
    expect(await changeScreenFrame(SCREEN, { kind: 'frame', index: 0 }, { focus: 'middle' as never })).toBeNull()
    expect(await changeScreenFrame('<div', { kind: 'frame', index: 0 }, { shape: 'arch' })).toBeNull()
    expect(await findScreenFrames('<div')).toEqual([])
  })
})
