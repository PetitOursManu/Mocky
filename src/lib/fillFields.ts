/**
 * A screen with FIELDS TO FILL: a weekly menu, an event poster, a price list —
 * the same design every time, a few words and a picture that change.
 *
 * The person decides which runs of text and which pictures are fields, by
 * ticking them in a list of what the screen shows (decided with the user: the
 * person defines them, not a model). Filling one writes the new values into the
 * source at parser-vouched offsets (I1) — no model call, so nothing else on the
 * page moves, which is exactly what "the same design with this week's dishes"
 * promises and what a model rewriting the page cannot guarantee. The same
 * mechanism as a campaign's facts (`campaignFacts.ts`), one level more precise:
 * a fact is matched by its VALUE everywhere it appears, a field is ONE place.
 *
 * A field is found again by what it says, not by an offset: an edit elsewhere
 * shifts every offset in the file, and a field stored as one would point into
 * the middle of another word after the first polish. So a field is its kind,
 * its current value, and which occurrence of that value it is (`nth`) — two
 * days of a menu may both say "Salade de saison", and they are two fields.
 * After a fill each field carries its NEW value, so next week fills from this
 * week. A field whose value an edit changed is reported missing, never guessed.
 *
 * The words are read with the translation's filter (`textRuns`, `translation`):
 * a field is something a reader sees, never a class name, an address or a value
 * the code compares against.
 */

import { findScreenImages, type ImageSpan } from './screenImages'
import { escapeFor, loadTransform, textRuns, type TextRun, type Transform } from './sourceText'

export type FillKind = 'text' | 'image'

/** A field, as stored on the screen (`Screen.fill`). */
export interface FillField {
  id: string
  /** The person's name for it: "Plat du lundi", "Prix", "Photo". */
  label: string
  kind: FillKind
  /** What the source says there: a run's text as written (whitespace folded), or a picture's library hash. */
  value: string
  /** Which occurrence of that value, in source order. */
  nth: number
}

/** A place on the screen that can become a field. */
export interface FillCandidate {
  kind: FillKind
  /** Identity: see `FillField.value`. */
  value: string
  nth: number
  /** What a person reads: the run with its escapes undone, or the picture's alt. */
  text: string
  /** Offsets of what a fill replaces. */
  start: number
  end: number
  run?: TextRun
  span?: ImageSpan
}

const HASH_RE = /^[a-f0-9]{64}$/

const fold = (s: string) => s.replace(/\s+/g, ' ').trim()

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** What a run SAYS, from what it is written as. */
function readable(run: TextRun, raw: string): string {
  if (run.kind === 'jsx' || run.kind === 'attr') return fold(decodeEntities(raw))
  return fold(raw.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|.)/gi, (_m, c: string) => (c[0] === 'u' && c.length > 1 ? String.fromCodePoint(parseInt(c.replace(/[u{}]/gi, ''), 16)) : c === 'n' ? '\n' : c)))
}

/**
 * Every place of this source that can be a field, in source order. Null when
 * the code does not parse — a field list is never read off a regex (I1).
 */
export async function fillCandidates(code: string, transform?: Transform | null): Promise<FillCandidate[] | null> {
  const tf = transform ?? (await loadTransform().catch(() => null))
  if (!tf) return null
  const runs = await textRuns(code, tf, { translation: true })
  if (!runs) return null
  const out: FillCandidate[] = []
  for (const run of runs) {
    const raw = code.slice(run.start, run.end)
    // A JSX text run carries the indentation around it; what is replaced is the
    // words, so the line breaks of the layout stay where they were.
    const lead = raw.length - raw.trimStart().length
    const trail = raw.length - raw.trimEnd().length
    const start = run.start + lead
    const end = run.end - trail
    if (end <= start) continue
    const value = fold(code.slice(start, end))
    out.push({ kind: 'text', value, nth: 0, text: readable(run, code.slice(start, end)), start, end, run })
  }
  for (const img of await findScreenImages(code)) {
    for (const span of img.spans) {
      out.push({ kind: 'image', value: img.hash, nth: 0, text: span.alt || img.alt || span.context || '', start: span.start, end: span.end, span })
    }
  }
  out.sort((a, b) => a.start - b.start)
  const seen = new Map<string, number>()
  for (const c of out) {
    const key = `${c.kind}:${c.value}`
    c.nth = seen.get(key) ?? 0
    seen.set(key, c.nth + 1)
  }
  return out
}

/** The place a field names in this list, or undefined when the source no longer says it. */
export function locate(candidates: FillCandidate[], field: Pick<FillField, 'kind' | 'value' | 'nth'>): FillCandidate | undefined {
  return candidates.find((c) => c.kind === field.kind && c.value === field.value && c.nth === field.nth)
}

