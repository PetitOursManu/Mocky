import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { selectCapabilities } from '../src/lib/capabilities/select'
import { CAPABILITY_MAP } from '../src/lib/capabilities/registry'

/**
 * Invariant U1: with Motion Ultra off, the generation path is the one it was
 * before Motion Ultra existed.
 *
 * The path lives in lib/pipeline/newScreen.ts, which ProjectView's `generate`
 * calls for every new screen: a dozen network stages that no test can run on
 * their own. So this reads the source,
 * like the other cross-cutting tests here, and pins the few places Motion Ultra
 * touches that path to the guards that switch them off — then checks the pure
 * pieces by behaviour. A new call added outside the guard fails here.
 *
 * `runUltra` is `ultraActive && pipe.motionUltra` and `pipe.planner` is true:
 * `pipe` is `documentPipeline(runPage)`, and every one of its switches is on
 * for a screen that is not a DOCUMENT (`documentMode.test.ts` holds that). So
 * the guards below are the old conditions, with a document switched off too.
 */
const view = readFileSync(new URL('../src/lib/pipeline/newScreen.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// The composer itself: none of Motion Ultra's generation may have stayed behind there.
const composer = readFileSync(new URL('../src/components/ProjectView.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const generate = readFileSync(new URL('../src/lib/generate.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const indexesOf = (src, needle) => {
  const out = []
  for (let i = src.indexOf(needle); i >= 0; i = src.indexOf(needle, i + 1)) out.push(i)
  return out
}

describe('Motion Ultra off leaves the generation path unchanged (U1)', () => {
  it('runs the storyboard and the series only inside the Motion Ultra block', () => {
    const start = view.indexOf('if (runUltra && project.ultra && !siteNew) {')
    const end = view.indexOf('if (settings.usePlanner && pipe.planner && !musePreamble && !ultraRecord && !siteNew)')
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    for (const call of ['runStoryboard(', 'generateUltraImages(', 'buildUltraPreamble(']) {
      expect(indexesOf(composer, call), call).toEqual([])
      const at = indexesOf(view, call)
      expect(at.length, call).toBeGreaterThan(0)
      for (const i of at) expect(i > start && i < end, call).toBe(true)
    }
  })

  it('makes and plugs a video background only when Motion Ultra planned one', () => {
    for (const call of ['plugFilmIntoSlot(', "motionKind: 'background'"]) {
      const at = indexesOf(view, call)
      expect(at.length, call).toBeGreaterThan(0)
      const guard = view.lastIndexOf('if (ultraFilmSection && ultraRecord) {', at[0])
      expect(guard, call).toBeGreaterThan(0)
    }
    // Off, ultraFilmSection stays null and no film is made.
    expect(view).toContain('let ultraFilmSection: string | null = null')
  })

  it('adds the kit only when a storyboard exists, and leaves the planner to run otherwise', () => {
    expect(indexesOf(view, "capIds = [...capIds, 'ultra']")).toHaveLength(1)
    expect(view).toContain("if (ultraRecord && !capIds.includes('ultra')) capIds = [...capIds, 'ultra']")
    // `!ultraRecord` is true whenever Motion Ultra did not run, and `!siteNew`
    // whenever no site screenshot was attached: the old condition.
    expect(view).toContain('if (settings.usePlanner && pipe.planner && !musePreamble && !ultraRecord && !siteNew)')
  })

  it('offers earlier pictures only to a project that has Motion Ultra pictures', () => {
    // projectUltraPictures() is empty for a project that never used Motion Ultra,
    // so the section is never built and the path is the old one.
    expect(view).toContain('const owned = projectUltraPictures(hooks.currentScreens())')
    expect(view).toContain('if (owned.length) {')
  })

  it("keeps Muse's own picture as it was, and makes no film on its own", () => {
    expect(view).toContain('if (remaining.length && pins.length === 0 && !runUltra && picturesAllowed)')
    // True for every screen that is not a document — see site-reference.test.js.
    expect(view).toContain('const picturesAllowed = !pipe.document || runDocPicture !== null')
    expect(view).toContain('const runUltra = ultraActive && pipe.motionUltra')
    // The automatic film is gone for everyone: a film is only ever asked for.
    for (const src of [view, composer]) {
      expect(src).not.toContain('decideFilm(')
      expect(src).not.toContain('placeFilmInScreen(')
      expect(src).not.toContain('dossierMotionRequest(')
    }
  })

  it('never offers the kit on a guess, and never documents it unless it is in scope', () => {
    expect(CAPABILITY_MAP.ultra.triggers).toEqual({ keywords: [], intents: [] })
    const ids = selectCapabilities('A landing page with a glass hero, an aurora, parallax and display type')
    expect(ids).not.toContain('ultra')
    expect(generate).toContain("if (caps.some((c) => c.id === 'ultra')) {")
  })
})
