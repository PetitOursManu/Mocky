export interface DesignConfig {
  /** Raw DESIGN.md markdown. */
  markdown: string
  /** Whether to prepend it to generation prompts. */
  enabled: boolean
  /**
   * What the document held before it was last REPLACED wholesale — today, only
   * by "derive from this screen". Hand edits do not touch it: they are
   * incremental and the field would be overwritten on every keystroke, which is
   * the opposite of an undo.
   */
  previousMarkdown?: string
  /**
   * Design systems the user has kept, by name.
   *
   * Stored INSIDE the design config rather than under a key of its own, and
   * that is deliberate: `PUT /api/data` treats `design` as an opaque blob, so
   * anything nested here syncs to the server and across devices for free.
   * A sibling key would have needed sync.ts, the server payload and the
   * reconcile path all taught about it.
   */
  library?: DesignEntry[]
}

/** One saved design system. `markdown` is the whole document, verbatim. */
export interface DesignEntry {
  id: string
  name: string
  markdown: string
  createdAt: number
  updatedAt: number
  /**
   * Where it came from, so the list can say — a system lifted off a screen and
   * one written by hand are not the same kind of thing to their author.
   */
  origin?: 'manual' | 'screen' | 'muse'
}

import { scheduleSync, reportStorageFailure } from './sync'

const STORAGE_KEY = 'mocky.design.v1'

export function defaultDesign(): DesignConfig {
  return { markdown: '', enabled: true }
}

export function loadDesign(): DesignConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultDesign()
    const parsed = JSON.parse(raw) as Partial<DesignConfig>
    return { ...defaultDesign(), ...parsed }
  } catch {
    return defaultDesign()
  }
}

export function saveDesign(d: DesignConfig): void {
  // A full quota must not take the app down. This runs from a useEffect in
  // DesignPanel that fires on mount, so an unguarded throw reached the root
  // ErrorBoundary: on an instance with no room left, merely opening the Design
  // tab replaced the entire interface with the crash screen. Everywhere else in
  // the codebase a quota error is an ordinary, reported condition.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch (err) {
    reportStorageFailure(err)
    return
  }
  scheduleSync()
}

/** True when a design system is configured and switched on. */
export function isDesignActive(d: DesignConfig): boolean {
  return d.enabled && d.markdown.trim().length > 0
}

// ---- the named library ----
//
// Before this, DESIGN.md was a single mutable document: adopting a second look
// meant destroying the first. That made every interesting move — comparing two
// directions, keeping a house style beside an experiment, reusing what a screen
// produced — into a copy-paste-into-a-text-file chore outside the tool.

/** How many systems one account may keep. Generous; a bound all the same. */
export const MAX_LIBRARY_ENTRIES = 50
const MAX_NAME_LENGTH = 60

