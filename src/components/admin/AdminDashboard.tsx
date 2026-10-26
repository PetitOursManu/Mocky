import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Icon, type IconName } from '../../ui'
import { useT } from '../../i18n'
import type { AuthUser } from '../../lib/api'
import { useDashboard, type LiveStatus } from './useDashboard'
import OverviewSection from './OverviewSection'
import ActivitySection from './ActivitySection'
import UsersSection from './UsersSection'
import SessionsSection from './SessionsSection'
import SystemSection from './SystemSection'
import ProvidersSection from './ProvidersSection'
import AuditSection from './AuditSection'
import AnnouncementSection from './AnnouncementSection'
import AssistantsSection from './AssistantsSection'
import SpendSection from './SpendSection'
import MigrationSettings from '../MigrationSettings'

export type SectionId =
  | 'overview'
  | 'activity'
  | 'users'
  | 'sessions'
  | 'system'
  | 'providers'
  | 'spend'
  | 'audit'
  | 'announcement'
  | 'assistants'
  | 'maintenance'

const SECTIONS: Array<{ id: SectionId; icon: IconName }> = [
  { id: 'overview', icon: 'grid' },
  { id: 'activity', icon: 'pulse' },
  { id: 'users', icon: 'user' },
  { id: 'sessions', icon: 'key' },
  { id: 'system', icon: 'cpu' },
  { id: 'providers', icon: 'plug' },
  { id: 'spend', icon: 'coins' },
  { id: 'audit', icon: 'list' },
  { id: 'announcement', icon: 'megaphone' },
  { id: 'assistants', icon: 'link' },
  { id: 'maintenance', icon: 'settings' },
]

/** Remembered per browser: an admin who lives on "System" should land there. */
const SECTION_KEY = 'mocky.admin.section'

function loadSection(): SectionId {
  try {
    const v = localStorage.getItem(SECTION_KEY)
    if (SECTIONS.some((s) => s.id === v)) return v as SectionId
  } catch {
    /* private mode */
  }
  return 'overview'
}

/**
 * Admin, as one page with a menu on the left.
 *
 * It replaced a single long scroll — access, accounts, usage, three provider
 * blocks and the migration, in that order, 5,000 px tall — where the thing an
 * admin came for was always somewhere below the thing they did not. A menu
 * makes every part one click away, and the live parts (who is here, what the
 * machine is doing) get a screen of their own instead of a paragraph.
 *
 * One page still: the sections are views of the SAME live stream, opened once
 * here and handed down, so moving between them costs no request and loses no
 * history. The settings blocks (providers, Motion Ultra, maintenance) are the
 * components that were already there, mounted unchanged.
 */
