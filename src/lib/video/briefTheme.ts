// The colours the USER asked for, read out of the brief, and why they come
// before the project's dossier.
//
// ── What this does NOT change ────────────────────────────────────────────────
//
// The model still does not write the theme. `VideoTimelineSchema` still has no
// `theme` key, every object in it is still `.strict()`, and `attachTheme` still
// puts the look onto `RenderTimelineSchema` server-side, after the model's
// document has been validated. Nothing here reaches a prompt.
//
// What changes is where a DECLARED colour may come from. Rule 9's sentence was
// "only what the direction declared", and the distinction it was really making
// is not brief-versus-dossier — it is **the user declared** versus **the model
// guessed**. A brief that says "texte blanc sur fond noir" is a declaration, and
// it is a more recent and more specific one than a DESIGN.md written weeks ago:
// somebody typed it, for this film, three centimetres above the button. So the
// brief wins per token, the dossier keeps every token the brief is silent about,
// and a colour nobody stated anywhere still reaches nothing.
//
// ── Why the extraction is the design system's own ───────────────────────────
//
// `designTokens.ts` already knows how to find colours in prose, and it has been
// corrected twice by real documents — a background inferred from an empty pool,
// and a label regex eaten by Markdown emphasis. Reimplementing that here would
// be a sixth hand-kept mirror in a module that already has five, so this file
// does one thing the existing reader cannot: it turns the FRENCH AND ENGLISH
// PROSE of a brief into the `- Label: #hex` grammar `parseColors` was written
// for, and then hands it to `themeFromDesign` unchanged. Role resolution, the
// declared/guessed distinction, the hex charset and the schema check are all the
// existing code, reached through one door.
//
// ── A name is a declaration; the exact shade is Mocky's, once, in code ───────
//
// Nobody types `#c0392b` into a brief. They type "en rouge et noir", and
// refusing to read that would ship a feature that answers a request nobody
// makes. But "rouge" names a family, not a value, so the hex below is a choice —
// and it is the same KIND of choice as `THEME_FALLBACK.accent`: made once, in
// code a reviewer read, and visible in the result. That is the opposite of the
// thing rule 9 forbids, which is a colour nobody chose appearing as though the
// project had asked for it.
//
// ── And a role is never guessed ─────────────────────────────────────────────
//
// "En rouge et noir" says two colours and no roles, and this module deliberately
// takes NOTHING from it: which of the two is the ground and which is the ink is
// exactly the guess that burns an unseeable colour into a film. A colour is read
// only when the brief also says what it is FOR — "fond noir", "texte blanc",
// "un accent rouge" — or through the one idiom that states both at once, "X sur
// Y". The panel then prints what was understood, which is what turns a brief
// that said nothing usable into something the writer can fix in one edit,
// instead of a film that quietly ignored them.
import { roleForLabel } from '../designTokens'
import { themeFromDesign } from './theme'
import { VideoThemeSchema, type VideoTheme } from './timeline'

/** The four colour roles a film can carry. `VideoThemeSchema.colors`' own keys. */
export type ThemeColorRole = 'background' | 'text' | 'accent' | 'surface'

/** In the order a note reads them: the ground, then what stands on it. */
export const THEME_COLOR_ROLES: ThemeColorRole[] = ['background', 'text', 'accent', 'surface']

/**
 * The colour words a brief may use, and the one hex each of them means.
 *
 * A closed table on purpose. Every value here is a decision — "which red" — and
 * a decision made once in a file under review is the only kind this feature is
 * allowed to make; the alternative is a model asked to name a colour, which is
 * both a token spend and the guess rule 9 exists to refuse.
 *
 * Bilingual because the interface is, and the feminine forms are in it because
 * French agreement is not optional in prose: "une carte blanche" is what people
 * write, and a table with only "blanc" in it reads half the briefs it is given.
 *
 * `or` is deliberately absent while `doré` is present. As a bare word it is one
 * of the most common conjunctions in written French — "Or, le film doit…" — and
 * a colour table that fires on it would paint a film gold because of a sentence
 * about something else.
 */
