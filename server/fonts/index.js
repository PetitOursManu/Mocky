/**
 * The typefaces a generated screen can load, as the server knows them.
 *
 * `families.json` beside this file is written by scripts/vendor-fonts.mjs as a
 * projection of src/lib/fonts/catalogue.json — names and categories, no files —
 * because the runtime image ships server/ and never src/. Muse reads it to make
 * an art direction name faces that will actually be drawn: before, the dossier
 * wrote "Display: Modern sans display" or "Freight", the screen was told to
 * follow it exactly, and the canvas showed the system font.
 *
 * `findFontIn` MIRRORS the function of the same name in src/lib/fonts/index.ts
 * (Node cannot import TypeScript at the 22.12 floor — the same deliberate
 * duplication as server/video/timeline.js). `server/fonts/index.test.js` runs one
 * corpus through both.
 */
import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url), 'utf8'))

/** @type {{ family: string, category: string, fallback: string }[]} */
export const FONT_FAMILIES = data.families

const BY_NAME = new Map(FONT_FAMILIES.map((f) => [f.family.toLowerCase(), f]))
const LONGEST_FIRST = [...FONT_FAMILIES].sort((a, b) => b.family.length - a.family.length)
const PATTERNS = new Map(
  FONT_FAMILIES.map((f) => {
    const body = f.family
      .split(' ')
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[ _]')
    return [f, new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu')]
  }),
)

/** A family by its exact name, case-insensitive. */
export function fontByName(name) {
  return BY_NAME.get(String(name || '').trim().toLowerCase())
}

/** The catalogue family a free-text line names FIRST, or undefined. Mirror of the TS one. */
export function findFontIn(text) {
  if (!text) return undefined
  let rest = String(text)
  let lower = rest.toLowerCase()
  let best
  for (const f of LONGEST_FIRST) {
    if (!lower.includes(f.family.split(' ')[0].toLowerCase())) continue
    let at = -1
    rest = rest.replace(PATTERNS.get(f), (m, offset) => {
      if (at < 0) at = offset
      return ' '.repeat(m.length)
    })
    if (at >= 0) {
      lower = rest.toLowerCase()
      if (!best || at < best.at) best = { family: f, at }
    }
  }
  return best?.family
}

/** How the categories read to the art director, in the order they are listed. */
const CATEGORY_LABEL = {
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

/** The catalogue, one line per category, for a prompt. */
export function fontCatalogueLines() {
  return Object.entries(CATEGORY_LABEL).map(
    ([c, label]) => `- ${label}: ${FONT_FAMILIES.filter((f) => f.category === c).map((f) => f.family).join(', ')}`,
  )
}

/**
 * From a DESCRIPTION of type to a family that exists — for the offline
 * dossier, whose patterns say "Serif display (Playfair/Freight), humanist sans
 * body", and for a model that described a face instead of naming one.
 *
 * Read in order, first hit wins: the specific treatments before the broad
 * families, so "rounded slab / groovy display" is groovy before it is slab and
 * "high-contrast serif" is a Didone before it is a serif. Every answer is a
 * catalogue name — a test holds the table to the catalogue.
 */
const DISPLAY_BY_WORD = [
  [/blackletter|fraktur|gothic|medieval/i, 'UnifrakturMaguntia'],
  [/pixel|8-?bit|arcade|retro game/i, 'Press Start 2P'],
  [/typewriter/i, 'Special Elite'],
  [/hand[- ]?(drawn|written|lettered)|handwrit|marker|sketch|doodle/i, 'Caveat'],
  [/script|calligraph|cursive|wedding/i, 'Great Vibes'],
  [/groovy|psychedel|seventies|70s/i, 'Shrikhand'],
  [/art deco|\bdeco\b/i, 'Poiret One'],
  [/western|saloon/i, 'Rye'],
  [/mono|code|terminal/i, 'JetBrains Mono'],
  [/condensed|compressed|poster|narrow/i, 'Bebas Neue'],
  [/high[- ]contrast|didone|bodoni|fashion|luxury/i, 'Bodoni Moda'],
  [/slab/i, 'Zilla Slab'],
  [/rounded|friendly|playful|soft/i, 'Fredoka'],
  [/chunky|extra[- ]?bold|heavy|black/i, 'Archivo Black'],
  [/(?<!sans[- ]?)serif|editorial|playfair|garamond|classic/i, 'Playfair Display'],
  [/geometric/i, 'Outfit'],
  [/grotesk|grotesque|swiss|neo-grot|helvetica/i, 'Inter Tight'],
  [/humanist/i, 'Source Sans 3'],
]
const BODY_BY_WORD = [
  [/mono|code|terminal/i, 'IBM Plex Mono'],
  [/(?<!sans[- ]?)serif/i, 'Source Serif 4'],
  [/rounded|friendly|playful|soft/i, 'Nunito'],
  [/humanist|calm|warm/i, 'Source Sans 3'],
  [/geometric/i, 'Outfit'],
  [/thin|light|wide tracking/i, 'Jost'],
]
export const DEFAULT_DISPLAY = 'Inter Tight'
export const DEFAULT_BODY = 'Inter'

function byWord(text, table) {
  for (const [re, family] of table) if (re.test(text)) return family
  return undefined
}

/** The family a role's free text names or describes, or undefined. */
export function familyFor(text, role) {
  const named = findFontIn(text)
  if (named) return named.family
  return byWord(String(text || ''), role === 'body' ? BODY_BY_WORD : DISPLAY_BY_WORD)
}

/**
 * A pattern's one-line typography ("Serif display (Playfair/Freight), humanist
 * sans body", "Humanist sans, calm serif headings") split into its two roles:
 * the part that says body or text is the body, the part that says heading,
 * display or title is the display, and when only one is marked the other part
 * is the other role. A line that marks neither ("Monospace (JetBrains Mono)
 * primary") answers both from its first part.
 */
export function typographyFromDescription(description) {
  const parts = String(description || '')
    .split(/[,;+]|\band\b/i)
    .map((p) => p.trim())
    .filter(Boolean)
  let head = parts.find((p) => /head|display|title/i.test(p))
  let body = parts.find((p) => p !== head && /\bbody\b|\btext\b/i.test(p))
  if (head && !body) body = parts.find((p) => p !== head)
  if (body && !head) head = parts.find((p) => p !== body)
  head = head || parts[0] || ''
  body = body || head
  return {
    display: familyFor(head, 'display') || DEFAULT_DISPLAY,
    body: familyFor(body, 'body') || DEFAULT_BODY,
  }
}

/**
 * A dossier's typography, settled on faces that load.
 *
 * A model asked to pick from the list mostly does; when it names a face we do
 * not carry ("Satoshi") or describes one ("elegant serif"), the description is
 * mapped, then the pattern's seed is, then the default. Never a failure (M3):
 * the worst outcome is a plainer face than was imagined, never a missing one.
 */
export function settleTypography(typography, seed) {
  const t = typography && typeof typography === 'object' ? typography : {}
  const fromSeed = typographyFromDescription(seed)
  const display = familyFor(t.display, 'display') || fromSeed.display
  const body = familyFor(t.body, 'body') || fromSeed.body
  return { ...t, display, body }
}