/** The fields a source still holds, and the ones it lost (an edit rewrote their words). */
export async function fieldStatus(code: string, fields: FillField[]): Promise<{ found: Map<string, FillCandidate>; missing: string[] } | null> {
  const cands = await fillCandidates(code)
  if (!cands) return null
  const found = new Map<string, FillCandidate>()
  const missing: string[] = []
  for (const f of fields) {
    const c = locate(cands, f)
    if (c) found.set(f.id, c)
    else missing.push(f.id)
  }
  return { found, missing }
}

export type FillRefusal = 'missing' | 'empty' | 'unsafe' | 'notImage'

export interface FillOutcome {
  code: string
  /** The fields as they are in the new code: their new values, their new `nth`. */
  fields: FillField[]
  written: string[]
  refused: { id: string; reason: FillRefusal }[]
}

/**
 * Write `values` (field id → what the person typed, or a library hash for a
 * picture) into the source. A value equal to what the field shows is not a
 * change. Throws `unparsable` when the code cannot be read or a write would
 * break it; a field that cannot be written is refused by name, the rest are
 * written (degrade, never fail).
 *
 * `origin` is Mocky's own, for a picture whose address was absolute — the same
 * rule as `replaceScreenImage`, and never the iframe's (I2).
 */
export async function applyFill(code: string, fields: FillField[], values: Record<string, string>, origin: string): Promise<FillOutcome> {
  const tf = await loadTransform().catch(() => null)
  const cands = await fillCandidates(code, tf)
  if (!cands) throw new Error('unparsable')
  const edits: { id: string; start: number; end: number; text: string; value: string }[] = []
  const refused: FillOutcome['refused'] = []
  const taken = new Set<number>()
  for (const f of fields) {
    const next = values[f.id]
    if (next === undefined) continue
    const c = locate(cands, f)
    if (!c) {
      refused.push({ id: f.id, reason: 'missing' })
      continue
    }
    if (taken.has(c.start)) continue
    if (f.kind === 'image') {
      if (next === f.value) continue
      if (!HASH_RE.test(next)) {
        refused.push({ id: f.id, reason: 'notImage' })
        continue
      }
      const base = origin.replace(/\/+$/, '')
      edits.push({ id: f.id, start: c.start, end: c.end, text: `${c.span?.absolute ? base : ''}/api/images/${next}`, value: next })
      taken.add(c.start)
      continue
    }
    const want = next.replace(/[ \t]+/g, ' ').trim()
    if (want === c.text) continue
    // Emptying a field removes words, and what is left around them is a layout
    // nobody looked at: a dash or a space is a value, nothing is not.
    if (!want) {
      refused.push({ id: f.id, reason: 'empty' })
      continue
    }
    const escaped = c.run ? escapeFor(c.run, want) : null
    if (escaped === null) {
      refused.push({ id: f.id, reason: 'unsafe' })
      continue
    }
    edits.push({ id: f.id, start: c.start, end: c.end, text: escaped, value: fold(escaped) })
    taken.add(c.start)
  }

  let out = code
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  const after = edits.length ? await fillCandidates(out, tf) : cands
  if (!after) throw new Error('unparsable')

  // Each field's place in the NEW source: its old start, shifted by every edit
  // before it. Its `nth` is read back off the new list rather than kept, since a
  // new value may equal another run's and change which occurrence it is.
  const shiftAt = (pos: number) => edits.filter((e) => e.start < pos).reduce((n, e) => n + e.text.length - (e.end - e.start), 0)
  const nextFields = fields.map((f) => {
    const c = locate(cands, f)
    if (!c) return f
    const edit = edits.find((e) => e.start === c.start)
    const at = c.start + shiftAt(c.start)
    const here = after.find((a) => a.kind === f.kind && a.start === at)
    if (!here) return edit ? { ...f, value: edit.value } : f
    return { ...f, value: here.value, nth: here.nth }
  })
  return { code: out, fields: nextFields, written: edits.map((e) => e.id), refused }
}

/** A field's default name: its first words. */
export function defaultLabel(c: Pick<FillCandidate, 'kind' | 'text'>, pictureWord: string): string {
  if (c.kind === 'image') return c.text ? `${pictureWord} · ${c.text.slice(0, 32)}` : pictureWord
  const words = c.text.split(/\s+/).slice(0, 5).join(' ')
  return words.length > 40 ? `${words.slice(0, 39)}…` : words
}

/** Validate a stored field list, or drop it. */
export function normalizeFill(raw: unknown): FillField[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: FillField[] = []
  const ids = new Set<string>()
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue
    const { id, label, kind, value, nth } = f as Partial<FillField>
    if (typeof id !== 'string' || !id || ids.has(id)) continue
    if (kind !== 'text' && kind !== 'image') continue
    if (typeof value !== 'string' || !value) continue
    if (kind === 'image' && !HASH_RE.test(value)) continue
    ids.add(id)
    out.push({
      id,
      label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : value.slice(0, 40),
      kind,
      value,
      nth: typeof nth === 'number' && Number.isInteger(nth) && nth >= 0 ? nth : 0,
    })
  }
  return out.length ? out : undefined
}
