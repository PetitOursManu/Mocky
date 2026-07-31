import { useEffect, useMemo, useState } from 'react'
import { headline, type Project, type Screen } from '../lib/project'
import { getThumb, pruneThumbs, THUMB_REGION } from '../lib/thumbnails'
import { Button, Icon, IconButton, Input } from '../ui'
import { useT } from '../i18n'


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
}: {
  projects: Project[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  const t = useT()
  const timeAgo = useTimeAgo()
  const [query, setQuery] = useState('')

  const { lead, rest, empties, matched } = useMemo(() => {
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
    return { lead: withScreens[0] ?? null, rest: withScreens.slice(1), empties: without, matched: found.length }
  }, [projects, query])

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
        <div className="flex items-center gap-2">
          {projects.length > 5 && (
            <label className="relative">
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
                className="w-56 !py-1.5 pl-8"
              />
            </label>
          )}
          <Button variant="primary" onClick={onCreate}>
            <Icon name="plus" size={16} />
            {t('projects.new')}
          </Button>
        </div>
      </header>

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

      {/* ---- the register ----
          Three columns of name-plus-date read as a spreadsheet: twenty rows of
          identical grey, nothing to tell one project from another, and the
          request that actually produced each screen nowhere in sight. A
          newspaper index does the opposite — it numbers its entries, gives each
          a line of standfirst, and rules them off. Two columns leave room for
          that line; the numbers give the page a rhythm the old grid had none of,
          and they continue the lead's 01. */}
      {rest.length > 0 && (
        <section className="mb-10">
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('projects.recent')}</span>
            <span className="ml-auto font-mono text-caption text-ink-faint">{rest.length}</span>
          </div>

          {/* `divide-x` draws the column rule — the device that makes a grid of
              text read as a page rather than as cards. */}
          <div className="grid gap-x-10 xl:grid-cols-2 xl:divide-x xl:divide-line-soft">
            {rest.map((p, i) => {
              const deck = deckOf(p, 96)
              return (
                <article
                  key={p.id}
                  className="group flex items-start gap-4 border-b border-line-soft py-4 xl:px-6 xl:first:pl-0"
                >
                  {/* The entry number, as an index has. `tabular-nums` keeps the
                      column of digits straight; `padStart` keeps 02 above 12. */}
                  <span className="mt-1 w-6 shrink-0 font-mono text-caption tabular-nums text-ink-faint transition group-hover:text-accent-ink">
                    {String(i + 2).padStart(2, '0')}
                  </span>

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

                  {/* Decoration, not a control — the headline already opens the
                      project. See the note on the lead's figure. */}
                  <div onClick={() => onOpen(p.id)} aria-hidden className="hidden shrink-0 cursor-pointer sm:block">
                    <ProjectFigure screens={p.screens} thumbs={thumbs} />
                  </div>

                  <IconButton
                    label={t('projects.delete')}
                    variant="quiet"
                    onClick={() => confirmDelete(p)}
                    className="-mr-1 shrink-0 text-ink-faint opacity-0 transition hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <Icon name="trash" size={16} />
                  </IconButton>
                </article>
              )
            })}
          </div>
        </section>
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
                className="group inline-flex min-h-8 items-center gap-1.5 border border-line-soft pl-2.5 text-body-sm text-ink-muted"
              >
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
    </div>
  )
}
