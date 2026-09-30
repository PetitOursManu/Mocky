import type { BlockInfo, Rect, Rgba, RunStyle, TextAlign, TextBlock, TextLine, TextRun, Word } from './types'

/**
 * From words the layout drew to the lines and blocks an export can rebuild.
 *
 * Pure on purpose: this is the part of an export that can be wrong in a way
 * nobody sees until a flyer comes back from Google Slides with its headline
 * split across two text boxes. The DOM walk (measure.ts) only reports what the
 * browser measured — one rect per word, in document order — and everything that
 * DECIDES something lives here, where a test can feed it synthetic rects.
 */

export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 }

/**
 * A computed colour, as a browser writes it back.
 *
 * `getComputedStyle` answers `rgb(15, 23, 42)` for Tailwind's
 * `rgb(15 23 42 / var(--tw-text-opacity))`, but the space syntax and hex are
 * accepted too because a page kit may set an inline style. Anything else
 * (`oklch(…)`, `color(srgb …)`) falls back to black rather than throwing: an
 * export in the wrong ink is a notice-worthy flaw, an export that fails on a
 * colour function is not an export.
 */
export function parseCssColor(input: string | null | undefined): Rgba {
  const s = (input || '').trim().toLowerCase()
  if (!s) return BLACK
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return BLACK
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(s)
  if (!fn) return BLACK
  const parts = fn[1].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return BLACK
  const ch = (p: string) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p))
  const al = (p: string | undefined) => (p === undefined ? 1 : p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p))
  const c = { r: ch(parts[0]), g: ch(parts[1]), b: ch(parts[2]), a: al(parts[3]) }
  if (![c.r, c.g, c.b, c.a].every(Number.isFinite)) return BLACK
  const clamp = (v: number, hi: number) => Math.min(hi, Math.max(0, v))
  return { r: Math.round(clamp(c.r, 255)), g: Math.round(clamp(c.g, 255)), b: Math.round(clamp(c.b, 255)), a: clamp(c.a, 1) }
}

