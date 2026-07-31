import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Every text/background pair the design system offers must clear WCAG AA.
 *
 * The old themes were built by re-declaring Tailwind utilities per theme, and
 * nothing checked the result. Measured on the shipped values:
 *   text-slate-500  →  3.75:1 dark, 2.09:1 beige, 2.34:1 "Mocky"
 *   text-slate-600  →  2.36:1
 * and the active "Frame" toolbar button was `bg-slate-700 text-white` — the
 * background was remapped for the light themes, the text never was, giving
 * 1.21:1. The label of the active button was invisible.
 *
 * This test reads the real token file, so it fails on the values that ship.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = fs.readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8')

/** Tokens declared inside a given selector block. */
function tokensIn(selector) {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`selector not found: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const block = css.slice(open, close)
  const out = {}
  for (const m of block.matchAll(/--([\w-]+):\s*([\d\s]+?)\s*;/g)) {
    const channels = m[2].trim().split(/\s+/).map(Number)
    if (channels.length === 3 && channels.every((n) => Number.isFinite(n))) out[m[1]] = channels
  }
  return out
}

/** Relative luminance, per WCAG 2.1. */
function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const THEMES = {
  light: tokensIn(':root,\n[data-theme=\'light\']'),
  dark: tokensIn("[data-theme='dark']"),
}

/** [foreground, background, minimum, what it is]. */
const PAIRS = [
  ['ink', 'surface', 4.5, 'body text on a panel'],
  ['ink', 'sunken', 4.5, 'body text on the canvas'],
  ['ink', 'raised', 4.5, 'body text in a popover'],
  ['ink-muted', 'surface', 4.5, 'secondary text — the old text-slate-400'],
  ['ink-muted', 'sunken', 4.5, 'secondary text on the canvas'],
  ['ink-faint', 'surface', 4.5, 'the faintest text allowed — the old text-slate-500 was 2.09:1'],
  ['on-accent', 'accent', 4.5, 'the label of the primary button'],
  ['on-danger', 'danger', 4.5, 'the label of a destructive button'],
  ['surface', 'ink', 4.5, 'inverted: the ACTIVE toolbar button, which used to be 1.21:1'],
  // `accent` is the flat: fills, rules, active states, icons — all UI
  // components, which AA sets at 3:1. #228477 measures 4.27:1 on paper, which
  // is fine for those and NOT fine for small text…
  ['accent', 'surface', 3.0, 'accent as a fill, rule or icon'],
  ['accent', 'sunken', 3.0, 'accent on the canvas'],
  // …which is why anything set in the accent at text size uses this one.
  ['accent-ink', 'surface', 4.5, 'accent as small text — links, labels'],
  ['accent-ink', 'raised', 4.5, 'accent as small text inside a popover'],
  ['danger', 'surface', 4.5, 'error text'],
  ['warn', 'surface', 4.5, 'warning text'],
  ['ok', 'surface', 4.5, 'success text'],
  ['muse', 'surface', 3.0, 'the Muse mark as a fill or rule'],
  ['muse-ink', 'surface', 4.5, 'the Muse mark as small text'],
  ['line', 'surface', 3.0, 'the structural rule — a UI boundary needs 3:1'],
]

for (const [theme, tokens] of Object.entries(THEMES)) {
  describe(`contrast — ${theme} theme`, () => {
    it('declares every token the pairs below rely on', () => {
      const needed = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]))
      for (const name of needed) expect(tokens[name], `--${name} missing`).toBeDefined()
    })

    for (const [fg, bg, min, what] of PAIRS) {
      it(`${fg} on ${bg} ≥ ${min}:1 — ${what}`, () => {
        const ratio = contrast(tokens[fg], tokens[bg])
        expect(
          Number(ratio.toFixed(2)),
          `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`,
        ).toBeGreaterThanOrEqual(min)
      })
    }
  })
}

describe('token hygiene', () => {
  it('defines the same token names in both themes', () => {
    // A token present in one theme and missing in the other is precisely how a
    // colour silently falls back to whatever the other theme set.
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort())
  })

  it('keeps the two themes genuinely distinct', () => {
    expect(THEMES.light.surface).not.toEqual(THEMES.dark.surface)
    expect(THEMES.light.ink).not.toEqual(THEMES.dark.ink)
  })
})
