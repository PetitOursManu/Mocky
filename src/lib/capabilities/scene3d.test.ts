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

/**
 * The catalogue after it grew, and the two things growing it could break.
 *
 * Six scenes were six variations on one idea: a single body, centred, in one
 * ink. The four added are the shapes a page actually asks for — a globe (the
 * name Motion's own block carries, so a film and the page it came from say the
 * same word), cards floating in depth, a cluster, and a tunnel. A second hue
 * came with them, because a scene painted in one ink beside a two-colour
 * palette is what made the first six read as the same object in different
 * shapes.
 */
describe('the scenes that are made of several parts', () => {
  it('takes its reach from the GROUP, not from one geometry', () => {
    // A globe's ring is wider than its dots: a bound read off the dots would
    // have cut the ring — the defect the framing rule exists to stop, one
    // object further out.
    expect(Scene3DSource).toContain('for (var ki = 0; ki < group.children.length; ki++)')
    expect(Scene3DSource).toContain('child.position.length() + (bs.center.length() + bs.radius) * sc')
  })

  it('disposes everything it allocated, not the last thing it made', () => {
    // Half the catalogue is composite now, and a geometry or material left out
    // of the cleanup is GPU memory that outlives the screen that asked for it.
    expect(Scene3DSource).toContain('var owned = [];')
    expect(Scene3DSource).toContain('for (var oi = 0; oi < owned.length; oi++)')
  })

  it('accepts a second hex, and falls back to the first rather than to the house ink', () => {
    expect(Scene3DSource).toContain("mockySceneColor(props.accent, color)")
    expect(Scene3DSource).toContain("mockySceneColor(props.color, '#6366f1')")
    const card = cap('scene3d')?.components?.[0]?.description ?? ''
    expect(card).toContain('accent')
    expect(card).toContain('OPTIONAL')
  })

  it('sways what cannot spin, and travels what has nowhere to turn', () => {
    // A panel turned edge-on is a hairline, so a stack of cards sways instead
    // of spinning; a tunnel has no orientation to change, so it MOVES.
    expect(Scene3DSource).toMatch(/stack: \{[^}]*sway: [\d.]+/)
    expect(Scene3DSource).toContain('scene.sway')
    expect(Scene3DSource).toContain('drift.position.z = (t * 0.5 * speed) % driftSpan')
  })

  it('names a globe the way Motion names one', () => {
    // Not a coincidence to be tidied away later: the block a film draws and the
    // scene a page draws are the same object, so they carry the same word.
    expect(SCENE3D_PRESETS).toContain('globe')
    expect(Scene3DSource).toMatch(/globe: \{ body: 'globe'/)
  })
})

/**
 * What a scene does when the page moves.
 *
 * The first ten turned at a constant rate and noticed nothing else, which is
 * what a screensaver does. Three answers were added at once, and the reason
 * there are three is the `orb`: a SPHERE rotated ten degrees is the same
 * sphere, so a turn alone would have been invisible on the preset a page
 * reaches for first. The body turns, the camera slides (a real parallax, which
 * every body shows, the fields included), and the key light travels so the
 * highlight sweeps a surface with no features to turn.
 *
 * None of it can be seen without frames, so it is checked the way the framing
 * is: the arithmetic is lifted out of the shipped source and run.
 */
describe('a scene answers the cursor and the scroll', () => {
  const lift = (re: RegExp) => Scene3DSource.match(re)?.[0] ?? ''
  const run = (body: string, name: string) =>
    new Function(`${body}\nreturn ${name}`)()

  const scroll = run(lift(/function mockySceneScroll[\s\S]*?\n\}/), 'mockySceneScroll') as (
    box: { top: number; height: number },
    viewport: number,
  ) => number

  it('reads the scroll as -1 entering, 0 centred, +1 leaving', () => {
    const vh = 900
    const h = 300
    // Centre of the element on the centre of the viewport.
    expect(scroll({ top: vh / 2 - h / 2, height: h }, vh)).toBeCloseTo(0, 6)
    // Just below the fold, and just above the top.
    expect(scroll({ top: vh, height: h }, vh)).toBeLessThan(-0.5)
    expect(scroll({ top: -h, height: h }, vh)).toBeGreaterThan(0.5)
    // Clamped, monotone, and never NaN on a degenerate box.
    expect(scroll({ top: 10 * vh, height: h }, vh)).toBe(-1)
    expect(scroll({ top: -10 * vh, height: h }, vh)).toBe(1)
    expect(scroll({ top: 0, height: 0 }, 0)).toBe(0)
  })

  it('slides the camera without letting a body leave the box', () => {
    // The slide is spent out of the framing margin: at tangency the slack is
    // about 0.074 of the half-angle, and this spends 0.046 of it. Checked as
    // the real condition — the centre's angular offset plus the body's own
    // angular radius stays inside the half-angle.
    const reachSrc = `${lift(/var MOCKY_SCENE_MARGIN = [\d.]+;/)}\n${lift(/function mockySceneReach[\s\S]*?\n\}/)}`
    const reach = run(reachSrc, 'mockySceneReach') as (r: number, fov: number, a: number) => number
    const slideShare = Number(lift(/var MOCKY_LOOK_SLIDE = ([\d.]+);/).match(/[\d.]+/)?.[0])
    expect(slideShare).toBeGreaterThan(0)

    const FOV = 42
    for (const aspect of [0.2, 0.39, 1, 2.29, 5]) {
      for (const radius of [0.6, 1.35, 2.4]) {
        const d = reach(radius, FOV, aspect)
        const slide = radius * slideShare
        const halfV = (FOV * Math.PI) / 360
        const half = Math.min(halfV, Math.atan(Math.tan(halfV) * aspect))
        const offset = Math.atan(slide / d)
        const own = Math.asin(radius / Math.hypot(d, slide))
        expect(offset + own, `${radius} at ${aspect}`).toBeLessThan(half)
      }
    }
  })

  it('listens on the window, and stops listening when it stops drawing', () => {
    // The usual shape is a scene behind a headline, so the cursor is over the
    // text nine times out of ten and an element listener would never fire.
    expect(Scene3DSource).toContain("window.addEventListener('pointermove', onPointer, { passive: true })")
    // A listener per screen on the canvas, left behind, is the leak this avoids.
    expect(Scene3DSource).toContain("window.removeEventListener('pointermove', onPointer)")
    expect(Scene3DSource).toMatch(/function stop\(keep\) \{\s*\n(\s*\/\*[\s\S]*?\*\/\s*\n)?\s*deafen\(\);/)
    // A scene that must hold still attaches none of it.
    expect(Scene3DSource).toContain('if (listening || reduced || stillOnly) return;')
    // And no frame reads layout: the box is measured on scroll and on resize.
    expect(Scene3DSource).toContain("window.addEventListener('scroll', measure, { passive: true })")
  })

  it('answers in three ways, because one of them is invisible on a sphere', () => {
    expect(Scene3DSource).toContain('camera.position.x = lookX * slide')
    expect(Scene3DSource).toContain('keyLight.position.set(2.5 + lookX * 1.8')
    expect(Scene3DSource).toContain('group.rotation.y += lookX * MOCKY_LOOK_YAW')
  })
})

/**
 * The two shapes the card teaches are not equally safe, and the backdrop one is
 * where a page loses its text: a headline stands ON the scene, and nothing here
 * measures the contrast of a moving pixel.
 */
describe('a backdrop stays behind', () => {
  it('dims a scene taken out of the flow, and only that one', () => {
    expect(Scene3DSource).toContain('var backdrop = ')
    expect(Scene3DSource).toMatch(/var backdrop = \/\(\^\|\\s\)\(absolute\|fixed\)/)
    expect(Scene3DSource).toContain('opacity: backdrop && !dimmed ? 0.62 : undefined')
    // relative and sticky are still in the flow — a subject with a size, not a
    // surface under something else — so they keep their full strength.
    expect(Scene3DSource).not.toContain('absolute|fixed|sticky)(')
  })

  it('never takes a click, being decorative and aria-hidden both', () => {
    expect(Scene3DSource).toContain("pointerEvents: 'none'")
    expect(Scene3DSource).toContain("'aria-hidden': 'true'")
  })

  it('lets the page overrule it, as it does for the position', () => {
    expect(Scene3DSource).toMatch(/var dimmed = \/\(\^\|\\s\)-\?opacity-\//)
    expect(Scene3DSource).toContain('props.style.opacity !== undefined')
  })
})

/**
 * The console a preview leaves behind.
 *
 * A generated screen's console is where a USER looks for their own error, so a
 * line Mocky puts there three times per screen costs more than it looks:
 * `THREE.Clock` is deprecated in 0.185 and says so on construction. Nothing
 * here needed the class — a start stamp and a subtraction are what it did — so
 * it is gone from the component AND from the vendored entry point, which is the
 * half that makes it impossible to come back quietly.
 */
describe('a scene keeps its own time', () => {
  it('constructs nothing three.js has deprecated', () => {
    // The class, not the word: the comment beside the replacement names it.
    expect(Scene3DSource).not.toContain('new THREE.Clock')
    expect(Scene3DSource).toContain('performance.now')
  })

  it('measures seconds, which is all the clock was for', () => {
    const elapsed = new Function(
      `var window = { performance: { now: function () { return 1500; } } };
       var performance = window.performance;
       var startedAt = 500;
       ${Scene3DSource.match(/function elapsed\(\)[\s\S]*?\n    \}/)?.[0]}
       return elapsed`,
    )() as () => number
    expect(elapsed()).toBeCloseTo(1, 6)
  })
})

/**
 * One live scene per screen, and why the component is what enforces it.
 *
 * The canvas grants a context PER SCREEN — it posts to an iframe and cannot see
 * inside it — so a screen drawing three scenes spends three of the browser's
 * sixteen while the arbiter believes it spent one. Four such screens are
 * twelve, and the seventeenth context kills the OLDEST: a scene somebody is
 * looking at goes blank because of a page nobody is. Verified in a browser
 * with three `<Scene3D>` on one page: three elements, ONE canvas, two calm
 * gradients.
 */
describe('a screen spends one context, whatever the model wrote', () => {
  it('claims a slot before it builds anything', () => {
    expect(Scene3DSource).toContain('function mockySceneClaim()')
    expect(Scene3DSource).toContain('if (window.__mockyScene) return false;')
    expect(Scene3DSource).toContain('var slot = rationed ? mockySceneClaim() : true;')
    // Refused: no renderer, no listeners, no cleanup to undo — the gradient
    // the element already draws stands, which is the no-WebGL fallback.
    expect(Scene3DSource).toContain('if (!slot) return function () {};')
  })

  it('gives the slot back when the scene goes away', () => {
    // A screen is re-rendered on every edit; a slot never released would make
    // the second render of the same page draw nothing at all.
    expect(Scene3DSource).toContain('if (rationed) mockySceneRelease();')
    expect(Scene3DSource).toContain('function mockySceneRelease()')
  })

  it('rations nothing on the paths that hold no context', () => {
    // A capture frame and a reduced-motion page take one frame and give the
    // context back inside the same task, so two of them never overlap — and
    // refusing the second there would put a gradient in a thumbnail that could
    // have had the object.
    expect(Scene3DSource).toContain('var rationed = !(stillOnly || reduced);')
    // And the ORDER, which is the half this test was missing while the line
    // above passed: `stillOnly` was declared fifteen lines further down, so
    // `var` hoisting made it `undefined` at the only place that reads it and
    // every path was rationed after all. A capture of a page with two scenes
    // did exactly what the sentence above says must not happen. Reading the
    // text of a line proves the line exists, not that it runs with a value.
    const declared = Scene3DSource.indexOf('var stillOnly = window.__mockyStill === true')
    const read = Scene3DSource.indexOf('var rationed = !(stillOnly || reduced);')
    expect(declared).toBeGreaterThan(-1)
    expect(declared).toBeLessThan(read)
  })

  it('says so on the card, because a model should know what it gets', () => {
    const card = cap('scene3d')?.components?.[0]?.description ?? ''
    expect(card).toContain('ENFORCED')
    expect(card).toContain('tilt-3d')
  })
})
