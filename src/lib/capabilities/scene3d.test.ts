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

/**
 * The framing, proved by arithmetic rather than by reading.
 *
 * The catalogue shipped with a camera at a fixed distance, framed for a wide
 * box: on a rendered probe sheet of the six presets at three aspect ratios,
 * four were cut — the sphere in a tall box sliced by two straight vertical
 * lines, the knot in a square one cropped on all four sides. That is the defect
 * a viewer reads as broken software, and it is the same one Motion's globe had.
 *
 * `mockySceneReach` is lifted out of the shipped source and run here, because a
 * bound checked as a string is a bound nobody checked.
 */
describe('a body fits the box it is given', () => {
  /** The margin and the bound, lifted verbatim out of the shipped source. */
  const lift = (re: RegExp) => Scene3DSource.match(re)?.[0] ?? ''
  const reach = new Function(
    `${lift(/var MOCKY_SCENE_MARGIN = [\d.]+;/)}
     ${lift(/function mockySceneReach[\s\S]*?\n\}/)}
     return mockySceneReach`,
  )() as (r: number, fov: number, aspect: number) => number

  const FOV = 42
  const half = (aspect: number) => {
    const halfV = (FOV * Math.PI) / 360
    return Math.min(halfV, Math.atan(Math.tan(halfV) * aspect))
  }

  it('keeps the whole bounding sphere inside the frustum, at every shape of box', () => {
    // 140x360 (a column), 240x240, 320x140 (a band), and two extremes either way.
    for (const aspect of [0.2, 0.39, 1, 2.29, 5]) {
      for (const radius of [0.6, 1.35, 1.6, 2.4]) {
        const d = reach(radius, FOV, aspect)
        // Tangency: a sphere of radius R at distance d is inside a cone of
        // half-angle h exactly when d·sin(h) ≥ R. The margin is what keeps an
        // object from touching all four edges, which reads as not having fitted.
        expect(d * Math.sin(half(aspect)), `${radius} at ${aspect}`).toBeGreaterThan(radius * 1.05)
      }
    }
  })

  it('pushes the camera back as the box narrows, and never divides by zero', () => {
    const column = reach(1.35, FOV, 0.3)
    const square = reach(1.35, FOV, 1)
    const band = reach(1.35, FOV, 3)
    expect(column).toBeGreaterThan(square)
    // Past square the vertical angle is the smaller one, so a wider box changes
    // nothing: the height is what the object has to fit into.
    expect(band).toBeCloseTo(square, 6)
    expect(Number.isFinite(reach(1, FOV, 0))).toBe(true)
  })

  it('takes the radius from the geometry, and leaves the fields alone', () => {
    expect(Scene3DSource).toContain('computeBoundingSphere')
    // A body is an object and must fit; a field is a texture and is MEANT to run
    // past the edges, exactly as a background does.
    expect(Scene3DSource).toMatch(/orb: \{[^}]*fits: true/)
    expect(Scene3DSource).toMatch(/particles: \{[^}]*fits: false/)
    expect(Scene3DSource).toMatch(/wave: \{[^}]*fits: false/)
  })
})

/**
 * What the element does to the page around it.
 *
 * `position: relative` was written INLINE, and an inline rule beats a class: the
 * most natural hero a model can write — a scene `absolute inset-0` behind its
 * words — came back in the flow, where `inset-0` means nothing and the height of
 * an element whose only child is absolute is zero. Measured in a browser: the
 * host box was 151×0 with a live WebGL context inside it.
 */
describe('a scene inhabits the box the page gave it', () => {
  it('positions itself only when nothing else does', () => {
    expect(Scene3DSource).toContain("position: positioned ? undefined : 'relative'")
    expect(Scene3DSource).toMatch(/absolute\|fixed\|sticky\|relative/)
    // A style prop is a positioning statement too.
    expect(Scene3DSource).toContain('props.style.position')
  })

  it('never drops the calm gradient for an empty still', () => {
    // A scene revoked before its first paint produced a transparent 282-byte
    // PNG, and a poster used to replace the gradient — so the fallback became a
    // hole. Now a still is kept only when a frame was really drawn, and the
    // gradient stays underneath whatever happens.
    expect(Scene3DSource).toContain('if (!renderer || !drew) return;')
    expect(Scene3DSource).toContain('backgroundImage: mockySceneStill(color)')
    // A shorthand would reset the background-colour the page set with a class.
    expect(Scene3DSource).not.toContain('background: mockySceneStill')
  })

  it('holds still when the screen was asked to hold still', () => {
    // "Sans animation" is a promise about the SCREEN, not about one library:
    // the switch said no animation while the object kept turning. Same flag
    // <Animated> reads, same path as prefers-reduced-motion and a capture —
    // one frame, then the context back.
    expect(Scene3DSource).toContain('window.__mockyAnimations === false')
  })

  it('bounds what a still costs, because the canvas pays for it mid-pan', () => {
    // toDataURL on a hero-sized buffer (2880×1440) costs 35 ms of the main
    // thread, measured — a dropped frame per scene every time a pan changes who
    // holds the budget. A capture frame is the one place that pays full price.
    expect(Scene3DSource).toContain('640 / Math.max(src.width, src.height)')
    expect(Scene3DSource).toContain('stillOnly ? 1 :')
  })
})
