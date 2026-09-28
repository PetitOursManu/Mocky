import { useMemo } from 'react'
import { useT } from '../../i18n'
import { WORK_KINDS, type Overview } from '../../lib/dashboard'
import { Banner, Button } from '../../ui'
import type { SectionId } from './AdminDashboard'
import { SectionHead } from './AdminDashboard'
import { MinuteColumns, Stat, TimeChart } from './charts'
import { useFmt } from './format'
import type { useDashboard } from './useDashboard'
import { WorkLine } from './ActivitySection'

type Live = ReturnType<typeof useDashboard>

const GB = 1024 ** 3
/** Free space on the data volume below which the overview says so. */
const DISK_WARN_BYTES = 5 * GB
const DISK_DANGER_BYTES = 1 * GB

/**
 * What an admin should know on arrival, and nothing they have to scroll for:
 * who is here, what is running, whether the machine and the providers are
 * well, and the few things that need a decision.
 */
export default function OverviewSection({ live, go }: { live: Live; go: (s: SectionId) => void }) {
  const t = useT()
  const f = useFmt()
  const d = live.data
  if (!d) return <p className="text-body text-ink-faint">{t('common.loading')}</p>

  const s = d.sample
  const cpu = s?.container?.cpu ?? s?.process.cpu ?? null
  const mem = s?.container?.memUsed ?? s?.process.rss ?? null
  const gpu = d.gpu
  const gpuUtil = s?.gpu?.[0]?.util ?? null
  const budget = d.storage.budget
  const storagePct = budget?.ratio != null ? budget.ratio * 100 : null

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.overview')} title={t('dashboard.overview.title')} blurb={t('dashboard.overview.blurb')} />

      <Alerts d={d} go={go} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('dashboard.stat.online')}
          value={d.counts.online}
          sub={t('dashboard.stat.onlineSub', { active: d.counts.active, users: d.counts.users })}
          onClick={() => go('activity')}
        />
        <Stat
          label={t('dashboard.stat.working')}
          value={d.inflight.length}
          sub={t('dashboard.stat.workingSub', { n: d.counts.working, queued: d.video.queued })}
          onClick={() => go('activity')}
        />
        <Stat
          label={t('dashboard.stat.cpu')}
          value={f.pct(cpu)}
          sub={s?.container ? t('dashboard.stat.cpuContainer') : t('dashboard.stat.cpuProcess')}
          tone={cpu != null && cpu >= 90 ? 'danger' : cpu != null && cpu >= 75 ? 'warn' : undefined}
          onClick={() => go('system')}
        />
        <Stat
          label={t('dashboard.stat.memory')}
          value={f.bytes(mem)}
          sub={
            s?.container?.memLimit
              ? t('dashboard.stat.ofLimit', { limit: f.bytes(s.container.memLimit) })
              : t('dashboard.stat.memoryProcess')
          }
          onClick={() => go('system')}
        />
        <Stat
          label={t('dashboard.stat.gpu')}
          value={!gpu ? '…' : gpu.status === 'ok' ? f.pct(gpuUtil) : gpu.status === 'unmeasurable' ? '—' : t('dashboard.gpu.absentShort')}
          sub={
            gpu?.status === 'ok' || gpu?.status === 'unmeasurable'
              ? gpu.devices[0]?.name
              : gpu
                ? t('dashboard.gpu.absent')
                : t('dashboard.gpu.detecting')
          }
          onClick={() => go('system')}
        />
        <Stat
          label={t('dashboard.stat.storage')}
          value={storagePct != null ? f.pct(storagePct) : f.bytes(budget?.bytes)}
          sub={
            budget?.maxBytes
              ? t('dashboard.stat.ofLimit', { limit: f.bytes(budget.maxBytes) })
              : t('dashboard.stat.storageNoLimit')
          }
          tone={storagePct != null && storagePct >= 90 ? 'danger' : storagePct != null && storagePct >= 75 ? 'warn' : undefined}
          onClick={() => go('system')}
        />
        <Stat
          label={t('dashboard.stat.sessions')}
          value={d.counts.sessions}
          sub={t('dashboard.stat.sessionsSub', { n: d.counts.users })}
          onClick={() => go('sessions')}
        />
        <Stat
          label={t('dashboard.stat.failedLogins')}
          value={d.security.failedLogins24h}
          sub={t('dashboard.stat.failedLoginsSub', { n: d.security.lockouts24h })}
          tone={d.security.lockouts24h > 0 ? 'warn' : undefined}
          onClick={() => go('audit')}
        />
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-8 xl:grid-cols-2">
        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.overview.now')}</span>
            <Button size="sm" variant="quiet" className="ml-auto" onClick={() => go('activity')}>
              {t('dashboard.overview.seeActivity')}
            </Button>
          </div>
          {d.inflight.length === 0 ? (
            <p className="text-body text-ink-faint">{t('dashboard.activity.nothingRunning')}</p>
          ) : (
            <ul className="border-t border-line-soft">
              {d.inflight.slice(0, 8).map((w) => (
                <WorkLine key={w.id} work={w} now={d.now} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.overview.requests')}</span>
            <span className="ml-auto font-mono text-caption text-ink-muted">
              {t('dashboard.overview.lastHour', { n: totalOf(d) })}
            </span>
          </div>
          <MinuteColumns
            buckets={d.perMinute}
            valueOf={(b) => WORK_KINDS.reduce((a, k) => a + ((b as Overview['perMinute'][number])[k] || 0), 0)}
            label={t('dashboard.overview.requests')}
            unit={(n) => t('dashboard.unit.requests', { n })}
            clock={(x) => f.clock(x)}
            height={72}
          />
          <p className="mt-2 text-caption text-ink-muted">{t('dashboard.overview.requestsHelp')}</p>
        </div>

        <ChartCard title={t('dashboard.system.cpuProcess')} value={f.pct(s?.process.cpu)}>
          <TimeChart
            points={d.metrics.map((m) => ({ t: m.t, v: m.process.cpu }))}
            now={d.now}
            max={100}
            format={(v) => f.pct(v)}
            label={t('dashboard.system.cpuProcess')}
            clock={(x) => f.clock(x)}
          />
        </ChartCard>
        <ChartCard title={t('dashboard.system.memProcess')} value={f.bytes(s?.process.rss)}>
          <TimeChart
            points={d.metrics.map((m) => ({ t: m.t, v: m.process.rss }))}
            now={d.now}
            format={(v) => f.bytes(v)}
            label={t('dashboard.system.memProcess')}
            clock={(x) => f.clock(x)}
          />
        </ChartCard>
      </div>
    </section>
  )
}

function totalOf(d: Overview) {
  return d.perMinute.reduce((a, b) => a + WORK_KINDS.reduce((x, k) => x + (b[k] || 0), 0), 0)
}

/** A chart with its title and current value above it. */
export function ChartCard({ title, value, children }: { title: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline gap-3 border-b border-line pb-1.5">
        <span className="kicker text-ink">{title}</span>
        {value && <span className="ml-auto font-mono text-body-sm text-ink">{value}</span>}
      </div>
      {children}
    </div>
  )
}

/**
 * The things that need a decision, as sentences. Only what is actually wrong:
 * a list that always says something is a list nobody reads.
 */
function Alerts({ d, go }: { d: Overview; go: (s: SectionId) => void }) {
  const t = useT()
  const f = useFmt()
  const items = useMemo(() => {
    const out: Array<{ tone: 'warn' | 'danger'; text: string; to: SectionId }> = []
    if (d.maintenance.on) out.push({ tone: 'warn', text: t('dashboard.alert.maintenance'), to: 'maintenance' })
    const budget = d.storage.budget
    if (budget?.ratio != null && budget.ratio >= 0.9)
      out.push({ tone: budget.ratio >= 1 ? 'danger' : 'warn', text: t('dashboard.alert.storage', { pct: f.pct(budget.ratio * 100) }), to: 'system' })
    // In bytes, not as a share: 78 GB free is 8 % of a 1 TB disk and years of
    // Mocky, while 3 GB free is 30 % of a small VPS volume and one busy week.
    if (d.storage.disk && d.storage.disk.free < DISK_WARN_BYTES)
      out.push({
        tone: d.storage.disk.free < DISK_DANGER_BYTES ? 'danger' : 'warn',
        text: t('dashboard.alert.disk', { free: f.bytes(d.storage.disk.free) }),
        to: 'system',
      })
    for (const h of d.health) {
      if ((h.errorRate ?? 0) >= 0.2 && h.errors >= 2)
        out.push({
          tone: 'danger',
          text: t('dashboard.alert.provider', {
            provider: h.provider,
            kind: t(`dashboard.kind.${h.kind}`),
            pct: f.pct((h.errorRate ?? 0) * 100),
          }),
          to: 'providers',
        })
    }
    if ((d.sample?.loop.p99 ?? 0) >= 200)
      out.push({ tone: 'warn', text: t('dashboard.alert.loop', { ms: f.num(d.sample?.loop.p99 ?? 0) }), to: 'system' })
    if (d.security.lockouts24h > 0)
      out.push({ tone: 'warn', text: t('dashboard.alert.lockouts', { n: d.security.lockouts24h }), to: 'audit' })
    const w = d.video.worker
    if (w && !w.available && w.reason !== 'not-configured')
      out.push({ tone: 'warn', text: t('dashboard.alert.worker'), to: 'system' })
    return out
  }, [d, t, f])

  if (!items.length) {
    return (
      <Banner tone="ok" className="mb-5">
        {t('dashboard.alert.none')}
      </Banner>
    )
  }
  return (
    <div className="mb-5 space-y-2">
      {items.map((a, i) => (
        <Banner
          key={i}
          tone={a.tone}
          action={
            <Button size="sm" variant="quiet" onClick={() => go(a.to)}>
              {t(`dashboard.nav.${a.to}`)}
            </Button>
          }
        >
          <span className="text-ink">{a.text}</span>
        </Banner>
      ))}
    </div>
  )
}
