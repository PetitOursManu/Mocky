import { parseDesignSystem, type DesignSystem, type DesignToken } from './designTokens'
import { extractProductName } from './design'

/**
 * A DESIGN.md, read as a specification rather than as a palette.
 *
 * Mocky writes far more into these documents than it ever showed. A real Muse
 * dossier carries eleven sections — concept, references, tokens, layout
 * grammar, motion language, voice, imagery, forbidden — and the canvas
 * displayed two of them: some swatches and a generic dashboard thumbnail. This
 * module reads the rest.
 *
 * ── Two documents, one reader ────────────────────────────────────────────────
 *
 * There are two shapes in circulation and they are not interchangeable:
 *
 *   'dossier'    written by Muse (`server/muse/inspire/dossier.js`), headed
 *                `# Design Dossier`. Has a concept, a forbidden list, layout
 *                and motion grammar.
 *   'design-md'  derived from a screen (`DESIGN_EXTRACT_PROMPT` in
 *                `lib/generate.ts`) or hand-written, headed `# Design System`.
 *                Has component patterns; has no concept and no forbidden list,
 *                because the extraction prompt does not ask for them.
 *
 * Every field is optional and every absence is honest. Nothing here invents a
 * value the document does not contain: a derived DESIGN.md gets no north-star
 * line and no DON'T column, because it genuinely has neither, and inventing one
 * would publish fiction under the user's own product name.
 *
 * ── Why parsing this is allowed ──────────────────────────────────────────────
 *
 * Invariant I1 forbids discovering names in GENERATED SOURCE with a regular
 * expression, and explicitly exempts Markdown prose — `extractDesignColors` and
 * `export/theme.ts` are the existing precedents. Everything below reads a
 * document. Nothing reads `screen.code`, and the temptation is real: neither
 * document records shadows, so the obvious shortcut for an elevation section is
 * to grep the component for `shadow-*`. That is exactly what I1 forbids, and it
 * is why there is no elevation section here.
 */

export type SpecKind = 'dossier' | 'design-md'

export interface SpecTypography {
  /** The display face, as DECLARED. Nothing in Mocky loads a webfont. */
  display?: string
  body?: string
  /** Free prose about the scale ("large editorial jumps"), when stated. */
  scale?: string
}

export interface DesignSpec {
  kind: SpecKind
  /** The wordmark, from `## Product`. */
  productName: string | null
  /** The document's own title line, e.g. "Design Dossier — Untitled project". */
  heading: string | null
  /** `## Concept` — dossier only. The north-star line. */
  concept: string | null
  typography: SpecTypography
  /** Resolved roles and radius, plus which of them the document actually said. */
  system: DesignSystem
  colors: DesignToken[]
  /**
   * Which roles the document STATED, as opposed to the ones parseDesignSystem
   * filled in. Showing an invented slate `#f8fafc` as "the surface token" of a
   * cream editorial design is not a near miss, it is a false claim.
   */
  stated: Record<string, boolean>
  /** Prescriptive bullets: layout grammar and motion, or component patterns. */
  dos: string[]
  /** `## Forbidden` — dossier only. */
  donts: string[]
  /** Where `dos` came from, so the UI can label it truthfully. */
  dosSource: 'layout-grammar' | 'component-patterns' | null
  /** `## References` — provenance, one line each. */
  references: string[]
}

/**
 * Every section the sheet lets you edit, and the heading that carries it.
 *
 * Editing works on the RAW BODY of a section rather than on parsed fields, and
 * that is the whole design. A structured editor would have to round-trip every
 * line back into the exact grammar `dossierToMarkdown` emits — bullet markers,
 * the two spaces before a parenthetical, the `- Display:` key — and any field
 * it failed to model would be silently dropped on save. Editing the text keeps
 * the document the source of truth and makes the loss impossible: what you see
 * is what the file says, and what you type is what it will say.
 */
export const EDITABLE_SECTIONS = {
  concept: /^#{2,4}[ \t]*Concept/i,
  typography: /^#{2,4}[ \t]*Typograph/i,
  grammar: /^#{2,4}[ \t]*Layout Grammar/i,
  motion: /^#{2,4}[ \t]*Motion Language/i,
  patterns: /^#{2,4}[ \t]*Component patterns?/i,
  forbidden: /^#{2,4}[ \t]*Forbidden/i,
  references: /^#{2,4}[ \t]*References/i,
} as const

export type EditableSection = keyof typeof EDITABLE_SECTIONS

/** The raw body of a section, exactly as written. Null when there is none. */
export function readSectionBody(markdown: string, section: EditableSection): string | null {
  return readSection(markdown, EDITABLE_SECTIONS[section])
}

/**
 * Replace one section's body, leaving every other byte of the document alone.
 *
 * Returns the markdown unchanged when the section does not exist — a document
 * without a `## Forbidden` is not a document with an empty one, and inventing
 * the heading would put a section into a file that never had it.
 */
