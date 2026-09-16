/**
 * Which installed typeface a declared family IS, and how to load it.
 *
 * ── What changed, and the sentence that made it change ─────────────────────
 *
 * "Les polices d'écriture ne sont absolument pas respectées." This container had
 * Liberation and nothing else, so a direction naming Fraunces got Liberation
 * Serif at best — the right CLASS, never the face. The image now carries the
 * families in `catalogue.js`, all OFL-1.1, installed from @fontsource at build
 * time and bundled as files: nothing is fetched while a film renders, which is the
 * property the old comment was protecting when it said "no egress".
 *
 * ── Pure, on purpose ─────────────────────────────────────────────────────────
 *
 * This module imports data and nothing else, so `composition.js` can use it and
 * Mocky's own suite can test it without a single font package installed. The
 * file URLs are in `files.js`, which only the compositions import.
 *
 * ── The one number, and why it only ever shrinks ────────────────────────────
 *
 * The layout estimates line widths from constants calibrated on Liberation Sans
 * and never sees a face. `advance` is each family's measured width against that
 * reference (the generator's header says how), and `sizeAdjust` is what the face
 * is registered with: a family wider than the estimate is scaled back onto it, so
 * a word the layout fitted still fits. A NARROWER family is left at 100% — scaling
 * it up would enlarge its glyphs inside a line box whose height is set by the
 * leading, and the heading's mask would clip them.
 */
import { FONT_CATALOGUE } from './catalogue.js'

/** `ThemeFontSchema`'s charset: one family name, letters, digits, spaces and hyphens. */
const DECLARED_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,47}$/u

/** Lowercase, accents off, one space between words. */
function normalise(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Weight and style words a direction writes after a family name: "Space Grotesk ExtraBold". */
const QUALIFIERS = new Set([
  'thin', 'hairline', 'extralight', 'ultralight', 'light', 'regular', 'normal', 'book', 'medium', 'semibold',
  'demibold', 'bold', 'extrabold', 'ultrabold', 'black', 'heavy', 'italic', 'oblique', 'variable', 'display', 'text',
  'extra', 'semi', 'demi', 'ultra',
])

/**
 * Commercial faces a direction names that have a well-known open cousin here.
 *
 * Short, and only where the resemblance is the one a designer would reach for
 * themselves — SF Pro and Inter share a skeleton, Gotham and Montserrat were
 * drawn from the same signage. Helvetica and Arial are deliberately absent:
 * Liberation Sans is metric-compatible with both and already the fallback.
 */
const COUSINS = {
  'sf pro': 'Inter',
  'sf pro display': 'Inter',
  'sf pro text': 'Inter',
  'san francisco': 'Inter',
  graphik: 'Inter',
  sohne: 'Inter',
  gotham: 'Montserrat',
  circular: 'DM Sans',
  'circular std': 'DM Sans',
  'gt walsheim': 'Outfit',
  'neue montreal': 'Hanken Grotesk',
  'founders grotesk': 'Schibsted Grotesk',
  tiempos: 'Newsreader',
  'tiempos headline': 'Newsreader',
  canela: 'Fraunces',
  recoleta: 'Fraunces',
  'sf mono': 'JetBrains Mono',
}

const BY_NAME = new Map(FONT_CATALOGUE.map((entry) => [normalise(entry.family), entry]))
/** Longest names first, so "Inter Tight" is found before "Inter". */
const NAMES_LONGEST_FIRST = [...BY_NAME.keys()].sort((a, b) => b.length - a.length)

/**
 * The catalogue entry a declared family resolves to, or null.
 *
 * In order: the exact name; the name with its weight and style words taken off
 * ("Space Grotesk ExtraBold"); an open cousin of a commercial face; and finally
 * any installed family the declaration CONTAINS as whole words, longest first —
 * which is what turns "SF Pro Display ou Inter Display" into Inter rather than
 * into nothing. A declaration that matches none of these returns null and keeps
 * the class fallback it always had.
 */
export function catalogueFamily(declared) {
  const name = normalise(declared)
  if (!name) return null
  if (BY_NAME.has(name)) return BY_NAME.get(name)

  const bare = name
    .split(' ')
    .filter((word) => !QUALIFIERS.has(word))
    .join(' ')
  if (bare && BY_NAME.has(bare)) return BY_NAME.get(bare)
  for (const candidate of [name, bare]) {
    if (candidate && COUSINS[candidate]) return BY_NAME.get(normalise(COUSINS[candidate])) ?? null
  }

  const padded = ` ${name} `
  for (const known of NAMES_LONGEST_FIRST) {
    if (padded.includes(` ${known} `)) return BY_NAME.get(known)
  }
  for (const [cousin, family] of Object.entries(COUSINS)) {
    if (padded.includes(` ${cousin} `)) return BY_NAME.get(normalise(family)) ?? null
  }
  return null
}

/** The `size-adjust` a family is registered with, as a fraction: never above 1. */
export function sizeAdjustOf(entry) {
  const advance = Number(entry?.advance)
  if (!Number.isFinite(advance) || advance <= 1) return 1
  return Math.round((1 / advance) * 1000) / 1000
}

/**
 * Every face a theme needs loaded: its heading family and its body family, once
 * each, with the family name CSS will ask for and the size adjustment to apply.
 * Families the catalogue does not have contribute nothing — they keep the class
 * fallback, and a render never waits on a face that is not in the image.
 */
export function facesForTheme(theme) {
  const fonts = theme && typeof theme === 'object' ? theme.fonts || {} : {}
  const seen = new Set()
  const faces = []
  for (const declared of [fonts.heading, fonts.body]) {
    // The schema's own charset, re-checked: `fontStack` drops a family that fails
    // it, so loading a face for one would load a face nothing asks for.
    if (typeof declared !== 'string' || !DECLARED_FAMILY.test(declared)) continue
    const entry = catalogueFamily(declared)
    if (!entry || seen.has(entry.family)) continue
    seen.add(entry.family)
    for (const face of entry.faces) {
      faces.push({ family: entry.family, key: face.key, weight: face.weight, sizeAdjust: sizeAdjustOf(entry) })
    }
  }
  return faces
}

export { FONT_CATALOGUE }
