import React, { useEffect, useMemo, useState } from 'react'
import { useTimeAgo } from '../lib/timeAgo'
import { headline, shownProjectName, type Project, type Screen } from '../lib/project'
import {
  buildFolderTree,
  canMoveFolder,
  FOLDER_NAME_MAX,
  folderStats,
  placeOf,
  type Folder,
  type FolderTree,
} from '../lib/folderTree'
import { getThumb, pruneThumbs, reconcileRemoteThumbs } from '../lib/thumbnails'
import { Button, Icon, IconButton, Input, Modal } from '../ui'
import { useT } from '../i18n'
import ReviewStatusPill from './ReviewStatusPill'
import type { ProjectReviewState } from '../lib/review'

/** Coming back from a project lands in the folder it was opened from. */
const CWD_KEY = 'mocky.home.folder'

/** What is being dragged. The page's own state: a drag never leaves this page. */
type Dragged = { projects: string[] } | { folder: string }

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
}) {
  const t = useT()
  const timeAgo = useTimeAgo()
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  /** The move dialog: for the ticked set, one project, or one folder. */
  const [moving, setMoving] = useState<{ selection: true } | { project: string } | { folder: string } | null>(null)
  /** The naming dialog: a new folder here, or a new name for this one. */
  const [naming, setNaming] = useState<{ create: true } | { rename: Folder } | null>(null)
  const [dragged, setDragged] = useState<Dragged | null>(null)
  const [dropOver, setDropOver] = useState<string | null>(null)

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

  /** Folders open in the side tree. The way down to where you are always is. */
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const openPath = useMemo(() => new Set(cwd ? tree.pathOf(cwd).map((f) => f.id) : []), [tree, cwd])
  const toggleOpen = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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

  const canDrop = (what: Dragged | null, target: string | null) => {
    if (!what) return false
    if ('folder' in what) return tree.parentOf(what.folder) !== target && canMoveFolder(tree, what.folder, target)
    return true
  }
  const drop = (target: string | null) => {
    if (dragged && canDrop(dragged, target)) {
      if ('folder' in dragged) onMoveFolder(dragged.folder, target)
      else onMoveProjects(dragged.projects, target)
    }
    setDragged(null)
    setDropOver(null)
  }
  /** What makes something a place to drop on. `null` is the top of the tree. */
  const dropZone = (target: string | null) => {
    const key = target ?? 'root'
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!canDrop(dragged, target)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dropOver !== key) setDropOver(key)
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setDropOver(null)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        drop(target)
      },
    }
  }
  const dropLit = (target: string | null) => dropOver === (target ?? 'root') && dragged != null
  const startDrag = (e: React.DragEvent, what: Dragged) => {
    // Firefox starts no drag without data, and the data is never read.
    e.dataTransfer.setData('text/plain', '')
    e.dataTransfer.effectAllowed = 'move'
    setDragged(what)
  }
  const dragProject = (p: Project) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) =>
      startDrag(e, { projects: picked.has(p.id) ? [...picked] : [p.id] }),
    onDragEnd: () => {
      setDragged(null)
      setDropOver(null)
    },
  })

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

  const renderTree = (parent: string | null, depth: number): React.ReactNode =>
    tree.children(parent).map((f) => {
      const kids = tree.children(f.id).length > 0
      const open = opened.has(f.id) || openPath.has(f.id)
      return (
        <li key={f.id}>
          <div
            {...dropZone(f.id)}
            style={{ paddingLeft: 4 + depth * 14 }}
            className={`flex items-center gap-0.5 rounded-md pr-1 transition ${
              dropLit(f.id) ? 'bg-accent/20' : cwd === f.id ? 'bg-ink/10' : 'hover:bg-ink/5'
            }`}
          >
            {kids ? (
              <button
                type="button"
                onClick={() => toggleOpen(f.id)}
                aria-expanded={open}
                aria-label={f.name}
                className="flex h-6 w-5 shrink-0 items-center justify-center text-ink-faint"
              >
                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => go(f.id)}
              aria-current={cwd === f.id ? 'true' : undefined}
              className={`min-w-0 flex-1 truncate py-1 text-left text-body-sm ${cwd === f.id ? 'text-ink' : 'text-ink-muted'}`}
              title={f.name}
            >
              {f.name}
            </button>
          </div>
          {kids && open && <ul>{renderTree(f.id, depth + 1)}</ul>}
        </li>
      )
    })

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
          <Button variant="ghost" onClick={() => setNaming({ create: true })}>
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


      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* The whole shelf, always visible: a place to go and a place to drop. */}
        <nav aria-label={t('projects.folders')} className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div
              {...dropZone(null)}
              className={`flex items-center rounded-md px-1 transition ${
                dropLit(null) ? 'bg-accent/20' : cwd === null && !searching ? 'bg-ink/10' : 'hover:bg-ink/5'
              }`}
            >
              <button
                type="button"
                onClick={() => go(null)}
                className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-body-sm ${cwd === null ? 'text-ink' : 'text-ink-muted'}`}
              >
                <Icon name="grid" size={15} />
                {t('projects.allProjects')}
              </button>
            </div>
            {folders.length > 0 && <ul className="mt-1">{renderTree(null, 0)}</ul>}
          </div>
        </nav>

        <div className="min-w-0">
          {/* Where you are, and each step back is also a place to drop. */}
          <nav aria-label={t('projects.location')} className="mb-5 flex flex-wrap items-center gap-1 text-body-sm">
            <button
              type="button"
              {...dropZone(null)}
              onClick={() => go(null)}
              className={`rounded px-1.5 py-0.5 transition ${dropLit(null) ? 'bg-accent/20' : 'hover:bg-ink/5'} ${cwd === null ? 'text-ink' : 'text-ink-muted'}`}
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
                  className={`rounded px-1.5 py-0.5 transition ${dropLit(f.id) ? 'bg-accent/20' : 'hover:bg-ink/5'} ${i === crumbs.length - 1 ? 'text-ink' : 'text-ink-muted'}`}
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
                  draggable
                  onDragStart={(e) => startDrag(e, { folder: f.id })}
                  onDragEnd={() => {
                    setDragged(null)
                    setDropOver(null)
                  }}
                  {...dropZone(f.id)}
                  className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition ${
                    dropLit(f.id) ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-ink/25 focus-within:border-ink/25'
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
                  className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-ink/25 focus-within:border-ink/25"
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
          title={'create' in naming ? t('projects.newFolder') : t('projects.renameFolder')}
          initial={'rename' in naming ? naming.rename.name : ''}
          action={'create' in naming ? t('projects.createFolder') : t('projects.renameFolder')}
          onSubmit={(name) => {
            if ('create' in naming) onCreateFolder(name, cwd)
            else onRenameFolder(naming.rename.id, name)
            setNaming(null)
          }}
          onClose={() => setNaming(null)}
        />
      )}
    </div>
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
