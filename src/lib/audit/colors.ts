/**
 * Tailwind class names, read as colours a contrast check could use.
 *
 * WHY A TABLE OF HEXES AT ALL
 *
 * A generated screen writes its colours as `text-slate-600 bg-white`, never as
 * `#475569`. Nothing in the audit pipeline renders anything (Q4), so the only
 * way to say anything at all about contrast is to resolve those names back to
 * the values the preview will actually paint. The preview compiles with the
 * vendored Tailwind Play CDN build — 3.4.17, see `public/vendor/VENDOR.md` —
 * configured with nothing but `darkMode: 'class'`, so the palette below IS the
 * palette generated screens get. It was dumped from `tailwindcss/colors.js` and
 * every value was checked against the bytes of `public/vendor/tailwind.min.js`,
 * not typed by hand: one wrong digit here is a contrast finding about a colour
 * that is not on screen.
 *
 * WHY EVERY ANSWER CAN BE "I DO NOT KNOW"
 *
 * This is the whole point of the module, and the reason it is separate from the
 * rule that will use it. A screen's *text* colour is usually on the element. Its
 * *background* usually is not — it comes from a wrapper three levels up, from a
 * gradient, from `style={{...}}`, or from a theme token that only exists at
 * runtime. `ElementFact.ancestors` carries tag names and nothing else, so this
 * analysis genuinely cannot follow a background up the tree, and there is no
 * honest way to fake it.
 *
 * So: **never assume white.** A white default would make every dark-panel screen
 * — dark wrapper, light text, perfectly legible — report unreadable text, and a
 * contrast report that cries wolf on correct screens is worse than no contrast
 * report at all. It teaches the reader to ignore the panel, including the day it
 * is right. Everything here therefore answers with `resolvable: false` rather
 * than a plausible guess, and the caller is expected to abstain.
 *
 * The one rule the rest of the module obeys: **`hex` is non-null if and only if
 * `resolvable` is true.** A caller that reads `hex` and forgets `resolvable`
 * still cannot get a colour that is not painted.
 *
 * WHY NO REGULAR EXPRESSIONS
 *
 * Invariant I1 is about generated source, and a class list is a value the AST
 * already handed over — but char-level scanning is what this needs anyway.
 * `bg-[url(data:image/svg+xml;base64,PHN2Zz...)]` contains `:`, `/` and `,` that
 * belong to the value, and any pattern that splits a class on those separators
 * gets it wrong. The scanners below track bracket depth instead.
 */

import { attr, type ElementFact } from './inspect'

/** The three properties a screen's legibility depends on. */
export type ColorRole = 'text' | 'bg' | 'border'

/**
 * Tailwind v3's default palette, restricted to the families generated screens
 * actually use. Values are lower-case six-digit hex; `50`–`950` throughout.
 */
