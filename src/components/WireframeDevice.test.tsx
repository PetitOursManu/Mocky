import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import WireframeDevice, { type WireframeScreenProps } from './WireframeDevice'
import { deviceFrame } from '../lib/deviceFrames'

/*
 * The one promise the drawing makes that the geometry cannot keep alone: the
 * screen's box is the opening, scaled — so hotspots expressed as fractions of
 * the screen land where they were drawn. A static render is enough to read it.
 */
function render(kind: 'phone' | 'tablet' | 'computer', w: number, h: number, scale: number, systemUi = true) {
  const frame = deviceFrame(kind, w, h)
  let seen: WireframeScreenProps | null = null
  const html = renderToStaticMarkup(
    <WireframeDevice frame={frame} scale={scale} caption="cap" systemUi={systemUi}>
      {(screen) => {
        seen = screen
        return <i data-screen="" />
      }}
    </WireframeDevice>,
  )
  return { frame, html, seen: seen as WireframeScreenProps | null }
}

describe('WireframeDevice', () => {
  it.each([
    ['phone', 390, 844, 0.8],
    ['tablet', 820, 1180, 0.5],
    ['computer', 1440, 900, 0.6],
  ] as const)('lays the %s screen exactly over the opening', (kind, w, h, s) => {
    const { frame, html } = render(kind, w, h, s)
    const px = (v: number) => `${v}px`
    const opening = new RegExp(
      `left:${px(frame.body.x * s)};top:${px(frame.body.y * s)};width:${px(w * s)};height:${px(h * s)}`,
    )
    expect(html).toMatch(opening)
    expect(html).toContain('data-screen')
    expect(html).toContain('cap')
  })

  // The page inside must lay out at the width it was DESIGNED at, whatever the
  // fit: sized to the scaled box, a 1440 screen in a laptop on a laptop window
  // laid out at ~900 px and showed its tablet layout under a desktop caption.
  it.each([
    ['computer', 1440, 900, 0.48],
    ['tablet', 820, 1180, 0.4],
    ['phone', 390, 844, 0.7],
  ] as const)('lays the %s page out at its design size and scales it', (kind, w, h, s) => {
    const { html } = render(kind, w, h, s)
    expect(html).toContain(`width:${w}px;height:${h}px;transform:scale(${s});transform-origin:0 0`)
  })

  it('rounds and hides scrollbars on touch devices, not on a laptop', () => {
    const phone = render('phone', 390, 844, 0.5)
    expect(phone.seen?.hideScrollbars).toBe(true)
    // In body px: the children are scaled with the box, so the radius is too.
    expect(phone.seen?.radius).toBe(`${phone.frame.body.r}px`)
    const laptop = render('computer', 1440, 900, 1).seen
    expect(laptop?.hideScrollbars).toBe(false)
    expect(laptop?.radius).toBeUndefined()
  })

  it('draws the island and status bar only on a phone', () => {
    expect(render('phone', 390, 844, 1).html).toContain('9:41')
    expect(render('tablet', 820, 1180, 1).html).not.toContain('9:41')
  })

  it('draws no system UI on a phone that is one only by width', () => {
    const bare = render('phone', 480, 900, 1, false)
    expect(bare.html).not.toContain('9:41')
    // The island is the only rect whose radius is half its height; its absence
    // and the camera dot in the bezel are what the screen gets instead.
    if (bare.frame.kind !== 'phone') throw new Error('expected a phone')
    expect(bare.html).not.toContain(`height="${bare.frame.island.h}"`)
    expect(bare.html).toContain(`cy="${bare.frame.camera.cy}"`)
    const promised = render('phone', 390, 844, 1, true)
    if (promised.frame.kind !== 'phone') throw new Error('expected a phone')
    expect(promised.html).not.toContain(`cy="${promised.frame.camera.cy}"`)
  })

  it('keeps every drawing out of the way of the pointer', () => {
    const { html } = render('computer', 1440, 900, 0.5)
    const svgs = html.match(/<svg[^>]*>/g) ?? []
    expect(svgs.length).toBeGreaterThan(0)
    for (const tag of svgs.filter((t) => t.includes('absolute'))) expect(tag).toContain('pointer-events-none')
  })
})