export function replaceSectionBody(
  markdown: string,
  section: EditableSection,
  body: string,
): string {
  const heading = EDITABLE_SECTIONS[section]
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((l) => heading.test(l))
  if (start === -1) return markdown

  let end = start + 1
  while (end < lines.length && !/^#{1,4}[ \t]/.test(lines[end])) end++

  // One blank line before the next heading, and none doubled — the documents
  // are read by people and diffed by git, so the shape has to stay stable
  // across an edit that only changed a word.
  const next = [...lines.slice(0, start + 1), '', ...body.trim().split(/\r?\n/), '']
  if (end < lines.length) next.push(...lines.slice(end))
  return next.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** The text of one `##`/`###` section, up to the next heading of any level. */
function readSection(markdown: string, heading: RegExp): string | null {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((l) => heading.test(l))
  if (start === -1) return null
  const body: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,4}[ \t]/.test(lines[i])) break
    body.push(lines[i])
  }
  const text = body.join('\n').trim()
  return text || null
}

/** The `- ` bullets of a section, cleaned of markers and emphasis. */
function bullets(section: string | null): string[] {
  if (!section) return []
  return section
    .split(/\r?\n/)
    .filter((l) => /^[\s]*[-*+][ \t]/.test(l))
    .map((l) => l.replace(/^[\s]*[-*+][ \t]+/, '').replace(/[*_`]/g, '').trim())
    .filter(Boolean)
}

/** `- Display: Cormorant Garamond` → the value, or undefined. */
function keyedLine(section: string | null, key: RegExp): string | undefined {
  // The key is an alternation, and alternation binds looser than anchoring:
  // `^display|body` reads as `(^display)|(body)`, so only the first branch is
  // anchored and the capture group ends up in a branch that never ran. Hence
  // the non-capturing group — without it `m[1]` is undefined and this throws.
  const re = new RegExp(`^(?:${key.source})\\s*[:=]\\s*(.+)$`, 'i')
  for (const b of bullets(section)) {
    const m = re.exec(b)
    if (m && m[1].trim()) return m[1].trim()
  }
  return undefined
}

/**
 * Which roles the document stated outright.
 *
 * `parseDesignSystem` always returns seven filled roles — that is what makes it
 * always renderable, and it is also why it cannot be printed as a token list
 * without this. A palette of three colours still yields a surface, a muted and
 * a border, all three of them slate defaults invented for the occasion.
 */
function statedRoles(colors: DesignToken[]): Record<string, boolean> {
  const out: Record<string, boolean> = {
    bg: false, surface: false, text: false, muted: false, accent: false, accentText: false, border: false,
  }
  for (const c of colors) if (c.role in out) out[c.role] = true
  return out
}

/** Read a DESIGN.md or a Muse dossier into everything the sheet can show. */
export function parseDesignSpec(markdown: string): DesignSpec {
  const md = markdown || ''
  // The same test the canvas card and the modal already use to tell the two
  // documents apart, so all three agree on what they are looking at.
  const kind: SpecKind = /^#\s*Design Dossier/im.test(md) ? 'dossier' : 'design-md'

  const headingLine = /^#[ \t]+(.+)$/m.exec(md)
  const typo = readSection(md, /^#{2,4}[ \t]*Typograph/i)
  const layout = bullets(readSection(md, /^#{2,4}[ \t]*Layout Grammar/i))
  const motion = bullets(readSection(md, /^#{2,4}[ \t]*Motion Language/i))
  const patterns = bullets(readSection(md, /^#{2,4}[ \t]*Component patterns?/i))

  // Prescriptive statements, whichever document they came from. Layout and
  // motion are grammar — "do this" — and read correctly as DOs; component
  // patterns are the derived document's only prescriptive prose. They are kept
  // apart from `donts` and labelled by source, because calling a layout rule a
  // "component" would be a small lie told by the UI.
  const dos = kind === 'dossier' ? [...layout, ...motion] : patterns
  const dosSource = dos.length ? (kind === 'dossier' ? 'layout-grammar' : 'component-patterns') : null

  const system = parseDesignSystem(md)
  const colors = system.colors

  return {
    kind,
    productName: extractProductName(md),
    heading: headingLine ? headingLine[1].trim() : null,
    concept: readSection(md, /^#{2,4}[ \t]*Concept/i),
    typography: {
      display: keyedLine(typo, /display|heading|titre/),
      body: keyedLine(typo, /body|texte|corps/),
      scale: keyedLine(typo, /scale|échelle|echelle|rythme/),
    },
    system,
    colors,
    stated: statedRoles(colors),
    dos,
    // Dossier-only, and deliberately not synthesised for the other shape:
    // negating a list of DOs produces confident nonsense.
    donts: kind === 'dossier' ? bullets(readSection(md, /^#{2,4}[ \t]*Forbidden/i)) : [],
    dosSource,
    references: bullets(readSection(md, /^#{2,4}[ \t]*References/i)),
  }
}