export const TAILWIND_COLORS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  slate: { '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1', '400': '#94a3b8', '500': '#64748b', '600': '#475569', '700': '#334155', '800': '#1e293b', '900': '#0f172a', '950': '#020617' },
  gray: { '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827', '950': '#030712' },
  zinc: { '50': '#fafafa', '100': '#f4f4f5', '200': '#e4e4e7', '300': '#d4d4d8', '400': '#a1a1aa', '500': '#71717a', '600': '#52525b', '700': '#3f3f46', '800': '#27272a', '900': '#18181b', '950': '#09090b' },
  neutral: { '50': '#fafafa', '100': '#f5f5f5', '200': '#e5e5e5', '300': '#d4d4d4', '400': '#a3a3a3', '500': '#737373', '600': '#525252', '700': '#404040', '800': '#262626', '900': '#171717', '950': '#0a0a0a' },
  stone: { '50': '#fafaf9', '100': '#f5f5f4', '200': '#e7e5e4', '300': '#d6d3d1', '400': '#a8a29e', '500': '#78716c', '600': '#57534e', '700': '#44403c', '800': '#292524', '900': '#1c1917', '950': '#0c0a09' },
  red: { '50': '#fef2f2', '100': '#fee2e2', '200': '#fecaca', '300': '#fca5a5', '400': '#f87171', '500': '#ef4444', '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d', '950': '#450a0a' },
  orange: { '50': '#fff7ed', '100': '#ffedd5', '200': '#fed7aa', '300': '#fdba74', '400': '#fb923c', '500': '#f97316', '600': '#ea580c', '700': '#c2410c', '800': '#9a3412', '900': '#7c2d12', '950': '#431407' },
  amber: { '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f', '950': '#451a03' },
  yellow: { '50': '#fefce8', '100': '#fef9c3', '200': '#fef08a', '300': '#fde047', '400': '#facc15', '500': '#eab308', '600': '#ca8a04', '700': '#a16207', '800': '#854d0e', '900': '#713f12', '950': '#422006' },
  lime: { '50': '#f7fee7', '100': '#ecfccb', '200': '#d9f99d', '300': '#bef264', '400': '#a3e635', '500': '#84cc16', '600': '#65a30d', '700': '#4d7c0f', '800': '#3f6212', '900': '#365314', '950': '#1a2e05' },
  green: { '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac', '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d', '800': '#166534', '900': '#14532d', '950': '#052e16' },
  emerald: { '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22' },
  teal: { '50': '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4', '300': '#5eead4', '400': '#2dd4bf', '500': '#14b8a6', '600': '#0d9488', '700': '#0f766e', '800': '#115e59', '900': '#134e4a', '950': '#042f2e' },
  cyan: { '50': '#ecfeff', '100': '#cffafe', '200': '#a5f3fc', '300': '#67e8f9', '400': '#22d3ee', '500': '#06b6d4', '600': '#0891b2', '700': '#0e7490', '800': '#155e75', '900': '#164e63', '950': '#083344' },
  sky: { '50': '#f0f9ff', '100': '#e0f2fe', '200': '#bae6fd', '300': '#7dd3fc', '400': '#38bdf8', '500': '#0ea5e9', '600': '#0284c7', '700': '#0369a1', '800': '#075985', '900': '#0c4a6e', '950': '#082f49' },
  blue: { '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554' },
  indigo: { '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b' },
  violet: { '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '300': '#c4b5fd', '400': '#a78bfa', '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#4c1d95', '950': '#2e1065' },
  purple: { '50': '#faf5ff', '100': '#f3e8ff', '200': '#e9d5ff', '300': '#d8b4fe', '400': '#c084fc', '500': '#a855f7', '600': '#9333ea', '700': '#7e22ce', '800': '#6b21a8', '900': '#581c87', '950': '#3b0764' },
  fuchsia: { '50': '#fdf4ff', '100': '#fae8ff', '200': '#f5d0fe', '300': '#f0abfc', '400': '#e879f9', '500': '#d946ef', '600': '#c026d3', '700': '#a21caf', '800': '#86198f', '900': '#701a75', '950': '#4a044e' },
  pink: { '50': '#fdf2f8', '100': '#fce7f3', '200': '#fbcfe8', '300': '#f9a8d4', '400': '#f472b6', '500': '#ec4899', '600': '#db2777', '700': '#be185d', '800': '#9d174d', '900': '#831843', '950': '#500724' },
  rose: { '50': '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3', '300': '#fda4af', '400': '#fb7185', '500': '#f43f5e', '600': '#e11d48', '700': '#be123c', '800': '#9f1239', '900': '#881337', '950': '#4c0519' },
}

/**
 * The five names that take no shade.
 *
 * Three of them are not colours at all in the sense this module needs.
 * `transparent` paints nothing, `current` and `inherit` take their value from
 * somewhere else in the tree — so they resolve to a refusal, not to a hex. They
 * are listed rather than omitted because "we know this word and it means we
 * cannot answer" is a different report from "we have never heard of this word".
 */
export const TAILWIND_SPECIAL: Readonly<Record<string, string>> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
}

/**
 * Why a colour could not be pinned down.
 *
 * Every one of these means the same thing to a caller — do not conclude — but
 * they read very differently to a person, and the panel shows them. "The
 * background comes from a parent" is a fact about this analysis; "the text is
 * painted at 60% opacity" is a fact about the screen.
 */
