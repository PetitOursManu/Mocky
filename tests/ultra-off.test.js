import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { selectCapabilities } from '../src/lib/capabilities/select'
import { CAPABILITY_MAP } from '../src/lib/capabilities/registry'
import { decideFilm } from '../src/lib/video/filmDecision'

/**
 * Invariant U1: with Motion Ultra off, the generation path is the one it was
 * before Motion Ultra existed.
 *
 * The path lives inside ProjectView's `generate`, a closure over a dozen pieces
 * of React state that no test can call on its own. So this reads the source,
 * like the other cross-cutting tests here, and pins the few places Motion Ultra
 * touches that path to the guards that switch them off — then checks the pure
 * pieces by behaviour. A new call added outside the guard fails here.
 */
const view = readFileSync(new URL('../src/components/ProjectView.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const generate = readFileSync(new URL('../src/lib/generate.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const indexesOf = (src, needle) => {
  const out = []
  for (let i = src.indexOf(needle); i >= 0; i = src.indexOf(needle, i + 1)) out.push(i)
  return out
}

describe('Motion Ultra off leaves the generation path unchanged (U1)', () => {
  it('runs the storyboard and the series only inside the Motion Ultra block', () => {
    const start = view.indexOf('if (ultraActive && project.ultra) {')
    const end = view.indexOf('if (settings.usePlanner && !musePreamble && !ultraRecord)')
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    for (const call of ['runStoryboard(', 'generateUltraImages(', 'buildUltraPreamble(']) {
      const at = indexesOf(view, call)
      expect(at.length, call).toBeGreaterThan(0)
      for (const i of at) expect(i > start && i < end, call).toBe(true)
    }
  })

  it('adds the kit only when a storyboard exists, and leaves the planner to run otherwise', () => {
    expect(indexesOf(view, "capIds = [...capIds, 'ultra']")).toHaveLength(1)
    expect(view).toContain("if (ultraRecord && !capIds.includes('ultra')) capIds = [...capIds, 'ultra']")
    // `!ultraRecord` is true whenever Motion Ultra did not run: the old condition.
    expect(view).toContain('if (settings.usePlanner && !musePreamble && !ultraRecord)')
  })

  it("keeps Muse's own picture and the film's placement as they were", () => {
    expect(view).toContain('if (remaining.length && pins.length === 0 && !ultraActive)')
    // Undefined when Motion Ultra did not run, and decideFilm ignores undefined.
    expect(view).toContain('openingTaken: ultraOpening,')
    const kinds = ['hero', 'background', 'showcase']
    const dossier = { wanted: true, kind: 'hero', section: 'hero' }
    expect(decideFilm({ mode: 'auto', kinds, dossier, openingTaken: undefined })).toEqual(
      decideFilm({ mode: 'auto', kinds, dossier }),
    )
  })

  it('never offers the kit on a guess, and never documents it unless it is in scope', () => {
    expect(CAPABILITY_MAP.ultra.triggers).toEqual({ keywords: [], intents: [] })
    const ids = selectCapabilities('A landing page with a glass hero, an aurora, parallax and display type')
    expect(ids).not.toContain('ultra')
    expect(generate).toContain("if (caps.some((c) => c.id === 'ultra')) {")
  })
})