/** `RRGGBB`, the form OOXML writes a colour in. */
export function toHex6(c: Rgba): string {
  return [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * Generic families have no name another application can look up. A slide that
 * says `system-ui` is set in whatever that application's fallback is, which in
 * Google Slides is not even a sans — so each generic is named after the face
 * every office suite has.
 */
const GENERIC_FAMILIES: Record<string, string> = {
  'sans-serif': 'Arial',
  'system-ui': 'Arial',
  'ui-sans-serif': 'Arial',
  '-apple-system': 'Arial',
  blinkmacsystemfont: 'Arial',
  'segoe ui': 'Arial',
  serif: 'Times New Roman',
  'ui-serif': 'Times New Roman',
  monospace: 'Courier New',
  'ui-monospace': 'Courier New',
  cursive: 'Arial',
  fantasy: 'Arial',
  emoji: 'Arial',
  math: 'Arial',
}

/** The first family of a computed `font-family` list, generics mapped to a real face. */
export function primaryFontFamily(list: string | null | undefined): string {
  const first = (list || '').split(',')[0]?.trim().replace(/^["']|["']$/g, '').trim() || ''
  if (!first) return 'Arial'
  return GENERIC_FAMILIES[first.toLowerCase()] ?? first
}

/**
 * The text as it is SEEN. The DOM holds "Réservez", the page shows "RÉSERVEZ"
 * because of `uppercase`; a slide that carried the DOM's text would put the
 * lower case back.
 */
export function applyTextTransform(text: string, transform: string | null | undefined): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'capitalize':
      return text.replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase())
    default:
      return text
  }
}

export function alignOf(textAlign: string | null | undefined, direction?: string | null): TextAlign {
  const rtl = direction === 'rtl'
  switch (textAlign) {
    case 'center':
    case '-webkit-center':
      return 'center'
    case 'right':
    case '-webkit-right':
      return 'right'
    case 'end':
      return rtl ? 'left' : 'right'
    case 'justify':
      return 'justify'
    case 'start':
      return rtl ? 'right' : 'left'
    default:
      return 'left'
  }
}

export function unionRect(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/**
 * A word the layout broke across lines (`break-words` on a long URL) comes back
 * as several rects for one range. Its characters are shared out in proportion
 * to the rects' widths — the only split an estimate without the glyphs can make,
 * and close enough for a text layer nobody sees and a box a person will retype.
 */
export function splitAcrossRects(text: string, rects: readonly Rect[]): { text: string; rect: Rect }[] {
  const usable = rects.filter((r) => r.w > 0 && r.h > 0)
  if (usable.length <= 1) return usable.length ? [{ text, rect: usable[0] }] : []
  const chars = [...text]
  const total = usable.reduce((a, r) => a + r.w, 0)
  const out: { text: string; rect: Rect }[] = []
  let from = 0
  usable.forEach((r, i) => {
    const to = i === usable.length - 1 ? chars.length : Math.min(chars.length, from + Math.round((r.w / total) * chars.length))
    if (to > from) out.push({ text: chars.slice(from, to).join(''), rect: r })
    from = to
  })
  return out
}

/**
 * Two boxes are on one line when they overlap vertically by at least half the
 * shorter one. Not "same top": a 40 px word and a 16 px word on one baseline
 * have different tops, and a superscript is higher still.
 */
export function sameLine(a: Rect, b: Rect): boolean {
  const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return overlap >= 0.5 * Math.min(a.h, b.h)
}

export function sameStyle(a: RunStyle, b: RunStyle): boolean {
  return (
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.fontFamily === b.fontFamily &&
    a.letterSpacing === b.letterSpacing &&
    a.color.r === b.color.r &&
    a.color.g === b.color.g &&
    a.color.b === b.color.b &&
    Math.abs(a.color.a - b.color.a) < 0.01
  )
}

/**
 * How far apart, in em, two words with no whitespace between them in the source
 * must be drawn before they are read as two words.
 *
 * `space` comes from the text flow, and a flex row of `<span>`s has none:
 * `<span>12</span><span>juin</span>` with a `gap-2` is drawn "12 juin" and was
 * exported "12juin". Kerning and a bold word glued to its neighbour
 * ("Hello<b>World</b>") sit well under a fifth of an em; a word space is about a
 * quarter, and a gap a designer chose is more.
 */
export const GLUED_GAP_EM = 0.2

/**
 * Words, in document order, into visual lines.
 *
 * A line ends when the block changes, when the next word is not on the same
 * band, or when it starts to the LEFT of where the line got to — which is what
 * a wrap looks like when two lines are too close to tell apart by height alone.
 * Runs of one style are merged, so a sentence with one bold word is three runs,
 * not twelve.
 */
export function groupLines(words: readonly Word[]): TextLine[] {
  const lines: TextLine[] = []
  let cur: { words: Word[]; runs: TextRun[] } | null = null
  const flush = () => {
    if (!cur || cur.words.length === 0) return
    const rect = unionRect(cur.words.map((w) => w.rect))
    lines.push({
      text: cur.runs.map((r) => r.text).join(''),
      rect,
      runs: cur.runs,
      block: cur.words[0].block,
      fontSize: Math.max(...cur.runs.map((r) => r.style.fontSize)),
    })
  }
  for (const w of words) {
    if (!w.text) continue
    const last = cur?.words[cur.words.length - 1]
    const continues =
      !!last &&
      last.block === w.block &&
      sameLine(last.rect, w.rect) &&
      w.rect.x >= last.rect.x + last.rect.w - 0.5 * Math.max(w.style.fontSize, 1)
    if (!continues || !cur) {
      flush()
      cur = { words: [w], runs: [{ text: w.text, style: w.style }] }
      continue
    }
    const sep = w.space || w.rect.x - (last.rect.x + last.rect.w) > GLUED_GAP_EM * Math.max(w.style.fontSize, 1) ? ' ' : ''
    const run = cur.runs[cur.runs.length - 1]
    if (sameStyle(run.style, w.style)) run.text += sep + w.text
    else {
      // The space goes with the run BEFORE it, so an underlined link that
      // follows plain text does not start with an underlined gap.
      run.text += sep
      cur.runs.push({ text: w.text, style: w.style })
    }
    cur.words.push(w)
  }
  flush()
  return lines
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Lines into blocks: consecutive lines of one block element.
 *
 * CONSECUTIVE, not "every line of that element": `<div>Intro<p>…</p>Outro</div>`
 * has the div's text above AND below the paragraph, and one box around both
 * would sit on top of the paragraph's own. A line that goes back UP (CSS
 * columns) starts a block too, for the same reason.
 */
export function groupBlocks(lines: readonly TextLine[], infos: readonly BlockInfo[]): TextBlock[] {
  const groups: TextLine[][] = []
  for (const line of lines) {
    const g = groups[groups.length - 1]
    const prev = g?.[g.length - 1]
    if (prev && prev.block === line.block && line.rect.y > prev.rect.y + prev.rect.h * 0.5) g.push(line)
    else groups.push([line])
  }
  return groups.map((g) => {
    const info = infos[g[0].block] ?? { align: 'left', lineHeight: null }
    const deltas = g.slice(1).map((l, i) => l.rect.y - g[i].rect.y)
    const pitch = deltas.length ? median(deltas) : info.lineHeight ?? g[0].rect.h
    return { rect: unionRect(g.map((l) => l.rect)), lines: g, align: info.align, pitch: Math.max(pitch, g[0].rect.h * 0.8) }
  })
}
