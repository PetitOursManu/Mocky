import { TAILWIND_COLORS } from './audit/colors'
import { parseColors } from './designTokens'

/**
 * The direction follows an edit that recoloured the screen.
 *
 * "Passe les couleurs du rouge au bleu" came back blue — and the Design System
 * panel beside it stayed red, because an edit writes CODE and the direction
 * (DESIGN.md) is a separate document nothing rewrote. The panel was then wrong
 * about the screen it was showing, and the next screen was generated red again,
 * from the direction, as if the edit had never been asked for.
 *
 * Read, not asked: no model call. The two versions of the code are compared
 * with their colours masked, so the lines that are the same apart from their
 * colours line up, and each colour that sat in one place before is paired with
 * the colour in that place after. A colour of the direction is moved only when
 * MOST of its places changed, and to the colour that took most of them: "make
 * the button blue" moves one place out of fifteen and leaves the accent alone,
 * while "everything in blue" moves fifteen.
 *
 * Pure and deterministic, so a test can hold it — and an edit that rewrote the
 * whole layout simply lines nothing up and changes nothing (degrade, never
 * fail).
 */

export interface DesignColorChange {
  label: string
  from: string
  to: string
}

/** Every colour utility Tailwind has, by its prefix: what a screen paints with. */
const UTILITY_RE =
  /\b(?:bg|text|border(?:-[trblxy])?|from|via|to|ring|ring-offset|fill|stroke|outline|decoration|divide|accent|caret|shadow|placeholder)-(?:([a-z]+)-(50|[1-9]00|950)|\[(#[0-9a-fA-F]{3,8})\])(?:\/\d{1,3})?/g
/** A hex literal anywhere else: an inline style, a prop, an SVG fill. */
const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g

const expand = (hex: string): string | null => {
  const h = hex.toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(h)) return h
  if (/^#[0-9a-f]{3}$/.test(h)) return '#' + [...h.slice(1)].map((c) => c + c).join('')
  if (/^#[0-9a-f]{8}$/.test(h)) return h.slice(0, 7)
  return null
}

interface Masked {
  lines: string[]
  /** Per line, the colours in it, in order. */
  colors: string[][]
  /** Per line, what each colour paints — `bg-`, `text-`… or '' for a literal. */
  uses: string[][]
}

/** The code with every colour replaced by a placeholder, and the colours set aside. */
export function maskColors(code: string): Masked {
  const lines: string[] = []
  const colors: string[][] = []
  const uses: string[][] = []
  for (const raw of code.split('\n')) {
    const found: { at: number; end: number; hex: string; keep: string }[] = []
    let m: RegExpExecArray | null
    UTILITY_RE.lastIndex = 0
    while ((m = UTILITY_RE.exec(raw))) {
      const hex = m[3] ? expand(m[3]) : TAILWIND_COLORS[m[1]]?.[m[2]] ?? null
      if (!hex) continue
      // The prefix stays, so a background lines up with a background.
      const prefix = m[0].slice(0, m[0].indexOf('-') + 1)
      found.push({ at: m.index, end: m.index + m[0].length, hex, keep: prefix })
    }
    HEX_RE.lastIndex = 0
    while ((m = HEX_RE.exec(raw))) {
      const at = m.index
      if (found.some((f) => at >= f.at && at < f.end)) continue
      const hex = expand(m[0])
      if (hex) found.push({ at, end: at + m[0].length, hex, keep: '' })
    }
    found.sort((a, b) => a.at - b.at)
    let line = ''
    let last = 0
    for (const f of found) {
      line += raw.slice(last, f.at) + f.keep + '\u0000'
      last = f.end
    }
    lines.push((line + raw.slice(last)).trim())
    colors.push(found.map((f) => f.hex))
    uses.push(found.map((f) => f.keep))
  }
  return { lines, colors, uses }
}

/** Per colour, how many times each use paints it. */
function usage(m: Masked): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  m.colors.forEach((row, i) =>
    row.forEach((hex, k) => {
      const by = out.get(hex) ?? new Map<string, number>()
      by.set(m.uses[i][k], (by.get(m.uses[i][k]) ?? 0) + 1)
      out.set(hex, by)
    }),
  )
  return out
}

const count = (by: Map<string, number>) => [...by.values()].reduce((s, v) => s + v, 0)

/** Cosine of two use histograms: a colour used for backgrounds is replaced by one used for backgrounds. */
function alike(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0)
  const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0))
  return dot / (norm(a) * norm(b) || 1)
}

