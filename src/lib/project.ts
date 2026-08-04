import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scheduleSync, reportStorageFailure } from './sync'
import { visibleProjects, mergeProjects, TOMBSTONE_TTL_MS } from './merge'

/** A link from an element (or region) of a screen to another screen. */
export interface Hotspot {
  id: string
  /** Rectangle normalized 0..1 relative to the screen's body — for display. */
  x: number
  y: number
  w: number
  h: number
  /** Target screen id to navigate to. */
  target: string
  /** CSS selector (inside the preview) of the bound element, if element-based. */
  selector?: string
  /** Human label of the bound element, for the link overlay. */
  label?: string
}

export interface Screen {
  id: string
  name: string
  prompt: string
  code: string
  componentName: string
  createdAt: number
  /** Previous code before the last edit — used for "revert" if the new version has errors. */
  previousCode?: string
  /** Selected capability IDs (e.g. ['motion', 'charts']) persisted for reload/edit. */
  caps?: string[]
  /**
   * The DESIGN.md this screen was actually generated from.
   *
   * A copy, taken at generation time, not a reference. The document is global
   * and mutable: read it back later and you get whatever it says *now*, which
   * is a different thing as soon as anyone edits it — so "the design used for
   * this screen" could not be answered at all, and the canvas could only ever
   * show the current one while implying it was this one's.
   *
   * Absent on screens generated before this existed, and on screens generated
   * with no design system active. Both cases mean "nothing to show" rather than
   * "empty design", and the UI distinguishes them.
   */
  design?: string
  /** Image Library hash of the Muse image backing this screen (shown on the canvas). */
  imageHash?: string
  /**
   * What that image was FOR — the canvas badge said only "Image Muse", so there
   * was no way to tell an art-direction reference from a picture embedded in the
   * screen, and therefore no way to check that inspiration mode was doing
   * anything at all.
   *  - 'content'     — placed in the screen as a real <img>
   *  - 'inspiration' — shown to the model as a reference, never embedded
   *  - 'both'        — embedded AND shown, so the model designs around it
   * Absent on screens generated before the distinction was recorded.
   */
  imageRole?: 'content' | 'inspiration' | 'both'
  /**
   * The scroll sequence backing this screen's hero, when Muse produced one.
   *
   * Both fields or neither: the component needs the frame count as much as the
   * address, and a sequence addressed with the wrong count draws the last
   * frame for the rest of the scroll.
   */
  videoHash?: string
  videoFrames?: number
  /**
   * This screen's own answer about motion, overriding the composer's switch.
   *
   * `undefined` — the common case — means "follow the global setting", which is
   * what every screen generated before this existed says. Set explicitly, it
   * survives a reload and travels with the project, because "this one screen
   * must hold still for the demo" is a property of the screen, not of the
   * session that happened to be open.
   */
  animations?: boolean
  /**
   * The last quality check on this screen, kept small on purpose.
   *
   * Only the verdict is stored: the score, the rule ids still open, and how
   * many correction passes it took. The findings' names and descriptions are
   * NOT stored — they are reproducible from the rule id, and a project holds
   * many screens inside a localStorage budget that the component sources
   * already strain (see reportStorageFailure in lib/sync.ts). A few hundred
   * bytes per screen is affordable; a few kilobytes is not.
   *
   * Absent means "never checked", which is deliberately distinct from a stored
   * record with `open: []`, meaning "checked and clean".
   */
  quality?: ScreenQuality
  /** Position on the infinite canvas (canvas coordinates). */
  x: number
  y: number
  /** Real size of the frame / preview viewport, in canvas pixels. */
  w: number
  h: number
  /** Device chrome to draw around the preview. */
  device: 'iphone' | 'none'
  /** Interaction links to other screens (used by demo mode). */
  links: Hotspot[]
}