export default function AdminDashboard({
  currentUsername,
  onAccountChange,
}: {
  currentUsername: string
  /** The signed-in administrator's own account changed (Users → test plan). */
  onAccountChange?: (user: AuthUser) => void
}) {
  const t = useT()
  const [section, setSection] = useState<SectionId>(loadSection)
  /** The phone's dropdown of panels. */
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])
  const live = useDashboard()
  const d = live.data
  const rootRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_KEY, section)
    } catch {
      /* a convenience only */
    }
    // A card at the bottom of the overview opens a section; without this the
    // new section appears scrolled to where the old one was.
    if (!firstRender.current && rootRef.current && rootRef.current.getBoundingClientRect().top < 0) {
      rootRef.current.scrollIntoView({ block: 'start' })
    }
    firstRender.current = false
  }, [section])

  /** What each menu entry says without being opened. Words, never a lone dot. */
  function badge(id: SectionId): { text: string; tone: 'accent' | 'warn' | 'danger' } | null {
    if (!d) return null
    switch (id) {
      case 'activity':
        return d.counts.working > 0 ? { text: String(d.counts.working), tone: 'accent' } : null
      case 'users':
        return d.counts.online > 0 ? { text: String(d.counts.online), tone: 'accent' } : null
      case 'providers': {
        const failing = d.health.filter((h) => (h.errorRate ?? 0) >= 0.2 && h.errors >= 2).length
        return failing ? { text: String(failing), tone: 'danger' } : null
      }
      case 'announcement':
        return d.announcement
          ? { text: t(d.announcement.status === 'scheduled' ? 'dashboard.nav.scheduled' : 'dashboard.nav.on'), tone: 'accent' }
          : null
      case 'maintenance':
        return d.maintenance.on ? { text: t('dashboard.nav.on'), tone: 'warn' } : null
      default:
        return null
    }
  }

  /** The menu's rows: the column from md, the phone's dropdown below it. */
  const navRows = (pick: (id: SectionId) => void) =>
    SECTIONS.map((s) => {
      const active = s.id === section
      const b = badge(s.id)
      return (
        <li key={s.id} className="shrink-0">
          <button
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => pick(s.id)}
            className={
              // A rounded row, as the inspector's tabs and the screen menu draw theirs.
              'tap-target mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-left text-body-sm transition ' +
              (active ? 'bg-selected text-on-selected' : 'text-ink-muted hover:bg-ink/5 hover:text-ink')
            }
          >
            <Icon name={s.icon} size={18} />
            <span className="flex-1">{t(`dashboard.nav.${s.id}`)}</span>
            {b && (
              <span
                className={
                  'min-w-5 px-1.5 text-center font-mono text-caption ' +
                  (active
                    ? 'bg-surface text-ink'
                    : b.tone === 'danger'
                      ? 'bg-danger text-on-danger'
                      : b.tone === 'warn'
                        ? 'bg-warn/15 text-warn'
                        : 'bg-accent/10 text-accent-ink')
                }
              >
                {b.text}
              </span>
            )}
          </button>
        </li>
      )
    })

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const currentBadge = badge(current.id)

  const body = (() => {
    switch (section) {
      case 'overview':
        return <OverviewSection live={live} go={setSection} />
      case 'activity':
        return <ActivitySection live={live} />
      case 'users':
        return <UsersSection live={live} currentUsername={currentUsername} onAccountChange={onAccountChange} />
      case 'sessions':
        return <SessionsSection />
      case 'system':
        return <SystemSection live={live} />
      case 'providers':
        return <ProvidersSection live={live} />
      case 'spend':
        return <SpendSection />
      case 'audit':
        return <AuditSection />
      case 'announcement':
        return <AnnouncementSection live={live} />
      case 'assistants':
        return <AssistantsSection />
      case 'maintenance':
        return <MigrationSettings />
    }
  })()

  return (
    // Clipped from md only: below it the panel dropdown hangs out of the nav, and
    // on a short panel the card's clip cut the list off half way.
    <div ref={rootRef} className="rounded-2xl border border-line bg-surface md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:overflow-clip">
      {/* Below md the nav is a bar that STICKS to the top of the window while
          a panel scrolls under it. It was a strip of tabs at the top of the
          card: scroll a long panel and the only way to the other ten was to
          scroll all the way back up to a row that, at 375px, showed two and a
          half entries and gave no sign there were more. People did not find
          them. */}
      <nav
        aria-label={t('dashboard.nav.label')}
        className="sticky top-0 z-10 rounded-t-2xl border-b border-line bg-surface md:static md:rounded-none md:border-b-0 md:border-r md:bg-transparent"
      >
        {/* Below md, a dropdown of our own: one control that SAYS which panel is
            open and, tapped, unfolds the same rows as the column — icons and
            badges included. It was a native select, whose Android picker is a
            system dialog of plain words that looked like nothing else here. */}
        <div className="relative md:hidden">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              aria-expanded={navOpen}
              aria-haspopup="true"
              aria-label={t('dashboard.nav.label')}
              onClick={() => setNavOpen((v) => !v)}
              className="tap-target flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-raised px-3 py-2 text-left text-body-sm text-ink transition hover:border-ink/25"
            >
              <Icon name={current.icon} size={18} className="shrink-0 text-accent-ink" />
              <span className="min-w-0 flex-1 truncate font-medium">{t(`dashboard.nav.${current.id}`)}</span>
              {currentBadge && <span className="font-mono text-caption text-accent-ink">{currentBadge.text}</span>}
              <Icon name="chevronDown" size={16} className={`shrink-0 text-ink-faint transition-transform ${navOpen ? 'rotate-180' : ''}`} />
            </button>
            <LiveBadge status={live.status} compact />
          </div>
          {navOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setNavOpen(false)} />
              <ul className="absolute inset-x-0 top-full z-20 max-h-[70dvh] overflow-y-auto border-b border-line bg-surface py-2 shadow-2xl">
                {navRows((id) => {
                  setSection(id)
                  setNavOpen(false)
                })}
              </ul>
            </>
          )}
        </div>
        <div className="hidden md:sticky md:top-0 md:block">
          <header className="hidden px-4 pb-3 pt-5 md:block">
            <span className="kicker">{t('nav.admin')}</span>
            <h2 className="mt-1 text-h3 text-ink">{t('dashboard.title')}</h2>
            <LiveBadge status={live.status} />
          </header>
          <ul className="md:block md:border-t md:border-line-soft md:py-2">{navRows(setSection)}</ul>
        </div>
      </nav>

      <div className="min-w-0 px-3 py-4 sm:px-6 sm:py-5">
        {live.status === 'error' && (
          <Banner
            tone="danger"
            title={t('dashboard.live.failed')}
            className="mb-4"
            action={<Button size="sm" onClick={live.reconnect}>{t('dashboard.live.retry')}</Button>}
          >
            {live.error}
          </Banner>
        )}
        {live.status === 'offline' && (
          <Banner
            tone="warn"
            title={t('dashboard.live.offline')}
            className="mb-4"
            action={<Button size="sm" onClick={live.reconnect}>{t('dashboard.live.retry')}</Button>}
          >
            {t('dashboard.live.offlineHelp')}
          </Banner>
        )}
        {body}
      </div>
    </div>
  )
}

/** Whether the numbers on screen are moving. Text beside the mark, always. */
function LiveBadge({ status, compact = false }: { status: LiveStatus; compact?: boolean }) {
  const t = useT()
  const dot =
    status === 'live' ? 'bg-ok' : status === 'reconnecting' || status === 'loading' ? 'bg-warn' : 'bg-danger'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-caption text-ink-muted ${compact ? '' : 'mt-2'}`}
      role="status"
    >
      <span aria-hidden className={`h-2 w-2 ${dot} ${status === 'live' ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
      {t(`dashboard.live.${status}`)}
    </span>
  )
}

/** The heading every section opens with: kicker, title, one sentence, actions. */
export function SectionHead({
  kicker,
  title,
  blurb,
  actions,
}: {
  kicker?: string
  title: string
  blurb?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="rule-thin mb-5 flex flex-wrap items-end gap-x-4 gap-y-2 pb-3">
      <div className="min-w-0 flex-1">
        {kicker && <span className="kicker">{kicker}</span>}
        <h2 className="mt-1 text-h2 text-ink">{title}</h2>
        {blurb && <p className="measure mt-1.5 text-body text-ink-muted">{blurb}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
