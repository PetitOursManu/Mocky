import { useMemo, useState } from 'react'
import type { Project, Screen } from '../lib/project'
import { Button, Icon, IconButton, Input } from '../ui'
import { useT } from '../i18n'

/**
 * The front page.
 *
 * It used to be a flat two-column list where every entry looked identical and
 * each thumbnail showed the string `componentName` — which is always "App", so
 * sixteen projects displayed the word "App" twenty times and told you nothing.
 *
 * A newspaper front page does the opposite: one lead story set large, the rest
 * ranked beneath it, and empty drafts pushed out of the way. The lead's deck is
 * the prompt that created its first screen — real content, and far more use
 * than a placeholder.
 */

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
 * Screens drawn as proportional rectangles.
 *
 * Deliberately not live previews: sixteen projects would mean sixteen iframes
 * each booting React, Babel and Tailwind. The real width/height ratio and the
 * device type are honest information, and they cost nothing.
 */
function ScreenFigure({ screens, tall = false }: { screens: Screen[]; tall?: boolean }) {
  const shown = screens.slice(0, tall ? 5 : 3)
  const box = tall ? 76 : 40
  return (
    <span className="flex items-end gap-1.5" aria-hidden>
      {shown.map((s) => {
        const ratio = s.w > 0 && s.h > 0 ? s.w / s.h : 4 / 3
        const h = box
        const w = Math.max(10, Math.min(box * 1.6, Math.round(h * ratio)))
        return (
          <span
            key={s.id}
            style={{ width: w, height: h }}
            className={`block border border-line-soft bg-surface ${s.device === 'iphone' ? 'rounded-[3px]' : ''}`}
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

/** The deck under a lead headline: the request that produced the first screen. */
function deckOf(p: Project): string | null {
  const withPrompt = p.screens.find((s) => s.prompt?.trim())
  if (!withPrompt) return null
  const clean = withPrompt.prompt.trim().replace(/\s+/g, ' ')
  return clean.length > 180 ? clean.slice(0, 180) + '…' : clean
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

  const screenCount = (n: number) =>
    n === 0 ? t('projects.noScreens') : n === 1 ? t('projects.screens_one') : t('projects.screens_other', { count: n })

  const confirmDelete = (p: Project) => {
    if (confirm(t('projects.deleteConfirm', { name: p.name }))) onDelete(p.id)
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
          </div>

          <div className="group grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-start">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(lead.id)}
                aria-label={t('projects.openProject', { name: lead.name })}
                className="block max-w-3xl text-left"
              >
                <h2 className="text-display text-ink transition group-hover:text-accent-ink">{lead.name}</h2>
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

            <button
              type="button"
              onClick={() => onOpen(lead.id)}
              tabIndex={-1}
              aria-hidden
              className="hidden shrink-0 md:block"
            >
              <ScreenFigure screens={lead.screens} tall />
            </button>
          </div>
        </section>
      )}

      {/* ---- the ranked list, in newspaper columns ---- */}
      {rest.length > 0 && (
        <section className="mb-10">
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('projects.recent')}</span>
            <span className="ml-auto font-mono text-caption text-ink-faint">{rest.length}</span>
          </div>

          {/* `divide-x` draws the column rule between columns — the device that
              makes a grid of text read as a page rather than as cards. */}
          <div className="grid gap-x-8 lg:grid-cols-2 lg:divide-x lg:divide-line-soft xl:grid-cols-3">
            {rest.map((p) => (
              <div key={p.id} className="group flex items-center gap-3 border-b border-line-soft py-3 lg:px-4 lg:first:pl-0">
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ScreenFigure screens={p.screens} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink transition group-hover:text-accent-ink">
                      {p.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-caption text-ink-faint">
                      {screenCount(p.screens.length)} · {timeAgo(p.updatedAt)}
                    </span>
                  </span>
                </button>
                <IconButton
                  label={t('projects.delete')}
                  variant="quiet"
                  onClick={() => confirmDelete(p)}
                  className="text-ink-faint opacity-0 transition hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Icon name="trash" size={16} />
                </IconButton>
              </div>
            ))}
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
          <p className="measure mb-3 text-body-sm text-ink-faint">{t('projects.emptiesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {empties.map((p) => (
              <span
                key={p.id}
                className="group inline-flex min-h-8 items-center gap-1.5 border border-line-soft pl-2.5 text-body-sm text-ink-muted"
              >
                <button type="button" onClick={() => onOpen(p.id)} className="transition hover:text-accent-ink">
                  {p.name}
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