const NAMED_COLORS: Record<string, string> = {
  noir: '#000000', noire: '#000000', black: '#000000',
  blanc: '#ffffff', blanche: '#ffffff', white: '#ffffff',
  gris: '#6b7280', grise: '#6b7280', grey: '#6b7280', gray: '#6b7280',
  rouge: '#c0392b', red: '#c0392b',
  orange: '#ea580c',
  jaune: '#eab308', yellow: '#eab308',
  vert: '#16a34a', verte: '#16a34a', green: '#16a34a',
  bleu: '#2563eb', bleue: '#2563eb', blue: '#2563eb',
  violet: '#7c3aed', violette: '#7c3aed', mauve: '#7c3aed', purple: '#7c3aed',
  rose: '#db2777', pink: '#db2777',
  marron: '#78350f', brun: '#78350f', brown: '#78350f',
  beige: '#e8dcc8',
  crème: '#f6f4ee', creme: '#f6f4ee', cream: '#f6f4ee',
  ivoire: '#f8f5ec', ivory: '#f8f5ec',
  turquoise: '#0d9488',
  cyan: '#0891b2',
  indigo: '#4338ca',
  doré: '#b8860b', dore: '#b8860b', dorée: '#b8860b', doree: '#b8860b', gold: '#b8860b',
  argent: '#9ca3af', argenté: '#9ca3af', argente: '#9ca3af', silver: '#9ca3af',
}

/** "vert foncé", "dark green" — the modifier is a direction, not a second colour. */
const DARKER = ['foncé', 'fonce', 'foncée', 'foncee', 'sombre', 'profond', 'profonde', 'dark', 'deep']
const LIGHTER = ['clair', 'claire', 'pâle', 'pale', 'light']

/**
 * How far a modifier moves a named colour toward black or white.
 *
 * One number rather than a second table of hexes, because "dark green" is a
 * modification of green and a table would let the two drift apart — "vert" and
 * "vert foncé" landing on unrelated greens is the sort of thing nobody notices
 * until a film is on screen. 0.45 is far enough that the two read as different
 * colours and near enough that the hue survives; nothing downstream depends on
 * the value, since every run is re-measured against the surface it lands on.
 */
const SHADE_MIX = 0.45

const DARK_SET = new Set(DARKER)
const LIGHT_SET = new Set(LIGHTER)

