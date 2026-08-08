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

/**
 * Infer a color's semantic role from its DESIGN.md label. Order matters.
 *
 * Bilingual, because the documents are. The dossier prompt instructs the model
 * to write everything in the language of the request, so a French request
 * yields a French palette — "Papier", "Encre", "Ligne", "Rose signal" — and an
 * English-only matcher resolved essentially none of it. The consequence was not
 * cosmetic: every unmatched colour falls through to 'other', `roles` then
 * invents slate defaults for background, text and accent, and a cream editorial
 * direction renders as a grey dashboard that resembles nothing the user made.
 *
 * The French terms are the ones Muse actually produces, not a dictionary: paper
 * and ink for the page and its text, "filet" for a rule — Mocky's own design
 * language calls it that — and "signal" for the one committed accent.
 */
export function roleForLabel(label: string): TokenRole {
  const l = label.toLowerCase()
  if (/accent[-\s]?text|on[-\s]?(primary|accent|brand)|(primary|button)\s*text|sur[-\s]?accent/.test(l)) return 'accentText'
  if (/muted|secondary|subtle|placeholder|caption|atténué|attenue|secondaire|discret|estompé|estompe/.test(l)) return 'muted'
  if (/\btext\b|foreground|\bink\b|\bbody\b|heading|typography|\btexte\b|\bencre\b|titre|corps/.test(l)) return 'text'
  if (/border|divider|outline|stroke|ring|\bfilet\b|bordure|séparateur|separateur|\bligne\b|trait/.test(l)) return 'border'
  if (/surface|\bcard\b|panel|elevated|sheet|\bcarte\b|panneau|feuille/.test(l)) return 'surface'
  if (/background|\bbg\b|\bbase\b|canvas|\bpage\b|\bfond\b|papier|arrière[-\s]?plan|arriere[-\s]?plan/.test(l)) return 'bg'
  if (/primary|accent|brand|action|\bcta\b|highlight|link|signal|primaire|marque|principal/.test(l)) return 'accent'
  return 'other'
}

/**
 * `- Crème: #f7f3e8` → label "Crème", not "me".
 *
 * The label class used to be `[A-Za-z]`, which stops dead at the first accent:
 * a French palette came back with "re" for Crème and "cision" for Précision —
 * the regex simply started matching after the é. Muse writes its dossier in the
 * language of the request, by instruction, so on a French install that was most
 * labels in most documents. `\p{L}` under the `u` flag covers every alphabet,
 * which is the right scope: nothing about this is French-specific.
 *
 * `[*_`\s]*` before the separator is the same failure one layer out. A derived
 * DESIGN.md is free-form Markdown written by a model, and models emphasise:
 * `- **Papier**: #f6f4ee`. The leading `**` costs nothing — the scan just starts
 * at the P — but the trailing one sits between the label and the colon, so the
 * whole optional group failed and the token came back UNLABELLED. That is not a
 * cosmetic loss: an unlabelled colour resolves to role 'other', and
 * `inferBackground` then excludes it by its `label !== hex` test. One pair of
 * asterisks made every colour in a document invisible to role resolution at
 * once, which is how a green page previewed as slate-900.
 *
 * And a colon is not the only thing a model puts between a label and its value.
 * Fixing the asterisks and stopping there left two shapes producing the SAME
 * total loss, both of them ordinary output for a prompt that asks for plain
 * Markdown: the em-dash list `- **Papier** — \`#F6F4EE\``, and the table row
 * `| Papier | #F6F4EE |`. Neither has a colon anywhere, so every colour in those
 * documents came back unlabelled and the whole slate cascade ran — which is the
 * reported symptom exactly, not a variant of it. Hence `[:=|—–]`, and the marks
 * are allowed on BOTH sides of it because the value gets emphasised as often as
 * the label does.
 *
 * The ASCII hyphen is deliberately NOT a separator. These documents are bullet
 * lists: `- ` opens every line, and accepting it would let one item's label bind
 * to the next item's colour.
 */