/** The compact record of one quality check. See Screen.quality. */
export interface ScreenQuality {
  /** Health score out of 20 when the check ran. */
  score: number
  band: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical'
  /** Rule ids still failing and worth acting on. */
  open: string[]
  /**
   * Rule ids the correction pass resolved.
   *
   * Without this, a converged polish and a polish that found nothing look
   * identical in storage and in the UI — both leave `open` empty. That is the
   * one question worth answering afterwards: what did it change?
   */
  fixed: string[]
  /** How many correction passes ran to get here. */
  iterations: number
  /** Whether the model-judged half of the pass contributed. */
  judged: boolean
  checkedAt: number
}

/** Legacy frame-header height; frames are now chrome-less, so this is 0. */
export const FRAME_HEADER = 0

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  screens: Screen[]
  /**
   * A screen pinned as the shared-layout reference. Its code is injected into
   * every NEW generation so screens keep a consistent nav/header/sidebar.
   */
  referenceScreenId?: string
  /**
   * Set instead of removing the record, so the deletion can travel to the other
   * devices. Sync merges by union — without a tombstone, a project deleted here
   * would simply be handed back by whichever device still had a copy. Records
   * are dropped for good after TOMBSTONE_TTL_MS (see ./merge).
   */
  deletedAt?: number
  /**
   * The folder this project is filed under — the NAME itself, not an id.
   *
   * There is deliberately no folder registry anywhere. A folder exists exactly
   * as long as some project names it, and the folder list is the set of distinct
   * values (see `listFolders`). That removes a whole class of state nobody would
   * have enjoyed: no id→name table to keep in step, no orphan id pointing at a
   * folder that was deleted on another device, and no empty folders left behind.
   *
   * It rides on the Project and not on a separate store because that is the only
   * place that survives every hop unchanged: the server keeps the projects blob
   * as an opaque string it never parses, `mergeProjects` moves whole Project
   * objects by reference, and `loadProjects` spreads `...p`. The same field on a
   * Screen would be dropped silently — `normalizeScreen` rebuilds each screen
   * from a fixed whitelist.
   *
   * The cost of naming rather than pointing: renaming a folder rewrites every
   * project in it. That is a loop over a handful of records, and each one bumps
   * `updatedAt`, so it merges like any other edit.
   */
  folder?: string
  /**
   * The design direction THIS project works under.
   *
   * DESIGN.md is global — one per browser, shared by every project (see
   * loadDesign). That is almost certainly why Muse was written to ignore it and
   * mint its own dossier per generation: it had nowhere to put a direction that
   * belonged to one project. The consequence was the bug this field closes —
   * every screen carried a different design document, so a project had as many
   * visual languages as it had screens, which is the one thing Mocky exists to
   * prevent.
   *
   * Absent means "use the global DESIGN.md", which is what every existing
   * project does and keeps doing. Nothing is rewritten behind anyone's back.
   *
   * Here and not on Screen for the same reason `folder` is: the server keeps the
   * projects blob as an opaque string, `mergeProjects` moves whole Project
   * objects, and `loadProjects` spreads `...p` — while `normalizeScreen` rebuilds
   * every screen from a fixed whitelist and would drop it.
   */
  design?: string
}

const PROJECTS_KEY = 'mocky.projects.v1'
const LEGACY_HISTORY_KEY = 'mocky.history.v1'

// Debounced localStorage persistence: we batch rapid edits (canvas drag,
// typing-triggered re-renders…) and flush at most once per 300ms. A
// `beforeunload` handler guarantees nothing is lost if the tab closes mid-debounce.
let saveTimer: number | null = null
let pendingProjects: Project[] | null = null
let beforeunloadHooked = false

function flushProjectsNow() {
  if (pendingProjects === null) return
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(pendingProjects))
  } catch (err) {
    // Almost always QuotaExceededError. Left unhandled, this threw out of a
    // setTimeout — so `pendingProjects` was never cleared and scheduleSync() was
    // never reached: local saving AND server sync both stopped, permanently and
    // without a word. Report it and keep the pending data so a later flush (or a
    // sync to the server) can still get it out.
    reportStorageFailure(err)
    return
  }
  pendingProjects = null
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  scheduleSync()
}