/** `#1a2b3c` → [26, 43, 60]. Six digits only: every value in the table is one. */
function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function shade(hex: string, direction: 'dark' | 'light'): string {
  const target = direction === 'dark' ? 0 : 255
  const moved = channels(hex).map((c) => Math.round(c + (target - c) * SHADE_MIX))
  return `#${moved.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/*
 * The colour token, as a source string, because it appears in two patterns.
 *
 * The lookarounds are not decoration: without them "vert" matches inside
 * "vertical" and "or" inside "orange", and a brief about a vertical format would
 * come back green. `\p{L}` under `u` is the right class for the same reason
 * `designTokens` uses it — nothing about this is French-specific.
 *
 * The hex branch refuses a seventh digit for the mirror reason: `#1234567` is
 * not a six-digit colour followed by a stray character, it is something this
 * module does not understand, and reading its prefix would invent a colour.
 */
const HEX_TOKEN = '#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])'
const alternation = (words: string[]) =>
  [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const NAME_TOKEN = `(?<!\\p{L})(?:${alternation(Object.keys(NAMED_COLORS))})(?!\\p{L})`
const MOD_TOKEN = `(?<!\\p{L})(?:${alternation([...DARKER, ...LIGHTER])})(?!\\p{L})`
const COLOUR = `(?:${HEX_TOKEN}|(?:${MOD_TOKEN}[ \\t-]+)?${NAME_TOKEN}(?:[ \\t-]+${MOD_TOKEN})?)`

/** A matched colour token — a hex, or a name with at most one modifier — as a hex. */
function tokenToHex(raw: string): string | null {
  const written = raw.trim()
  // A hex the user typed is passed through with its own capitalisation, exactly
  // as `themeFromDesign` leaves a DESIGN.md's: the value is theirs, and a
  // "tidied" one is a diff nobody asked for in the one field they can read back.
  if (written.startsWith('#')) return written
  const token = written.toLowerCase()
  let name: string | null = null
  let direction: 'dark' | 'light' | null = null
  for (const word of token.split(/[\s-]+/)) {
    if (DARK_SET.has(word)) direction = 'dark'
    else if (LIGHT_SET.has(word)) direction = 'light'
    else if (word in NAMED_COLORS) name = word
  }
  if (!name) return null
  const base = NAMED_COLORS[name]
  return direction ? shade(base, direction) : base
}

/**
 * How many words around a colour are read as saying what it is for.
 *
 * The window is the only thing standing between this module and a false
 * positive: a colour with a role word four words away is a sentence about
 * something else, and painting a film from it is the failure that has no visible
 * cause. Three behind, because "la couleur de fond" is three; two ahead, because
 * that side exists for English adjective order — "white text", "a red accent" —
 * where the noun follows immediately or not at all.
 *
 * A clause boundary stops both, comma included, and the comma is not
 * fussiness: "dark background, white text" put a role word one word behind a
 * colour that belongs to the next phrase, and read backwards it painted the
 * ground white. A colon is deliberately NOT a boundary — "Fond : noir" is a
 * person stating a token.
 */
const ROLE_WINDOW_WORDS = 3
const ROLE_WINDOW_AHEAD = 2
const CLAUSE_BREAK = /[.,;!?\n]/
const WORD = /[\p{L}\p{N}'’-]+/gu

/**
 * The words that make the colour after them a GROUND, whatever else is nearby.
 *
 * "Du texte blanc sur noir" and "white text on black" both put a role word
 * behind the second colour that belongs to the first, so the ordinary window
 * reads the ink's noun and paints the ground with it. The preposition is the
 * more specific statement and it wins outright — but only as the word
 * IMMEDIATELY before, so "sur un fond noir" still goes through the window and
 * says the same thing for its own reason.
 */
const GROUND_PREPOSITIONS = new Set(['sur', 'on', 'over', 'contre', 'against'])

/** `'bg'` → `'background'`. The roles a film carries; every other one is dropped. */
function themeRole(role: string): ThemeColorRole | null {
  if (role === 'bg') return 'background'
  if (role === 'text') return 'text'
  if (role === 'accent') return 'accent'
  if (role === 'surface') return 'surface'
  return null
}

/**
 * What the words just before a colour say it is for, asked of the design system.
 *
 * `roleForLabel` is the authority here rather than a lexicon of my own, and that
 * is the whole reuse: it is already bilingual, already knows that "papier" and
 * "encre" and "signal" are roles, and has already been corrected against real
 * documents. A second vocabulary in this file would be a mirror nothing holds
 * level.
 *
 * The clause is cut at sentence punctuation so a role word cannot reach across a
 * full stop into the next thought.
 */
function roleBefore(text: string, at: number): ThemeColorRole | null {
  const clause = text.slice(Math.max(0, at - 80), at).split(CLAUSE_BREAK).pop() ?? ''
  const words = clause.match(WORD) ?? []
  if (!words.length) return null
  if (GROUND_PREPOSITIONS.has(words[words.length - 1].toLowerCase())) return 'background'
  return themeRole(roleForLabel(words.slice(-ROLE_WINDOW_WORDS).join(' ')))
}

/** The same question asked forwards, for the language that puts the noun last. */
function roleAfter(text: string, from: number): ThemeColorRole | null {
  const clause = text.slice(from, from + 80).split(CLAUSE_BREAK)[0] ?? ''
  const words = clause.match(WORD) ?? []
  if (!words.length) return null
  return themeRole(roleForLabel(words.slice(0, ROLE_WINDOW_AHEAD).join(' ')))
}

/**
 * `X sur Y` / `X on Y` — the one idiom that states two roles in three words.
 *
 * "Vert foncé sur noir" is how a person says "this ink, that ground", and
 * neither half carries a role word for `roleBefore` to find. It is deliberately
 * narrow: both sides must be colours with nothing between them and the
 * preposition, so "un logo rouge sur un fond noir" does NOT match here — "fond"
 * is not a colour — and falls through to the role windows, which read it
 * correctly and drop the logo's red for want of a role.
 *
 * It survives `GROUND_PREPOSITIONS` rather than being replaced by it, and the
 * two answer different halves. The preposition rule settles the colour AFTER the
 * word, which is all "white text on black" needs — its ink already has a noun.
 * This settles the colour BEFORE it, which nothing else can: "vert foncé sur
 * noir" names an ink with no noun anywhere near it.
 */
const ON_PATTERN = new RegExp(`(${COLOUR})[ \\t]+(?:sur|on)[ \\t]+(${COLOUR})`, 'giu')
const COLOUR_PATTERN = new RegExp(COLOUR, 'giu')

/**
 * The brief, as the `## Colors` section it never had.
 *
 * Exported because it is the grammar, and a test that reads it can say which of
 * the two passes fired without going through the schema. Returns `''` when the
 * brief declares nothing — which is the common case and is not a failure.
 *
 * First statement wins, per role. A brief that changes its mind halfway is not a
 * thing to arbitrate, and reading the first is the reading a person can predict.
 */
export function briefColorPalette(brief: string | null | undefined): string {
  const text = typeof brief === 'string' ? brief : ''
  if (!text.trim()) return ''

  const found = new Map<ThemeColorRole, string>()
  const claim = (role: ThemeColorRole | null, hex: string | null) => {
    if (!role || !hex || found.has(role)) return
    found.set(role, hex)
  }

  // The idiom first: it is the only pattern that can name two roles at once, and
  // running it second would let the role windows take its left-hand colour for
  // whatever noun happened to precede the phrase.
  const consumed: Array<[number, number]> = []
  ON_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ON_PATTERN.exec(text))) {
    consumed.push([m.index, m.index + m[0].length])
    // A role word before the left colour still wins: "un fond vert sur noir"
    // says the first one out loud, and the idiom's default is only a default.
    claim(roleBefore(text, m.index) ?? 'text', tokenToHex(m[1]))
    claim('background', tokenToHex(m[2]))
  }

  COLOUR_PATTERN.lastIndex = 0
  while ((m = COLOUR_PATTERN.exec(text))) {
    const at = m.index
    if (consumed.some(([from, to]) => at >= from && at < to)) continue
    claim(roleBefore(text, at) ?? roleAfter(text, at + m[0].length), tokenToHex(m[0]))
  }

  if (!found.size) return ''
  // The English role names, and not the words the brief used, because
  // `roleForLabel` has to resolve them back and a label that round-trips is the
  // one thing this synthetic document owes the parser.
  const label: Record<ThemeColorRole, string> = {
    background: 'Background', text: 'Text', accent: 'Accent', surface: 'Surface',
  }
  const lines = THEME_COLOR_ROLES.filter((role) => found.has(role)).map(
    (role) => `- ${label[role]}: ${found.get(role)}`,
  )
  return `## Colors\n\n${lines.join('\n')}\n`
}

/**
 * The theme a brief declares, or null.
 *
 * `themeFromDesign` and nothing else, on a document this module wrote: the hex
 * charset, the `stated` discipline and the schema check are all the existing
 * ones, so a colour that would be refused coming from a DESIGN.md is refused
 * coming from a brief, with no second implementation to keep level.
 *
 * Colours only, in practice: a brief has no `## Typography` section and states no
 * radius, so the other two derivations find nothing. That is a property of the
 * document rather than a filter, and a brief that really does write
 * `Radius: 14px` is a person stating a radius.
 */
export function themeFromBrief(brief: string | null | undefined): VideoTheme | null {
  return themeFromDesign(briefColorPalette(brief))
}

/** What the panel needs to say where the film's colours came from. */
export interface FilmTheme {
  /** The merged theme, ready for `/compose` and `/render`. Null when nothing was stated. */
  theme: VideoTheme | null
  /** The roles the brief declared, and therefore the ones it took from the dossier. */
  fromBrief: ThemeColorRole[]
  /** Whether the project's direction contributed anything at all. */
  fromProject: boolean
}

/**
 * The project's direction and the user's brief, merged token by token.
 *
 * Per token and not whole, because that is what "priority" means: a brief that
 * names a ground has said nothing about the typeface, and throwing the project's
 * away would make asking for one colour cost every other one. The consequence is
 * that a brief's ground can meet a dossier's ink, and the pair can be a bad one
 * — a dark ink from a cream direction on a black ground somebody just asked for.
 * That is safe rather than lucky: `resolveTheme` pairs what is left unstated and
 * `legibleOn` measures every run against the surface it is really painted on, so
 * the worst outcome is the requested colour being degraded and said so, never an
 * invisible line (rule 8, and Q1).
 *
 * Two arguments rather than the two documents, so the caller can memoise the
 * expensive half: parsing a DESIGN.md on every keystroke of a 600-character
 * brief is work nobody asked for.
 */
export function mergeFilmTheme(
  project: VideoTheme | null,
  brief: VideoTheme | null,
): FilmTheme {
  const briefColors = brief?.colors ?? {}
  const fromBrief = THEME_COLOR_ROLES.filter((role) => Boolean(briefColors[role]))

  const colors = { ...(project?.colors ?? {}), ...briefColors }
  const merged: Record<string, unknown> = { ...(project ?? {}) }
  if (Object.values(colors).some(Boolean)) merged.colors = colors
  else delete merged.colors

  // Parsed by the schema the server applies, for the reason `themeFromDesign`
  // gives about its own output: `attachTheme` drops a refused theme WHOLE, so
  // the cheapest place to be sure the merge is acceptable is the merge.
  const parsed = VideoThemeSchema.safeParse(merged)
  return {
    theme: parsed.success ? parsed.data : null,
    fromBrief: parsed.success ? fromBrief : [],
    fromProject: Boolean(project),
  }
}