/**
 * Line pairs that are equal once masked, by longest common subsequence. Lines
 * with no colour in them are left out first: they cannot vote, and dropping
 * them keeps the table small on a screen of a thousand lines.
 */
function alignedPairs(a: Masked, b: Masked): [string, string][] {
  const ia = a.lines.map((_, i) => i).filter((i) => a.colors[i].length)
  const ib = b.lines.map((_, i) => i).filter((i) => b.colors[i].length)
  const n = ia.length
  const m = ib.length
  if (!n || !m || n * m > 4_000_000) return []
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a.lines[ia[i]] === b.lines[ib[j]] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs: [string, string][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a.lines[ia[i]] === b.lines[ib[j]]) {
      const ca = a.colors[ia[i]]
      const cb = b.colors[ib[j]]
      for (let k = 0; k < ca.length; k++) pairs.push([ca[k], cb[k]])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return pairs
}

const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))
/** Close enough to be the same colour: a direction's hex against Tailwind's nearest shade. */
function near(a: string, b: string): boolean {
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) <= 28
}

/**
 * The direction rewritten to the colours the edit moved to, or null when the
 * edit moved none of them.
 */
export function followRecolor(markdown: string, before: string, after: string): { markdown: string; changes: DesignColorChange[] } | null {
  if (!markdown.trim() || before === after) return null
  const tokens = parseColors(markdown)
  if (!tokens.length) return null
  const [mb, ma] = [maskColors(before), maskColors(after)]
  const pairs = alignedPairs(mb, ma)
  const [usedBefore, usedAfter] = [usage(mb), usage(ma)]
  const usesOf = (hex: string, used: Map<string, Map<string, number>>) => {
    const by = new Map<string, number>()
    for (const [h, m] of used) if (near(h, hex)) for (const [k, v] of m) by.set(k, (by.get(k) ?? 0) + v)
    return by
  }
  // Colours the edit brought in that the screen did not have: what a vanished
  // colour may have become when no line lined up.
  const fresh = [...usedAfter.entries()].filter(([h]) => ![...usedBefore.keys()].some((b) => near(b, h)))
  const taken = new Set<string>()

  const changes: DesignColorChange[] = []
  for (const token of tokens) {
    const from = expand(token.hex)
    if (!from) continue
    let same = 0
    const moved = new Map<string, number>()
    for (const [was, now] of pairs) {
      if (!near(was, from)) continue
      if (near(now, was)) same++
      else moved.set(now, (moved.get(now) ?? 0) + 1)
    }
    const total = [...moved.values()].reduce((s, v) => s + v, 0)
    if (total > same) {
      const [to] = [...moved.entries()].sort((x, y) => y[1] - x[1])[0]
      changes.push({ label: token.label, from: token.hex, to })
      continue
    }
    if (total + same > 0) continue
    /*
     * No line lined up — the edit rewrote the layout along with the colours,
     * which is most edits by a model. A colour of the direction the screen
     * painted at least twice and paints no more is matched to the new colour
     * painting the most alike things (backgrounds for backgrounds), each new
     * colour given once: "rouge et rouge foncé" become "bleu et bleu foncé",
     * not "bleu et bleu".
     */
    const was = usesOf(from, usedBefore)
    if (count(was) < 2 || count(usesOf(from, usedAfter)) > 0) continue
    const best = fresh
      .filter(([h]) => !taken.has(h))
      .map(([h, by]) => ({ h, score: alike(was, by), n: count(by) }))
      .filter((c) => c.score >= 0.5 && c.n >= Math.ceil(count(was) / 2))
      .sort((x, y) => y.score - x.score || y.n - x.n)[0]
    if (!best) continue
    taken.add(best.h)
    changes.push({ label: token.label, from: token.hex, to: best.h })
  }
  if (!changes.length) return null

  // Every mention of a moved hex, the prose included ("buttons in #dc2626"):
  // the document must not describe the old colour anywhere.
  let out = markdown
  for (const c of changes) {
    const esc = c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`${esc}(?![0-9a-fA-F])`, 'gi'), c.to)
  }
  return out === markdown ? null : { markdown: out, changes }
}
