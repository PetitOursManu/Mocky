import { describe, it, expect } from 'vitest'
import { CAPABILITIES } from './registry'
import { Scene3DSource, SCENE3D_EXPORTS, SCENE3D_PRESETS, SCENE3D_SPEEDS } from './snippets/Scene3D'
import { ANIMATE_PRESETS, AnimateSource } from './snippets/Animate'

const cap = (id: string) => CAPABILITIES.find((c) => c.id === id)

/**
 * The 3D vocabulary, held to one list.
 *
 * A preset the model may name and the component cannot draw is a screen with a
 * quiet gradient where an object was asked for — the failure this catalogue is
 * shaped to make impossible, and the same check `Icons` and the Motion block
 * catalogue already carry in their own directories.
 */
describe('the 3D scene catalogue', () => {
  it('draws every preset the card offers, and offers every preset it draws', () => {
    const drawn = [...Scene3DSource.matchAll(/^ {2}(\w+): \{ body:/gm)].map((m) => m[1])
    expect(drawn.sort()).toEqual([...SCENE3D_PRESETS].sort())
    const card = cap('scene3d')?.components?.[0]?.description ?? ''
    for (const preset of SCENE3D_PRESETS) expect(card, preset).toContain(`"${preset}"`)
    for (const speed of SCENE3D_SPEEDS) expect(Scene3DSource, speed).toContain(`${speed}:`)
  })

  it('is a capability that loads the vendored library, and nothing from a CDN', () => {
    const lib = cap('three-lib')
    expect(lib?.kind).toBe('cdn-script')
    expect(lib?.cdn?.url).toBe('/vendor/three.js')
    expect(lib?.cdn?.url.startsWith('http')).toBe(false)
    expect(cap('scene3d')?.requires).toContain('three-lib')
    expect(cap('scene3d')?.snippets?.[0].exports).toEqual([...SCENE3D_EXPORTS])
  })

  /**
   * The three properties the whole feature rests on, checked in the source
   * because none of them can be observed without a GPU.
   */
  it('gives its context back, keeps the last frame, and survives losing it', () => {
    // Granted by the parent — the canvas arbitrates the sixteen the browser has.
    expect(Scene3DSource).toContain("window.addEventListener('mocky:gl'")
    expect(Scene3DSource).toContain('window.__mockyGL !== false')
    // Released rather than leaked, with the frame kept as an image first.
    expect(Scene3DSource).toContain('forceContextLoss')
    expect(Scene3DSource).toContain("toDataURL('image/png')")
    // And the browser may take it anyway.
    expect(Scene3DSource).toContain("'webglcontextlost'")
    // Paused when the document is hidden, and when the element is out of view.
    expect(Scene3DSource).toContain("document.addEventListener('visibilitychange'")
    expect(Scene3DSource).toContain('IntersectionObserver')
  })

  /**
   * A model writes hexes all day for Tailwind's arbitrary values; one of them
   * reaching a renderer unchecked is the one string in this component that
   * comes from outside it.
   */
  it('accepts a colour only as a hex, and falls back rather than failing', () => {
    expect(Scene3DSource).toMatch(/\^#\[0-9a-fA-F\]/)
    expect(Scene3DSource).toContain("'#6366f1'")
  })

  /**
   * Depth without a renderer, which is why it lives with the flat presets: a
   * tilt costs no context, so it is not rationed and may be used on a whole
   * grid of cards.
   */
  it('keeps the CSS tilt out of the rationed capability', () => {
    expect(ANIMATE_PRESETS).toContain('tilt-3d')
    expect(AnimateSource).toContain("'tilt-3d': { tilt:")
    expect(AnimateSource).toContain('perspective(900px)')
    // It returns to flat, so nothing is left rotated in a capture.
    expect(AnimateSource).toContain('onPointerLeave')
    expect(Scene3DSource).not.toContain('tilt-3d')
  })
})