function newEntryId(): string {
  // crypto.randomUUID is not available on http:// origins in every browser, and
  // Mocky is routinely reached over plain HTTP on a LAN.
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Saved systems, newest first. Always an array, even on a legacy config. */
export function listDesigns(d: DesignConfig = loadDesign()): DesignEntry[] {
  return Array.isArray(d.library) ? [...d.library].sort((a, b) => b.updatedAt - a.updatedAt) : []
}

/**
 * A name nobody else in the library is using.
 *
 * Duplicates are not refused — being told "that name is taken" while trying to
 * save something is a interruption, not a service. A suffix is added instead,
 * the way a file manager does it.
 */
export function uniqueDesignName(raw: string, existing: DesignEntry[]): string {
  const base = (raw || '').trim().slice(0, MAX_NAME_LENGTH) || 'Design'
  const taken = new Set(existing.map((e) => e.name.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${base} (${Date.now()})`
}

/** Keep a design system under a name. Returns the stored entry. */
export function saveDesignToLibrary(
  name: string,
  markdown: string,
  origin: DesignEntry['origin'] = 'manual',
): DesignEntry {
  const d = loadDesign()
  const library = listDesigns(d)
  if (library.length >= MAX_LIBRARY_ENTRIES) {
    throw new Error(`You already have ${MAX_LIBRARY_ENTRIES} saved design systems. Delete one first.`)
  }
  const now = Date.now()
  const entry: DesignEntry = {
    id: newEntryId(),
    name: uniqueDesignName(name, library),
    markdown,
    createdAt: now,
    updatedAt: now,
    origin,
  }
  saveDesign({ ...d, library: [...library, entry] })
  return entry
}

export function renameDesignEntry(id: string, name: string): void {
  const d = loadDesign()
  const library = listDesigns(d)
  const others = library.filter((e) => e.id !== id)
  saveDesign({
    ...d,
    library: library.map((e) =>
      e.id === id ? { ...e, name: uniqueDesignName(name, others), updatedAt: Date.now() } : e,
    ),
  })
}

export function deleteDesignEntry(id: string): void {
  const d = loadDesign()
  saveDesign({ ...d, library: listDesigns(d).filter((e) => e.id !== id) })
}

/**
 * Make a saved system the current one.
 *
 * The document being replaced goes into `previousMarkdown`, so switching is
 * always one click from being undone — the same safety the derive-from-screen
 * path already has.
 */
export function applyDesignEntry(id: string): DesignEntry | null {
  const d = loadDesign()
  const entry = listDesigns(d).find((e) => e.id === id)
  if (!entry) return null
  saveDesign({ ...d, markdown: entry.markdown, enabled: true, previousMarkdown: d.markdown || undefined })
  return entry
}

/** Is this exact document already saved? Used to avoid offering a duplicate. */
export function findDesignByMarkdown(markdown: string, d: DesignConfig = loadDesign()): DesignEntry | null {
  const needle = markdown.trim()
  return listDesigns(d).find((e) => e.markdown.trim() === needle) ?? null
}

/**
 * Turn the current document off without destroying it.
 *
 * Distinct from clearing: the markdown stays, so switching back on restores
 * what was there. "Stop applying this" and "throw this away" are different
 * intentions and used to share one button at the bottom of the page.
 */
export function setDesignEnabled(enabled: boolean): void {
  saveDesign({ ...loadDesign(), enabled })
}

/**
 * Wraps the DESIGN.md content with an explicit instruction so the model
 * treats it as the authoritative brand/design system to follow. Returned
 * string is passed as the `extraSystem` portion of the generation prompt.
 */
export function buildDesignPreamble(markdown: string): string {
  return [
    'The following is the project DESIGN SYSTEM (DESIGN.md). Treat it as authoritative.',
    'Every screen you generate MUST follow its color tokens, typography, spacing scale, and',
    'component patterns exactly, so all generated screens stay visually consistent and on-brand.',
    'Map its tokens to the closest Tailwind utility classes (use arbitrary values like',
    'bg-[#1d4ed8] when a token has no default Tailwind equivalent).',
    '',
    '<DESIGN_SYSTEM>',
    markdown.trim(),
    '</DESIGN_SYSTEM>',
  ].join('\n')
}

/**
 * Extract the hex colors declared in a DESIGN.md, in order of first appearance,
 * deduped. Each captures the nearest preceding "Label:" token when present (e.g.
 * "- Primary: #4f46e5" → { hex: '#4f46e5', label: 'Primary' }). Used to offer
 * the project's own palette as one-tap recolor swatches in the Modify panel.
 */
export function extractDesignColors(markdown: string): { hex: string; label: string }[] {
  const out: { hex: string; label: string }[] = []
  const seen = new Set<string>()
  const re = /(?:([A-Za-z][A-Za-z0-9 /_-]*?)\s*[:=]\s*)?(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown))) {
    const hex = m[2].toLowerCase()
    if (seen.has(hex)) continue
    seen.add(hex)
    out.push({ hex, label: (m[1] || '').trim() || hex })
  }
  return out
}

/**
 * The product's own name, read out of a DESIGN.md's `## Product` section.
 *
 * Why the name is read from PROSE and not from the screen it appears in: the
 * name lives in generated JSX, and invariant I1 forbids discovering names in
 * generated source with a regular expression — a wordmark is a string among
 * strings, and "Softly" in a header is indistinguishable from "Softly" in a
 * sentence to a pattern. Parsing Markdown is the invariant's one explicit
 * exemption, and `extractDesignColors` above is the in-repo precedent: the
 * model reads the screen once, writes what it found into the document, and
 * everything afterwards reads the document.
 *
 * Returns null rather than a guess. A DESIGN.md written before this section
 * existed simply has no `## Product`, and callers fall back to naming the
 * document instead of inventing a product.
 */
export function extractProductName(markdown: string | undefined): string | null {
  if (!markdown) return null

  // A line walk rather than one regular expression. The regex this replaced
  // ended its section with `\Z`, which JavaScript does not support and reads as
  // a literal "Z" — so the name was found only when another `##` happened to
  // follow it, and a document ending on `## Product` returned nothing.
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##[ \t]*Product[ \t]*$/i.test(l))
  if (start === -1) return null

  let line: string | null = null
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##[ \t]/.test(lines[i])) break // next section: the field was empty
    const cleaned = lines[i].replace(/^[\s>*+-]+/, '').replace(/[*_`]/g, '').trim()
    if (cleaned) {
      line = cleaned
      break
    }
  }
  if (!line) return null
  // The prompt asks for a bare name, but models like to explain themselves.
  // Take what precedes the first sentence break, and refuse anything long
  // enough to be a description rather than a wordmark.
  const name = line.split(/\s+[—–-]\s+|\.\s|:\s/)[0].trim()
  if (!name || name.length > 40) return null
  // The prompt's own escape hatch for a screen that shows no product name.
  if (/^not established/i.test(name)) return null
  return name
}

/** A minimal example so users without a DESIGN.md can see the expected shape. */
export const STARTER_TEMPLATE = `# Design System

## Color tokens
- Primary: #4f46e5 (indigo-600)
- Primary hover: #4338ca
- Background: #0f172a (slate-900)
- Surface: #1e293b (slate-800)
- Text: #e2e8f0 (slate-200)
- Muted text: #94a3b8 (slate-400)
- Border: #334155 (slate-700)
- Success: #10b981  Danger: #f43f5e

## Typography
- Font: system-ui / Inter, sans-serif
- Headings: bold, tight tracking
- Body: 14–16px, relaxed line height
- Scale: text-xs labels, text-sm body, text-lg section titles, text-2xl page titles

## Spacing & radius
- Base spacing unit: 4px (Tailwind default scale)
- Card padding: p-6 ; gaps: gap-4
- Radius: rounded-xl for cards, rounded-lg for inputs/buttons

## Component patterns
- Buttons: solid primary (bg-primary text-white), ghost (border, transparent bg). Medium weight, rounded-lg, px-4 py-2.
- Cards: surface bg, 1px border, rounded-xl, subtle shadow.
- Inputs: surface bg, border, focus ring in primary color.
- Layout: generous whitespace, max content width, clear visual hierarchy.
`
