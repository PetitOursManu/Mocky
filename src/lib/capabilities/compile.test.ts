import { describe, it, expect } from 'vitest'
import * as Babel from '@babel/standalone'
import { CAPABILITIES } from './registry'
import { resolveCapabilities } from './select'
import { buildPrelude } from './prelude'

/**
 * Every snippet pack must survive the compiler that actually runs it.
 *
 * The packs are STRINGS. Nothing type-checks them, nothing lints them, and a
 * missing bracket in one of them is invisible until a generated screen fails to
 * render inside a sandboxed iframe — where the error surfaces as a blank frame
 * and a message nobody reads. This runs the same transform the preview shell
 * runs, so a syntax error fails the build instead.
 */

const transform = (src: string) =>
  Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code

describe('every snippet pack compiles', () => {
  for (const pack of CAPABILITIES.filter((c) => c.kind === 'snippet-pack')) {
    it(pack.id, () => {
      const prelude = buildPrelude(resolveCapabilities([pack.id]))
      expect(prelude.length).toBeGreaterThan(0)
      expect(() => transform(prelude)).not.toThrow()
    })
  }

  it('and they compile together, as the preview injects them', () => {
    const ids = CAPABILITIES.filter((c) => c.kind === 'snippet-pack').map((c) => c.id)
    expect(() => transform(buildPrelude(resolveCapabilities(ids)))).not.toThrow()
  })
})

describe('Animated', () => {
  const prelude = buildPrelude(resolveCapabilities(['animate']))

  it('honours the "no animation" switch the shell passes in', () => {
    // Without this the button says "Sans animation" and the screens already on
    // the canvas keep moving, because the presets are baked into their code.
    expect(prelude).toContain('window.__mockyAnimations === false')
  })

  it('refuses to animate a hidden document, and says why in code', () => {
    // Motion holds an element at its `initial` state until the frame loop
    // starts, and browsers do not run it while hidden — measured: a mockup in a
    // background tab sits at opacity 0 forever.
    expect(prelude).toContain('document.hidden')
    expect(prelude).toContain('prefers-reduced-motion')
  })

  it('never lets an unknown preset produce an empty element', () => {
    // An unknown name falls through to the plain tag WITH its children.
    expect(prelude).toContain('var animating = Boolean(config) && allowed.current === true')
    expect(prelude).toMatch(/if \(!animating\) \{[\s\S]{0,160}React\.createElement\(Tag[\s\S]{0,120}children\)/)
  })

  it('calls its hooks unconditionally', () => {
    // document.hidden can flip while a mockup is open. If the early return sat
    // before the hooks, the next render would call fewer of them than the last
    // — "Rendered fewer hooks than expected", which kills the whole frame.
    const body = prelude.slice(prelude.indexOf('var Animated = function'))
    const guard = body.indexOf('if (!animating)')
    const lastHook = Math.max(
      body.lastIndexOf('React.useRef', guard),
      body.lastIndexOf('React.useState', guard),
      body.lastIndexOf('React.useEffect', guard),
    )
    expect(lastHook).toBeGreaterThan(0)
    expect(lastHook).toBeLessThan(guard)
  })

  it('gives a statistic its real number when it is not allowed to count', () => {
    // A KPI stuck at 0 is not a missing animation, it is wrong data.
    expect(prelude).toContain('React.useState(allowed.current ? 0 : to)')
  })

  it('exposes no Motion API beyond the closed preset list', () => {
    for (const name of ['fade-in', 'fade-up', 'scale-in', 'stagger-list', 'hover-lift', 'exit-slide']) {
      expect(prelude).toContain(`'${name}'`)
    }
    // The model is given <Animated>, never the library itself.
    expect(prelude).not.toMatch(/from ['"]motion/)
  })
})

describe('ScrollSequence', () => {
  const prelude = buildPrelude(resolveCapabilities(['scrollvideo']))

  it('compiles together with a screen that uses it', () => {
    const screen = `
      function App() {
        return (
          <div>
            <ScrollSequence base="/api/videos/abc" frames={60} height={300}>
              <h1 className="text-6xl">Un titre</h1>
            </ScrollSequence>
            <section className="p-10">suite de la page</section>
          </div>
        )
      }
    `
    expect(() => transform(prelude + '\n' + screen)).not.toThrow()
  })

  it('reads its frames from the app origin, never from a media element', () => {
    // The whole reason the server cuts the clip into JPEGs: the preview's CSP
    // allows img-src and nothing media-shaped. A <video> creeping in here would
    // be blocked at runtime, silently.
    expect(prelude).not.toMatch(/<video|createElement\(\s*['"]video['"]/)
    expect(prelude).toContain("'/f/'")
    expect(prelude).toContain('canvas')
  })

  it('drives the frame from scroll progress, clamped to the sequence', () => {
    // The three things that make scrubbing correct rather than approximate.
    expect(prelude).toContain('getBoundingClientRect')
    expect(prelude).toContain('window.innerHeight')
    expect(prelude).toMatch(/progress\s*<\s*0\s*\?\s*0\s*:\s*progress\s*>\s*1\s*\?\s*1/)
  })
})
