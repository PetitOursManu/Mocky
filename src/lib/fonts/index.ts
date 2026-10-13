/**
 * The typefaces a generated screen may use, and how they reach it.
 *
 * Before this, a screen got no webfont at all: the preview's CSP refuses
 * external stylesheets (so Google Fonts never loaded), nothing was served from
 * Mocky's origin, and a model that wrote `font-['Playfair_Display']` — or an art
 * direction that said "Display: Playfair Display" — rendered in Times on every
 * machine that did not happen to have the face installed. The direction was
 * honoured in the source and invisible on the canvas.
 *
 * Now ~200 families are self-hosted under /fonts (scripts/vendor-fonts.mjs,
 * which also writes `catalogue.json` beside this file), the model is shown the
 * list (`FONTS_PROMPT`), and every document a screen is drawn in declares the
 * faces its code NAMES (`fontFaceCss`) — and only those, so a screen that uses
 * two families carries two families' worth of CSS and downloads nothing else.
 */
import catalogue from './catalogue.json'

export type FontCategory =
  | 'sans'
  | 'condensed'
  | 'rounded'
  | 'serif'
  | 'serif-display'
  | 'slab'
  | 'display'
  | 'retro'
  | 'blackletter'
  | 'handwriting'
  | 'script'
  | 'mono'

export interface FontFace {
  style: 'normal' | 'italic'
  /** A CSS font-weight descriptor: "400", or a range "100 900". */
  weight: string
  /** Paths under /fonts/, per subset. */
  files: { latin?: string; 'latin-ext'?: string }
}

export interface FontFamily {
  family: string
  id: string
  category: FontCategory
  fallback: string
  package: string
  version: string
  license: string
  faces: FontFace[]
}

export const FONT_FAMILIES = catalogue.families as FontFamily[]
const RANGES = catalogue.ranges as Record<'latin' | 'latin-ext', string>

/** The order categories are listed in — to the model and to a person. */
export const FONT_CATEGORIES: FontCategory[] = [
  'sans',
  'condensed',
  'rounded',
  'serif',
  'serif-display',
  'slab',
  'display',
  'retro',
  'blackletter',
  'handwriting',
  'script',
  'mono',
]

/** How each category is introduced to the model: short, because it is paid on every call. */
const CATEGORY_PROMPT: Record<FontCategory, string> = {
  sans: 'Sans',
  condensed: 'Condensed',
  rounded: 'Rounded',
  serif: 'Serif (text)',
  'serif-display': 'Serif (display)',
  slab: 'Slab',
  display: 'Display',
  retro: 'Retro / decorative',
  blackletter: 'Blackletter / medieval',
  handwriting: 'Handwriting',
  script: 'Script',
  mono: 'Monospace',
}

const BY_NAME = new Map(FONT_FAMILIES.map((f) => [f.family.toLowerCase(), f]))

/** A catalogue family by its exact name, case-insensitive. */
export function fontByName(name: string): FontFamily | undefined {
  return BY_NAME.get(name.trim().toLowerCase())
}

/**
 * The family a free-text typography line names, if it names one of ours.
 *
 * A direction writes "Playfair Display (high-contrast serif)", "Inter, 400/700"
 * or "Lora / Inter": the catalogue name that comes FIRST wins — the line's
 * own order is its order of preference — and "Inter Tight" is never read as
 * "Inter" (see `namedIn`). "Serif display (Playfair/Freight)" names none.
 */
export function findFontIn(text: string | undefined | null): FontFamily | undefined {
  if (!text) return undefined
  const found = namedIn(String(text)).sort((a, b) => a.at - b.at)
  return found[0]?.family
}

const LONGEST_FIRST = [...FONT_FAMILIES].sort((a, b) => b.family.length - a.family.length)

/**
 * One pattern per family: its name, case-insensitive, with a space OR an
 * underscore wherever the name has a space (Tailwind's arbitrary values spell
 * `Playfair_Display`), and not inside a longer word.
 *
 * The boundary is what keeps "Inter" out of "Interstate" and "Rye" out of
 * "Ryeland". It does not keep "Cookie" out of a bakery's copy, and is not
 * meant to: a family declared and never used costs a few hundred bytes of CSS
 * and NO download — a browser fetches a face only when text is set in it. A
 * family used and not declared costs the typography of the screen. So the
 * scan errs towards declaring, and reads the whole source rather than only
 * `fontFamily:` and `font-[…]`: a model that keeps its stack in a constant
 * (`const display = "'Fraunces', serif"`) names the face nowhere near either.
 */
