import { useCallback, useEffect, useState } from 'react'
import { scheduleSync } from './sync'

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
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(pendingProjects))
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
      // Backfill w/h (and x/y) on screens persisted before frames had a size.
      return (parsed as Project[]).map((p) => ({
        ...p,
        screens: (p.screens || []).map((s, i) => normalizeScreen(s, i)),
      }))
    }
    return migrateLegacy()
  } catch {
    return []
  }
}

function saveProjects(projects: Project[]): void {
  scheduleSaveProjects(projects)
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())

  useEffect(() => {
    saveProjects(projects)
  }, [projects])

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
    setProjects((prev) => prev.filter((p) => p.id !== id))
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
