/**
 * Notes a person writes about one of their screens — for THEMSELVES.
 *
 * "Keep this hero, the pricing grid is too dense, try a darker footer next
 * time": the memory of a design session, written on the screen it is about.
 * The one property that matters is who reads it. A model never does: nothing
 * that builds a prompt imports this module or reads `Screen.userNotes`, and
 * `tests/screen-notes-private.test.js` fails the build the day something does.
 *
 * That is a decision, not an omission. A note is written in the voice of
 * someone talking to themselves — half-sentences, second thoughts, "Paul hates
 * this" — and a model handed that text treats every word as an instruction. The
 * product already has a channel for telling the model something (the composer,
 * the modify mode, the annotation snips); this is the one place that is not it.
 * If a note should shape the next generation, the person copies it into the
 * composer, and then it is a request they chose to make.
 *
 * Pure functions only, so the rules can be tested without a canvas.
 */

export interface ScreenNote {
  id: string
  text: string
  createdAt: number
  /** Absent until the note is edited once — "written" and "revised" differ. */
  updatedAt?: number
}

/**
 * Longest a single note may be.
 *
 * Notes ride inside the projects blob, which lives in a localStorage budget the
 * component sources already strain (see `reportStorageFailure`). A paragraph is
 * a note; a pasted specification is a document, and belongs in DESIGN.md.
 */
export const NOTE_MAX_LEN = 2000

/** How many notes one screen keeps, for the same budget. */
export const NOTES_MAX = 50

function noteId(): string {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** Trimmed and capped, or null when nothing is left to keep. */
export function cleanNoteText(text: string): string | null {
  const clean = text.replace(/\r\n?/g, '\n').trim().slice(0, NOTE_MAX_LEN).trim()
  return clean ? clean : null
}

/**
 * Validate stored notes, or drop them.
 *
 * `normalizeScreen` rebuilds every screen from a whitelist, so this is what
 * decides whether a note survives a reload. An empty list is returned as
 * `undefined`: "no notes" has one spelling, and a screen that never had any
 * does not grow an empty array on its first save.
 */
export function normalizeNotes(raw: unknown): ScreenNote[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ScreenNote[] = []
  const seen = new Set<string>()
  for (const n of raw) {
    if (!n || typeof n !== 'object') continue
    const r = n as Partial<ScreenNote>
    const text = typeof r.text === 'string' ? cleanNoteText(r.text) : null
    if (!text) continue
    // A duplicated id would make edit and delete act on two notes at once.
    const id = typeof r.id === 'string' && r.id && !seen.has(r.id) ? r.id : noteId()
    seen.add(id)
    const createdAt = typeof r.createdAt === 'number' && r.createdAt > 0 ? r.createdAt : Date.now()
    const note: ScreenNote = { id, text, createdAt }
    if (typeof r.updatedAt === 'number' && r.updatedAt > createdAt) note.updatedAt = r.updatedAt
    out.push(note)
  }
  return out.length ? out.slice(-NOTES_MAX) : undefined
}

/** Append a note. Blank text changes nothing. Oldest notes go first past the cap. */
export function addNote(notes: ScreenNote[] | undefined, text: string, now = Date.now()): ScreenNote[] | undefined {
  const clean = cleanNoteText(text)
  if (!clean) return notes
  return [...(notes ?? []), { id: noteId(), text: clean, createdAt: now }].slice(-NOTES_MAX)
}

/**
 * Rewrite a note. Emptying it deletes it — a blank note is not a note, and
 * keeping one would leave a dated card that says nothing.
 */
export function editNote(
  notes: ScreenNote[] | undefined,
  id: string,
  text: string,
  now = Date.now(),
): ScreenNote[] | undefined {
  const clean = cleanNoteText(text)
  if (!clean) return removeNote(notes, id)
  if (!notes) return notes
  return notes.map((n) => (n.id === id && n.text !== clean ? { ...n, text: clean, updatedAt: now } : n))
}

export function removeNote(notes: ScreenNote[] | undefined, id: string): ScreenNote[] | undefined {
  if (!notes) return notes
  const next = notes.filter((n) => n.id !== id)
  return next.length ? next : undefined
}