const PATTERNS = new Map(
  FONT_FAMILIES.map((f) => {
    const body = f.family
      .split(' ')
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[ _]')
    return [f, new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu')]
  }),
)

/**
 * Every family named in `text`, with where it first appears.
 *
 * Longest names first, and each match is blanked out of the text before the
 * shorter names are tried: "Inter Tight" would otherwise also be read as
 * "Inter", and "Cormorant Garamond" as "Cormorant" — a second family declared
 * for a name nobody wrote.
 */
function namedIn(text: string): Array<{ family: FontFamily; at: number }> {
  let rest = text
  let lower = text.toLowerCase()
  const out: Array<{ family: FontFamily; at: number }> = []
  for (const f of LONGEST_FIRST) {
    // A substring test before the regex: almost every family is absent from
    // almost every screen, and `includes` rules them out for nothing.
    if (!lower.includes(f.family.split(' ')[0].toLowerCase())) continue
    const re = PATTERNS.get(f)!
    let at = -1
    rest = rest.replace(re, (m, offset: number) => {
      if (at < 0) at = offset
      return ' '.repeat(m.length)
    })
    if (at >= 0) {
      out.push({ family: f, at })
      lower = rest.toLowerCase()
    }
  }
  return out
}

/** Every catalogue family a screen's source names, in catalogue order. */
export function fontsNamedIn(code: string): FontFamily[] {
  if (!code) return []
  const found = new Set(namedIn(code).map((m) => m.family))
  return FONT_FAMILIES.filter((f) => found.has(f))
}

/** `'Family', generic` — what a style or a class should say. */
export function fontStackOf(f: FontFamily): string {
  return `'${f.family}', ${f.fallback}`
}

/**
 * The @font-face rules for some families.
 *
 * `font-display: block`, not `swap`: a mockup is LOOKED AT, and measured — the
 * preview reports its height, the document kit counts its pages, a capture
 * draws its text — and every one of those would rather wait a few milliseconds
 * for a face served from this origin than act on the fallback's metrics and be
 * wrong after the swap. The block period is the browser's own (≈3 s), so a
 * face that never arrives still degrades to the fallback instead of hiding the
 * text.
 *
 * `origin` is prefixed to every URL. A srcdoc frame resolves `/fonts/…` against
 * its parent's address, so '' works there; a caller that builds a document for
 * some other place passes its origin. `alias` renames the family — see
 * `specimenFamily`.
 */
export function fontFaceCss(families: FontFamily[], origin = '', alias?: (f: FontFamily) => string): string {
  const rules: string[] = []
  for (const f of families) {
    const name = (alias ? alias(f) : f.family).replace(/'/g, '')
    for (const face of f.faces) {
      for (const subset of ['latin', 'latin-ext'] as const) {
        const file = face.files[subset]
        if (!file) continue
        rules.push(
          `@font-face{font-family:'${name}';font-style:${face.style};font-weight:${face.weight};font-display:block;` +
            `src:url(${origin}/fonts/${file}) format('woff2');unicode-range:${RANGES[subset]}}`,
        )
      }
    }
  }
  return rules.join('\n')
}

/** The faces a screen's source names, as CSS ready for a <style>. Empty when it names none. */
export function fontFaceCssFor(code: string, origin = ''): string {
  return fontFaceCss(fontsNamedIn(code), origin)
}

/**
 * The name a family is registered under in MOCKY'S OWN document.
 *
 * Mocky's interface asks for `Inter` and `Roboto` by name (tailwind.config.js),
 * and falls back to the system face when the machine has neither. Registering
 * the catalogue's `Inter` in the app's document to show a specimen would
 * quietly switch the whole interface to the webfont the moment a design was
 * opened. A prefixed alias draws the specimen and touches nothing else.
 */
export function specimenFamily(f: FontFamily): string {
  return `Mocky Specimen ${f.family}`
}

const registered = new Set<string>()

/**
 * Declare some families in Mocky's own document, under `specimenFamily`, once
 * each. A browser downloads a face only when
 * text uses it, so registering a whole category to list it costs CSS, and only
 * the specimens scrolled into view are fetched.
 */
export function registerSpecimens(families: FontFamily[]): void {
  if (typeof document === 'undefined') return
  const fresh = families.filter((f) => !registered.has(f.id))
  if (!fresh.length) return
  for (const f of fresh) registered.add(f.id)
  const style = document.createElement('style')
  style.dataset.mockyFonts = 'specimens'
  style.textContent = fontFaceCss(fresh, '', specimenFamily)
  document.head.appendChild(style)
}

/** The stack a specimen is set in: the alias, then the generic fallback. */
export function specimenStack(f: FontFamily): string {
  return `'${specimenFamily(f)}', ${f.fallback}`
}

/**
 * What the model is told, on the paths that may CHOOSE a typeface: a new
 * screen, an edit, and a polish (whose `overused-font` finding asks it to
 * replace one). Not the repair, the accessibility fix or the page fit — each is
 * told to change nothing but what it was given, a screen they return still
 * names the faces it named, and delivery reads the code, so the list would be
 * a thousand tokens paid to be ignored.
 *
 * One line per category and names only: this is paid on every call that
 * carries it. The two spellings given are the two `fontsNamedIn` is sure to
 * read, and the generic fallback is asked for because a face that fails to
 * load should fall to its own kind, not to Times.
 */
export const FONTS_PROMPT = [
  'FONTS — these typefaces are served with the page. Use them by name; never import, <link> or @import a font, and never use Google Fonts.',
  "Set one with a Tailwind arbitrary class, spaces written as underscores and a generic fallback last — className=\"font-['Playfair_Display',serif]\" — or with style={{ fontFamily: \"'Playfair Display', serif\" }}. Spell the name exactly as listed: any other family falls back to the system font.",
  'When the art direction or the request names a typeface, use it. Otherwise choose for the subject: usually one display face for headings and one readable face for text — three families at most. Script, handwriting, blackletter, retro and display faces are for headlines, logos and short labels, never for paragraphs.',
  ...FONT_CATEGORIES.map(
    (c) =>
      `- ${CATEGORY_PROMPT[c]}: ${FONT_FAMILIES.filter((f) => f.category === c)
        .map((f) => f.family)
        .join(', ')}`,
  ),
].join('\n')