function scheduleSaveProjects(projects: Project[]) {
  pendingProjects = projects
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = window.setTimeout(flushProjectsNow, 300)
  // Install the unload flush once, lazily, so we don't lose data on close.
  if (!beforeunloadHooked) {
    beforeunloadHooked = true
    window.addEventListener('beforeunload', flushProjectsNow, { capture: true })
  }
}

/** Queue a debounced write of the whole project list to localStorage. */
export function saveProjects(projects: Project[]): void {
  scheduleSaveProjects(projects)
}

/**
 * Throw away a queued save instead of writing it.
 *
 * Needed when something OUTSIDE this module has just written a newer value to
 * localStorage — in practice `reconcileOnLogin()` merging in the copy the
 * server holds. The queued snapshot predates that merge, and `flushProjectsNow`
 * is also wired to `beforeunload` with capture, so it would run during the
 * reload that follows and put the pre-merge array straight back.
 *
 * That is not a lost write, it is an infinite loop: the next load reads the
 * stale array, reconciles against the server again, finds a difference again,
 * and reloads again — several times a second, forever. A fresh origin (a Docker
 * instance on another port, a new browser profile) walks straight into it,
 * because there the pre-merge array is empty while the server holds every
 * project the account owns.
 *
 * The snapshot dropped here is by construction the one taken at mount, before
 * the merge — `useProjects` no longer queues that write at all, so in practice
 * there is nothing to drop and this is a guard rather than a mechanism.
 */
export function discardPendingSave(): void {
  pendingProjects = null
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

/** Default real frame size for a new screen (in canvas pixels). */
export const DEFAULT_W = 1024
export const DEFAULT_H = 720
export const MIN_W = 240
export const MIN_H = 200
const GAP = 80
const COLS = 3

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function deriveName(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, ' ')
  if (!clean) return 'Untitled screen'
  return clean.length > 48 ? clean.slice(0, 48) + '…' : clean
}

/** The placeholder a project gets before it has any screen. */
export const DEFAULT_PROJECT_NAME = 'Untitled project'

/**
 * A short, human project title derived from the first prompt, so projects stop
 * being called "Untitled project". Drops the leading boilerplate people write
 * ("une page d'accueil pour…", "a landing page for…"), keeps the subject, and
 * cuts on a word boundary.
 */
