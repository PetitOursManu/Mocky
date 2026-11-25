/**
 * A figure a visual shows must be a figure of the TEXT.
 *
 * The defect the tools of this kind are known for is the plausible number: a
 * bar chart of a text that gave no figures, a "+12 %" the source never said.
 * A visual looks like a fact, so a made-up value in one is worse than in a
 * paragraph. The check is arithmetic, not judgement: every number written in
 * the request is collected under the forms a writer would use for it, and a
 * `value` that matches none of them is taken out of the visual (`read.ts`,
 * `dropVisualValues`). The item stays — its words came from the text — and the
 * person is told which figures went.
 *
 * Deliberately generous in what counts as "the same number": 1 200, 1,2 k and
 * 1.2 thousand are one figure; 12 % and 0.12 are one share. Deliberately blind
 * to numbers written in words ("douze"): that miss errs towards removing a
 * figure, which is the safe direction.
 */
import type { VisualDoc } from './families'

const MULTIPLIERS: [RegExp, number][] = [
  [/^(?:k|k€|k\$|ke|mille|thousand|thousands)$/i, 1e3],
  [/^(?:m|m€|m\$|me|million|millions|mio|mn)$/i, 1e6],
  [/^(?:md|mds|md€|milliard|milliards|billion|billions|bn|b)$/i, 1e9],
]

/** Every number the text writes, with the forms it may be shown in. */
export function numbersIn(text: string): number[] {
  const out = new Set<number>()
  // A digit run with spaces (incl. narrow and no-break) or separators inside it,
  // and the word that may follow it ("1,2 million", "12 k€").
  const re = /(-?)(\d{1,3}(?:[   ]\d{3})+|\d+(?:[.,]\d+)*)(\s*%)?(?:\s*([A-Za-zÀ-ÿ€$]+))?/g
  for (const m of text.matchAll(re)) {
    const sign = m[1] === '-' ? -1 : 1
    for (const base of readings(m[2])) {
      const v = sign * base
      out.add(v)
      if (m[3]) out.add(v / 100)
      const word = m[4]
      if (word) for (const [w, k] of MULTIPLIERS) if (w.test(word)) out.add(v * k)
    }
  }
  return [...out]
}

/**
 * The values one written number may stand for. "1,234" is a thousand in
 * English and one and a quarter in French; "1.234" the reverse. Both readings
 * count — the check asks "could the text have meant this", not which.
 */
function readings(raw: string): number[] {
  const s = raw.replace(/[   ]/g, '')
  const out = new Set<number>()
  const plain = Number(s)
  if (Number.isFinite(plain)) out.add(plain)
  const seps = s.match(/[.,]/g) ?? []
  if (seps.length) {
    // The last separator as the decimal point, the others as thousands.
    const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
    const dec = Number(s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1))
    if (Number.isFinite(dec)) out.add(dec)
    // Every separator as thousands.
    const whole = Number(s.replace(/[.,]/g, ''))
    if (Number.isFinite(whole)) out.add(whole)
  }
  return [...out]
}

function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9)
}

/** Whether `value` is one of the text's figures, under any of its forms. */
export function figureInText(value: number, figures: readonly number[]): boolean {
  for (const f of figures) {
    if (same(value, f)) return true
    // A share written as a percentage and given as a fraction, or the reverse.
    if (same(value * 100, f) || same(value, f * 100)) return true
    // A figure given in thousands, millions or billions by its unit.
    for (const k of [1e3, 1e6, 1e9]) if (same(value * k, f) || same(value, f * k)) return true
  }
  return false
}

/** The indexes of the items whose `value` the text never gave. */
export function inventedValues(doc: VisualDoc | null, text: string): number[] {
  if (!doc || !Array.isArray(doc.items)) return []
  const figures = numbersIn(text)
  const out: number[] = []
  doc.items.forEach((it, i) => {
    if (typeof it?.value !== 'number' || !Number.isFinite(it.value)) return
    if (!figureInText(it.value, figures)) out.push(i)
  })
  return out
}
