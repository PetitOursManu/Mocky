import { useT } from '../../i18n'
import type { HealthRow, Outcome } from '../../lib/dashboard'
import ImageProviderSettings from '../ImageProviderSettings'
import TextProviderSettings from '../TextProviderSettings'
import VideoExportSettings from '../VideoExportSettings'
import { SectionHead } from './AdminDashboard'
import { ProviderName } from './ActivitySection'
import { useFmt } from './format'
import type { useDashboard } from './useDashboard'

type Live = ReturnType<typeof useDashboard>

/**
 * How the providers are answering, then how they are configured.
 *
 * The health table comes first because it is what an admin opens this screen
 * about when something is wrong; the three settings blocks below are the ones
 * the old Admin page had, mounted unchanged.
 */
export default function ProvidersSection({ live }: { live: Live }) {
  const t = useT()
  const rows = live.data?.health || []
  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.providers')} title={t('dashboard.providers.title')} blurb={t('dashboard.providers.blurb')} />

      <div className="section-head">
        <span className="kicker text-accent-ink">{t('dashboard.providers.health')}</span>
        <span className="ml-auto text-caption text-ink-muted">{t('dashboard.providers.window')}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-body text-ink-faint">{t('dashboard.providers.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-body-sm">
            <thead>
              <tr className="border-b border-line-soft text-caption uppercase tracking-wide text-ink-muted">
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.providers.colKind')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.providers.colProvider')}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{t('dashboard.providers.colCalls')}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{t('dashboard.providers.colErrors')}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{t('dashboard.providers.colTtfb')}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{t('dashboard.providers.colP50')}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{t('dashboard.providers.colP95')}</th>
                <th className="py-1.5 font-semibold">{t('dashboard.providers.colLast')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <HealthLine key={`${r.kind}|${r.provider}`} r={r} now={live.data?.now ?? Date.now()} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="measure mt-3 text-caption text-ink-muted">{t('dashboard.providers.footnote')}</p>

      <div className="mt-10 space-y-10 border-t border-line pt-8">
        <TextProviderSettings />
        <ImageProviderSettings />
      </div>
      <div className="mt-10 border-t border-line pt-8">
        <VideoExportSettings />
      </div>
    </section>
  )
}

function HealthLine({ r, now }: { r: HealthRow; now: number }) {
  const t = useT()
  const f = useFmt()
  const rate = r.errorRate
  // Words for the state as well as a colour: a rate alone asks the reader to
  // know where "bad" starts.
  const verdict = rate == null ? null : r.errors >= 2 && rate >= 0.2 ? 'bad' : r.errors > 0 ? 'some' : 'good'
  const tone = verdict === 'bad' ? 'text-danger' : verdict === 'some' ? 'text-warn' : 'text-ok'
  return (
    <tr className="border-b border-line-soft">
      <td className="py-2 pr-3 text-ink">{t(`dashboard.kind.${r.kind}`)}</td>
      <td className="py-2 pr-3">
        <ProviderName provider={r.provider} source={r.source} />
      </td>
      <td className="py-2 pr-3 text-right font-mono text-ink">
        {r.count}
        {r.aborted > 0 && <span className="ml-1 text-caption text-ink-faint">({t('dashboard.providers.cancelled', { n: r.aborted })})</span>}
      </td>
      <td className={`py-2 pr-3 text-right font-mono ${tone}`}>
        {rate == null ? '—' : `${r.errors} · ${f.pct(rate * 100)}`}
        {r.invalid > 0 && (
          <span className="ml-1 block text-caption text-ink-faint">{t('dashboard.providers.invalid', { n: r.invalid })}</span>
        )}
        {verdict && <span className="sr-only"> — {t(`dashboard.providers.verdict.${verdict}`)}</span>}
      </td>
      <td className="py-2 pr-3 text-right font-mono text-ink-muted">{f.duration(r.ttfbP50)}</td>
      <td className="py-2 pr-3 text-right font-mono text-ink-muted">{f.duration(r.p50)}</td>
      <td className="py-2 pr-3 text-right font-mono text-ink-muted">{f.duration(r.p95)}</td>
      <td className="py-2 text-ink-muted">
        {r.lastError ? (
          <span className="text-danger">
            {t(`dashboard.outcome.${r.lastError.outcome as Outcome}`)}
            {r.lastError.status ? ` · ${r.lastError.status}` : ''} · {f.ago(r.lastError.at, now)}
          </span>
        ) : (
          <span>
            {t('dashboard.providers.lastOk')} · {f.ago(r.lastAt, now)}
          </span>
        )}
      </td>
    </tr>
  )
}