export function deriveProjectName(prompt: string): string {
  let clean = prompt.trim().replace(/\s+/g, ' ')
  if (!clean) return DEFAULT_PROJECT_NAME

  // Strip the "<screen kind> for/pour" preamble — the subject is what matters.
  clean = clean.replace(
    /^(?:une?|an?|the|le|la|les)?\s*(?:page|écran|ecran|screen|site|app(?:lication)?|dashboard|tableau de bord|landing(?:\s*page)?|maquette|interface|vue)\b[^,]*?\s(?:pour|for|de|d['’]|du|des)\s+/i,
    '',
  )
  clean = clean.replace(/^(?:une?|an?|the|le|la|les|des|du|de)\s+/i, '')

  // Cut on a word boundary, never mid-word.
  const MAX = 42
  if (clean.length > MAX) {
    const cut = clean.slice(0, MAX)
    const lastSpace = cut.lastIndexOf(' ')
    clean = (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-–—]+$/, '') + '…'
  }
  clean = clean.replace(/[,;:.]+$/, '').trim()
  if (!clean) return DEFAULT_PROJECT_NAME
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/**
 * The screens of a walkthrough, in the order they should play.
 *
 * ORDER IS THE ARRAY, which is creation order — `addScreen` only ever appends,
 * nothing in the app re-sorts `project.screens`, and every other list already
 * reads it that way (export sidebar, links panel, project cover).
 *
 * Canvas position was the tempting alternative, since dragging is the only
 * ordering gesture the product offers. It loses on one fact: `packScreens` —
 * the Arrange button — derives POSITION FROM ARRAY ORDER, and says so ("order is
 * preserved: arranging must be predictable, not clever"). A chain read out of
 * x/y would therefore be silently rewritten the first time anyone tidied the
 * canvas, with no undo. Position is downstream of the array here, so the array
 * is what a sequence must be built on.
 *
 * Screens with no code are dropped rather than shown as a blank step: a screen
 * that never generated is a hole in the story, not a beat of it.
 *
 * `from` starts the walk at a chosen screen and keeps everything after it, which
 * is what "play from here" means on a canvas the user has scrolled through. An
 * unknown id is ignored rather than yielding nothing.
 */
export function autoFlow(screens: Screen[], from?: string): string[] {
  const usable = screens.filter((s) => s.code && s.code.trim().length > 0)
  if (usable.length === 0) return []
  const at = from ? usable.findIndex((s) => s.id === from) : 0
  return usable.slice(at > 0 ? at : 0).map((s) => s.id)
}

/**
 * Which design direction applies to a screen of this project.
 *
 * One rule, in one place, so nothing has to guess: the project's own direction
 * wins, the global DESIGN.md is the fallback, and an empty or whitespace-only
 * value counts as absent — a blank direction is not a direction, and treating it
 * as one would silently strip the fallback.
 *
 * Returns undefined when neither exists, which every caller already handles as
 * "generate without a design preamble".
 */
export function designForProject(
  project: Pick<Project, 'design'> | null | undefined,
  globalMarkdown?: string,
): string | undefined {
  const own = project?.design
  if (own && own.trim()) return own
  return globalMarkdown && globalMarkdown.trim() ? globalMarkdown : undefined
}

/**
 * Longest a folder name may be.
 *
 * Folders are chips on one line above the index; past this they wrap and the
 * filter bar stops reading as a bar. It is also a guard on the store, since the
 * name is repeated on every project filed under it.
 */
export const FOLDER_MAX_LEN = 32

/**
 * Tidies a folder name, or returns null if there is nothing left.
 *
 * Trimming matters more than it looks: " Client " and "Client" would otherwise
 * be two folders that render identically, and no one would ever work out why
 * their projects had split in two.
 */
export function normalizeFolder(name: string | undefined | null): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, FOLDER_MAX_LEN)
  return clean.length > 0 ? clean : null
}

/**
 * Every folder in use, with how many live projects each holds.
 *
 * Derived, never stored — see the note on `Project.folder`. Sorted by name
 * rather than by count so the bar does not reshuffle itself as projects move
 * between folders; a filter whose entries jump around is unusable.
 *
 * Comparison is locale-aware and case-insensitive so "Études" files next to
 * "essais" rather than after "Zoo", which is what a plain `<` would do.
 */
