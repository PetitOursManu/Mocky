// Parse a free-form DESIGN.md into a structured, role-tagged color model so the
// Design-system frame (Lot D.2) can render a live style guide AND rewrite a
// single token's hex in place when the user recolors it.
//
// Anchoring is text-first: we read "Label: #hex" lines, infer each color's role
// from its label, and keep the exact character offset of every hex so a recolor
// is a precise slice-replace (never a fragile global find/replace).

import { isDarkColor, luminance } from './styles'

export type TokenRole =
  | 'bg'
  | 'surface'
  | 'text'
  | 'muted'
  | 'accent'
  | 'accentText'
  | 'border'
  | 'other'

export interface DesignToken {
  label: string
  hex: string
  /** Character offset of the '#' in the source markdown (for in-place rewrite). */
  index: number
  role: TokenRole
}

export interface DesignSystem {
  colors: DesignToken[]
  /** Resolved role → hex, with sensible fallbacks so the frame always renders. */
  roles: Record<Exclude<TokenRole, 'other'>, string>
  radius: string
}

/** Infer a color's semantic role from its DESIGN.md label. Order matters. */
export function roleForLabel(label: string): TokenRole {
  const l = label.toLowerCase()
  if (/accent[-\s]?text|on[-\s]?(primary|accent|brand)|(primary|button)\s*text/.test(l)) return 'accentText'
  if (/muted|secondary|subtle|placeholder|caption/.test(l)) return 'muted'
  if (/\btext\b|foreground|\bink\b|\bbody\b|heading|typography/.test(l)) return 'text'
  if (/border|divider|outline|stroke|ring/.test(l)) return 'border'
  if (/surface|\bcard\b|panel|elevated|sheet/.test(l)) return 'surface'
  if (/background|\bbg\b|\bbase\b|canvas|\bpage\b/.test(l)) return 'bg'
  if (/primary|accent|brand|action|\bcta\b|highlight|link/.test(l)) return 'accent'
  return 'other'
}

const COLOR_LINE_RE = /(?:([A-Za-z][A-Za-z0-9 /_-]*?)\s*[:=]\s*)?(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g

/**
 * A role stated outright, right after the hex.
 *
 * Muse writes `- Paper: #f7f3e8  (background)` — the dossier schema has a `role`
 * field beside `label`, and `colorLines()` renders it in parentheses. Reading
 * only the label threw that away and left the parser guessing at poetry:
 * "Paper", "Bone", "Signal" match none of the label patterns, so a perfectly
 * well-described palette resolved to no background at all.
 */
const ROLE_SUFFIX_RE = /^\s*\(([A-Za-z][A-Za-z /_-]*)\)/

/** Extract every hex color with its label, role and source offset (deduped by hex). */
export function parseColors(markdown: string): DesignToken[] {
  const out: DesignToken[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  COLOR_LINE_RE.lastIndex = 0
  while ((m = COLOR_LINE_RE.exec(markdown))) {
    const hex = m[2]
    const key = hex.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label = (m[1] || '').trim()
    // The hex sits at the end of the whole match (before the zero-width \b).
    const index = m.index + m[0].length - hex.length
    // Stated role first, label second. Both go through the same matcher, so a
    // parenthesised "(surface)" and a label "Surface" mean the same thing.
    const stated = ROLE_SUFFIX_RE.exec(markdown.slice(index + hex.length))
    const role = (stated && roleForLabel(stated[1])) || roleForLabel(label)
    out.push({ hex, label: label || hex, index, role })
  }
  return out
}

/**
 * The page colour, when nothing in the palette says which one it is.
 *
 * The old answer was `#0f172a` — slate-900 — and it was wrong far more often
 * than it was right: a palette with no colour labelled "background" is normal,
 * and every one of them rendered as a dark navy dashboard regardless of what the
 * screens actually looked like. On a cream editorial design that is not a
 * near-miss, it is the opposite of the design.
 *
 * A palette almost always contains its own page colour; what identifies it is
 * being the furthest thing from the text. So when the text colour is known, take
 * the greatest contrast — that lands on white for black ink and on near-black
 * for pale ink, which is both cases at once. With no text either there is
 * nothing to reason from, and the lightest colour is the better bet: light
 * backgrounds are the overwhelming majority.
 */
function inferBackground(colors: DesignToken[], text?: string): string | undefined {
  // Two exclusions, both about evidence. Colours that already have a job keep
  // it: a palette naming its surface, its border and its accent is telling us
  // those are not the page. And a bare hex with no label at all says nothing —
  // a lone colour in a design document is a brand colour, and pages are rarely
  // saturated cyan. `label === hex` is how parseColors records "unlabelled".
  //
  // If that leaves nothing, it leaves nothing: better the caller's default than
  // a background invented from an accent.
  const pool = colors.filter((c) => (c.role === 'other' || c.role === 'bg') && c.label !== c.hex)
  if (!pool.length) return undefined
  if (text) {
    const lt = luminance(text)
    return pool.reduce((best, c) =>
      Math.abs(luminance(c.hex) - lt) > Math.abs(luminance(best.hex) - lt) ? c : best,
    ).hex
  }
  return pool.reduce((best, c) => (luminance(c.hex) > luminance(best.hex) ? c : best)).hex
}

/** Extract a radius token like "Radius: rounded-xl" or "16px"; falls back to 12px. */
function parseRadius(markdown: string): string {
  const m = /radius[^\n#]*?(\d+\s?px|\d+(?:\.\d+)?\s?rem|rounded-[a-z0-9]+)/i.exec(markdown)
  if (!m) return '12px'
  const v = m[1].replace(/\s+/g, '')
  const map: Record<string, string> = {
    'rounded-none': '0px', 'rounded-sm': '2px', rounded: '6px', 'rounded-md': '8px',
    'rounded-lg': '10px', 'rounded-xl': '14px', 'rounded-2xl': '18px', 'rounded-3xl': '26px', 'rounded-full': '9999px',
  }
  return map[v] ?? v
}

/** Parse a DESIGN.md into a structured, always-renderable design system. */
export function parseDesignSystem(markdown: string): DesignSystem {
  const colors = parseColors(markdown)
  const first = (role: TokenRole) => colors.find((c) => c.role === role)?.hex

  const accent = first('accent') || colors[0]?.hex || '#6366f1'
  // Ordered to break the circle: the stated ink decides the page when the page
  // is unstated, and the page decides the ink when the ink is.
  const statedText = first('text')
  const bg = first('bg') || inferBackground(colors, statedText) || '#0f172a'
  const darkBg = isDarkColor(bg)
  const text = statedText || (darkBg ? '#e2e8f0' : '#0f172a')
  const surface = first('surface') || (darkBg ? '#1e293b' : '#f8fafc')
  const muted = first('muted') || (darkBg ? '#94a3b8' : '#64748b')
  const border = first('border') || (darkBg ? '#334155' : '#e2e8f0')
  const accentText = first('accentText') || (isDarkColor(accent) ? '#ffffff' : '#0f172a')

  return {
    colors,
    roles: { bg, surface, text, muted, accent, accentText, border },
    radius: parseRadius(markdown),
  }
}

/** Replace one token's hex at its exact source offset. Returns the new markdown. */
export function replaceTokenHex(markdown: string, token: { index: number; hex: string }, newHex: string): string {
  const before = markdown.slice(0, token.index)
  const after = markdown.slice(token.index + token.hex.length)
  return before + newHex + after
}
