import { TAILWIND_COLORS } from './audit/colors'
import { expand, near, UTILITY_RE } from './designFollow'
import { parseDesignSpec } from './designSpec'
import { parseColors } from './designTokens'
import { findFontIn, type FontFamily } from './fonts'
import { loadTransform, parses } from './sourceText'

/**
 * A token of the direction changed: the screens already made still paint the
 * old one. Rewrite them, without a model.
 *
 * `designFollow.ts` is the other direction of the same street — an edit
 * recoloured a screen and the direction follows. Here the direction moved and
 * the screens are offered to follow, on a click (decided with the user: never
 * on its own). Regenerating them for that would be a model call per screen and
 * a new layout each time, which is not what "change the accent" asks for.
 *
 * Three decisions, each of which is what makes the rewrite safe to offer:
 *
 * 1. **An exact hex only.** A generated screen writes the direction's hexes as
 *    arbitrary values (`bg-[#C6FF3D]`, the generation prompt insists on it), so
 *    the old token is findable as written. A Tailwind shade NEAR it
 *    (`bg-lime-300`) or a hex a few units off is a decision somebody made —
 *    or the model approximated — and rewriting it in silence would be a
 *    decision nobody made. They are COUNTED and reported instead.
 * 2. **Everywhere the hex is written**: a class, a style, an SVG fill, a
 *    constant, and the text of a swatch that prints its own value — a style
 *    guide still reading `#C6FF3D` under a violet square would be the one place
 *    the rewrite visibly missed. An HTML entity (`&#123;`) is not a colour.
 * 3. **A font by its family name where a family name is written** — after a
 *    quote or `[`, before a quote, a comma or `]` — so "Inter" in a sentence
 *    is never touched and `Playfair_Display` keeps its underscore inside a
 *    class. The generic fallback after it is left alone: `fontFaceCssFor`
 *    declares the new face from the code, and `font-display: block` means the
 *    fallback is only ever seen if the face fails to load.
 *
 * A rewrite that no longer parses is not a rewrite: the screen is left as it
 * was and reported skipped.
 */

export type TokenChange =
  | { kind: 'color'; label: string; from: string; to: string }
  | { kind: 'font'; label: string; from: FontFamily; to: FontFamily }

/** What changed between two versions of a direction, token by token. */
export function tokenChanges(before: string | null | undefined, after: string | null | undefined): TokenChange[] {
  if (!before?.trim() || !after?.trim() || before === after) return []
  const out: TokenChange[] = []

  const was = new Map<string, string>()
  for (const tok of parseColors(before)) {
    const hex = expand(tok.hex)
    if (hex) was.set(tok.label.trim().toLowerCase(), hex)
  }
  const seen = new Set<string>()
  for (const tok of parseColors(after)) {
    const key = tok.label.trim().toLowerCase()
    const from = was.get(key)
    const to = expand(tok.hex)
    // Two labels sharing one old hex move it once: the second would find
    // nothing left to rewrite and report a change that did nothing.
    if (!from || !to || from === to || seen.has(from)) continue
    seen.add(from)
    out.push({ kind: 'color', label: tok.label.trim(), from, to })
  }

  const typeBefore = parseDesignSpec(before).typography
  const typeAfter = parseDesignSpec(after).typography
  for (const role of ['display', 'body'] as const) {
    const from = findFontIn(typeBefore[role])
    const to = findFontIn(typeAfter[role])
    if (!from || !to || from.family === to.family) continue
    if (out.some((c) => c.kind === 'font' && c.from.family === from.family)) continue
    out.push({ kind: 'font', label: role, from, to })
  }
  return out
}

/** A hex as written in code, not inside an HTML entity or a longer token. */
const HEX_IN_CODE = /(?<![&\w])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F\w])/g

