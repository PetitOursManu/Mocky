import { useEffect, useMemo, useState } from 'react'
import {
  FOLDER_MAX_LEN,
  groupByFolder,
  indexNumbers,
  headline,
  listFolders,
  normalizeFolder,
  type Project,
  type Screen,
} from '../lib/project'
import { getThumb, pruneThumbs, THUMB_REGION } from '../lib/thumbnails'
import { Button, Icon, IconButton, Input, Modal } from '../ui'
import { useT } from '../i18n'

/**
 * Key for the unfiled section's folded state.
 *
 * A sentinel and not `null`, because the folded set holds folder NAMES and a
 * real folder would otherwise be able to collide with it. A NUL cannot appear
 * in one — `normalizeFolder` trims and collapses whitespace, and a NUL is
 * neither — so the only way to produce this string is to write it out here.
 */
const UNFILED = '\u0000unfiled'

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
        className={`flex h-[18px] w-[18px] items-center justify-center border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-transparent'
        }`}
      >
        <Icon name="check" size={13} />
      </span>
    </label>
  )
}

function useTimeAgo() {
  const t = useT()
  return (ts: number): string => {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return t('time.justNow')
    const m = Math.floor(s / 60)
    if (m < 60) return t('time.minutes', { n: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('time.hours', { n: h })
    const d = Math.floor(h / 24)
    if (d < 7) return t('time.days', { n: d })
    return new Date(ts).toLocaleDateString()
  }
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
 * Display size of a thumbnail.
 *
 * The capture only covers the top THUMB_REGION.h of the screen, so the picture's
 * ratio is `w / (h * region.h)` — using the screen's own ratio would squash it.
 * The result is clamped: a phone screen is nearly square once cropped and would
 * otherwise tower over the row it sits in.
 */
function thumbBox(screen: Screen, width: number, minH: number, maxH: number) {
  const w = screen.w > 0 ? screen.w : 1024
  const h = screen.h > 0 ? screen.h : 720
  const ratio = w / Math.max(1, h * THUMB_REGION.h)
  return { width, height: Math.round(Math.min(maxH, Math.max(minH, width / ratio))) }
}

/**
 * The project's cover: its real screenshot when one has been captured, the
 * drawn rectangles until then. Never a hole — a project whose capture failed
 * still shows a figure of the right shape.
 */
function ProjectFigure({
  screens,
  thumbs,
  tall = false,
}: {
  screens: Screen[]
  thumbs: Record<string, string>
  tall?: boolean
}) {
  const cover = screens[0]
  const thumb = cover ? thumbs[cover.id] : undefined
  if (!thumb || !cover) return <ScreenFigure screens={screens} tall={tall} />
  // A 1440 px screen shown at 96 px was unreadable — generated screens open on
  // a pale header, so the whole thumbnail read as a white box. 480 px is stored
  // (see thumbnails.ts) so neither size is upscaled.
  const box = tall ? thumbBox(cover, 360, 130, 260) : thumbBox(cover, 132, 46, 104)
  return (
    <img
      src={thumb}
      alt=""
      aria-hidden
      decoding="async"
      width={box.width}
      height={box.height}
      style={{ width: box.width, height: box.height }}
      className="block max-w-full shrink-0 border border-line-soft bg-surface object-cover object-top"
    />
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
  onOpen,
  onCreate,
  onDelete,
  onSetFolder,
  onRenameFolder,
}: {
  projects: Project[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onSetFolder: (ids: string[], folder: string | null) => void
  onRenameFolder: (from: string, to: string) => void
}) {
  const t = useT()
  const timeAgo = useTimeAgo()
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  /** Open the filing dialog: for the ticked set, or for one project by id. */
  const [filing, setFiling] = useState<'selection' | string | null>(null)
  const [creating, setCreating] = useState(false)
  /** Section heads the user has folded away. Names, so a rename reopens it. */
  const [folded, setFolded] = useState<Set<string>>(new Set())

  const folders = useMemo(() => listFolders(projects), [projects])
  const folderNames = useMemo(() => folders.map((f) => f.name), [folders])

  const { lead, sections, counts, empties, matched, visible } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (p: Project) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.screens.some((s) => `${s.name} ${s.prompt}`.toLowerCase().includes(q))

    const found = projects.filter(matches)
    const byRecency = [...found].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    // A project with no screen is a draft someone abandoned — it must not take
    // the lead, and it should not crowd the ranked list either.
    const withScreens = byRecency.filter((p) => p.screens.length > 0)
    const without = byRecency.filter((p) => p.screens.length === 0)
    const head = withScreens[0] ?? null

    /*
     * The count on a section head counts the FOLDER, not the rows under it.
     *
     * Those two differ by one whenever the lead belongs to that folder, because
     * the lead is printed at the top of the page and not repeated in its
     * section. Counting rows made a folder holding three projects announce
     * itself as two, which reads as a bug — the head names a folder, so it has
     * to say how big that folder is.
     *
     * It counts the MATCHED projects rather than every project, so a search
     * narrows the numbers along with the lists instead of leaving them stale.
     */
    const counts = new Map<string, number>()
    for (const p of withScreens) {
      const key = normalizeFolder(p.folder) ?? UNFILED
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    return {
      lead: head,
      // The lead is already printed at the top; leaving it in its section too
      // would list it twice.
      sections: groupByFolder(withScreens.slice(1)),
      counts,
      empties: without,
      matched: found.length,
      visible: found,
    }
  }, [projects, query])

  const numbers = useMemo(() => indexNumbers(sections), [sections])

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

  /** Whichever projects the open filing dialog is about. */
  const filingTargets = useMemo(() => {
    if (filing === null) return []
    if (filing === 'selection') return pickedProjects
    const one = projects.find((p) => p.id === filing)
    return one ? [one] : []
  }, [filing, pickedProjects, projects])

  const applyFiling = (name: string | null) => {
    if (filingTargets.length === 0) return
    onSetFolder(
      filingTargets.map((p) => p.id),
      name,
    )
    const wasSelection = filing === 'selection'
    setFiling(null)
    if (wasSelection) leaveSelection()
  }

  const toggleFold = (name: string) =>
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // Real screenshots, keyed by the id of the screen they show.
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  // One cover screen per project — the first, i.e. the one whose prompt is the
  // lead's deck — most recently touched first. That order is also the capture
  // order, so the front of the page fills in before the tail. It is derived from
  // `projects` and not from the filtered list on purpose: typing in the search
  // box must not restart the queue on every keystroke.
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
   * A project whose screen has never been opened since simply keeps its drawn
   * figure, which is honest rather than empty.
   */
  useEffect(() => {
    const cached: Record<string, string> = {}
    for (const s of covers) {
      const hit = getThumb(s.id, s.code)
      if (hit) cached[s.id] = hit
    }
    setThumbs(cached)
    pruneThumbs(projects.flatMap((p) => p.screens.map((s) => s.id)))
  }, [covers, projects])

  const screenCount = (n: number) =>
    n === 0 ? t('projects.noScreens') : n === 1 ? t('projects.screens_one') : t('projects.screens_other', { count: n })

  const confirmDelete = (p: Project) => {
    if (confirm(t('projects.deleteConfirm', { name: headline(p.name) }))) onDelete(p.id)
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

  return (
    <div className="page py-8">
      <header className="rule-double mb-8 flex flex-wrap items-end justify-between gap-4 pb-3">
        <div>
          <p className="kicker text-accent-ink">{t('projects.contents')}</p>
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
        {/* Wraps, like the selection bar and the drafts row below already do.
            In French this row asks for 680px — "Nouveau dossier", "Sélectionner"
            and "Nouveau projet" beside a 224px search field — against the 342px
            a 390px phone leaves. Without a wrap the buttons did not overflow,
            they squeezed: every label broke onto two lines inside its own box,
            which is worse than a second row. */}
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 5 && (
            // Full width on its own line rather than squeezed beside the
            // buttons: this field was the only fixed width in the shell.
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
          {/* A folder is made here, in one dialog, without ticking anything
              first. The previous arrangement hid folder creation behind
              selection mode, which meant you had to already know folders
              existed to find out that they did. */}
          {projects.some((p) => p.screens.length > 0) && (
            <Button variant="ghost" onClick={() => setCreating(true)}>
              <Icon name="library" size={16} />
              {t('projects.newFolder')}
            </Button>
          )}
          {projects.length > 1 && (
            <Button variant={selecting ? 'primary' : 'ghost'} onClick={() => (selecting ? leaveSelection() : setSelecting(true))}>
              <Icon name={selecting ? 'close' : 'check'} size={16} />
              {selecting ? t('projects.selectDone') : t('projects.select')}
            </Button>
          )}
          <Button variant="primary" onClick={onCreate}>
            <Icon name="plus" size={16} />
            {t('projects.new')}
          </Button>
        </div>
      </header>

      {/* ---- the selection bar ----
          Sticky, because the ticks are spread down a long page and the actions
          must not be somewhere you have to scroll back to. */}
      {selecting && (
        <div className="sticky top-2 z-20 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border border-line bg-surface px-3 py-2 shadow-sm">
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
            <Button variant="ghost" size="sm" disabled={picked.size === 0} onClick={() => setFiling('selection')}>
              <Icon name="library" size={15} />
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

      {matched === 0 && query && (
        <p className="measure text-body text-ink-muted">{t('projects.noMatch', { q: query })}</p>
      )}

      {/* ---- the lead ---- */}
      {lead && (
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="kicker text-accent-ink">{t('projects.lead')}</span>
            <span className="h-px flex-1 bg-accent/40" />
            <span className="font-mono text-caption tabular-nums text-accent-ink">01</span>
          </div>

          <div className="group grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-start">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                {selecting && (
                  <TickBox
                    checked={picked.has(lead.id)}
                    onChange={(on) => toggle(lead.id, on)}
                    label={t('projects.selectProject', { name: headline(lead.name) })}
                    className="mt-2"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onOpen(lead.id)}
                  aria-label={t('projects.openProject', { name: lead.name })}
                  className="block max-w-3xl text-left"
                >
                  <h2 className="text-display text-ink transition group-hover:text-accent-ink">
                    {headline(lead.name)}
                  </h2>
                </button>
              </div>
              {normalizeFolder(lead.folder) && (
                <p className="mt-2 font-mono text-caption text-ink-faint">
                  {t('projects.inFolder', { name: normalizeFolder(lead.folder) as string })}
                </p>
              )}
              {deckOf(lead) && (
                <p className="measure mt-3 font-serif text-lead text-ink-muted">{deckOf(lead)}</p>
              )}
              <p className="mt-4 font-mono text-body-sm text-ink-faint">
                <span className="text-accent-ink">{screenCount(lead.screens.length)}</span>
                {' · '}
                {t('projects.updated', { when: timeAgo(lead.updatedAt) })}
              </p>
              <div className="mt-5 flex items-center gap-2">
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

            {/* Not a <button>. It was one, marked aria-hidden and tabIndex={-1}
                to keep it out of the tab order — but clicking still focused it,
                and the browser rightly complains that a focused element must not
                be hidden from assistive technology. The headline and the "Open"
                button already lead into the project; this is decoration, so it
                is a plain element that happens to be clickable. */}
            <div
              onClick={() => onOpen(lead.id)}
              aria-hidden
              className="hidden shrink-0 cursor-pointer md:block"
            >
              <ProjectFigure screens={lead.screens} thumbs={thumbs} tall />
            </div>
          </div>
        </section>
      )}

      {/* ---- the index, cut into sections ----
          Three columns of name-plus-date read as a spreadsheet: twenty rows of
          identical grey, nothing to tell one project from another, and the
          request that actually produced each screen nowhere in sight. A
          newspaper index does the opposite — it numbers its entries, gives each
          a line of standfirst, and rules them off. Two columns leave room for
          that line; the numbers give the page a rhythm the old grid had none of,
          and they continue the lead's 01.

          Folders are the SECTIONS of that index rather than a filter above it.
          A filter shows one folder and hides the rest, so the shape of the whole
          is never visible and a folder you are not looking at may as well not
          exist — which is exactly how the first attempt failed. Sections show
          every folder at once, in the page's own existing vocabulary: a kicker,
          a rule, a count. They fold away when there are too many. */}
      {sections.map(({ folder: name, projects: ps }) => {
        // The unfiled group is not a folder, so it cannot be keyed by its name.
        const key = name ?? UNFILED
        const shut = folded.has(key)
        return (
          <section key={key} className="mb-10">
            <div className="section-head">
              <button
                type="button"
                onClick={() => toggleFold(key)}
                aria-expanded={!shut}
                className="-ml-1 inline-flex items-center gap-1.5 px-1 py-0.5 text-left transition hover:text-accent-ink"
              >
                <Icon
                  name={shut ? 'chevronRight' : 'chevronDown'}
                  size={14}
                  className="text-ink-faint"
                />
                <span className="kicker text-accent-ink">
                  {name ?? t('projects.unfiled')}
                </span>
              </button>
              {name && (
                <IconButton
                  label={t('projects.renameFolder')}
                  variant="quiet"
                  onClick={() => {
                    const next = prompt(t('projects.renameFolderPrompt', { name }), name)
                    if (next != null) onRenameFolder(name, next)
                  }}
                  className="text-ink-faint hover:text-accent-ink"
                >
                  <Icon name="pencil" size={14} />
                </IconButton>
              )}
              <span className="ml-auto font-mono text-caption text-ink-faint">{counts.get(key) ?? ps.length}</span>
            </div>

            {/* `divide-x` draws the column rule — the device that makes a grid of
                text read as a page rather than as cards. */}
            {!shut && (
              <div className="grid gap-x-10 xl:grid-cols-2 xl:divide-x xl:divide-line-soft">
                {ps.map((p) => {
                  const deck = deckOf(p, 96)
                  return (
                    <article
                      key={p.id}
                      className="group flex items-start gap-4 border-b border-line-soft py-4 xl:px-6 xl:first:pl-0"
                    >
                      {/* The entry number, as an index has. `tabular-nums` keeps
                          the column of digits straight; `padStart` keeps 02 above
                          12. In selection mode the tick box takes its place
                          rather than sitting beside it: two markers in the same
                          gutter would push the column out of line with the lead. */}
                      {selecting ? (
                        <TickBox
                          checked={picked.has(p.id)}
                          onChange={(on) => toggle(p.id, on)}
                          label={t('projects.selectProject', { name: headline(p.name) })}
                          className="mt-1 w-6"
                        />
                      ) : (
                        <span className="mt-1 w-6 shrink-0 font-mono text-caption tabular-nums text-ink-faint transition group-hover:text-accent-ink">
                          {String(numbers.get(p.id) ?? 0).padStart(2, '0')}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpen(p.id)}
                        className="min-w-0 flex-1 text-left"
                        aria-label={t('projects.openProject', { name: headline(p.name) })}
                      >
                        <span className="block truncate font-serif text-body font-medium text-ink transition group-hover:text-accent-ink">
                          {headline(p.name)}
                        </span>
                        {deck && (
                          <span className="mt-1 block truncate text-body-sm text-ink-muted">{deck}</span>
                        )}
                        <span className="mt-1.5 block font-mono text-caption text-ink-faint">
                          <span className="text-accent-ink">{screenCount(p.screens.length)}</span>
                          {' · '}
                          {timeAgo(p.updatedAt)}
                        </span>
                      </button>

                      {/* Decoration, not a control — the headline already opens
                          the project. See the note on the lead's figure. */}
                      <div onClick={() => onOpen(p.id)} aria-hidden className="hidden shrink-0 cursor-pointer sm:block">
                        <ProjectFigure screens={p.screens} thumbs={thumbs} />
                      </div>

                      {/* Filing one project takes one click from here. It used to
                          take four — enter selection mode, tick, open the dialog,
                          choose — which meant you had to already know folders
                          existed in order to discover that they did. */}
                      <IconButton
                        label={t('projects.fileProject', { name: headline(p.name) })}
                        variant="quiet"
                        onClick={() => setFiling(p.id)}
                        className="shrink-0 text-ink-faint hover:text-accent-ink"
                      >
                        <Icon name="library" size={16} />
                      </IconButton>

                      <IconButton
                        label={t('projects.delete')}
                        variant="quiet"
                        onClick={() => confirmDelete(p)}
                        className="-mr-1 shrink-0 text-ink-faint transition hover:text-danger"
                      >
                        <Icon name="trash" size={16} />
                      </IconButton>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

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
                className="group inline-flex min-h-8 items-center gap-1.5 border border-line-soft pl-2.5 text-body-sm text-ink-muted"
              >
                {selecting && (
                  <TickBox
                    checked={picked.has(p.id)}
                    onChange={(on) => toggle(p.id, on)}
                    label={t('projects.selectProject', { name: headline(p.name) })}
                  />
                )}
                <button type="button" onClick={() => onOpen(p.id)} className="transition hover:text-accent-ink">
                  {headline(p.name)}
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
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 border border-dashed border-line-soft py-10 text-body text-ink-muted transition hover:border-accent hover:text-accent-ink"
        >
          <Icon name="plus" size={18} />
          {t('projects.new')}
        </button>
      )}

      {filing !== null && filingTargets.length > 0 && (
        <FileIntoFolder
          count={filingTargets.length}
          only={filingTargets.length === 1 ? headline(filingTargets[0].name) : null}
          folders={folderNames}
          anyFiled={filingTargets.some((p) => !!normalizeFolder(p.folder))}
          onPick={applyFiling}
          onClose={() => setFiling(null)}
        />
      )}

      {creating && (
        <NewFolder
          candidates={projects.filter((p) => p.screens.length > 0)}
          existing={folderNames}
          onCreate={(name, ids) => {
            onSetFolder(ids, name)
            setCreating(false)
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

/**
 * Make a folder and put projects in it, in one dialog.
 *
 * This exists because the first version had no such step: the only way to make a
 * folder was to enter selection mode, tick something, open "File" and type a
 * name — which meant you had to already know folders existed in order to find
 * out that they did.
 *
 * It asks for the projects at the same time as the name because it has to. A
 * folder here IS the projects filed under it (see `Project.folder`), so an empty
 * one cannot be stored and would vanish on the next reload. Naming and filling
 * are one action rather than two, and nothing is left dangling.
 */
function NewFolder({
  candidates,
  existing,
  onCreate,
  onClose,
}: {
  candidates: Project[]
  existing: string[]
  onCreate: (name: string, ids: string[]) => void
  onClose: () => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const clean = normalizeFolder(name)
  const taken = !!clean && existing.some((e) => e.localeCompare(clean, undefined, { sensitivity: 'base' }) === 0)

  return (
    <Modal
      title={t('projects.newFolder')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!clean || chosen.size === 0}
            onClick={() => clean && onCreate(clean, [...chosen])}
          >
            {t('projects.createFolder')}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1 block font-mono text-caption text-ink-faint">{t('projects.folderName')}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.folderNamePlaceholder')}
          maxLength={FOLDER_MAX_LEN}
          autoFocus
        />
      </label>
      {taken && <p className="mt-1.5 text-body-sm text-ink-muted">{t('projects.folderExists')}</p>}

      <p className="measure mt-5 text-body-sm text-ink-muted">{t('projects.newFolderHint')}</p>

      <div className="mt-3 max-h-64 overflow-y-auto border border-line-soft">
        {candidates.map((p) => {
          const current = normalizeFolder(p.folder)
          return (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0 transition hover:text-accent-ink"
            >
              <TickBox
                checked={chosen.has(p.id)}
                onChange={(on) =>
                  setChosen((prev) => {
                    const next = new Set(prev)
                    if (on) next.add(p.id)
                    else next.delete(p.id)
                    return next
                  })
                }
                label={t('projects.selectProject', { name: headline(p.name) })}
              />
              <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{headline(p.name)}</span>
              {/* Where it is now, so moving it out of another folder is a
                  deliberate act rather than a surprise. */}
              {current && (
                <span className="shrink-0 font-mono text-caption text-ink-faint">
                  {t('projects.inFolder', { name: current })}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </Modal>
  )
}

/**
 * Pick a folder for the ticked projects, or take them out of one.
 *
 * There is no "create folder" step anywhere else in the app, and there does not
 * need to be: naming one here is what creates it. That is the whole point of
 * storing the name on the project — a folder is the projects in it, so an empty
 * one cannot exist and does not have to be cleaned up.
 */
function FileIntoFolder({
  count,
  only,
  folders,
  anyFiled,
  onPick,
  onClose,
}: {
  count: number
  /** The project name when there is exactly one — a title beats a tally. */
  only: string | null
  folders: string[]
  anyFiled: boolean
  onPick: (name: string | null) => void
  onClose: () => void
}) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const clean = normalizeFolder(draft)

  return (
    <Modal title={only ? t('projects.fileOne', { name: only }) : t('projects.moveToTitle', { count })} onClose={onClose} size="sm">
      <p className="measure text-body-sm text-ink-muted">{t('projects.moveToHint')}</p>

      {folders.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {folders.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onPick(name)}
              className="inline-flex min-h-8 items-center border border-line-soft px-2.5 text-body-sm text-ink transition hover:border-accent hover:text-accent-ink"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (clean) onPick(clean)
        }}
      >
        <label className="flex-1">
          <span className="mb-1 block font-mono text-caption text-ink-faint">{t('projects.newFolder')}</span>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('projects.folderNamePlaceholder')}
            maxLength={FOLDER_MAX_LEN}
            aria-label={t('projects.folderName')}
            autoFocus
          />
        </label>
        <Button type="submit" variant="primary" disabled={!clean}>
          {t('projects.moveTo')}
        </Button>
      </form>

      {anyFiled && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-4 inline-flex items-center gap-1.5 text-body-sm text-ink-faint transition hover:text-danger"
        >
          <Icon name="close" size={14} />
          {t('projects.removeFromFolder')}
        </button>
      )}
    </Modal>
  )
}
