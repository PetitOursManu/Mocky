import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTimeAgo } from '../lib/timeAgo'
import { headline, shownProjectName, type Project, type Screen } from '../lib/project'
import {
  buildFolderTree,
  canMoveFolder,
  cleanFolderName,
  FOLDER_NAME_MAX,
  folderDropVerdict,
  folderStats,
  insertionIndex,
  placeOf,
  projectsDropVerdict,
  treeKeyAction,
  visibleRows,
  type DropVerdict,
  type Folder,
  type FolderTree,
  type TreeRow,
} from '../lib/folderTree'
import { getThumb, pruneThumbs, reconcileRemoteThumbs } from '../lib/thumbnails'
import { Button, Icon, IconButton, Input, Modal } from '../ui'
import { useT } from '../i18n'
import ReviewStatusPill from './ReviewStatusPill'
import type { ProjectReviewState } from '../lib/review'

/** Coming back from a project lands in the folder it was opened from. */
const CWD_KEY = 'mocky.home.folder'

/**
 * Whether the folder tree is shown, per viewer: below `lg` it is a panel that
 * opens from the header (closed by default — a phone's first screen belongs to
 * the projects), from `lg` a sidebar (open by default). Two answers, because
 * someone who hides the sidebar on a wide screen has not asked to lose it on
 * their phone, and the other way round.
 */
const SHELF_KEY = 'mocky.home.tree'
type Shelf = { narrow: boolean; wide: boolean }
function readShelf(): Shelf {
  try {
    const raw = JSON.parse(localStorage.getItem(SHELF_KEY) ?? 'null') as Partial<Shelf> | null
    return { narrow: raw?.narrow === true, wide: raw?.wide !== false }
  } catch {
    return { narrow: false, wide: true }
  }
}

/**
 * How long a drag rests on a closed folder of the tree before it opens. Long
 * enough that sweeping across the shelf opens nothing, short enough that
 * pausing on a folder to look inside does not feel like waiting.
 */
const HOVER_OPEN_MS = 600

/**
 * What is being dragged. The page's own state: a drag never leaves this page.
 * A project drag carries where each project is now, read once at the start,
 * so hovering does not look every project up on every `dragover`.
 */
type Dragged = { projects: string[]; places: (string | null)[] } | { folder: string }

/** A tree row's key: its folder id, or `root` for "All projects". */
const rowKey = (id: string | null) => id ?? 'root'

/** The look of a place being hovered by a drag, by what dropping would do. */
function dropTone(verdict: DropVerdict | null): string {
  if (verdict === 'move') return 'bg-accent/15 ring-1 ring-inset ring-accent'
  // A rule just met, said in the status colour rather than in a flat "no":
  // the cursor alone does not tell a folder you cannot enter from a gap.
  if (verdict === 'refused') return 'bg-danger/10 ring-1 ring-inset ring-danger/50 cursor-no-drop'
  return ''
}

/**
 * The tick box that appears on a row in selection mode.
 *
 * Drawn rather than a native `<input type=checkbox>`: the native control paints
 * itself with the operating system's accent colour, which is the one colour on
 * the page the theme cannot reach. It stays a real checkbox underneath, so the
 * keyboard and screen readers get the real thing.
 */
function TickBox({
  checked,
  onChange,
  label,
  className = '',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  className?: string
}) {
  return (
    <label className={`relative flex shrink-0 cursor-pointer items-center ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer absolute h-0 w-0 opacity-0"
      />
      <span
        aria-hidden
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-transparent'
        }`}
      >
        <Icon name="check" size={13} />
      </span>
    </label>
  )
}

/**
 * Screens drawn as proportional rectangles — the fallback figure.
 *
 * Used until a real thumbnail exists, and permanently for a screen that cannot
 * be captured. The width/height ratio and the device type are honest
 * information, and they cost nothing.
 *
 * Outline, never filled. Filled with `bg-surface` these read as broken images
 * in the dark theme — a column of black boxes where pictures should be — when
 * what they actually are is a diagram of the screen's shape.
 */
function ScreenFigure({ screens, tall = false }: { screens: Screen[]; tall?: boolean }) {
  const shown = screens.slice(0, tall ? 5 : 3)
  const box = tall ? 76 : 40
  return (
    <span className="flex items-end gap-1.5 opacity-70" aria-hidden>
      {shown.map((s) => {
        const ratio = s.w > 0 && s.h > 0 ? s.w / s.h : 4 / 3
        const h = box
        const w = Math.max(10, Math.min(box * 1.6, Math.round(h * ratio)))
        return (
          <span
            key={s.id}
            style={{ width: w, height: h }}
            className={`block border border-line ${s.device === 'iphone' ? 'rounded-[3px]' : ''}`}
          />
        )
      })}
      {screens.length > shown.length && (
        <span className="self-center pl-0.5 font-mono text-caption text-ink-faint">
          +{screens.length - shown.length}
        </span>
      )}
    </span>
  )
}

/**
 * A project's cover filling the box it is given — a card's picture. The real
 * screenshot when there is one, the drawn rectangles until then, centred on the
 * canvas colour so a card without a picture still reads as a card.
 */
function ProjectCover({
  screens,
  thumbs,
  className = '',
}: {
  screens: Screen[]
  thumbs: Record<string, string>
  className?: string
}) {
  const cover = screens[0]
  const thumb = cover ? thumbs[cover.id] : undefined
  return (
    // `relative` + an absolute picture: as a flex child the image's own height
    // overrode the box's aspect ratio and a tall capture stretched its card.
    <div className={`relative flex items-center justify-center overflow-hidden bg-sunken ${className}`}>
      {thumb ? (
        <img
          src={thumb}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[0_0]"
        />
      ) : (
        <ScreenFigure screens={screens} />
      )}
    </div>
  )
}

/** The deck under a headline: the request that produced the first screen. */
function deckOf(p: Project, max = 180): string | null {
  const withPrompt = p.screens.find((s) => s.prompt?.trim())
  if (!withPrompt) return null
  // The same markup `headline` strips would open every deck with a tag.
  const clean = headline(withPrompt.prompt)
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}

