// The project's art direction, turned into the handful of tokens a film can
// carry.
//
// ── Who writes a theme, and who does not ─────────────────────────────────────
//
// The model does not. `VideoTimelineSchema` has no `theme`, and every object in
// it is `.strict()`, so a model that invents one is refused like any other
// unknown key. What a montage looks like is not a decision the composer gets to
// make: the project already made it, in its DESIGN.md or its Muse dossier, and
// re-deciding it per film is how an export ends up resembling a stock template
// instead of the product it was cut from. Reading it costs no tokens, cannot
// fail a generation, and gives the same answer twice.
//
// ── Why this runs in the browser and lands on the server ─────────────────────
//
// The derivation is here rather than in `server/video/` for a reason that is
// structural, not stylistic: the server keeps a project as an OPAQUE blob (see
// `Project.design` in `lib/project.ts`) and cannot import a `.ts` module at the
// Node 22.12 floor anyway — which is the same constraint that makes
// `server/video/timeline.js` a hand-kept mirror. So the direction is read where
// it lives, and the SERVER is what puts the result into the render document,
// through `attachTheme`, after the model's timeline has already been accepted.
//
// That leaves a browser handing the server a theme, which is fine and is not an
// accident: `VideoThemeSchema` is bounded so tightly that the worst a modified
// client can do is render its own film in its own colours. Colours are hex,
// fonts are one family name from a charset with no CSS syntax in it, the radius
// is an integer, and nothing anywhere becomes a URL or a file name.
//
// ── Declared, never guessed ──────────────────────────────────────────────────
//
// `parseDesignSystem` always returns seven filled roles and a radius, because a
// style sheet has to render; most of those values are inventions when the
// document is quiet. `parseDesignSpec` records which ones were actually stated,
// and only those are emitted here. A guessed accent burnt into a film is a lie
// nobody can see through — the video is simply the wrong colour, with nothing
// saying so — while an absent one leaves the composition on a default somebody
// chose on purpose, once, in code a reviewer read.
//
// ── This is one of two declarers, and the other one comes first ──────────────
//
// The distinction above is "the user stated it" against "the model guessed it",
// and the direction is not the only place a user states something: a brief that
// says "fond noir" is the same person, more recently, about this film. That
// reading lives in `briefTheme.ts` — which is deliberately built ON this
// function rather than beside it, so the hex charset, the role resolution and
// `parseDesignSpec.stated` have exactly one implementation — and
// `mergeFilmTheme` lays it over this one token by token.
import { parseDesignSpec } from '../designSpec'
import { readRadius } from '../designTokens'
import { ThemeColorSchema, ThemeFontSchema, VideoThemeSchema, type VideoTheme } from './timeline'

/**
 * One family name out of a typography line.
 *
 * These documents are prose: `- Display: Cormorant Garamond`, but also
 * `- Body: Inter, sans-serif` and `system-ui / Inter`. The schema carries ONE
 * family and never a CSS stack — a comma there is the start of a syntax, and a
 * font name is the one theme field that could close a declaration — so the head
 * of the list is what is taken, and the composition appends its own fallbacks.
 *
 * Anything left that the schema will not accept is dropped rather than cleaned
 * up. A "sanitised" typeface is a different typeface, and the honest outcome of
 * "this direction names a font Mocky cannot express" is the template's own.
 */
function familyName(declared: string | undefined): string | undefined {
  if (!declared) return undefined
  const head = declared
    .split(/[,/]/)[0]
    .replace(/["'`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return ThemeFontSchema.safeParse(head).success ? head : undefined
}

/** A stated colour, or nothing. Asked of the schema so the rule lives once. */
function color(hex: string | undefined, stated: boolean | undefined): string | undefined {
  if (!stated || !hex) return undefined
  return ThemeColorSchema.safeParse(hex).success ? hex : undefined
}

/**
 * `14px` / `1.5rem` as a whole number of pixels.
 *
 * A number and not a CSS length, so the document carries no unit to parse and
 * no `calc()` to smuggle. 16 px to the rem is the browser default and the only
 * root size a Remotion composition has; a value that will not convert is
 * dropped, because a radius guessed wrong is visible in every corner of the
 * film.
 */
function radiusPx(declared: string | null): number | undefined {
  if (!declared) return undefined
  const m = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(declared)
  if (!m) return undefined
  const px = Number(m[1]) * (m[2] === 'rem' ? 16 : 1)
  if (!Number.isFinite(px) || px < 0 || px > 9999) return undefined
  return Math.round(px)
}

/**
 * Read a DESIGN.md or a Muse dossier into a video theme.
 *
 * Returns `null` when the document states nothing this schema can carry — which
 * is a different fact from an empty theme, and is why `theme` is left out of the
 * render document entirely rather than sent as `{}`. "No direction" and "a
 * direction that asks for nothing" would otherwise be indistinguishable on the
 * wire.
 */
export function themeFromDesign(markdown: string | null | undefined): VideoTheme | null {
  const md = typeof markdown === 'string' ? markdown : ''
  if (!md.trim()) return null

  const spec = parseDesignSpec(md)
  const roles = spec.system.roles

  const colors = {
    background: color(roles.bg, spec.stated.bg),
    text: color(roles.text, spec.stated.text),
    accent: color(roles.accent, spec.stated.accent),
    surface: color(roles.surface, spec.stated.surface),
  }
  const fonts = {
    heading: familyName(spec.typography.display),
    body: familyName(spec.typography.body),
  }
  const radius = radiusPx(readRadius(md))

  const theme: Record<string, unknown> = {}
  if (Object.values(colors).some(Boolean)) theme.colors = dropEmpty(colors)
  if (Object.values(fonts).some(Boolean)) theme.fonts = dropEmpty(fonts)
  if (radius !== undefined) theme.radiusPx = radius

  /*
   * Parsed by the same schema the server applies, and `null` on a refusal.
   *
   * Belt and braces on purpose: `attachTheme` drops a refused theme WHOLE — one
   * unusable token would cost the project its colours as well — so the cheapest
   * place to be certain the document is acceptable is the one that built it.
   */
  const parsed = VideoThemeSchema.safeParse(theme)
  return parsed.success ? parsed.data : null
}

/** `{ a: 'x', b: undefined }` → `{ a: 'x' }`. `.strict()` tolerates the key, JSON does not carry it. */
function dropEmpty(record: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) if (value) out[key] = value
  return out
}