export function listFolders(projects: Project[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of projects) {
    if (p.deletedAt) continue
    const f = normalizeFolder(p.folder)
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/**
 * The index, cut into sections — one per folder, then everything unfiled.
 *
 * Folders are sections of the page rather than a filter above it. A filter shows
 * one folder and hides the others, so the shape of the whole is never visible;
 * an index shows every section at once, which is what makes the folders worth
 * having. It is also the page's existing vocabulary: "Les autres projets" and
 * "Brouillons vides" are already section heads, so a folder becomes one more.
 *
 * Unfiled projects come last and are not a folder — they are what is left, which
 * is why the caller titles them differently.
 */
export function groupByFolder(projects: Project[]): {
  folder: string | null
  projects: Project[]
}[] {
  const named = new Map<string, Project[]>()
  const loose: Project[] = []
  for (const p of projects) {
    const f = normalizeFolder(p.folder)
    if (!f) {
      loose.push(p)
      continue
    }
    const bucket = named.get(f)
    if (bucket) bucket.push(p)
    else named.set(f, [p])
  }
  const out = [...named.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([folder, ps]) => ({ folder: folder as string | null, projects: ps }))
  if (loose.length > 0) out.push({ folder: null, projects: loose })
  return out
}

/**
 * Entry numbers for the index, running across every section.
 *
 * The numbers are what make the page read as an index rather than as a list of
 * cards, so they must not restart at each folder — a second "02" halfway down
 * says the sections are separate documents. `first` is the number after the
 * lead, which is printed as 01.
 */
export function indexNumbers(
  sections: { projects: Project[] }[],
  first = 2,
): Map<string, number> {
  const out = new Map<string, number>()
  let n = first
  for (const s of sections) for (const p of s.projects) out.set(p.id, n++)
  return out
}

/**
 * A project name as a headline.
 *
 * A project created from a pasted brief inherits its first words verbatim, so
 * the front page ended up leading with `<reference-prompt> # Summary A
 * futuristic…`. That is markup, not a title, and it reads as a bug. Stripped
 * for display only — the stored name is untouched, so renaming still shows
 * exactly what the user typed.
 */
export function headline(name: string): string {
  const clean = name
    .replace(/<\/?[a-z][\w-]*(?:\s[^>]*)?>/gi, ' ') // XML-ish tags from pasted briefs
    .replace(/^[\s#>*_`\-–—]+/, '') // markdown lead-ins
    .replace(/\s+/g, ' ')
    .trim()
  // If stripping left nothing, the markup WAS the name — show it as it is
  // rather than an empty headline.
  return clean || name
}

/** Grid slot for the Nth screen, used when a screen has no explicit position. */
export function slotPosition(index: number): { x: number; y: number } {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return { x: col * (DEFAULT_W + GAP), y: row * (DEFAULT_H + GAP) }
}

/** A positioned box on the canvas — the only part of a Screen layout cares about. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Do two boxes touch, once the gutter is counted as part of each? */
function collides(a: Box, b: Box, gap = GAP): boolean {
  return (
    a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
  )
}

/**
 * Where to drop a NEW screen so it lands on empty canvas.
 *
 * The old rule was `slotPosition(screens.length)`: a fixed 1024x720 cell on a
 * three-column grid, indexed by how many screens existed. It overlapped in two
 * separate ways, and both are routine rather than edge cases.
 *
 * First, the cell is one size and screens are not: a desktop screen is 1440
 * wide, so it ran 336px into the next column every single time — and desktop is
 * now the default format. Second, the index says nothing about occupancy: drag
 * one screen anywhere (the ordinary thing to do on a canvas) and slot N is no
 * longer free, yet the next screen was posted to it regardless.
 *
 * This scans a lattice sized to the INCOMING screen and returns the first
 * position that touches nothing. Same reading order as before — left to right,
 * then down — so where screens land still feels predictable.
 */
export function placeScreen(existing: Box[], w: number, h: number): { x: number; y: number } {
  const boxes = existing.filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y))
  if (!boxes.length) return { x: 0, y: 0 }

  // Anchor on the existing cluster rather than the origin, so a project whose
  // screens were all dragged elsewhere does not get its next screen back at 0,0.
  const originX = Math.min(...boxes.map((b) => b.x))
  const originY = Math.min(...boxes.map((b) => b.y))
  const stepX = w + GAP
  const stepY = h + GAP

  for (let row = 0; row < 400; row++) {
    for (let col = 0; col < COLS; col++) {
      const cand: Box = { x: originX + col * stepX, y: originY + row * stepY, w, h }
      if (!boxes.some((b) => collides(cand, b))) return { x: cand.x, y: cand.y }
    }
  }
  // Unreachable in practice; below everything is still a correct answer.
  return { x: originX, y: Math.max(...boxes.map((b) => b.y + b.h)) + GAP }
}

/**
 * Lay a whole set out again — what the "Arrange" button does.
 *
 * Row height is the tallest screen IN THAT ROW and each column is as wide as it
 * needs to be, so a mobile screen next to a desktop one no longer has the
 * desktop one written across it. Order is preserved: arranging must be
 * predictable, not clever.
 */
export function packScreens(screens: Box[], maxPerRow = COLS): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  let rowTop = 0
  for (let i = 0; i < screens.length; i += maxPerRow) {
    const row = screens.slice(i, i + maxPerRow)
    let x = 0
    for (const s of row) {
      out.push({ x, y: rowTop })
      x += (Number.isFinite(s.w) ? s.w : DEFAULT_W) + GAP
    }
    rowTop += Math.max(...row.map((s) => (Number.isFinite(s.h) ? s.h : DEFAULT_H))) + GAP
  }
  return out
}

/** Backfill x/y/w/h on screens loaded from storage (older records lacked them). */
function normalizeScreen(s: Partial<Screen>, index: number): Screen {
  const pos =
    typeof s.x === 'number' && typeof s.y === 'number' ? { x: s.x, y: s.y } : slotPosition(index)
  return {
    id: s.id || newId(),
    name: s.name || 'Untitled screen',
    prompt: s.prompt || '',
    code: s.code || '',
    componentName: s.componentName || 'App',
    createdAt: s.createdAt || Date.now(),
    ...pos,
    w: typeof s.w === 'number' ? s.w : DEFAULT_W,
    h: typeof s.h === 'number' ? s.h : DEFAULT_H,
    device: s.device === 'iphone' ? 'iphone' : 'none',
    links: Array.isArray(s.links) ? s.links : [],
    caps: Array.isArray(s.caps) ? s.caps : [],
    // Trimmed, not padded: a stored empty string would claim "this screen was
    // generated with an empty design system", which is not the same as "no
    // design system was recorded for this screen".
    design: typeof s.design === 'string' && s.design.trim() ? s.design : undefined,
    imageHash: typeof s.imageHash === 'string' ? s.imageHash : undefined,
    imageRole:
      s.imageRole === 'content' || s.imageRole === 'inspiration' || s.imageRole === 'both'
        ? s.imageRole
        : undefined,
    // Kept as a pair — see the note on Screen.videoHash.
    videoHash: typeof s.videoHash === 'string' && s.videoFrames ? s.videoHash : undefined,
    videoFrames: typeof s.videoFrames === 'number' && s.videoFrames > 0 ? s.videoFrames : undefined,
    // Only a real boolean is an override; anything else means "follow the
    // composer", which is what every screen made before this field says.
    animations: typeof s.animations === 'boolean' ? s.animations : undefined,
    // Rebuilt field by field rather than passed through: this record is written
    // from a server response, and everything on a Screen survives a reload only
    // if it is named here.
    quality: normalizeQuality(s.quality),
  }
}

/** Validate a stored quality record, or drop it. */
function normalizeQuality(q: Partial<ScreenQuality> | undefined): ScreenQuality | undefined {
  if (!q || typeof q !== 'object') return undefined
  if (typeof q.score !== 'number' || !Number.isFinite(q.score)) return undefined
  const bands = ['excellent', 'good', 'acceptable', 'poor', 'critical'] as const
  return {
    score: Math.max(0, Math.min(20, Math.round(q.score))),
    band: bands.includes(q.band as (typeof bands)[number]) ? (q.band as ScreenQuality['band']) : 'good',
    open: Array.isArray(q.open) ? q.open.filter((r): r is string => typeof r === 'string') : [],
    fixed: Array.isArray(q.fixed) ? q.fixed.filter((r): r is string => typeof r === 'string') : [],
    iterations: typeof q.iterations === 'number' && q.iterations >= 0 ? Math.floor(q.iterations) : 0,
    judged: q.judged === true,
    checkedAt: typeof q.checkedAt === 'number' && q.checkedAt > 0 ? q.checkedAt : Date.now(),
  }
}

function migrateLegacy(): Project[] {
  try {
    const legacy = localStorage.getItem(LEGACY_HISTORY_KEY)
    if (!legacy) return []
    const screens = JSON.parse(legacy)
    if (!Array.isArray(screens) || screens.length === 0) {
      localStorage.removeItem(LEGACY_HISTORY_KEY)
      return []
    }
    const now = Date.now()
    const positioned: Screen[] = screens.map((s: Partial<Screen>, i: number) => normalizeScreen(s, i))
    const project: Project = {
      id: newId(),
      name: 'My screens',
      createdAt: now,
      updatedAt: now,
      screens: positioned,
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify([project]))
    localStorage.removeItem(LEGACY_HISTORY_KEY)
    return [project]
  } catch {
    return []
  }
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const now = Date.now()
      return (
        (parsed as Project[])
          // Forget tombstones once every device has had a month to see them,
          // otherwise deleted projects would weigh on the blob forever.
          .filter((p) => !(p.deletedAt && now - p.deletedAt > TOMBSTONE_TTL_MS))
          // Backfill w/h (and x/y) on screens persisted before frames had a size.
          .map((p) => ({
            ...p,
            screens: (p.screens || []).map((s, i) => normalizeScreen(s, i)),
          }))
      )
    }
    return migrateLegacy()
  } catch {
    return []
  }
}