export default function ProjectsHome({
  projects,
  folders,
  onOpen,
  onCreate,
  onDelete,
  onMoveProjects,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  reviewStates = {},
  onSaveTemplate,
}: {
  projects: Project[]
  folders: Folder[]
  onOpen: (id: string) => void
  /** A new project, in the folder being looked at. */
  onCreate: (folderId: string | null) => void
  onDelete: (id: string) => void
  onMoveProjects: (ids: string[], folderId: string | null) => void
  onCreateFolder: (name: string, parentId: string | null) => string | null
  onRenameFolder: (id: string, name: string) => void
  onMoveFolder: (id: string, parentId: string | null) => void
  onDeleteFolder: (id: string) => void
  /**
   * Each project's approval status (lib/useReviewState.ts). A project absent
   * from it is a draft, and a draft shows no label: most projects are never
   * sent to anyone, and a page where every card says "Draft" says nothing.
   */
  reviewStates?: Record<string, ProjectReviewState>
  /** "Save as template" on a project's card (lib/templates.ts). Absent: not offered. */
  onSaveTemplate?: (id: string) => void
}) {
  const t = useT()
  const timeAgo = useTimeAgo()
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  /** The move dialog: for the ticked set, one project, or one folder. */
  const [moving, setMoving] = useState<{ selection: true } | { project: string } | { folder: string } | null>(null)
  /** The naming dialog: a new folder under `create` (null: the top), or a new name for this one. */
  const [naming, setNaming] = useState<{ create: string | null } | { rename: Folder } | null>(null)
  const [dragged, setDragged] = useState<Dragged | null>(null)
  /** The place a drag is over, and what dropping there would do. */
  const [dropOver, setDropOver] = useState<{ key: string; verdict: DropVerdict } | null>(null)
  /** The tree row being renamed in place. */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  /** A tree row's menu, from a right-click, the menu key or its `⋯` button. */
  const [rowMenu, setRowMenu] = useState<{ id: string | null; x: number; y: number } | null>(null)
  /** The tree row that holds the tab stop (roving tabindex). */
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLElement>())
  const hoverOpen = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [shelf, setShelf] = useState<Shelf>(readShelf)
  const toggleShelf = (which: keyof Shelf) => {
    const next = { ...shelf, [which]: !shelf[which] }
    setShelf(next)
    try {
      localStorage.setItem(SHELF_KEY, JSON.stringify(next))
    } catch {
      /* not remembered, still toggled */
    }
  }

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const stats = useMemo(() => folderStats(tree, projects), [tree, projects])

  const [cwdRaw, setCwdRaw] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(CWD_KEY)
    } catch {
      return null
    }
  })
  // A folder deleted on another device takes whoever was in it to the top.
  const cwd = tree.has(cwdRaw) ? cwdRaw : null
  const go = (id: string | null) => {
    setCwdRaw(id)
    setQuery('')
    try {
      if (id) sessionStorage.setItem(CWD_KEY, id)
      else sessionStorage.removeItem(CWD_KEY)
    } catch {
      /* the folder is simply not remembered */
    }
  }

  /**
   * Folders open in the side tree. Arriving somewhere opens the way down to it,
   * once: it used to be forced open for as long as you stood there, which left
   * the arrow keys and the chevron unable to close an ancestor of where you are.
   */
  const [opened, setOpened] = useState<Set<string>>(() => new Set(cwd ? tree.pathOf(cwd).map((f) => f.id) : []))
  useEffect(() => {
    if (!cwd) return
    const path = tree.pathOf(cwd).map((f) => f.id)
    setOpened((prev) => (path.every((id) => prev.has(id)) ? prev : new Set([...prev, ...path])))
    // Only on arrival: `tree` changing under you (a rename elsewhere) must not
    // reopen what you just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd])
  const setOpen = (id: string, on: boolean) =>
    setOpened((prev) => {
      if (prev.has(id) === on) return prev
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const toggleOpen = (id: string) => setOpen(id, !opened.has(id))
  const rows = useMemo(() => visibleRows(tree, (id) => opened.has(id)), [tree, opened])

  const searching = query.trim().length > 0

  const { lead, shown, empties, visible, matched } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (p: Project) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.screens.some((s) => `${s.name} ${s.prompt}`.toLowerCase().includes(q))
    const byRecency = [...projects.filter(matches)].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    const lead = q ? null : (byRecency.find((p) => p.screens.length > 0) ?? null)
    // A search looks everywhere: where a project is filed is exactly what you
    // may have forgotten.
    const here = q ? byRecency : byRecency.filter((p) => placeOf(p, tree) === cwd)
    const withScreens = here.filter((p) => p.screens.length > 0)
    const atTop = !q && cwd === null
    return {
      lead,
      // The lead is printed at the top; listing it again would show it twice.
      shown: atTop ? withScreens.filter((p) => p !== lead) : withScreens,
      empties: here.filter((p) => p.screens.length === 0),
      visible: atTop && lead && !here.includes(lead) ? [lead, ...here] : here,
      matched: byRecency.length,
    }
  }, [projects, query, tree, cwd])

  // Ticks are dropped when a project leaves the view — through the search box or
  // a deletion. Acting on something the user can no longer see is how a batch
  // delete takes a project nobody meant to touch.
  useEffect(() => {
    setPicked((prev) => {
      const live = new Set(visible.map((p) => p.id))
      const next = new Set([...prev].filter((id) => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visible])

  const pickedProjects = useMemo(() => visible.filter((p) => picked.has(p.id)), [visible, picked])

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const leaveSelection = () => {
    setSelecting(false)
    setPicked(new Set())
  }

  /**
   * Delete everything ticked, behind one confirmation.
   *
   * The screen count is spelled out because the project names are not: at ten
   * projects a list would not fit in a `confirm`, and "12 projects" alone hides
   * whether this is twelve empty drafts or twelve weeks of work.
   */
  const deletePicked = () => {
    if (pickedProjects.length === 0) return
    const screens = pickedProjects.reduce((n, p) => n + p.screens.length, 0)
    const lines = [t('projects.deleteSelectedConfirm', { count: pickedProjects.length })]
    if (screens > 0) lines.push(t('projects.deleteSelectedScreens', { count: screens }))
    if (!confirm(lines.join('\n'))) return
    // deleteProject uses a functional setState, so a loop is safe: each call
    // sees the result of the previous one rather than a stale array.
    for (const p of pickedProjects) onDelete(p.id)
    leaveSelection()
  }

  const pathLabel = (p: Project): string | null => {
    const id = placeOf(p, tree)
    return id ? tree.pathOf(id).map((f) => f.name).join(' / ') : null
  }

  // ---- moving things ------------------------------------------------------

  const verdictOf = (what: Dragged | null, target: string | null): DropVerdict | null => {
    if (!what) return null
    if ('folder' in what) return folderDropVerdict(tree, what.folder, target)
    return projectsDropVerdict(what.places, target)
  }
  const disarmHoverOpen = (id?: string) => {
    if (hoverOpen.current && (id === undefined || hoverOpen.current.id === id)) {
      clearTimeout(hoverOpen.current.timer)
      hoverOpen.current = null
    }
  }
  useEffect(() => () => disarmHoverOpen(), [])
  const endDrag = () => {
    disarmHoverOpen()
    setDragged(null)
    setDropOver(null)
  }
  const drop = (target: string | null) => {
    if (dragged && verdictOf(dragged, target) === 'move') {
      if ('folder' in dragged) {
        onMoveFolder(dragged.folder, target)
        // Show where it went: the folder it landed in opens.
        if (target) setOpen(target, true)
      } else onMoveProjects(dragged.projects, target)
    }
    endDrag()
  }
  /**
   * What makes something a place to drop on. `null` is the top of the tree.
   * `opensAfterRest` is a closed tree row's id: resting on it opens it, which
   * is how a folder three levels down is reached in one drag.
   */
  const dropZone = (target: string | null, opensAfterRest?: string) => {
    const key = rowKey(target)
    return {
      onDragOver: (e: React.DragEvent) => {
        const verdict = verdictOf(dragged, target)
        if (!verdict) return
        if (verdict === 'move') {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }
        if (dropOver?.key !== key || dropOver.verdict !== verdict) setDropOver({ key, verdict })
        const isCarried = dragged != null && 'folder' in dragged && dragged.folder === opensAfterRest
        if (opensAfterRest && verdict !== 'refused' && !isCarried && hoverOpen.current?.id !== opensAfterRest) {
          disarmHoverOpen()
          const id = opensAfterRest
          hoverOpen.current = {
            id,
            timer: setTimeout(() => {
              hoverOpen.current = null
              setOpen(id, true)
            }, HOVER_OPEN_MS),
          }
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return
        if (opensAfterRest) disarmHoverOpen(opensAfterRest)
        setDropOver((prev) => (prev?.key === key ? null : prev))
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        drop(target)
      },
    }
  }
  /** What dropping on this place would do, while a drag is over it. */
  const dropAt = (target: string | null): DropVerdict | null =>
    dragged != null && dropOver?.key === rowKey(target) ? dropOver.verdict : null
  const startDrag = (e: React.DragEvent, what: Dragged) => {
    // Firefox starts no drag without data, and the data is never read.
    e.dataTransfer.setData('text/plain', '')
    e.dataTransfer.effectAllowed = 'move'
    setDragged(what)
  }
  const dragProject = (p: Project) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      const ids = picked.has(p.id) ? [...picked] : [p.id]
      const places = ids.map((id) => {
        const q = projects.find((x) => x.id === id)
        return q ? placeOf(q, tree) : null
      })
      startDrag(e, { projects: ids, places })
    },
    onDragEnd: endDrag,
  })
  const dragFolder = (id: string) => ({
    draggable: renamingId !== id,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation()
      startDrag(e, { folder: id })
    },
    onDragEnd: endDrag,
  })
  /** Dimmed while it is the thing being carried. */
  const carried = (what: { project: string } | { folder: string }) =>
    dragged != null &&
    ('folder' in what
      ? 'folder' in dragged && dragged.folder === what.folder
      : 'projects' in dragged && dragged.projects.includes(what.project))

  const movingTitle = useMemo(() => {
    if (!moving) return ''
    if ('selection' in moving) return t('projects.moveToTitle', { count: pickedProjects.length })
    if ('project' in moving) {
      const p = projects.find((x) => x.id === moving.project)
      return p ? t('projects.fileOne', { name: headline(shownProjectName(p.name, t('projects.untitled'))) }) : ''
    }
    return t('projects.moveFolderTitle', { name: tree.get(moving.folder)?.name ?? '' })
  }, [moving, pickedProjects.length, projects, tree, t])

  const applyMove = (target: string | null) => {
    if (!moving) return
    if ('selection' in moving) {
      onMoveProjects(pickedProjects.map((p) => p.id), target)
      leaveSelection()
    } else if ('project' in moving) {
      onMoveProjects([moving.project], target)
    } else {
      onMoveFolder(moving.folder, target)
    }
    setMoving(null)
  }

  const confirmDeleteFolder = (f: Folder) => {
    if (confirm(t('projects.deleteFolderConfirm', { name: f.name }))) onDeleteFolder(f.id)
  }

  // ---- the tree's own gestures -------------------------------------------

  const focusRow = (key: string) => {
    // A frame later: the row may only just have been rendered (a folder opened,
    // a rename input replaced by the name again).
    requestAnimationFrame(() => rowRefs.current.get(key)?.focus())
  }

  /** Set once the rename has been settled, so the blur that follows cannot settle it twice. */
  const renameSettled = useRef(false)
  const startRename = (id: string) => {
    renameSettled.current = false
    setRenamingId(id)
  }
  const finishRename = (id: string, value: string | null) => {
    if (renameSettled.current) return
    renameSettled.current = true
    const clean = value === null ? null : cleanFolderName(value)
    const before = tree.get(id)?.name
    if (clean && clean !== before) onRenameFolder(id, clean)
    setRenamingId(null)
    focusRow(id)
  }

  const openRowMenu = (id: string | null, e: React.MouseEvent | { currentTarget: Element }) => {
    // The menu key and Shift+F10 arrive as a contextmenu event at (0, 0): put
    // the menu under the row instead of in the window's corner.
    const fromPointer = 'clientX' in e && (e.clientX !== 0 || e.clientY !== 0)
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    setRowMenu({
      id,
      x: fromPointer ? (e as React.MouseEvent).clientX : rect.left + 16,
      y: fromPointer ? (e as React.MouseEvent).clientY : rect.bottom,
    })
  }
  const closeRowMenu = (refocus: boolean) => {
    const id = rowMenu?.id
    setRowMenu(null)
    if (refocus && id !== undefined) focusRow(rowKey(id))
  }

  const onRowKey = (e: React.KeyboardEvent, row: TreeRow) => {
    // Keys typed in the rename field are the field's.
    if (e.target !== e.currentTarget) return
    if (e.key === 'F2' && row.id) {
      e.preventDefault()
      startRename(row.id)
      return
    }
    const action = treeKeyAction(rows, row.id, e.key)
    if (!action) return
    e.preventDefault()
    if ('focus' in action) focusRow(rowKey(action.focus))
    else if ('open' in action) setOpen(action.open, true)
    else if ('close' in action) setOpen(action.close, false)
    else go(action.go)
  }

  /** The row holding the tab stop: the one last focused, else where you are. */
  const tabKey = (() => {
    const keys = new Set(rows.map((r) => rowKey(r.id)))
    if (focusKey && keys.has(focusKey)) return focusKey
    return keys.has(rowKey(cwd)) ? rowKey(cwd) : 'root'
  })()

  // Real screenshots, keyed by the id of the screen they show.
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  // One cover screen per project, most recently touched first. Derived from
  // `projects` and not from the filtered list on purpose: typing in the search
  // box must not restart anything on every keystroke.
  const covers = useMemo(
    () =>
      [...projects]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .map((p) => p.screens[0])
        .filter((s): s is Screen => !!s && !!s.code && s.code.trim().length > 0),
    [projects],
  )

  /**
   * READ ONLY. This page never takes a picture.
   *
   * It used to, and that was the wrong place: a capture needs a short-lived
   * same-origin iframe, so every visit to the home page re-ran model-written
   * code with Mocky's own origin, once per project — a privileged operation as
   * a side effect of navigation. The picture is now taken in the project view,
   * right after a screen settles, where the user has just asked Mocky to run
   * that code anyway (see queueThumbs).
   *
   * What this page may do is READ: this device's cache first, then the pictures
   * another device sent to the server (server/thumbs.js). A project no device
   * has ever opened since simply keeps its drawn figure.
   */
  useEffect(() => {
    const cached: Record<string, string> = {}
    for (const s of covers) {
      const hit = getThumb(s.id, s.code)
      if (hit) cached[s.id] = hit
    }
    setThumbs(cached)
    pruneThumbs(projects.flatMap((p) => p.screens.map((s) => s.id)))
    let gone = false
    void reconcileRemoteThumbs(covers).then((remote) => {
      if (!gone && Object.keys(remote).length > 0) setThumbs((prev) => ({ ...remote, ...prev }))
    })
    return () => {
      gone = true
    }
  }, [covers, projects])

  const screenCount = (n: number) =>
    n === 0 ? t('projects.noScreens') : n === 1 ? t('projects.screens_one') : t('projects.screens_other', { count: n })

  const confirmDelete = (p: Project) => {
    if (confirm(t('projects.deleteConfirm', { name: headline(shownProjectName(p.name, t('projects.untitled'))) }))) onDelete(p.id)
  }

  /**
   * Delete every empty draft at once.
   *
   * They accumulate on their own — a "New project" click that went nowhere
   * leaves one behind — so clearing them one by one is housekeeping the app
   * created for the user. Nothing here holds a screen, which is why a single
   * confirmation is enough for the whole batch.
   */
  const clearEmpties = () => {
    if (empties.length === 0) return
    const message =
      empties.length === 1
        ? t('projects.clearEmptiesOne')
        : t('projects.clearEmptiesConfirm', { count: empties.length })
    if (!confirm(message)) return
    // deleteProject uses a functional setState, so a loop is safe: each call
    // sees the result of the previous one rather than a stale array.
    for (const p of empties) onDelete(p.id)
  }

  // ---- the side tree ------------------------------------------------------
  //
  // One flat list of rows with `aria-level`, not nested lists: the keyboard
  // walks rows in the order they are drawn, and the placeholder of a drop can
  // be slotted between any two of them.

  const indent = (depth: number) => 4 + Math.max(0, depth - 1) * 14

  /** Where a folder being dragged would land among the rows on show. */
  const ghost = (() => {
    if (!dragged || !('folder' in dragged) || dropOver?.verdict !== 'move') return null
    const target = dropOver.key === 'root' ? null : dropOver.key
    const moving = tree.get(dragged.folder)
    if (!moving) return null
    const index = insertionIndex(rows, tree, target, moving)
    if (index === null) return null
    const depth = (rows.find((r) => r.id === target)?.depth ?? 0) + 1
    return { index, depth, target, name: moving.name }
  })()

  const renderGhost = (g: NonNullable<typeof ghost>) => (
    // A drop zone for the same target: resting on the placeholder must not
    // make it vanish and the rows below it jump back up under the cursor.
    <div key="ghost" aria-hidden {...dropZone(g.target)} style={{ paddingLeft: indent(g.depth) }} className="flex min-h-8 items-center pr-1">
      <span className="w-5 shrink-0" />
      <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-dashed border-accent px-1.5 py-0.5 text-body-sm text-accent-ink">
        <Icon name="folder" size={13} className="shrink-0" />
        <span className="truncate">{g.name}</span>
      </span>
    </div>
  )

  /** Count, or what a drop here would do while a drag is over the row. */
  const rowTail = (target: string | null, count: number) => {
    const verdict = dropAt(target)
    if (verdict === 'move')
      return <span aria-hidden className="shrink-0 px-1 font-mono text-caption text-accent-ink">{t('projects.dropHere')}</span>
    if (verdict === 'refused')
      return <span aria-hidden className="shrink-0 px-1 font-mono text-caption text-danger">{t('projects.dropRefused')}</span>
    return <span aria-hidden className="shrink-0 px-1 font-mono text-caption text-ink-faint">{count}</span>
  }

  /** `+` and `⋯`: on hover and focus with a mouse, always under a finger. */
  const rowActions = (id: string | null) =>
    !dragged &&
    renamingId !== id && (
      <span className="hidden shrink-0 items-center group-hover:flex group-focus-visible:flex pointer-coarse:flex">
        <IconButton
          label={id ? t('projects.newSubfolder') : t('projects.newFolder')}
          variant="quiet"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            setNaming({ create: id })
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="text-ink-faint hover:text-accent-ink"
        >
          <Icon name="plus" size={14} />
        </IconButton>
        <IconButton
          label={t('projects.folderActions')}
          variant="quiet"
          tabIndex={-1}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation()
            openRowMenu(id, e)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="text-ink-faint hover:text-accent-ink"
        >
          <Icon name="more" size={14} />
        </IconButton>
      </span>
    )

  const rowProps = (row: TreeRow) => {
    const key = rowKey(row.id)
    return {
      role: 'treeitem',
      ref: (el: HTMLDivElement | null) => {
        if (el) rowRefs.current.set(key, el)
        else rowRefs.current.delete(key)
      },
      'aria-level': row.depth + 1,
      'aria-expanded': row.id !== null && row.hasKids ? row.open : undefined,
      'aria-selected': row.id === cwd && !(row.id === null && searching),
      tabIndex: tabKey === key ? 0 : -1,
      onFocus: (e: React.FocusEvent) => {
        if (e.target === e.currentTarget) setFocusKey(key)
      },
      onKeyDown: (e: React.KeyboardEvent) => onRowKey(e, row),
      onClick: () => go(row.id),
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        openRowMenu(row.id, e)
      },
    }
  }

  const renderRow = (row: TreeRow) => {
    if (row.id === null) {
      const here = cwd === null && !searching
      return (
        <div
          key="root"
          {...rowProps(row)}
          {...dropZone(null)}
          aria-label={`${t('projects.allProjects')}, ${t('projects.treeCount', { count: projects.length })}`}
          className={`group flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-1 text-body-sm outline-offset-[-2px] transition ${
            dropTone(dropAt(null)) || (here ? 'bg-ink/10 text-ink' : 'text-ink-muted hover:bg-ink/5')
          }`}
        >
          <Icon name="grid" size={15} className="ml-0.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t('projects.allProjects')}</span>
          {rowTail(null, projects.length)}
          {rowActions(null)}
        </div>
      )
    }
    const f = tree.get(row.id)
    if (!f) return null
    const here = cwd === f.id
    const count = stats.get(f.id)?.projects ?? 0
    return (
      <div
        key={f.id}
        {...rowProps(row)}
        {...dragFolder(f.id)}
        {...dropZone(f.id, row.hasKids && !row.open ? f.id : undefined)}
        aria-label={`${f.name}, ${t('projects.treeCount', { count })}`}
        onDoubleClick={() => startRename(f.id)}
        title={f.name}
        style={{ paddingLeft: indent(row.depth) }}
        className={`group flex min-h-8 cursor-pointer items-center gap-0.5 rounded-md pr-1 text-body-sm outline-offset-[-2px] transition ${
          carried({ folder: f.id }) ? 'opacity-40' : ''
        } ${dropTone(dropAt(f.id)) || (here ? 'bg-ink/10 text-ink' : 'text-ink-muted hover:bg-ink/5')}`}
      >
        {row.hasKids ? (
          // The pointer's way to open a folder without going into it. Not a
          // button: the row is the focusable thing, and the arrow keys are
          // the keyboard's way to do the same.
          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation()
              toggleOpen(f.id)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="flex h-6 w-5 shrink-0 items-center justify-center text-ink-faint hover:text-ink"
          >
            <Icon name={row.open ? 'chevronDown' : 'chevronRight'} size={12} />
          </span>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        {renamingId === f.id ? (
          <input
            autoFocus
            defaultValue={f.name}
            maxLength={FOLDER_NAME_MAX}
            aria-label={t('projects.folderName')}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                finishRename(f.id, e.currentTarget.value)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                finishRename(f.id, null)
              }
            }}
            onBlur={(e) => finishRename(f.id, e.currentTarget.value)}
            className="input min-w-0 flex-1 !py-0.5 text-body-sm"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate py-1">{f.name}</span>
        )}
        {renamingId !== f.id && rowTail(f.id, count)}
        {rowActions(f.id)}
      </div>
    )
  }

  const menuFolder = rowMenu?.id ? tree.get(rowMenu.id) : undefined

  const crumbs = cwd ? tree.pathOf(cwd) : []
  const subfolders = searching ? [] : tree.children(cwd)

  return (
    <div className="page py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <p className="kicker">{t('projects.contents')}</p>
          <h1 className="mt-1 text-h2 text-ink">{t('projects.title')}</h1>
          <p className="mt-1 text-body-sm text-ink-faint">
            {projects.length === 0 ? (
              t('projects.empty')
            ) : (
              <>
                <span className="font-mono text-accent-ink">{projects.length}</span>{' '}
                {t('projects.projectsWord')}
                {' · '}
                <span className="font-mono">{projects.reduce((n, p) => n + p.screens.length, 0)}</span>{' '}
                {t('projects.screensWord')}
              </>
            )}
          </p>
        </div>
        {/* Wraps: in French this row asks for more than a 390px phone leaves,
            and without a wrap every label breaks onto two lines in its box. */}
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 5 && (
            <label className="relative w-full sm:w-auto">
              <span className="sr-only">{t('projects.search')}</span>
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('projects.search')}
                className="w-full !py-1.5 pl-8 sm:w-56"
              />
            </label>
          )}
          {/* Two toggles for two answers (see SHELF_KEY): each one only exists
              at the widths whose shelf it governs. */}
          <span className="lg:hidden">
            <Button
              variant="ghost"
              active={shelf.narrow}
              aria-pressed={undefined}
              aria-expanded={shelf.narrow}
              aria-controls="projects-shelf"
              onClick={() => toggleShelf('narrow')}
            >
              <Icon name="list" size={16} />
              {t('projects.folders')}
            </Button>
          </span>
          <span className="hidden lg:inline">
            <IconButton
              label={shelf.wide ? t('projects.hideFolders') : t('projects.showFolders')}
              variant="ghost"
              size="md"
              active={shelf.wide}
              aria-pressed={undefined}
              aria-expanded={shelf.wide}
              aria-controls="projects-shelf"
              onClick={() => toggleShelf('wide')}
              className="!w-9"
            >
              <Icon name="list" size={16} />
            </IconButton>
          </span>
          <Button variant="ghost" onClick={() => setNaming({ create: cwd })}>
            <Icon name="folder" size={16} />
            {t('projects.newFolder')}
          </Button>
          {projects.length > 1 && (
            <Button variant={selecting ? 'primary' : 'ghost'} onClick={() => (selecting ? leaveSelection() : setSelecting(true))}>
              <Icon name={selecting ? 'close' : 'check'} size={16} />
              {selecting ? t('projects.selectDone') : t('projects.select')}
            </Button>
          )}
          <Button variant="primary" onClick={() => onCreate(cwd)}>
            <Icon name="plus" size={16} />
            {t('projects.new')}
          </Button>
        </div>
      </header>

      {/* ---- the selection bar ----
          Sticky, because the ticks are spread down a long page and the actions
          must not be somewhere you have to scroll back to. */}
      {selecting && (
        <div className="sticky top-2 z-20 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-raised px-3 py-2 shadow-lg">
          <span className="font-mono text-body-sm text-ink">
            {picked.size === 0
              ? t('projects.selectHint')
              : picked.size === 1
                ? t('projects.selected_one')
                : t('projects.selected_other', { count: picked.size })}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPicked(picked.size === visible.length ? new Set() : new Set(visible.map((p) => p.id)))
              }
            >
              {picked.size === visible.length && visible.length > 0
                ? t('projects.selectNone')
                : t('projects.selectAll')}
            </Button>
            <Button variant="ghost" size="sm" disabled={picked.size === 0} onClick={() => setMoving({ selection: true })}>
              <Icon name="folder" size={15} />
              {t('projects.moveTo')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={picked.size === 0}
              onClick={deletePicked}
              className="text-ink-faint hover:text-danger"
            >
              <Icon name="trash" size={15} />
              {t('projects.deleteSelected')}
            </Button>
          </div>
        </div>
      )}


      <div className={`grid gap-6 lg:gap-8 ${shelf.wide ? 'lg:grid-cols-[240px_minmax(0,1fr)]' : ''}`}>
        {/* The whole shelf: a place to go and a place to drop. A panel under
            the header on a narrow window, a sidebar from `lg`; either can be
            put away, and each remembers it for this viewer. */}
        <nav
          id="projects-shelf"
          aria-label={t('projects.folders')}
          className={`${shelf.narrow ? 'block' : 'hidden'} ${shelf.wide ? 'lg:block' : 'lg:hidden'} rounded-xl border border-line bg-surface p-1.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}
        >
          <div className="max-h-[60vh] overflow-y-auto lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
            <div role="tree" aria-label={t('projects.folders')} className="flex flex-col gap-px">
              {rows.flatMap((row, i) => {
                const drawn = renderRow(row)
                return ghost && ghost.index === i ? [renderGhost(ghost), drawn] : [drawn]
              })}
              {ghost && ghost.index === rows.length && renderGhost(ghost)}
            </div>
            {tree.all.length === 0 && (
              <p className="px-1.5 pt-2 text-body-sm text-ink-faint">{t('projects.treeEmptyHint')}</p>
            )}
          </div>
        </nav>

        <div className="min-w-0">
          {/* Where you are, and each step back is also a place to drop. */}
          <nav aria-label={t('projects.location')} className="mb-5 flex flex-wrap items-center gap-1 text-body-sm">
            <button
              type="button"
              {...dropZone(null)}
              onClick={() => go(null)}
              className={`rounded px-1.5 py-0.5 transition ${dropTone(dropAt(null)) || 'hover:bg-ink/5'} ${cwd === null ? 'text-ink' : 'text-ink-muted'}`}
            >
              {t('projects.allProjects')}
            </button>
            {crumbs.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <Icon name="chevronRight" size={12} className="text-ink-faint" />
                <button
                  type="button"
                  {...dropZone(f.id)}
                  onClick={() => go(f.id)}
                  aria-current={i === crumbs.length - 1 ? 'page' : undefined}
                  className={`rounded px-1.5 py-0.5 transition ${dropTone(dropAt(f.id)) || 'hover:bg-ink/5'} ${i === crumbs.length - 1 ? 'text-ink' : 'text-ink-muted'}`}
                >
                  {f.name}
                </button>
              </span>
            ))}
            {cwd && (
              <span className="ml-1 flex items-center">
                <IconButton label={t('projects.renameFolder')} variant="quiet" onClick={() => setNaming({ rename: tree.get(cwd) as Folder })} className="text-ink-faint hover:text-accent-ink">
                  <Icon name="pencil" size={14} />
                </IconButton>
                <IconButton label={t('projects.moveFolder')} variant="quiet" onClick={() => setMoving({ folder: cwd })} className="text-ink-faint hover:text-accent-ink">
                  <Icon name="folder" size={14} />
                </IconButton>
                <IconButton label={t('projects.deleteFolder')} variant="quiet" onClick={() => confirmDeleteFolder(tree.get(cwd) as Folder)} className="text-ink-faint hover:text-danger">
                  <Icon name="trash" size={14} />
                </IconButton>
              </span>
            )}
          </nav>

      {matched === 0 && query && (
        <p className="measure text-body text-ink-muted">{t('projects.noMatch', { q: query })}</p>
      )}

      {/* ---- the lead ----
          The project touched last, as a wide card: its picture large, its
          request beside it. It was a newspaper's front-page story — a display
          headline over a serif standfirst — and the redesign keeps the idea
          (the last project is the one you are most likely to reopen) without
          the newsprint. */}
      {lead && !searching && cwd === null && (
        <section className="mb-10" {...dragProject(lead)}>
          <p className="kicker mb-3">{t('projects.lead')}</p>

          <div className="group grid overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-ink/25 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="flex min-w-0 flex-col p-6">
              <div className="flex items-start gap-3">
                {selecting && (
                  <TickBox
                    checked={picked.has(lead.id)}
                    onChange={(on) => toggle(lead.id, on)}
                    label={t('projects.selectProject', { name: headline(shownProjectName(lead.name, t('projects.untitled'))) })}
                    className="mt-1.5"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onOpen(lead.id)}
                  aria-label={t('projects.openProject', { name: headline(shownProjectName(lead.name, t('projects.untitled'))) })}
                  className="block min-w-0 text-left"
                >
                  <h2 className="text-h2 text-ink transition group-hover:text-accent-ink">{headline(shownProjectName(lead.name, t('projects.untitled')))}</h2>
                </button>
              </div>
              {reviewStates[lead.id] && reviewStates[lead.id].status !== 'draft' && (
                <p className="mt-2">
                  <ReviewStatusPill status={reviewStates[lead.id].status} unread={reviewStates[lead.id].unread} />
                </p>
              )}
              {pathLabel(lead) && (
                <p className="mt-2 font-mono text-caption text-ink-faint">
                  {t('projects.inFolder', { name: pathLabel(lead) as string })}
                </p>
              )}
              {deckOf(lead) && <p className="measure mt-3 text-body text-ink-muted">{deckOf(lead)}</p>}
              <p className="mt-4 font-mono text-caption text-ink-faint">
                <span className="text-accent-ink">{screenCount(lead.screens.length)}</span>
                {' · '}
                {t('projects.updated', { when: timeAgo(lead.updatedAt) })}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-6">
                <Button variant="primary" size="sm" onClick={() => onOpen(lead.id)}>
                  {t('projects.open')}
                  <Icon name="chevronRight" size={16} />
                </Button>
                {/* Every card says where else it can go: a finger has no drag. */}
                <IconButton
                  label={t('projects.fileProject', { name: headline(shownProjectName(lead.name, t('projects.untitled'))) })}
                  variant="quiet"
                  onClick={() => setMoving({ project: lead.id })}
                  className="text-ink-faint hover:text-accent-ink"
                >
                  <Icon name="folder" size={16} />
                </IconButton>
                {onSaveTemplate && (
                  <IconButton
                    label={t('templates.saveProject', { name: headline(shownProjectName(lead.name, t('projects.untitled'))) })}
                    variant="quiet"
                    onClick={() => onSaveTemplate(lead.id)}
                    className="text-ink-faint hover:text-accent-ink"
                  >
                    <Icon name="template" size={16} />
                  </IconButton>
                )}
                <IconButton
                  label={t('projects.delete')}
                  variant="quiet"
                  onClick={() => confirmDelete(lead)}
                  className="text-ink-faint hover:text-danger"
                >
                  <Icon name="trash" size={16} />
                </IconButton>
              </div>
            </div>

            {/* Not a <button>: the title and "Open" already lead into the
                project, and a focusable element hidden from assistive
                technology is what the browser rightly complains about. This is
                decoration that happens to be clickable. */}
            <div onClick={() => onOpen(lead.id)} aria-hidden className="cursor-pointer border-t border-line-soft md:border-l md:border-t-0">
              <ProjectCover screens={lead.screens} thumbs={thumbs} className="aspect-[16/10] h-full md:aspect-auto md:min-h-[260px]" />
            </div>
          </div>
        </section>
      )}


      {subfolders.length > 0 && (
        <section className="mb-10">
          <div className="section-head">
            <span className="kicker">{t('projects.folders')}</span>
            <span className="ml-auto font-mono text-caption text-ink-faint">{subfolders.length}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subfolders.map((f) => {
              const st = stats.get(f.id)
              const minis = st?.covers ?? []
              return (
                <article
                  key={f.id}
                  {...dragFolder(f.id)}
                  {...dropZone(f.id)}
                  className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition ${
                    carried({ folder: f.id }) ? 'opacity-40' : ''
                  } ${
                    dropAt(f.id) === 'move'
                      ? 'border-accent ring-1 ring-accent'
                      : dropAt(f.id) === 'refused'
                        ? 'cursor-no-drop border-danger/60 ring-1 ring-danger/40'
                        : 'border-line hover:border-ink/25 focus-within:border-ink/25'
                  }`}
                >
                  <div onClick={() => go(f.id)} aria-hidden className="cursor-pointer">
                    {minis.length > 0 ? (
                      <div className="grid aspect-[16/7] grid-cols-3 gap-px border-b border-line-soft bg-line-soft">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="relative overflow-hidden bg-sunken">
                            {minis[i] && thumbs[minis[i].id] && (
                              <img src={thumbs[minis[i].id]} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[0_0]" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex aspect-[16/7] items-center justify-center border-b border-line-soft bg-sunken text-ink-faint">
                        <Icon name="folder" size={28} />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 items-start gap-1 p-3">
                    <button type="button" onClick={() => go(f.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-body font-semibold text-ink transition group-hover:text-accent-ink">{f.name}</span>
                      <span className="mt-1 block font-mono text-caption text-ink-faint">
                        {t('projects.folderStats', { folders: st?.folders ?? 0, projects: st?.projects ?? 0 })}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconButton label={t('projects.renameFolder')} variant="quiet" onClick={() => setNaming({ rename: f })} className="text-ink-faint hover:text-accent-ink">
                        <Icon name="pencil" size={15} />
                      </IconButton>
                      <IconButton label={t('projects.moveFolder')} variant="quiet" onClick={() => setMoving({ folder: f.id })} className="text-ink-faint hover:text-accent-ink">
                        <Icon name="folder" size={15} />
                      </IconButton>
                      <IconButton label={t('projects.deleteFolder')} variant="quiet" onClick={() => confirmDeleteFolder(f)} className="text-ink-faint hover:text-danger">
                        <Icon name="trash" size={15} />
                      </IconButton>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {shown.length > 0 && (
        <section className="mb-10">
          <div className="section-head">
            <span className="kicker">{searching ? t('projects.results') : t('projects.projectsHere')}</span>
            <span className="ml-auto font-mono text-caption text-ink-faint">{shown.length}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => {
              const deck = deckOf(p, 96)
              const where = searching ? pathLabel(p) : null
              // `min-w-0`: a grid item's default `min-width: auto` is its
              // min-content, and an untruncated deck once made a row 749px
              // wide inside a 375px phone.
              return (
                <article
                  key={p.id}
                  {...dragProject(p)}
                  className={`group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-ink/25 focus-within:border-ink/25 ${
                    carried({ project: p.id }) ? 'opacity-40' : ''
                  }`}
                >
                  {/* Decoration, not a control — the name already opens the
                      project. See the note on the lead's picture. */}
                  <div onClick={() => onOpen(p.id)} aria-hidden className="cursor-pointer">
                    <ProjectCover screens={p.screens} thumbs={thumbs} className="aspect-[16/10] border-b border-line-soft" />
                  </div>
                  {selecting && (
                    <TickBox
                      checked={picked.has(p.id)}
                      onChange={(on) => toggle(p.id, on)}
                      label={t('projects.selectProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                      className="absolute left-3 top-3"
                    />
                  )}
                  <div className="flex min-w-0 items-start gap-1 p-3">
                    <button
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="min-w-0 flex-1 text-left"
                      aria-label={t('projects.openProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                    >
                      <span className="block truncate text-body font-semibold text-ink transition group-hover:text-accent-ink">
                        {headline(shownProjectName(p.name, t('projects.untitled')))}
                      </span>
                      {deck && <span className="mt-0.5 block truncate text-body-sm text-ink-muted">{deck}</span>}
                      {where && <span className="mt-0.5 block truncate font-mono text-caption text-ink-faint">{t('projects.inFolder', { name: where })}</span>}
                      <span className="mt-2 block font-mono text-caption text-ink-faint">
                        <span className="text-accent-ink">{screenCount(p.screens.length)}</span>
                        {' · '}
                        {timeAgo(p.updatedAt)}
                      </span>
                      {reviewStates[p.id] && reviewStates[p.id].status !== 'draft' && (
                        <span className="mt-2 block">
                          <ReviewStatusPill status={reviewStates[p.id].status} unread={reviewStates[p.id].unread} />
                        </span>
                      )}
                    </button>
                    {/* Visible at rest, brighter on hover: a finger has no hover. */}
                    <div className="flex shrink-0 items-center opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconButton
                        label={t('projects.fileProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                        variant="quiet"
                        onClick={() => setMoving({ project: p.id })}
                        className="text-ink-faint hover:text-accent-ink"
                      >
                        <Icon name="folder" size={16} />
                      </IconButton>
                      {onSaveTemplate && (
                        <IconButton
                          label={t('templates.saveProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                          variant="quiet"
                          onClick={() => onSaveTemplate(p.id)}
                          className="text-ink-faint hover:text-accent-ink"
                        >
                          <Icon name="template" size={16} />
                        </IconButton>
                      )}
                      <IconButton
                        label={t('projects.delete')}
                        variant="quiet"
                        onClick={() => confirmDelete(p)}
                        className="text-ink-faint hover:text-danger"
                      >
                        <Icon name="trash" size={16} />
                      </IconButton>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {cwd && !searching && subfolders.length === 0 && shown.length === 0 && empties.length === 0 && (
        <p className="measure rounded-xl border border-dashed border-line px-4 py-10 text-center text-body-sm text-ink-faint">
          {t('projects.folderEmptyHint')}
        </p>
      )}

      {/* ---- abandoned drafts, out of the way ---- */}
      {empties.length > 0 && (
        <section>
          <div className="section-head">
            <span className="kicker">{t('projects.empties')}</span>
            <span className="ml-auto font-mono text-caption text-ink-faint">{empties.length}</span>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="measure text-body-sm text-ink-faint">{t('projects.emptiesHint')}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearEmpties}
              className="shrink-0 text-ink-faint hover:text-danger"
            >
              <Icon name="trash" size={15} />
              {t('projects.clearEmpties')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {empties.map((p) => (
              <span
                key={p.id}
                className="group inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-surface pl-2.5 text-body-sm text-ink-muted"
              >
                {selecting && (
                  <TickBox
                    checked={picked.has(p.id)}
                    onChange={(on) => toggle(p.id, on)}
                    label={t('projects.selectProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                  />
                )}
                <button type="button" onClick={() => onOpen(p.id)} className="transition hover:text-accent-ink">
                  {headline(shownProjectName(p.name, t('projects.untitled')))}
                </button>
                <span className="font-mono text-caption text-ink-faint">{timeAgo(p.updatedAt)}</span>
                <button
                  type="button"
                  onClick={() => setMoving({ project: p.id })}
                  aria-label={t('projects.fileProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                  title={t('projects.fileProject', { name: headline(shownProjectName(p.name, t('projects.untitled'))) })}
                  className="py-1 pl-1 text-ink-faint transition hover:text-accent-ink"
                >
                  <Icon name="folder" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(p)}
                  aria-label={t('projects.delete')}
                  className="px-2 py-1 text-ink-faint transition hover:text-danger"
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}


      {projects.length === 0 && (
        <button
          type="button"
          onClick={() => onCreate(cwd)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-12 text-body text-ink-muted transition hover:border-accent hover:text-accent-ink"
        >
          <Icon name="plus" size={18} />
          {t('projects.new')}
        </button>
      )}
        </div>
      </div>

      {moving && (
        <MoveDialog
          title={movingTitle}
          tree={tree}
          movingFolder={'folder' in moving ? moving.folder : null}
          onPick={applyMove}
          onClose={() => setMoving(null)}
        />
      )}

      {naming && (
        <NameDialog
          title={
            'rename' in naming
              ? t('projects.renameFolder')
              : naming.create && tree.get(naming.create)
                ? t('projects.newFolderIn', { name: tree.get(naming.create)?.name ?? '' })
                : t('projects.newFolder')
          }
          initial={'rename' in naming ? naming.rename.name : ''}
          action={'create' in naming ? t('projects.createFolder') : t('projects.renameFolder')}
          onSubmit={(name) => {
            if ('create' in naming) {
              onCreateFolder(name, naming.create)
              // The new folder is shown where it was made, not hidden under a closed parent.
              if (naming.create) setOpen(naming.create, true)
            } else onRenameFolder(naming.rename.id, name)
            setNaming(null)
          }}
          onClose={() => setNaming(null)}
        />
      )}

      {rowMenu && (
        <RowMenu
          x={rowMenu.x}
          y={rowMenu.y}
          label={menuFolder ? menuFolder.name : t('projects.allProjects')}
          onClose={closeRowMenu}
        >
          {menuFolder ? (
            <>
              <RowMenuItem
                icon="plus"
                label={t('projects.newSubfolder')}
                onClick={() => {
                  closeRowMenu(false)
                  setNaming({ create: menuFolder.id })
                }}
              />
              <RowMenuItem
                icon="pencil"
                label={t('projects.renameFolder')}
                hint="F2"
                onClick={() => {
                  closeRowMenu(false)
                  startRename(menuFolder.id)
                }}
              />
              <RowMenuItem
                icon="folder"
                label={t('projects.moveFolderEllipsis')}
                onClick={() => {
                  closeRowMenu(false)
                  setMoving({ folder: menuFolder.id })
                }}
              />
              <div className="my-1 border-t border-line-soft" role="separator" />
              <RowMenuItem
                icon="trash"
                label={t('projects.deleteFolder')}
                danger
                onClick={() => {
                  closeRowMenu(false)
                  confirmDeleteFolder(menuFolder)
                }}
              />
            </>
          ) : (
            <RowMenuItem
              icon="plus"
              label={t('projects.newFolder')}
              onClick={() => {
                closeRowMenu(false)
                setNaming({ create: null })
              }}
            />
          )}
        </RowMenu>
      )}
    </div>
  )
}

/**
 * A tree row's menu. Kept to the page rather than shared with the canvas's:
 * four entries, and its keyboard contract (arrows inside, Escape back to the
 * row it came from) is the tree's own.
 */
function RowMenu({
  x,
  y,
  label,
  onClose,
  children,
}: {
  x: number
  y: number
  label: string
  /** `true` when focus should go back to the row (Escape, Tab). */
  onClose: (refocus: boolean) => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const M = 8
    const up = y + height + M > window.innerHeight && y - height - M > 0
    setPos({
      left: Math.max(M, Math.min(x, window.innerWidth - width - M)),
      top: up ? y - height : Math.max(M, Math.min(y, window.innerHeight - height - M)),
    })
    el.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [x, y])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      onClose(true)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      items[(i + step + items.length) % items.length]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-menu"
        onClick={() => onClose(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose(false)
        }}
      />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="menu-in fixed z-menu w-max min-w-[13rem] max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-line bg-raised p-1 text-body-sm text-ink shadow-2xl"
        style={{ left: pos.left, top: pos.top }}
      >
        {children}
      </div>
    </>
  )
}

function RowMenuItem({
  icon,
  label,
  hint,
  danger = false,
  onClick,
}: {
  icon: React.ComponentProps<typeof Icon>['name']
  label: string
  /** A shortcut, printed at the end of the row. */
  hint?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className={`flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-body-sm transition hover:bg-ink/5 focus-visible:bg-ink/5 ${
        danger ? 'text-ink hover:text-danger' : 'text-ink hover:text-accent-ink'
      }`}
    >
      <Icon name={icon} size={15} className="shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">{label}</span>
      {hint && <span className="font-mono text-caption text-ink-faint">{hint}</span>}
    </button>
  )
}

/** Names a new folder, or renames one. */
function NameDialog({
  title,
  initial,
  action,
  onSubmit,
  onClose,
}: {
  title: string
  initial: string
  action: string
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [name, setName] = useState(initial)
  const clean = name.trim()
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (clean) onSubmit(clean)
        }}
      >
        <label className="block">
          <span className="mb-1 block font-mono text-caption text-ink-faint">{t('projects.folderName')}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projects.folderNamePlaceholder')}
            maxLength={FOLDER_NAME_MAX}
            autoFocus
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!clean}>
            {action}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Pick a place in the tree. A click is the answer: there is nothing else to
 * decide, and a confirm button after a list of destinations is one click too
 * many on an action that can be undone by doing it again.
 */
function MoveDialog({
  title,
  tree,
  movingFolder,
  onPick,
  onClose,
}: {
  title: string
  tree: FolderTree
  /** Set when a folder is what moves: it cannot go inside itself. */
  movingFolder: string | null
  onPick: (folderId: string | null) => void
  onClose: () => void
}) {
  const t = useT()
  const allowed = (id: string | null) => !movingFolder || canMoveFolder(tree, movingFolder, id)
  const rows: React.ReactNode[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const f of tree.children(parent)) {
      const ok = allowed(f.id)
      rows.push(
        <button
          key={f.id}
          type="button"
          disabled={!ok}
          onClick={() => onPick(f.id)}
          style={{ paddingLeft: 12 + depth * 16 }}
          className="flex w-full items-center gap-2 border-b border-line-soft py-2 pr-3 text-left text-body-sm text-ink transition last:border-b-0 hover:text-accent-ink disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          <Icon name="folder" size={15} className="shrink-0 text-ink-faint" />
          <span className="min-w-0 truncate">{f.name}</span>
        </button>,
      )
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="max-h-80 overflow-y-auto border border-line-soft">
        <button
          type="button"
          disabled={!allowed(null)}
          onClick={() => onPick(null)}
          className="flex w-full items-center gap-2 border-b border-line-soft px-3 py-2 text-left text-body-sm text-ink transition last:border-b-0 hover:text-accent-ink disabled:text-ink-faint"
        >
          <Icon name="grid" size={15} className="shrink-0 text-ink-faint" />
          {t('projects.allProjects')}
        </button>
        {rows}
      </div>
      {rows.length === 0 && <p className="measure mt-3 text-body-sm text-ink-faint">{t('projects.noFoldersYet')}</p>}
    </Modal>
  )
}
