import { describe, it, expect } from 'vitest'
import { PAGE_SCENES } from '../server/video/compose.js'
import { SCENE3D_PRESETS } from '../src/lib/capabilities/snippets/Scene3D'

/**
 * The one place where the page's 3D vocabulary and the film's meet.
 *
 * `<Scene3D preset>` is the browser's list; `PAGE_SCENES` in `compose.js` is
 * what the composer is told about each of them. They are owned by two files in
 * two languages, and this is the only check that can see both — the same
 * arrangement as `timeline.test.js`, which holds the schema to its Node mirror.
 *
 * A preset with no row is not a crash: the film is told "a three-dimensional
 * scene" and composes beside it (Q1). It IS a silent loss of the whole point —
 * the film can no longer echo what the page draws — so it fails here, where it
 * costs nothing, rather than in an export nobody can explain.
 */
describe('the page presets and what the composer is told about them', () => {
  it('has a row for every preset a page can draw', () => {
    for (const preset of SCENE3D_PRESETS) {
      expect(PAGE_SCENES[preset], `no row for "${preset}" in compose.js`).toBeTruthy()
    }
  })

  it('describes nothing a page cannot draw', () => {
    const drawn = new Set(SCENE3D_PRESETS)
    for (const preset of Object.keys(PAGE_SCENES)) {
      expect(drawn.has(preset), `"${preset}" is described but no page can draw it`).toBe(true)
    }
  })

  it('says what each one IS, in words a model can compose against', () => {
    for (const [preset, row] of Object.entries(PAGE_SCENES)) {
      // A PHRASE, not the name: the composer cannot see the page, and "grid"
      // means a different thing in this catalogue than it does in that one —
      // a row that echoed the id back would tell the model nothing.
      expect(row.is, preset).not.toBe(preset)
      expect(row.is.trim().split(/\s+/).length, preset).toBeGreaterThan(1)
    }
  })
})