export function useProjects() {
  // `all` includes deleted records (tombstones), because those have to be
  // persisted and synced for the deletion to reach other devices. Everything
  // outside this hook only ever sees the visible ones.
  const [all, setProjects] = useState<Project[]>(() => loadProjects())
  const projects = useMemo(() => visibleProjects(all), [all])

  // Persist on change — but never on mount. The mount-time value is what we
  // just READ from storage, so writing it back is at best a no-op. At worst it
  // is the bug described on `discardPendingSave`: on a fresh origin the value
  // read is `[]` while the server holds every project, and queuing that empty
  // array both clobbers the merge that is about to land and schedules a sync
  // that would push it to the server.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    saveProjects(all)
  }, [all])

  // Two Mocky tabs used to overwrite each other: each held its own copy loaded
  // at mount and rewrote the whole array on every flush, so whichever tab saved
  // last erased what the other had done — and then pushed that truncated array
  // to the server. The storage event fires only in the OTHER tabs, which is
  // exactly what we want here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PROJECTS_KEY || e.newValue == null) return
      try {
        const incoming = JSON.parse(e.newValue)
        // Merge, don't replace. Wholesale replacement fixed "last writer wins"
        // in one direction and recreated it in the other: this tab's own writes
        // are debounced 300 ms, so a screen mid-generation was not in the other
        // tab's snapshot yet — adopting that snapshot dropped the screen, and
        // every later onUpdateScreen for it became a silent no-op against an id
        // that no longer existed. mergeProjects resolves per project by
        // updatedAt and keeps what only one side knows about.
        if (Array.isArray(incoming)) {
          setProjects((prev) => mergeProjects(prev, incoming as Project[]))
        }
      } catch {
        /* another tab wrote something unparseable — keep what we have */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const createProject = useCallback((name?: string): string => {
    const now = Date.now()
    const project: Project = {
      id: newId(),
      name: name?.trim() || DEFAULT_PROJECT_NAME,
      createdAt: now,
      updatedAt: now,
      screens: [],
    }
    setProjects((prev) => [project, ...prev])
    return project.id
  }, [])

  const deleteProject = useCallback((id: string) => {
    // Tombstone rather than removal — see Project.deletedAt. Dropping the record
    // outright made deletions un-syncable: the next merge with a device that
    // still had the project simply brought it back.
    const now = Date.now()
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, deletedAt: now, updatedAt: now } : p)))
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p)),
    )
  }, [])

  /**
   * Files a set of projects under a folder, or takes them out of one with null.
   *
   * A set rather than a single id because that is how it is always used — the
   * home page moves a selection. Doing it in one pass also means one state
   * update and therefore one 300 ms save, where a loop would queue one per
   * project.
   */
  const setProjectsFolder = useCallback((ids: string[], folder: string | null) => {
    const wanted = normalizeFolder(folder)
    const set = new Set(ids)
    const now = Date.now()
    setProjects((prev) =>
      prev.map((p) => {
        if (!set.has(p.id)) return p
        // Writing the same value would bump updatedAt for nothing and make this
        // project win a merge it has no business winning.
        if ((normalizeFolder(p.folder) ?? null) === wanted) return p
        const next = { ...p, updatedAt: now }
        if (wanted) next.folder = wanted
        else delete next.folder
        return next
      }),
    )
  }, [])

  /**
   * Renames a folder by rewriting every project filed under it.
   *
   * That is the price of storing the name rather than an id, and it is the right
   * price: there is no registry to fall out of step, and nothing to clean up
   * when the last project leaves. Merging into an existing folder is allowed and
   * is simply what happens when the new name is already in use.
   */
  /**
   * Fix this project's design direction, or clear it back to the global one.
   *
   * The only writer. Every path that changes a direction — "make this screen my
   * DESIGN.md", a Muse run the user allowed to redefine it — comes through here,
   * so there is one place to look when a project's look changes and nobody
   * remembers asking.
   */
  const setProjectDesign = useCallback((id: string, markdown: string | null) => {
    const clean = markdown && markdown.trim() ? markdown : null
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        if ((p.design ?? null) === clean) return p
        const next = { ...p, updatedAt: Date.now() }
        if (clean) next.design = clean
        else delete next.design
        return next
      }),
    )
  }, [])

  const renameFolder = useCallback((from: string, to: string) => {
    const before = normalizeFolder(from)
    const after = normalizeFolder(to)
    if (!before || !after || before === after) return
    const now = Date.now()
    setProjects((prev) =>
      prev.map((p) => (normalizeFolder(p.folder) === before ? { ...p, folder: after, updatedAt: now } : p)),
    )
  }, [])

  const addScreen = useCallback((projectId: string, screen: Omit<Screen, 'x' | 'y'>) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        // Placed against what is actually on the canvas, not against a count.
        const w = typeof screen.w === 'number' ? screen.w : DEFAULT_W
        const h = typeof screen.h === 'number' ? screen.h : DEFAULT_H
        const full: Screen = { ...screen, ...placeScreen(p.screens, w, h) }
        return { ...p, screens: [...p.screens, full], updatedAt: Date.now() }
      }),
    )
  }, [])

  const updateScreen = useCallback((projectId: string, screenId: string, patch: Partial<Screen>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              screens: p.screens.map((s) => (s.id === screenId ? { ...s, ...patch } : s)),
              updatedAt: Date.now(),
            }
          : p,
      ),
    )
  }, [])

  const removeScreen = useCallback((projectId: string, screenId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              screens: p.screens.filter((s) => s.id !== screenId),
              // If the pinned reference screen is deleted, un-pin it.
              referenceScreenId: p.referenceScreenId === screenId ? undefined : p.referenceScreenId,
              updatedAt: Date.now(),
            }
          : p,
      ),
    )
  }, [])

  /** Pin (or, with null, un-pin) a screen as the project's shared-layout reference. */
  const setReferenceScreen = useCallback((projectId: string, screenId: string | null) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, referenceScreenId: screenId || undefined, updatedAt: Date.now() }
          : p,
      ),
    )
  }, [])

  return {
    projects,
    createProject,
    deleteProject,
    renameProject,
    setProjectsFolder,
    setProjectDesign,
    renameFolder,
    addScreen,
    updateScreen,
    removeScreen,
    setReferenceScreen,
  }
}
