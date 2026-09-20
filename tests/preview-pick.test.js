import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'Preview.tsx'),
  'utf8',
)

/**
 * The message listener's GUARDS, and why they are read from refs.
 *
 * `Preview` subscribes to `message` once per srcDoc — deliberately, because
 * re-subscribing resets `ready` and re-arms the twenty-second render timeout,
 * and a preview that flickered back to "loading" every time the parent
 * re-rendered would be unusable. Everything the listener needs from a prop is
 * therefore kept in a ref.
 *
 * Two of them were not, and both were guards rather than callbacks, which is
 * what made the failure so quiet: the frame does the hover outline itself (it
 * is told `pick on` by another effect, with its own dependencies), so the
 * element lit up, the click was posted — and the parent dropped it against a
 * `pickMode` that was still `false` from the render the closure was built on. A
 * tool is always turned on AFTER a screen has rendered, so the modify tool
 * never worked from the canvas: "les éléments apparaissent bien au survol mais
 * si je clique dessus rien ne se passe".
 *
 * A source check rather than a rendered one: this repository runs no DOM in its
 * tests, and what has to hold is a property of the closure rather than of a
 * frame. It is the same shape as the compose-file checks in `tests/`.
 */
describe('the preview message listener', () => {
  it('reads its guards from refs, never from the closure it was built in', () => {
    expect(source).toMatch(/d\.type === 'picked' && pickModeRef\.current/)
    expect(source).toMatch(/d\.type === 'navigate' && demoLinksRef\.current/)
    // The mirror-image mistake: fixing the staleness by adding the props to the
    // listener's dependencies, which is what resets `ready` on every tool.
    const subscribe = source.slice(source.indexOf('function onMsg'))
    const deps = subscribe.match(/}, \[[^\]]*\]\)/)
    expect(deps, 'the message effect has no dependency array any more').toBeTruthy()
    expect(deps?.[0]).not.toMatch(/pickMode\b/)
    expect(deps?.[0]).not.toMatch(/demoLinks\b/)
  })

  it('keeps both refs in step with the props on every render', () => {
    expect(source).toMatch(/pickModeRef\.current = pickMode/)
    expect(source).toMatch(/demoLinksRef\.current = demoLinks/)
  })
})
