import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Icon, type IconName } from '../../ui'
import { useT } from '../../i18n'
import { useDashboard, type LiveStatus } from './useDashboard'
import OverviewSection from './OverviewSection'
import ActivitySection from './ActivitySection'
import UsersSection from './UsersSection'
import SessionsSection from './SessionsSection'
import SystemSection from './SystemSection'
import ProvidersSection from './ProvidersSection'
import AuditSection from './AuditSection'
import AnnouncementSection from './AnnouncementSection'
import MigrationSettings from '../MigrationSettings'

export type SectionId =
  | 'overview'
  | 'activity'
  | 'users'
  | 'sessions'
  | 'system'
  | 'providers'
  | 'audit'
  | 'announcement'
  | 'maintenance'

const SECTIONS: Array<{ id: SectionId; icon: IconName }> = [
  { id: 'overview', icon: 'grid' },
  { id: 'activity', icon: 'pulse' },
  { id: 'users', icon: 'user' },
  { id: 'sessions', icon: 'key' },
  { id: 'system', icon: 'cpu' },
  { id: 'providers', icon: 'plug' },
  { id: 'audit', icon: 'list' },
  { id: 'announcement', icon: 'megaphone' },
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
export default function AdminDashboard({ currentUsername }: { currentUsername: string }) {
  const t = useT()
  const [section, setSection] = useState<SectionId>(loadSection)
  const live = useDashboard()
  const d = live.data
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLUListElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_KEY, section)
    } catch {
      /* a convenience only */
    }
    // Below md the menu is a strip wider than the screen: bring the active entry
    // into it. By hand rather than scrollIntoView, which would also scroll the
    // PAGE to the strip.
    const strip = stripRef.current
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (strip && active && strip.scrollWidth > strip.clientWidth) {
      const offset = active.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft
      strip.scrollLeft = Math.max(0, offset - 16)
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

  const body = (() => {
    switch (section) {
      case 'overview':
        return <OverviewSection live={live} go={setSection} />
      case 'activity':
        return <ActivitySection live={live} />
      case 'users':
        return <UsersSection live={live} currentUsername={currentUsername} />
      case 'sessions':
        return <SessionsSection />
      case 'system':
        return <SystemSection live={live} />
      case 'providers':
        return <ProvidersSection live={live} />
      case 'audit':
        return <AuditSection />
      case 'announcement':
        return <AnnouncementSection live={live} />
      case 'maintenance':
        return <MigrationSettings />
    }
  })()

  return (
    <div ref={rootRef} className="border border-line bg-surface md:grid md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <nav aria-label={t('dashboard.nav.label')} className="border-b border-line md:border-b-0 md:border-r">
        <div className="md:sticky md:top-0">
          <header className="hidden px-4 pb-3 pt-5 md:block">
            <span className="kicker text-accent-ink">{t('nav.admin')}</span>
            <h2 className="mt-1 text-h3 text-ink">{t('dashboard.title')}</h2>
            <LiveBadge status={live.status} />
          </header>
          {/* Below md the menu is a strip that scrolls sideways inside itself —
              never the page, which must not scroll horizontally at 390 px. */}
          <ul ref={stripRef} className="flex overflow-x-auto md:block md:border-t md:border-line-soft md:py-2">
            {SECTIONS.map((s) => {
              const active = s.id === section
              const b = badge(s.id)
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setSection(s.id)}
                    className={
                      'tap-target flex w-full items-center gap-2.5 whitespace-nowrap border-b-2 px-4 py-2 text-left text-body-sm transition md:border-b-0 md:border-l-2 ' +
                      (active
                        ? 'border-accent bg-ink text-surface'
                        : 'border-transparent text-ink-muted hover:bg-ink/5 hover:text-ink')
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
            })}
          </ul>
        </div>
      </nav>

      <div className="min-w-0 px-4 py-5 sm:px-6">
        <div className="mb-4 md:hidden">
          <LiveBadge status={live.status} />
        </div>
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
function LiveBadge({ status }: { status: LiveStatus }) {
  const t = useT()
  const dot =
    status === 'live' ? 'bg-ok' : status === 'reconnecting' || status === 'loading' ? 'bg-warn' : 'bg-danger'
  return (
    <span className="mt-2 inline-flex items-center gap-1.5 text-caption text-ink-muted" role="status">
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
        {kicker && <span className="kicker text-accent-ink">{kicker}</span>}
        <h2 className="mt-1 text-h2 text-ink">{title}</h2>
        {blurb && <p className="measure mt-1.5 text-body text-ink-muted">{blurb}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