export type UnresolvedReason =
  /** Declared only under a variant — `hover:`, `dark:`, `md:`. Another state, not this one. */
  | 'stateful'
  /** An opacity modifier or an `rgba()` below 1: what is painted depends on the backdrop. */
  | 'translucent'
  /** `bg-transparent` — the element paints nothing and whatever is behind shows through. */
  | 'transparent'
  /** `current` / `inherit` — the value is decided elsewhere in the tree. */
  | 'contextual'
  /** A CSS variable or a theme token: `bg-[var(--brand)]`. Only exists at runtime. */
  | 'variable'
  /** A colour syntax this module does not read, `oklch()` and friends. */
  | 'unparseable'
  /** `bg-gradient-to-r`, or an arbitrary `linear-gradient()`: no single value. */
  | 'gradient'
  /** A background image — `bg-[url(...)]`. */
  | 'image'
  /** `mix-blend-*`: the painted colour is a function of what is underneath. */
  | 'blend'
  /** Two classes set the same property; CSS source order decides, and we cannot see it. */
  | 'conflict'
  /** `className={cn(...)}` — the class list is computed at runtime. */
  | 'dynamic'
  /** A `style` prop may set a colour this analysis cannot read. */
  | 'inline-style'
  /** Nothing readable for this role on this element. It may well be on an ancestor. */
  | 'undeclared'

export interface ParsedColorClass {
  role: ColorRole
  /** The painted colour, lower-case `#rrggbb`. Non-null exactly when `resolvable`. */
  hex: string | null
  resolvable: boolean
  reason?: UnresolvedReason
  /** As declared. Below 1 forces `resolvable: false` — see `reason: 'translucent'`. */
  alpha: number
}

// ---------------------------------------------------------------------------
// CSS colour literals
// ---------------------------------------------------------------------------

const HEX_DIGITS = '0123456789abcdef'

function isHexDigits(text: string): boolean {
  if (!text) return false
  for (const c of text) if (!HEX_DIGITS.includes(c)) return false
  return true
}

/**
 * `Number` with the two coercions that would silently invent a colour removed.
 *
 * `Number('')` is 0 and `Number('0x1f')` is 31, so `rgb(,,)` would read as black
 * and `rgb(0x1f 0 0)` as a real red. Neither is valid CSS, and a wrong colour is
 * worse than an unreadable one — it is the difference between a missing finding
 * and a false one.
 */