/** The replacement in the case the original was written in, alpha kept. */
function inStyleOf(written: string, to: string): string {
  const alpha = written.length === 9 ? written.slice(7) : ''
  const body = to.slice(1)
  const upper = /[A-F]/.test(written) && !/[a-f]/.test(written)
  return '#' + (upper ? body.toUpperCase() : body.toLowerCase()) + alpha
}

/** How many times `hex` is written exactly in a screen's code. */
export function colorUses(code: string, hex: string): number {
  const want = expand(hex)
  if (!want) return 0
  let n = 0
  for (const m of code.matchAll(HEX_IN_CODE)) if (expand(m[0]) === want) n++
  return n
}

/** Every exact occurrence of `from` written as `to`. */
export function replaceColor(code: string, from: string, to: string): string {
  const want = expand(from)
  const next = expand(to)
  if (!want || !next) return code
  return code.replace(HEX_IN_CODE, (m) => (expand(m) === want ? inStyleOf(m, next) : m))
}

/**
 * Colours close to `hex` that the rewrite will NOT touch: Tailwind shades near
 * it, and other hexes within the same small distance `designFollow` uses.
 */
export function nearMisses(code: string, hex: string): number {
  const want = expand(hex)
  if (!want) return 0
  let n = 0
  UTILITY_RE.lastIndex = 0
  for (const m of code.matchAll(UTILITY_RE)) {
    if (m[3]) continue // an arbitrary hex: counted below, with the literals
    const shade = TAILWIND_COLORS[m[1]]?.[m[2]]
    if (shade && near(shade, want)) n++
  }
  for (const m of code.matchAll(HEX_IN_CODE)) {
    const h = expand(m[0])
    if (h && h !== want && near(h, want)) n++
  }
  return n
}

/** A family name where code writes one: after a quote or `[`, before a quote, a comma or `]`. */
function fontPattern(family: string): RegExp {
  const body = family
    .split(' ')
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('([ _])')
  return new RegExp(`(?<=['"\`\\[]\\s*)${body}(?=\\s*['"\`,\\]])`, 'gi')
}

export function fontUses(code: string, family: string): number {
  return [...code.matchAll(fontPattern(family))].length
}

/** Every place a family is named as a family, renamed — an underscore stays an underscore. */
export function replaceFont(code: string, from: string, to: string): string {
  return code.replace(fontPattern(from), (m) => to.replace(/ /g, m.includes('_') ? '_' : ' '))
}

/** How a change reads in one screen's code. */
export function usesOf(code: string, change: TokenChange): number {
  return change.kind === 'color' ? colorUses(code, change.from) : fontUses(code, change.from.family)
}

/** Apply every change to one screen's code. */
export function applyChanges(code: string, changes: TokenChange[]): string {
  let out = code
  for (const c of changes) {
    out = c.kind === 'color' ? replaceColor(out, c.from, c.to) : replaceFont(out, c.from.family, c.to.family)
  }
  return out
}

export interface PropagationPlan {
  changes: TokenChange[]
  /** The screens that write at least one old token as written. */
  screenIds: string[]
  /** Near colours the rewrite leaves as they are, across those screens. */
  near: number
}

/** Which screens a set of changes would rewrite. Pure: nothing is written. */
export function planPropagation(screens: { id: string; code: string }[], changes: TokenChange[]): PropagationPlan {
  const screenIds: string[] = []
  let nearCount = 0
  for (const s of screens) {
    if (!s.code.trim()) continue
    if (changes.some((c) => usesOf(s.code, c) > 0)) screenIds.push(s.id)
    for (const c of changes) if (c.kind === 'color') nearCount += nearMisses(s.code, c.from)
  }
  return { changes, screenIds, near: nearCount }
}

/** The rewritten code, or null when there was nothing to write or the result does not parse. */
export async function propagateInto(code: string, changes: TokenChange[]): Promise<string | null> {
  const next = applyChanges(code, changes)
  if (next === code) return null
  const transform = await loadTransform().catch(() => null)
  return (await parses(next, transform)) ? next : null
}
