import { useMemo, useState } from 'react'
import { useT } from '../../i18n'
import { WORK_KINDS, type Outcome, type Person, type Work, type WorkEvent, type WorkKind } from '../../lib/dashboard'
import { Banner } from '../../ui'
import { SectionHead } from './AdminDashboard'
import { MinuteColumns } from './charts'
import { useFmt } from './format'
import type { useDashboard } from './useDashboard'

type Live = ReturnType<typeof useDashboard>

/**
 * Who is here and what they are doing, live.
 *
 * The type of action only — "Alice is polishing a screen with openrouter" —
 * never the prompt, the project or the screen: that is what the administrator
 * chose, and the server does not collect the rest in the first place (see
 * server/admin/activity.js).
 */
export default function ActivitySection({ live }: { live: Live }) {
  const t = useT()
  const f = useFmt()
  const d = live.data
  const [showOffline, setShowOffline] = useState(false)
  const [kinds, setKinds] = useState<Set<WorkKind>>(() => new Set(WORK_KINDS))

  const perKindMax = useMemo(
    () => Math.max(1, ...(d?.perMinute || []).flatMap((b) => WORK_KINDS.map((k) => b[k] || 0))),
    [d?.perMinute],
  )

  if (!d) return <p className="text-body text-ink-faint">{t('common.loading')}</p>

  const people = showOffline ? d.people : d.people.filter((p) => p.state !== 'offline')
  const feed = d.events.filter((e) => kinds.has(e.kind)).slice().reverse()

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.activity')} title={t('dashboard.activity.title')} blurb={t('dashboard.activity.blurb')} />

      {import.meta.env.DEV && (
        <Banner tone="info" title={t('dashboard.activity.devTitle')} className="mb-5">
          {t('dashboard.activity.devHelp')}
        </Banner>
      )}

      <div className="section-head">
        <span className="kicker text-accent-ink">{t('dashboard.activity.people')}</span>
        <span className="font-mono text-caption text-ink-muted">
          {t('dashboard.activity.peopleCount', { online: d.counts.online, users: d.counts.users })}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-body-sm text-ink-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={showOffline}
            onChange={(e) => setShowOffline(e.target.checked)}
          />
          {t('dashboard.activity.showOffline')}
        </label>
      </div>
      {people.length === 0 ? (
        <p className="text-body text-ink-faint">{t('dashboard.activity.nobody')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-body-sm">
            <thead>
              <tr className="border-b border-line-soft text-caption uppercase tracking-wide text-ink-muted">
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.activity.colUser')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.activity.colState')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.activity.colWhere')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.activity.colNow')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.activity.colHour')}</th>
                <th className="py-1.5 font-semibold">{t('dashboard.activity.colSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <PersonRow key={p.id} p={p} now={d.now} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.activity.running')}</span>
            <span className="font-mono text-caption text-ink-muted">{d.inflight.length}</span>
            {d.video.queued > 0 && (
              <span className="ml-auto text-caption text-ink-muted">{t('dashboard.activity.queued', { n: d.video.queued })}</span>
            )}
          </div>
          {d.inflight.length === 0 ? (
            <p className="text-body text-ink-faint">{t('dashboard.activity.nothingRunning')}</p>
          ) : (
            <ul className="border-t border-line-soft">
              {d.inflight.map((w) => (
                <WorkLine key={w.id} work={w} now={d.now} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.activity.byKind')}</span>
            <span className="ml-auto text-caption text-ink-muted">{t('dashboard.activity.byKindHelp')}</span>
          </div>
          {/* Small multiples on ONE scale: the busiest kind is visibly the
              busiest, which a chart per kind with its own ceiling would hide. */}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {WORK_KINDS.map((k) => {
              const total = d.perMinute.reduce((a, b) => a + (b[k] || 0), 0)
              return (
                <div key={k} className="min-w-0">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-body-sm text-ink">{t(`dashboard.kind.${k}`)}</span>
                    <span className="font-mono text-caption text-ink-muted">{t('dashboard.unit.requests', { n: total })}</span>
                  </div>
                  <MinuteColumns
                    buckets={d.perMinute}
                    valueOf={(b) => (b as (typeof d.perMinute)[number])[k] || 0}
                    max={perKindMax}
                    label={t(`dashboard.kind.${k}`)}
                    unit={(n) => t('dashboard.unit.requests', { n })}
                    clock={(x) => f.clock(x)}
                    height={36}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="section-head flex-wrap">
          <span className="kicker text-accent-ink">{t('dashboard.activity.feed')}</span>
          <span className="font-mono text-caption text-ink-muted">{feed.length}</span>
          <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label={t('dashboard.activity.filter')}>
            {WORK_KINDS.map((k) => {
              const on = kinds.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setKinds((prev) => {
                      const next = new Set(prev)
                      if (on) next.delete(k)
                      else next.add(k)
                      // Never an empty filter: that is a blank list that looks like a quiet hour.
                      return next.size ? next : new Set(WORK_KINDS)
                    })
                  }
                  className={
                    'tap-target min-h-8 border px-2 text-caption ' +
                    (on ? 'border-line bg-ink text-surface' : 'border-line-soft text-ink-muted hover:text-ink')
                  }
                >
                  {t(`dashboard.kind.${k}`)}
                </button>
              )
            })}
          </div>
        </div>
        {feed.length === 0 ? (
          <p className="text-body text-ink-faint">{t('dashboard.activity.feedEmpty')}</p>
        ) : (
          <ol className="max-h-[32rem] overflow-y-auto border-t border-line-soft">
            {feed.slice(0, 200).map((e) => (
              <EventLine key={e.seq} e={e} />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/** State as a mark AND a word — never colour alone. */
export function StateMark({ state }: { state: Person['state'] }) {
  const t = useT()
  const mark =
    state === 'active' ? 'bg-ok' : state === 'idle' ? 'border border-ink-muted bg-transparent' : 'border border-line-soft bg-transparent'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`inline-block h-2 w-2 ${mark}`} />
      <span className={state === 'offline' ? 'text-ink-faint' : 'text-ink'}>{t(`dashboard.state.${state}`)}</span>
    </span>
  )
}

function PersonRow({ p, now }: { p: Person; now: number }) {
  const t = useT()
  const f = useFmt()
  const hour = WORK_KINDS.filter((k) => p.lastHour[k] > 0)
  return (
    <tr className="border-b border-line-soft align-top">
      <td className="py-2 pr-3">
        <span className="text-ink">{p.username}</span>
        {p.role === 'admin' && <span className="ml-2 text-caption uppercase text-accent-ink">{t('settings.roleAdminShort')}</span>}
      </td>
      <td className="py-2 pr-3">
        <StateMark state={p.state} />
      </td>
      <td className="py-2 pr-3 text-ink-muted">
        {p.state === 'offline' || !p.area ? '—' : t(`dashboard.area.${p.area}`)}
        {p.tabs > 1 && <span className="ml-1 text-caption text-ink-faint">{t('dashboard.activity.tabs', { n: p.tabs })}</span>}
      </td>
      <td className="py-2 pr-3">
        {p.working.length === 0 ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <ul>
            {p.working.map((w, i) => (
              <li key={i} className="whitespace-nowrap text-ink">
                {t(`dashboard.kind.${w.kind}`)} · {t(`dashboard.action.${w.action}`)}{' '}
                <span className="font-mono text-caption text-ink-muted">{f.duration(now - w.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-2 pr-3 text-ink-muted">
        {hour.length === 0
          ? '—'
          : hour.map((k) => `${t(`dashboard.kind.${k}`)} ${p.lastHour[k]}`).join(' · ')}
      </td>
      <td className="whitespace-nowrap py-2 text-ink-muted">{p.lastSeen ? f.ago(p.lastSeen, now) : t('dashboard.activity.neverSince')}</td>
    </tr>
  )
}

/** One piece of work in flight: who, what, with which provider, for how long. */
export function WorkLine({ work, now }: { work: Work; now: number }) {
  const t = useT()
  const f = useFmt()
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-soft py-2 text-body-sm">
      <span aria-hidden className="inline-block h-2 w-2 animate-pulse bg-accent motion-reduce:animate-none" />
      <span className="text-ink">{work.username || t('dashboard.activity.deleted')}</span>
      <span className="text-ink-muted">
        {t(`dashboard.kind.${work.kind}`)} · {t(`dashboard.action.${work.action}`)}
      </span>
      <ProviderName provider={work.provider} source={work.source} />
      <span className="ml-auto font-mono text-caption text-ink">{f.duration(now - work.startedAt)}</span>
    </li>
  )
}

export function ProviderName({ provider, source }: { provider: string; source: 'instance' | 'browser' }) {
  const t = useT()
  return (
    <span className="font-mono text-caption text-ink-muted">
      {provider === 'unknown' ? <span className="font-sans">{t('dashboard.providers.unknown')}</span> : provider}
      {source === 'browser' && (
        <span className="ml-1 font-sans text-ink-faint" title={t('dashboard.providers.browserHelp')}>
          ({t('dashboard.providers.browser')})
        </span>
      )}
    </span>
  )
}

const OUTCOME_TONE: Record<Outcome, string> = {
  ok: 'text-ok',
  aborted: 'text-ink-faint',
  'rate-limited': 'text-warn',
  refused: 'text-danger',
  timeout: 'text-warn',
  unavailable: 'text-warn',
  invalid: 'text-danger',
  failed: 'text-danger',
}

function EventLine({ e }: { e: WorkEvent }) {
  const t = useT()
  const f = useFmt()
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 border-b border-line-soft py-1.5 text-body-sm sm:grid sm:grid-cols-[4.5rem_minmax(0,9rem)_minmax(0,1fr)_auto_auto]">
      <span className="font-mono text-caption text-ink-faint">{f.clock(e.endedAt, true)}</span>
      <span className="truncate text-ink">{e.username || t('dashboard.activity.deleted')}</span>
      <span className="min-w-0 basis-full truncate text-ink-muted sm:basis-auto">
        {t(`dashboard.kind.${e.kind}`)} · {t(`dashboard.action.${e.action}`)} <ProviderName provider={e.provider} source={e.source} />
      </span>
      <span className="font-mono text-caption text-ink-muted">{f.duration(e.ms)}</span>
      <span className={`text-caption font-semibold ${OUTCOME_TONE[e.outcome]}`}>
        {t(`dashboard.outcome.${e.outcome}`)}
        {e.outcome !== 'ok' && e.outcome !== 'aborted' && e.status ? ` · ${e.status}` : ''}
      </span>
    </li>
  )
}
