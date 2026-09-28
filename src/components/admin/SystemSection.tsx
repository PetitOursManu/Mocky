import { useT } from '../../i18n'
import type { GpuState, Overview } from '../../lib/dashboard'
import { SectionHead } from './AdminDashboard'
import { Meter, TimeChart } from './charts'
import { ChartCard } from './OverviewSection'
import { useFmt, type Fmt } from './format'
import type { useDashboard } from './useDashboard'

type Live = ReturnType<typeof useDashboard>

/**
 * The machine: processor, memory, event loop, graphics card, disk, and the
 * render worker — each scope on its own chart (see charts.tsx for why two
 * scopes are never two lines on one chart).
 */
export default function SystemSection({ live }: { live: Live }) {
  const t = useT()
  const f = useFmt()
  const d = live.data
  if (!d) return <p className="text-body text-ink-faint">{t('common.loading')}</p>

  const s = d.sample
  const info = d.info
  const m = d.metrics
  const clock = (x: number) => f.clock(x)
  const inContainer = Boolean(s?.container)
  const memCeiling = s?.container?.memLimit ?? s?.host.memTotal ?? info.memTotal

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.system')} title={t('dashboard.system.title')} blurb={t('dashboard.system.blurb')} />

      <InfoStrip d={d} f={f} />

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <ChartCard title={t('dashboard.system.cpuProcess')} value={f.pct(s?.process.cpu, 1)}>
          <TimeChart
            points={m.map((x) => ({ t: x.t, v: x.process.cpu }))}
            now={d.now}
            max={100}
            format={(v) => f.pct(v, 1)}
            label={t('dashboard.system.cpuProcess')}
            clock={clock}
          />
          <p className="mt-2 text-caption text-ink-muted">{t('dashboard.system.cpuProcessHelp', { cores: f.num(info.cores, 1) })}</p>
        </ChartCard>

        {inContainer ? (
          <ChartCard title={t('dashboard.system.cpuContainer')} value={f.pct(s?.container?.cpu, 1)}>
            <TimeChart
              points={m.map((x) => ({ t: x.t, v: x.container?.cpu ?? null }))}
              now={d.now}
              max={100}
              format={(v) => f.pct(v, 1)}
              label={t('dashboard.system.cpuContainer')}
              clock={clock}
            />
            <p className="mt-2 text-caption text-ink-muted">{t('dashboard.system.cpuContainerHelp')}</p>
          </ChartCard>
        ) : (
          <ChartCard title={t('dashboard.system.cpuHost')} value={f.pct(s?.host.cpu, 1)}>
            <TimeChart
              points={m.map((x) => ({ t: x.t, v: x.host.cpu }))}
              now={d.now}
              max={100}
              format={(v) => f.pct(v, 1)}
              label={t('dashboard.system.cpuHost')}
              clock={clock}
            />
            <p className="mt-2 text-caption text-ink-muted">
              {s?.host.load1 != null
                ? t('dashboard.system.cpuHostLoad', { load: f.num(s.host.load1, 2), n: info.cpuCount })
                : t('dashboard.system.cpuHostHelp')}
            </p>
          </ChartCard>
        )}

        <ChartCard title={t('dashboard.system.memProcess')} value={f.bytes(s?.process.rss)}>
          <TimeChart
            points={m.map((x) => ({ t: x.t, v: x.process.rss }))}
            now={d.now}
            format={(v) => f.bytes(v)}
            label={t('dashboard.system.memProcess')}
            clock={clock}
          />
          <p className="mt-2 text-caption text-ink-muted">
            {t('dashboard.system.memProcessHelp', { heap: f.bytes(s?.process.heapUsed), total: f.bytes(s?.process.heapTotal) })}
          </p>
        </ChartCard>

        <ChartCard
          title={inContainer ? t('dashboard.system.memContainer') : t('dashboard.system.memHost')}
          value={`${f.bytes(inContainer ? s?.container?.memUsed : s?.host.memUsed)} / ${f.bytes(memCeiling)}`}
        >
          <TimeChart
            points={m.map((x) => ({ t: x.t, v: inContainer ? (x.container?.memUsed ?? null) : x.host.memUsed }))}
            now={d.now}
            max={memCeiling}
            format={(v) => f.bytes(v)}
            label={inContainer ? t('dashboard.system.memContainer') : t('dashboard.system.memHost')}
            clock={clock}
          />
          <p className="mt-2 text-caption text-ink-muted">
            {inContainer
              ? s?.container?.memLimit
                ? t('dashboard.system.memContainerHelp')
                : t('dashboard.system.memContainerNoLimit')
              : t('dashboard.system.memHostHelp')}
          </p>
        </ChartCard>

        <ChartCard title={t('dashboard.system.loop')} value={s ? `${f.num(s.loop.p99, 1)} ms` : '—'}>
          <TimeChart
            points={m.map((x) => ({ t: x.t, v: x.loop.p99 }))}
            now={d.now}
            format={(v) => `${f.num(v, 1)} ms`}
            label={t('dashboard.system.loop')}
            clock={clock}
          />
          <p className="mt-2 text-caption text-ink-muted">{t('dashboard.system.loopHelp')}</p>
        </ChartCard>

        <GpuCard gpu={d.gpu} d={d} f={f} />
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.system.storage')}</span>
          </div>
          <div className="space-y-4">
            {d.storage.disk && (
              <Meter
                label={t('dashboard.system.disk')}
                value={d.storage.disk.total ? ((d.storage.disk.total - d.storage.disk.free) / d.storage.disk.total) * 100 : null}
                detail={t('dashboard.system.diskDetail', { free: f.bytes(d.storage.disk.free), total: f.bytes(d.storage.disk.total) })}
              />
            )}
            {d.storage.budget && (
              <Meter
                label={t('dashboard.system.budget')}
                value={d.storage.budget.ratio != null ? d.storage.budget.ratio * 100 : null}
                detail={
                  d.storage.budget.maxBytes
                    ? `${f.bytes(d.storage.budget.bytes)} / ${f.bytes(d.storage.budget.maxBytes)}`
                    : t('dashboard.system.budgetNoLimit', { used: f.bytes(d.storage.budget.bytes) })
                }
              />
            )}
          </div>
          <p className="mt-3 text-caption text-ink-muted">{t('dashboard.system.storageHelp')}</p>
        </div>

        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.system.worker')}</span>
          </div>
          <WorkerLine d={d} />
        </div>
      </div>
    </section>
  )
}

