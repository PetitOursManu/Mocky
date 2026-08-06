import { useEffect, useState } from 'react'
import { api, type UsageReport as Report } from '../lib/api'
import { shareOf, splitBytes, type ByteUnit } from '../lib/bytes'
import { Banner, Icon } from '../ui'
import { useT } from '../i18n'

const UNIT_KEY: Record<ByteUnit, string> = {
  b: 'admin.unitB',
  kb: 'admin.unitKB',
  mb: 'admin.unitMB',
  gb: 'admin.unitGB',
}

/**
 * What each account has produced, and what it costs the volume.
 *
 * Its own request rather than a column bolted onto the account list, because
 * building it is not free: the server parses every user's projects blob — the
 * one thing it otherwise never opens — and walks a directory per scroll
 * sequence. Loaded beside the list, not before it, so a slow report never
 * delays the controls an admin came here to use.
 */
export default function UsageReport() {
  const t = useT()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    api.admin
      .usage()
      .then((r) => {
        if (!live) return
        setReport(r)
        // The route answers 200 with an `error` field rather than a status, so
        // a failed report never looks like a failed Admin screen.
        if (r.error) setError(r.error)
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  /** "12 Mo" — the number and its translated unit, kept together. */
  const size = (n: number) => {
    const { value, unit } = splitBytes(n)
    return `${value.toLocaleString()} ${t(UNIT_KEY[unit])}`
  }

  const rows = report?.users ?? []
  // Bars are relative to the heaviest account, not to the disk ceiling: on a
  // 10 GB volume holding 40 MB, every bar against the ceiling is invisible and
  // the comparison an admin actually wants — who is heaviest — is lost.
  const heaviest = Math.max(1, ...rows.map((r) => r.bytes.total))
  const instance = report?.instance ?? null

  return (
    <section>
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('admin.usage')}</span>
        {instance && (
          <span className="ml-auto font-mono text-caption text-accent-ink">
            {size(instance.bytes)}
            {instance.maxBytes > 0 ? ` / ${size(instance.maxBytes)}` : ` · ${t('admin.usageUnlimited')}`}
          </span>
        )}
      </div>
      <p className="measure mb-3 text-body-sm text-ink-muted">{t('admin.usageBlurb')}</p>

      {error && (
        <Banner tone="warn" title={t('admin.usageFailed')}>
          {error}
        </Banner>
      )}

      {loading ? (
        <p className="text-body text-ink-faint">{t('common.loading')}</p>
      ) : rows.length === 0 && !error ? (
        <p className="text-body text-ink-faint">{t('admin.usageEmpty')}</p>
      ) : (
        <ul className="border-t border-line-soft">
          {rows.map((u) => (
            <li key={u.id} className="border-b border-line-soft py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-body text-ink">{u.username}</span>
                {!u.readable && (
                  <span
                    className="flex items-center gap-1 text-caption text-warn"
                    title={t('admin.usageUnreadableHelp')}
                  >
                    <Icon name="warning" size={13} />
                    {t('admin.usageUnreadable')}
                  </span>
                )}
                <span className="ml-auto font-mono text-body-sm text-ink">{size(u.bytes.total)}</span>
              </div>

              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-body-sm text-ink-muted">
                {/* Em dash, not 0: the counts are unknown for an unreadable blob,
                    and a confident nought sends an admin hunting for nothing. */}
                <span>
                  {t('admin.usageProjects')}{' '}
                  <span className="font-mono text-ink">{u.readable ? u.projects : '—'}</span>
                </span>
                <span>
                  {t('admin.usageScreens')}{' '}
                  <span className="font-mono text-ink">{u.readable ? u.screens : '—'}</span>
                </span>
                <span>
                  {t('admin.usageMedia')} <span className="font-mono text-ink">{u.media}</span>
                </span>
                {u.readable && u.deletedProjects > 0 && (
                  <span className="text-ink-faint">{t('admin.usageTombstones', { n: u.deletedProjects })}</span>
                )}
              </div>

              <div
                className="mt-1.5 h-1 w-full bg-ink/5"
                title={t('admin.usageBreakdown', {
                  data: size(u.bytes.data),
                  media: size(u.bytes.media),
                  avatar: size(u.bytes.avatar),
                })}
              >
                <div
                  className="h-full bg-accent"
                  style={{ width: `${shareOf(u.bytes.total, heaviest) ?? 0}%` }}
                />
              </div>
            </li>
          ))}

          {report && report.unattributed.count > 0 && (
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-soft py-2.5">
              <span className="text-body text-ink-muted" title={t('admin.usageUnattributedHelp')}>
                {t('admin.usageUnattributed')}
              </span>
              <span className="text-body-sm text-ink-faint">
                {t('admin.usageMedia')} <span className="font-mono">{report.unattributed.count}</span>
              </span>
              <span className="ml-auto font-mono text-body-sm text-ink-muted">
                {size(report.unattributed.bytes)}
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