function num(text: string): number {
  const t = text.trim()
  if (!t) return NaN
  if (t.includes('x')) return NaN
  return Number(t)
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('')

/** A channel token: `128`, `50%`. */
function channel(token: string): number {
  const t = token.trim()
  const n = t.endsWith('%') ? (num(t.slice(0, -1)) / 100) * 255 : num(t)
  return Number.isFinite(n) ? clamp(n, 0, 255) : NaN
}

/** An alpha token: `0.5`, `50%`. */
function alphaOf(token: string): number {
  const t = token.trim()
  const n = t.endsWith('%') ? num(t.slice(0, -1)) / 100 : num(t)
  return Number.isFinite(n) ? clamp(n, 0, 1) : NaN
}

/** `rgb(0, 1, 2)`, `rgb(0 1 2 / 50%)` and `hsl(210 40% 98%)` all reduce to this. */
function splitArgs(inner: string): string[] {
  const out: string[] = []
  let current = ''
  let depth = 0
  for (const c of inner) {
    if (c === '(') depth++
    if (c === ')') depth--
    // Modern and legacy CSS syntax differ only in their separators, and no
    // colour function takes a nested argument list — so at depth 0 all three
    // separators mean the same thing.
    if (depth === 0 && (c === ',' || c === '/' || c === ' ' || c === '\t')) {
      if (current) out.push(current)
      current = ''
      continue
    }
    current += c
  }
  if (current) out.push(current)
  return out
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

/**
 * A CSS colour literal, as a hex and an alpha.
 *
 * Deliberately narrow: hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, and the word
 * `transparent`. Named colours are NOT supported and `oklch()` is not either —
 * both return null, which becomes `reason: 'unparseable'` upstream. Half-knowing
 * a colour space is how a report ends up confidently wrong; not knowing it is
 * merely quiet.
 */
export function parseCssColor(input: string): { hex: string; alpha: number } | null {
  const value = input.trim().toLowerCase()
  if (!value) return null
  if (value === 'transparent') return { hex: '#000000', alpha: 0 }

  if (value.startsWith('#')) {
    const body = value.slice(1)
    if (!isHexDigits(body)) return null
    const expand = (s: string) => s + s
    if (body.length === 3 || body.length === 4) {
      const hex = '#' + [0, 1, 2].map((i) => expand(body[i])).join('')
      const alpha = body.length === 4 ? parseInt(expand(body[3]), 16) / 255 : 1
      return { hex, alpha }
    }
    if (body.length === 6 || body.length === 8) {
      const alpha = body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1
      return { hex: '#' + body.slice(0, 6), alpha }
    }
    return null
  }

  const open = value.indexOf('(')
  if (open > 0 && value.endsWith(')')) {
    const fn = value.slice(0, open)
    const args = splitArgs(value.slice(open + 1, -1))
    if (args.length < 3) return null
    const alpha = args.length > 3 ? alphaOf(args[3]) : 1
    if (!Number.isFinite(alpha)) return null

    if (fn === 'rgb' || fn === 'rgba') {
      const [r, g, b] = [channel(args[0]), channel(args[1]), channel(args[2])]
      if (![r, g, b].every(Number.isFinite)) return null
      return { hex: toHex(r, g, b), alpha }
    }
    if (fn === 'hsl' || fn === 'hsla') {
      const raw = args[0].trim()
      // `hsl(210deg 40% 98%)` is as valid as `hsl(210 40% 98%)`.
      const h = num(raw.endsWith('deg') ? raw.slice(0, -3) : raw)
      const s = args[1].trim().endsWith('%') ? num(args[1].trim().slice(0, -1)) / 100 : num(args[1])
      const l = args[2].trim().endsWith('%') ? num(args[2].trim().slice(0, -1)) / 100 : num(args[2])
      if (![h, s, l].every(Number.isFinite)) return null
      return { hex: hslToHex(h, clamp(s, 0, 1), clamp(l, 0, 1)), alpha }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

/**
 * Relative luminance, WCAG 2.x definition.
 *
 * NaN for anything not fully opaque, because the luminance of a translucent
 * colour is a property of what is behind it, and nothing here knows that.
 */
export function relativeLuminance(color: string): number {
  const parsed = parseCssColor(color)
  if (!parsed || parsed.alpha < 1) return NaN
  const channels = [1, 3, 5].map((i) => parseInt(parsed.hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * The WCAG 2.x contrast ratio between two colours, from 1 to 21.
 *
 * **NaN when either colour cannot be read**, and that is the safety mechanism
 * rather than an oversight: every comparison against NaN is false, so a caller
 * that forgets to check still cannot produce `ratio < 4.5` and report a screen
 * it never measured. A thrown error would have been the other option, and it
 * would have violated Q1 — a contrast check must never be able to fail an audit.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (!Number.isFinite(la) || !Number.isFinite(lb)) return NaN
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// ---------------------------------------------------------------------------
// Class parsing
// ---------------------------------------------------------------------------

/** Index of `ch` outside every bracket and paren, or -1. */
function lastTopLevel(token: string, ch: string): number {
  let depth = 0
  let found = -1
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ch && depth === 0) found = i
  }
  return found
}

interface BaseToken {
  base: string
  /** True when a variant prefix was stripped: `hover:`, `dark:`, `lg:`, `[&>li]:`. */
  stateful: boolean
  /** The `/50` modifier, without its slash. Empty when there was none. */
  modifier: string
}

/**
 * Peel a class down to the utility it applies in the resting state.
 *
 * The bracket tracking is not defensive programming: `supports-[display:grid]:`
 * and `bg-[url(data:image/png;base64,...)]` both contain a colon that is part of
 * the value, and splitting on the first or last colon blindly turns one into a
 * variant and the other into a broken URL.
 */
function peel(token: string): BaseToken {
  // `!bg-white` — the important marker changes precedence, never the colour.
  let rest = token.startsWith('!') ? token.slice(1) : token
  const colon = lastTopLevel(rest, ':')
  const stateful = colon >= 0
  if (stateful) rest = rest.slice(colon + 1)
  let modifier = ''
  const slash = lastTopLevel(rest, '/')
  if (slash >= 0) {
    modifier = rest.slice(slash + 1)
    rest = rest.slice(0, slash)
  }
  return { base: rest, stateful, modifier }
}

/**
 * The utility a class applies, and whether a variant gates it.
 *
 * Exported for `rules.ts`, which asks the same two questions of classes that
 * have nothing to do with colour — `py-2`, `text-[10px]`, `leading-none`. The
 * peeling is the awkward part (see `peel`), and a second implementation of it
 * next door would drift the first time someone meets `supports-[display:grid]:`.
 *
 * The two callers want opposite things from `underVariant`, which is why the
 * flag is returned rather than acted on here: a tap-target height must be
 * deduced from the resting state alone, or it describes a control that exists
 * at no breakpoint, while a font size that only applies under `md:` is still a
 * font size somebody reads.
 */
export function utilityBase(cls: string): { base: string; underVariant: boolean } {
  const { base, stateful } = peel(cls.trim())
  return { base, underVariant: stateful }
}

/** The alpha an opacity modifier asks for: `50` → 0.5, `[.06]` → 0.06. NaN when unreadable. */
function modifierAlpha(modifier: string): number {
  if (!modifier) return 1
  if (modifier.startsWith('[') && modifier.endsWith(']')) {
    const n = num(modifier.slice(1, -1))
    return Number.isFinite(n) ? clamp(n, 0, 1) : NaN
  }
  const n = num(modifier)
  return Number.isFinite(n) ? clamp(n / 100, 0, 1) : NaN
}

const ROLE_PREFIX: [string, ColorRole][] = [
  ['text-', 'text'],
  ['bg-', 'bg'],
  ['border-', 'border'],
]

/** `border-t-red-500` and `border-x-white` name a colour just as much as `border-red-500`. */
const BORDER_SIDES = ['t-', 'r-', 'b-', 'l-', 'x-', 'y-', 's-', 'e-']

type Resolution = { hex: string; alpha: number } | { reason: UnresolvedReason } | null

/** The colour a palette name or an arbitrary value stands for. `null` means "not a colour". */
function resolveValue(value: string): Resolution {
  if (value.startsWith('[') && value.endsWith(']')) {
    // Tailwind's type hint, `text-[color:var(--brand)]`, exists precisely to say
    // "this is a colour" — so it is one, and it is one we cannot read.
    const inner = value.slice(1, -1).startsWith('color:') ? value.slice(1, -1).slice(6) : value.slice(1, -1)
    // Underscores are Tailwind's escape for spaces inside arbitrary values.
    const css = inner.split('_').join(' ')
    if (css.includes('var(')) return { reason: 'variable' }
    if (css.includes('gradient(')) return { reason: 'gradient' }
    if (css.includes('url(')) return { reason: 'image' }
    const parsed = parseCssColor(css)
    if (parsed) return parsed
    // `text-[13px]` is an arbitrary value that is not a colour at all, and
    // `bg-[oklch(0.7_0.1_200)]` is a colour in a space this module does not
    // read. Only the second is worth reporting as unreadable — the first would
    // make every arbitrary font size look like a mystery colour.
    return value.slice(1, -1).startsWith('color:') || css.includes('(') ? { reason: 'unparseable' } : null
  }

  // `typeof`, not truthiness, on both lookups: `bg-constructor` and
  // `text-toString-500` reach Object.prototype and come back with a function,
  // which would sail through as a resolved colour.
  const special = TAILWIND_SPECIAL[value]
  if (typeof special === 'string') {
    if (special === 'transparent') return { reason: 'transparent' }
    if (special === 'currentColor' || special === 'inherit') return { reason: 'contextual' }
    return { hex: special, alpha: 1 }
  }

  const dash = value.lastIndexOf('-')
  if (dash <= 0) return null
  const family = TAILWIND_COLORS[value.slice(0, dash)]
  const hex = family?.[value.slice(dash + 1)]
  return typeof hex === 'string' ? { hex, alpha: 1 } : null
}

/**
 * One class, as a colour declaration.
 *
 * `null` means "this class does not declare one of the three colours" — a font
 * size, a background position, `bg-primary` from a theme Mocky does not ship.
 * That is not the same as `resolvable: false`, which means "it declares one and
 * it cannot be read"; both make an honest caller abstain, but only the second
 * has anything to tell the reader.
 */
export function parseColorClass(cls: string): ParsedColorClass | null {
  const token = cls.trim()
  if (!token) return null
  const { base, stateful, modifier } = peel(token)

  const prefixed = ROLE_PREFIX.find(([prefix]) => base.startsWith(prefix))
  if (!prefixed) return null
  // A `const`, not a narrowed `let`: TypeScript drops the narrowing of a `let`
  // captured by the closure below, and `role` is read there.
  const role = prefixed[1]
  let value = base.slice(prefixed[0].length)
  if (role === 'border') {
    const side = BORDER_SIDES.find((s) => value.startsWith(s))
    if (side) value = value.slice(side.length)
  }

  const resolved = resolveValue(value)
  if (!resolved) return null

  const alpha = modifierAlpha(modifier)
  const unresolved = (reason: UnresolvedReason): ParsedColorClass => ({
    role,
    hex: null,
    resolvable: false,
    reason,
    alpha: Number.isFinite(alpha) ? alpha : 1,
  })

  // A variant is checked last so the answer still carries a role: `hover:bg-x`
  // tells the caller a background exists somewhere, just not in this state.
  if ('reason' in resolved) return unresolved(resolved.reason)
  if (stateful) return unresolved('stateful')
  if (!Number.isFinite(alpha)) return unresolved('variable')
  const painted = alpha * resolved.alpha
  if (painted < 1) return unresolved('translucent')
  return { role, hex: resolved.hex, resolvable: true, alpha: 1 }
}

// ---------------------------------------------------------------------------
// What one element declares
// ---------------------------------------------------------------------------

export interface DeclaredColor {
  /** Lower-case `#rrggbb`, and non-null exactly when `resolvable` is true. */
  hex: string | null
  resolvable: boolean
  reason?: UnresolvedReason
  /** The class it came from, so a message can quote the screen back at the reader. */
  from?: string
}

export interface DeclaredColors {
  text: DeclaredColor
  background: DeclaredColor
  /**
   * The only condition under which a caller may compute a ratio.
   *
   * It exists so the check reads `if (!colors.comparable) return` in one line.
   * Two booleans a caller has to remember to AND together is one boolean a
   * caller forgets, and the forgotten case is exactly the false positive this
   * whole module is built to avoid.
   */
  comparable: boolean
}

/**
 * A class attribute, split into classes.
 *
 * A template-literal className spans lines, so the separator is any whitespace,
 * not a space — `"px-4\n  text-white"` is two classes and one of them decides
 * whether this element is legible.
 */
export function classTokens(value: string): string[] {
  const out: string[] = []
  let current = ''
  for (const c of value) {
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v') {
      if (current) out.push(current)
      current = ''
      continue
    }
    current += c
  }
  if (current) out.push(current)
  return out
}

/** Utilities that make the element's whole painted colour depend on the backdrop. */
function globalPoison(base: string): UnresolvedReason | null {
  if (base.startsWith('mix-blend-')) return 'blend'
  if (base.startsWith('opacity-')) {
    const a = modifierAlpha(base.slice('opacity-'.length))
    if (!Number.isFinite(a)) return 'translucent'
    return a < 1 ? 'translucent' : null
  }
  return null
}

/** Utilities that make one role's colour unreadable without declaring a colour themselves. */
function rolePoison(base: string): { role: ColorRole; reason: UnresolvedReason } | null {
  // Tailwind 3's gradient utilities set `background-image`, which paints over
  // whatever `bg-white` put in `background-color`. A screen with both is very
  // common — the flat colour is the fallback — and reading the fallback as the
  // painted background is how a hero section with white text on a violet
  // gradient gets reported as white on white.
  if (base.startsWith('bg-gradient-to-')) return { role: 'bg', reason: 'gradient' }
  if (base === 'bg-none') return { role: 'bg', reason: 'gradient' }
  for (const [prefix, role] of ROLE_PREFIX) {
    if (!base.startsWith(prefix + 'opacity-')) continue
    const a = modifierAlpha(base.slice((prefix + 'opacity-').length))
    if (!Number.isFinite(a)) return { role, reason: 'translucent' }
    return a < 1 ? { role, reason: 'translucent' } : null
  }
  return null
}

const unreadable = (reason: UnresolvedReason): DeclaredColor => ({ hex: null, resolvable: false, reason })

/**
 * The text and background colours **this element declares on itself**.
 *
 * Never walks up: `ElementFact.ancestors` is a list of tag names, so the
 * background of a `<p className="text-slate-500">` inside a dark wrapper is
 * simply not knowable here, and the answer is `resolvable: false`. Read the
 * module header before being tempted to default it to white — that default is
 * the bug this shape exists to prevent, and it fires on every dark screen.
 */
export function declaredColors(el: ElementFact): DeclaredColors {
  const pair = (text: DeclaredColor, background: DeclaredColor): DeclaredColors => ({
    text,
    background,
    comparable: text.resolvable && background.resolvable,
  })

  // A `style` prop can set either colour, and `style={{ background: c }}` is an
  // expression this analysis cannot read (`inspect.ts` records it as present,
  // value unknown). Judging such an element on its classes would be judging the
  // half of its styling that loses.
  if (attr(el, 'style')) return pair(unreadable('inline-style'), unreadable('inline-style'))

  const cls = attr(el, 'class')
  if (!cls) return pair(unreadable('undeclared'), unreadable('undeclared'))
  // `className={cn('p-4', dark && 'bg-black')` — present, unknowable. Reporting
  // it as "no background" would be true of the source and false of the screen.
  if (cls.kind !== 'string') return pair(unreadable('dynamic'), unreadable('dynamic'))

  const found: Record<'text' | 'bg', { hex: string; from: string }[]> = { text: [], bg: [] }
  const blocked: Partial<Record<'text' | 'bg', UnresolvedReason>> = {}
  let wholeElement: UnresolvedReason | null = null

  for (const token of classTokens(cls.value)) {
    const { base, stateful } = peel(token)
    // A poison under a variant poisons that variant's state, not this one.
    if (!stateful) {
      wholeElement = wholeElement ?? globalPoison(base)
      const rp = rolePoison(base)
      if (rp && rp.role !== 'border') blocked[rp.role] = blocked[rp.role] ?? rp.reason
    }
    const parsed = parseColorClass(token)
    if (!parsed || parsed.role === 'border') continue
    if (parsed.resolvable && parsed.hex) found[parsed.role].push({ hex: parsed.hex, from: token })
    // A variant-only declaration says nothing about the resting state, so it
    // must not block it either: `text-slate-900 hover:text-blue-600` is a
    // perfectly readable link, and treating the hover colour as an obstacle
    // would silence the check on most of them.
    else if (!stateful) blocked[parsed.role] = blocked[parsed.role] ?? (parsed.reason ?? 'undeclared')
  }

  const resolve = (role: 'text' | 'bg'): DeclaredColor => {
    if (wholeElement) return unreadable(wholeElement)
    if (blocked[role]) return unreadable(blocked[role]!)
    const hits = found[role]
    if (hits.length === 0) return unreadable('undeclared')
    // Two colour classes for the same property: the winner is decided by the
    // order Tailwind emitted the rules, which is not the order they appear in
    // the attribute. Picking the first or the last would be a coin flip.
    if (new Set(hits.map((h) => h.hex)).size > 1) return unreadable('conflict')
    return { hex: hits[0].hex, resolvable: true, from: hits[0].from }
  }

  return pair(resolve('text'), resolve('bg'))
}