function InfoStrip({ d, f }: { d: Overview; f: Fmt }) {
  const t = useT()
  const i = d.info
  const rows: Array<[string, string]> = [
    [t('dashboard.system.node'), `${i.node} · ${i.platform}/${i.arch}`],
    [
      t('dashboard.system.cpu'),
      `${i.cpuModel || '—'} · ${t('dashboard.system.threads', { n: i.cpuCount })}${
        i.cpuLimit ? ` · ${t('dashboard.system.limit', { n: f.num(i.cpuLimit, 1) })}` : ''
      }`,
    ],
    [t('dashboard.system.memory'), `${f.bytes(i.memTotal)}${i.memLimit ? ` · ${t('dashboard.system.limitBytes', { n: f.bytes(i.memLimit) })}` : ''}`],
    [
      t('dashboard.system.runtime'),
      i.container ? t('dashboard.system.container', { v: i.cgroup ?? '?' }) : t('dashboard.system.bare'),
    ],
    [t('dashboard.system.uptime'), f.duration(d.now - i.startedAt)],
  ]
  return (
    <dl className="grid gap-x-8 gap-y-2 border border-line-soft bg-ink/5 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-caption uppercase tracking-wide text-ink-muted">{k}</dt>
          <dd className="truncate text-body-sm text-ink" title={v}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The graphics card, when there is one — see server/admin/gpu.js for what
 * "one" means and why a card that cannot be measured is not called absent.
 */
function GpuCard({ gpu, d, f }: { gpu: GpuState | null; d: Overview; f: Fmt }) {
  const t = useT()
  if (!gpu) {
    return (
      <ChartCard title={t('dashboard.stat.gpu')}>
        <p className="text-body text-ink-faint">{t('dashboard.gpu.detecting')}</p>
      </ChartCard>
    )
  }
  if (gpu.status === 'absent') {
    return (
      <ChartCard title={t('dashboard.stat.gpu')} value={t('dashboard.gpu.absentShort')}>
        <p className="text-body text-ink">{t('dashboard.gpu.absent')}</p>
        <p className="measure mt-1 text-caption text-ink-muted">{t('dashboard.gpu.absentHelp')}</p>
      </ChartCard>
    )
  }
  if (gpu.status === 'unmeasurable') {
    return (
      <ChartCard title={t('dashboard.stat.gpu')} value="—">
        <ul className="space-y-1">
          {gpu.devices.map((dev, i) => (
            <li key={i} className="text-body text-ink">
              {dev.name}
              {dev.memTotal ? <span className="ml-2 font-mono text-caption text-ink-muted">{f.bytes(dev.memTotal)}</span> : null}
            </li>
          ))}
        </ul>
        <p className="measure mt-1 text-caption text-ink-muted">{t(`dashboard.gpu.hint.${gpu.hint || 'no-counter'}`)}</p>
      </ChartCard>
    )
  }
  return (
    <>
      {gpu.devices.map((dev, i) => {
        const latest = d.sample?.gpu?.[i]
        const used = latest?.memUsed ?? dev.memUsed
        const total = latest?.memTotal ?? dev.memTotal
        const temp = latest?.temp ?? dev.temp
        return (
          <ChartCard key={i} title={dev.name} value={f.pct(latest?.util ?? dev.util)}>
            <TimeChart
              points={d.metrics.map((x) => ({ t: x.t, v: x.gpu?.[i]?.util ?? null }))}
              now={d.now}
              max={100}
              format={(v) => f.pct(v)}
              label={t('dashboard.gpu.util', { name: dev.name })}
              clock={(x) => f.clock(x)}
              // Read every 5 s while this screen is open, once a minute when not.
              gapMs={90_000}
            />
            <div className="mt-3">
              <Meter
                label={t('dashboard.gpu.vram')}
                value={used != null && total ? (used / total) * 100 : null}
                detail={`${f.bytes(used)} / ${f.bytes(total)}${temp != null ? ` · ${temp} °C` : ''}`}
              />
            </div>
            <p className="mt-2 text-caption text-ink-muted">{t('dashboard.gpu.help', { source: gpu.source || '—' })}</p>
          </ChartCard>
        )
      })}
    </>
  )
}

function WorkerLine({ d }: { d: Overview }) {
  const t = useT()
  const w = d.video.worker
  const state = !w
    ? t('dashboard.worker.checking')
    : w.available
      ? t('dashboard.worker.up', { version: w.version || '—' })
      : w.reason === 'not-configured'
        ? t('dashboard.worker.off')
        : t('dashboard.worker.down')
  const tone = !w ? 'text-ink-muted' : w.available ? 'text-ok' : w.reason === 'not-configured' ? 'text-ink-muted' : 'text-danger'
  return (
    <div className="space-y-1 text-body-sm">
      <p className={tone}>{state}</p>
      {w && !w.available && w.detail && w.reason !== 'not-configured' && <p className="font-mono text-caption text-ink-muted">{w.detail}</p>}
      <p className="text-ink-muted">{t('dashboard.worker.queue', { running: d.video.running, queued: d.video.queued })}</p>
    </div>
  )
}