const COLOR_LINE_RE =
  /(?:(\p{L}[\p{L}\p{N} /_'’-]*?)[*_`\s]*[:=|—–]\s*[`*_]*)?(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/gu

/**
 * A role stated outright, right after the hex.
 *
 * Muse writes `- Paper: #f7f3e8  (background)` — the dossier schema has a `role`
 * field beside `label`, and `colorLines()` renders it in parentheses. Reading
 * only the label threw that away and left the parser guessing at poetry:
 * "Paper", "Bone", "Signal" match none of the label patterns, so a perfectly
 * well-described palette resolved to no background at all.
 */
const ROLE_SUFFIX_RE = /^\s*\((\p{L}[^)\n]*)\)/u

/**
 * The headings under which a document lists its palette.
 *
 * Dossiers write `### Colors`, a derived DESIGN.md writes `## Color tokens`,
 * and the shipped presets use either. Matched loosely on purpose — a document
 * is prose, and the exact wording is the model's choice.
 */
const COLOR_SECTION_RE = /^#{2,4}[ \t]*(colors?|colou?r tokens?|palette)[ \t]*$/gim

/** The [start, end) spans of every colour section in the document. */
function colorSectionSpans(markdown: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  let m: RegExpExecArray | null
  COLOR_SECTION_RE.lastIndex = 0
  while ((m = COLOR_SECTION_RE.exec(markdown))) {
    const from = m.index + m[0].length
    // Runs to the next heading of any level, or to the end of the document.
    const next = /^#{1,4}[ \t]/m.exec(markdown.slice(from))
    spans.push([from, next ? from + next.index : markdown.length])
  }
  return spans
}

/**
 * Extract every hex color with its label, role and source offset (deduped by hex).
 *
 * Read in TWO passes — the colour sections first, then the rest of the document
 * — and that ordering is a correctness fix, not a tidiness one. The scan is
 * document-wide and first-appearance wins, so a hex merely *mentioned* in prose
 * ("a signal red #c0392b against paper") used to claim the entry before the
 * `### Colors` bullet that actually declares it. It stole the label, and worse
 * it stole the `index`: recolouring is a slice-and-splice at that offset
 * (`replaceTokenHex`), so editing a token could rewrite a sentence in the
 * concept instead of the token in the palette.
 *
 * The second pass still runs: a document whose palette lives entirely in prose
 * is unusual but not wrong, and dropping those colours would leave the sheet
 * emptier than the document.
 */
export function parseColors(markdown: string): DesignToken[] {
  const out: DesignToken[] = []
  const seen = new Set<string>()

  const collect = (from: number, to: number) => {
    const slice = markdown.slice(from, to)
    let m: RegExpExecArray | null
    COLOR_LINE_RE.lastIndex = 0
    while ((m = COLOR_LINE_RE.exec(slice))) {
      const hex = m[2]
      const key = hex.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const label = (m[1] || '').trim()
      // The hex sits at the end of the whole match (before the zero-width \b),
      // and the offset is against the WHOLE document — replaceTokenHex splices
      // there, so a slice-relative index would corrupt the file.
      const index = from + m.index + m[0].length - hex.length
      // Label first, parenthetical second — and that order is the opposite of
      // what it was, changed against real documents.
      //
      // The parenthetical is NOT a role token. Muse's `colorLines()` renders the
      // dossier's `role` field, and models fill that field with a sentence about
      // usage: "(Fond discret de la formule mise en avant)". Read as a role, the
      // word "discret" in that sentence turned the accent pink into a muted
      // token, overriding a label — "Rose signal" — that said exactly what it
      // was. The label is the token's identity, chosen deliberately; the
      // parenthetical is prose about where it gets used.
      //
      // It still serves as the fallback, because it is genuinely what saves a
      // poetic palette: "Obsidian" and "Chalk" resolve to nothing, and only
      // "(background)" / "(text)" say which is which.
      //
      // `roleForLabel` returns the STRING 'other', which is truthy, so both
      // sides must be compared against it rather than tested for truthiness.
      const byLabel = roleForLabel(label)
      let role = byLabel
      if (byLabel === 'other') {
        const stated = ROLE_SUFFIX_RE.exec(markdown.slice(index + hex.length))
        if (stated) role = roleForLabel(stated[1])
      }
      out.push({ hex, label: label || hex, index, role })
    }
  }

  const spans = colorSectionSpans(markdown)
  for (const [from, to] of spans) collect(from, to)
  collect(0, markdown.length)
  // Source order, so the palette reads as the document writes it.
  return out.sort((a, b) => a.index - b.index)
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
 *
 * And when the palette has no unassigned colour left to choose from, it still
 * has evidence — see the second half of the body.
 */
function inferBackground(colors: DesignToken[], text?: string): string | undefined {
  // Two exclusions, both about evidence. Colours that already have a job keep
  // it: a palette naming its surface, its border and its accent is telling us
  // those are not the page. And a bare hex with no label at all says nothing —
  // `label === hex` is how parseColors records "unlabelled".
  const pool = colors.filter((c) => (c.role === 'other' || c.role === 'bg') && c.label !== c.hex)
  if (pool.length) {
    if (text) {
      const lt = luminance(text)
      return pool.reduce((best, c) =>
        Math.abs(luminance(c.hex) - lt) > Math.abs(luminance(best.hex) - lt) ? c : best,
      ).hex
    }
    return pool.reduce((best, c) => (luminance(c.hex) > luminance(best.hex) ? c : best)).hex
  }

  // No candidate left is NOT the same as no evidence, and reading it that way is
  // what put a slate-900 dashboard beside a green editorial page. A five-colour
  // palette that names an ink, a muted, a border, a surface and an accent has
  // assigned every one of its colours — the pool is empty by construction — while
  // having said, twice over, that the page is light. Falling to the caller's
  // `#0f172a` there does not merely miss: it flips `darkBg`, so the whole cascade
  // behind it inverts too, and the mockup came out dark ink on navy.
  //
  // What those leftovers settle is the POLARITY, and only that. The first attempt
  // returned the surface itself, on the grounds that it is a colour the document
  // really contains — and it hands the same hex to two roles, because a card sits
  // ON the page rather than being it. `parseDesignSystem` then resolves
  // `surface` to that same value, so every panel in the mockup (the sidebar, the
  // three stat cards, the chart) dissolved into the sheet behind it and the
  // design card became a blank rectangle with a few hairlines. Trading a wrong
  // page colour for an invisible one is not a fix.
  //
  // So: read the pole, do not borrow the neighbour. The ink first, because "the
  // page is the furthest thing from the text" is this function's whole thesis;
  // the surface second, since a pale card is never sitting on a black page. Only
  // the two extremes are invented, and either is strictly better than slate-900,
  // which is unreadable behind dark ink rather than merely approximate.
  if (text) return isDarkColor(text) ? '#ffffff' : '#0b0b0f'
  const surface = colors.find((c) => c.role === 'surface')?.hex
  if (surface) return isDarkColor(surface) ? '#0b0b0f' : '#ffffff'
  // Genuinely nothing said: the caller's default stands. A lone hex in a design
  // document is a brand colour, and a page is rarely saturated cyan.
  return undefined
}

/**
 * The accent, when no label and no parenthetical claims that role.
 *
 * The fallback here used to be `colors[0]`, and it was wrong in the one way that
 * cannot be seen in a swatch strip: a palette lists its page first, so the CTA
 * button, the chart bars and the active nav item were all painted the colour of
 * the sheet they sit on. `- **Papier**: #F6F4EE` at the top of a document is
 * enough — every accent in the mockup vanished, while the swatches underneath it
 * looked perfectly correct because they never resolve a role at all.
 *
 * Elimination first: a document that names its page, its ink, its rule and its
 * card has said what everything else is NOT, so what is left over is the brand
 * colour by construction. Among those, the most chromatic one — that is what
 * distinguishes an accent from the greys a palette carries for text and edges,
 * and "furthest from the background" alone just picks the darkest neutral.
 *
 * Never the background: whatever else an accent is, it is not invisible.
 */
function inferAccent(colors: DesignToken[], bg: string): string | undefined {
  const spare = colors.filter((c) => c.role === 'other')
  const pool = (spare.length ? spare : colors).filter(
    (c) => c.hex.toLowerCase() !== bg.toLowerCase(),
  )
  if (!pool.length) return undefined
  return pool.reduce((best, c) => (chroma(c.hex) > chroma(best.hex) ? c : best)).hex
}

/** How far a colour is from grey, 0…1. Saturation is what makes an accent one. */
function chroma(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  if (!Number.isFinite(n)) return 0
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (Math.max(...rgb) - Math.min(...rgb)) / 255
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

  // Ordered to break the circle: the stated ink decides the page when the page
  // is unstated, and the page decides the ink when the ink is.
  const statedText = first('text')
  const bg = first('bg') || inferBackground(colors, statedText) || '#0f172a'
  const darkBg = isDarkColor(bg)
  const text = statedText || (darkBg ? '#e2e8f0' : '#0f172a')
  const surface = first('surface') || (darkBg ? '#1e293b' : '#f8fafc')
  const muted = first('muted') || (darkBg ? '#94a3b8' : '#64748b')
  const border = first('border') || (darkBg ? '#334155' : '#e2e8f0')
  // After the page, not before it: an accent is chosen against the page it has
  // to stand out from, and the old first-colour fallback picked the page itself.
  const accent = first('accent') || inferAccent(colors, bg) || '#6366f1'
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
