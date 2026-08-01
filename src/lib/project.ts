import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scheduleSync, reportStorageFailure } from './sync'
import { visibleProjects, TOMBSTONE_TTL_MS } from './merge'

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
        if (Array.isArray(incoming)) setProjects(incoming as Project[])
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

  const addScreen = useCallback((projectId: string, screen: Omit<Screen, 'x' | 'y'>) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        const full: Screen = { ...screen, ...slotPosition(p.screens.length) }
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
    addScreen,
    updateScreen,
    removeScreen,
    setReferenceScreen,
  }
}
