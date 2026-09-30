import { describe, expect, it } from 'vitest'
import captureSource from './capture.ts?raw'
import previewSource from '../components/Preview.tsx?raw'
import animateSource from './capabilities/snippets/Animate.ts?raw'

/**
 * The export frame is held still with the rule the preview's "Sans animation"
 * writes. Two shells, one rule: Preview builds its copy inline, so the two are
 * compared as SOURCE — importing either file pulls in half the app.
 */

/** The concatenated single-quoted literals of `name = … 'a' + 'b' …`. */
function literalAfter(src: string, marker: RegExp): string {
  const m = marker.exec(src)
  if (!m) throw new Error(`marker not found: ${marker}`)
  const rest = src.slice(m.index + m[0].length)
  const run = /^\s*((?:'[^']*'\s*\+?\s*)+)/.exec(rest)
  if (!run) throw new Error('no literal after marker')
  return [...run[1].matchAll(/'([^']*)'/g)].map((x) => x[1]).join('')
}

describe('the export frame holds still', () => {
  const capture = captureSource
  const preview = previewSource

  it('uses the same still rule as the preview’s “Sans animation”', () => {
    const shared = literalAfter(capture, /export const STILL_ANIMATIONS_CSS =/)
    const own = literalAfter(preview, /const stillCss = animations\s*\?\s*''\s*:/)
    expect(shared).toContain('animation-fill-mode:forwards')
    expect(own.trim()).toBe(shared)
  })

  it('is injected, with the <Animated> flag, in document mode only', () => {
    expect(capture).toContain("${mode === 'document' ? `<style>${STILL_ANIMATIONS_CSS}${EXPORT_NO_TRANSITIONS_CSS}</style>` : ''}")
    // No transition at all, not a short one: a style the export pins and reads
    // back in the same task would otherwise read as its transition's start value.
    expect(capture).toContain("EXPORT_NO_TRANSITIONS_CSS = '*,*::before,*::after{transition:none !important}'")
    // Before the prelude runs: <Animated> decides once, at mount.
    const flag = capture.indexOf('window.__mockyAnimations = false;')
    const prelude = capture.indexOf('${preludeRunner}')
    expect(flag).toBeGreaterThan(0)
    expect(flag).toBeLessThan(prelude)
    expect(animateSource).toContain('if (window.__mockyAnimations === false) return false;')
  })
})
