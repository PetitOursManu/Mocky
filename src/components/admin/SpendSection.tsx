import { useEffect, useMemo, useState } from 'react'
import { api, type PriceImportLine, type SpendEntry, type SpendPrices } from '../../lib/api'
import {
  groupSpend,
  modelsByProject,
  pricedModels,
  sortSpend,
  splitPriceKey,
  type PricedModel,
  totalOf,
  type SpendGroup,
  type SpendRow,
  type SpendSort,
} from '../../lib/spend'
import { Banner, Button, Icon, Input, Segmented } from '../../ui'
import { useT } from '../../i18n'
import { SectionHead } from './AdminDashboard'
import { OwnApiBadge } from './ActivitySection'
import { useFmt } from './format'

const PERIODS = [7, 30, 365, 0] as const
const GROUPS: SpendGroup[] = ['day', 'month', 'user', 'project', 'model', 'provider']

/**
 * What the models cost, and which ones each project used (server/admin/spend.js).
 *
 * Three blocks, in the order an administrator asks: how much, then on what,
 * then at what price. The prices come last because most of the time there is
 * nothing to do there — a provider that reports its own price (OpenRouter) is
 * believed, and only the others need a line in the table.
 */
export default function SpendSection() {
  const t = useT()
  const f = useFmt()
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [group, setGroup] = useState<SpendGroup>('day')
  const [sort, setSort] = useState<{ by: SpendSort; ascending: boolean }>({ by: 'key', ascending: false })
  const [entries, setEntries] = useState<SpendEntry[] | null>(null)
  const [prices, setPrices] = useState<SpendPrices>({})
  const [error, setError] = useState<string | null>(null)

  const load = (d: number) =>
    api.admin
      .spend(d)
      .then((r) => {
        setEntries(r.entries)
        setPrices(r.prices)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))

  useEffect(() => {
    load(days)
  }, [days])

  const rows = useMemo(() => (entries ? sortSpend(groupSpend(entries, group), sort.by, group, sort.ascending) : []), [entries, group, sort])
  const total = useMemo(() => totalOf(rows), [rows])
  const usage = useMemo(() => (entries ? modelsByProject(entries) : []), [entries])

  const money = (n: number | null) => (n == null ? '—' : `$${n < 1 ? f.num(n, 4) : f.num(n, 2)}`)

  const header = (by: SpendSort, label: string, right = true) => {
    const active = sort.by === by
    return (
      <th
        className={`py-1.5 pr-3 font-semibold ${right ? 'text-right' : ''}`}
        aria-sort={active ? (sort.ascending ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={`uppercase tracking-wide hover:text-ink ${active ? 'text-ink' : ''}`}
          onClick={() => setSort((s) => ({ by, ascending: s.by === by ? !s.ascending : false }))}
        >
          {label}
          {active ? (sort.ascending ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    )
  }

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.spend')} title={t('spend.title')} blurb={t('spend.blurb')} />
      {error && (
        <Banner tone="danger" title={t('common.error')} className="mb-4">
          {error}
        </Banner>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label={t('spend.period')}
          value={String(days)}
          onChange={(v) => v && setDays(Number(v) as (typeof PERIODS)[number])}
          options={PERIODS.map((d) => ({ value: String(d), label: t(`spend.period.${d}`) }))}
        />
        <Segmented
          label={t('spend.groupBy')}
          value={group}
          onChange={(v) => {
            if (!v) return
            setGroup(v)
            // A timeline reads newest first; anything else, most expensive first.
            setSort({ by: v === 'day' || v === 'month' ? 'key' : 'cost', ascending: false })
          }}
          options={GROUPS.map((g) => ({ value: g, label: t(`spend.group.${g}`) }))}
        />
      </div>

      {!entries ? (
        <p className="text-body text-ink-faint">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-body text-ink-faint">{t('spend.empty')}</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Tile
              label={t('spend.cost')}
              value={total.unpriced && !total.cost ? '—' : money(total.cost)}
              note={total.unpriced ? t('spend.unpricedNote') : undefined}
            />
            <Tile
              label={t('spend.calls')}
              value={f.num(total.calls)}
              note={total.ownCalls ? t('spend.ownCalls', { n: f.num(total.ownCalls) }) : undefined}
            />
            <Tile label={t('spend.input')} value={f.num(total.input)} />
            <Tile
              label={t('spend.output')}
              value={f.num(total.output)}
              note={total.estimated ? t('spend.estimatedNote', { n: f.num(total.estimated) }) : undefined}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-body-sm">
              <thead>
                <tr className="border-b border-line-soft text-caption text-ink-muted">
                  {header('key', t(`spend.group.${group}`), false)}
                  {header('calls', t('spend.calls'))}
                  {header('input', t('spend.input'))}
                  {header('output', t('spend.output'))}
                  {header('cost', t('spend.cost'))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.key} r={r} group={group} money={money} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="measure mt-3 text-caption text-ink-muted">{t('spend.footnote')}</p>
        </>
      )}

      <div className="mt-10 border-t border-line pt-8">
        <div className="section-head">
          <span className="kicker">{t('spend.byProject')}</span>
        </div>
        <p className="measure mb-4 text-body-sm text-ink-muted">{t('spend.byProjectBlurb')}</p>
        {usage.length === 0 ? (
          <p className="text-body text-ink-faint">{t('spend.empty')}</p>
        ) : (
          <div className="space-y-5">
            {usage.map((u) => (
              <div key={u.userId}>
                <h4 className="text-body font-medium text-ink">{u.username ?? t('spend.deletedAccount')}</h4>
                <ul className="mt-1.5 divide-y divide-line-soft border-y border-line-soft">
                  {u.projects.map((p) => (
                    <li key={p.projectId ?? '-'} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 py-2">
                      <span className="min-w-[10rem] text-body-sm text-ink">
                        {p.projectId == null ? (
                          <em className="text-ink-muted">{t('spend.noProject')}</em>
                        ) : p.name ? (
                          p.name
                        ) : (
                          <em className="text-ink-muted">{t('spend.deletedProject')}</em>
                        )}
                        {p.deleted && p.name && <span className="ml-1.5 text-caption text-ink-faint">({t('spend.deleted')})</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {p.models.map((m) => (
                          <span
                            key={`${m.model}|${m.own}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-line-soft px-2 py-0.5 font-mono text-caption text-ink"
                            title={`${m.provider} · ${t('spend.callsN', { n: f.num(m.calls) })}`}
                          >
                            {m.own && <OwnApiBadge />}
                            {m.model}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <PriceTable
        entries={entries ?? []}
        prices={prices}
        // The costs above are priced by the server when it answers: a new
        // price means asking again, or the totals keep the old one.
        onSaved={(p) => {
          setPrices(p)
          load(days)
        }}
        onError={setError}
      />
    </section>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-line-soft p-3">
      <span className="kicker text-ink-muted">{label}</span>
      <span className="mt-1 block font-mono text-h3 text-ink">{value}</span>
      {note && <span className="mt-1 block text-caption text-warn">{note}</span>}
    </div>
  )
}

function Row({ r, group, money }: { r: SpendRow; group: SpendGroup; money: (n: number | null) => string }) {
  const t = useT()
  const f = useFmt()
  const label =
    group === 'user'
      ? r.label || t('spend.deletedAccount')
      : group === 'project'
        ? r.key.endsWith('|')
          ? t('spend.noProject')
          : r.label || t('spend.deletedProject')
        : r.label
  return (
    <tr className="border-b border-line-soft">
      <td className="py-2 pr-3 text-ink">
        <span className={group === 'model' || group === 'provider' ? 'font-mono' : ''}>{label}</span>
        {group === 'project' && r.owner && <span className="ml-1.5 text-caption text-ink-muted">· {r.owner}</span>}
        {r.ownCalls > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-caption text-ink-muted">
            <OwnApiBadge /> {t('spend.callsN', { n: f.num(r.ownCalls) })}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-right font-mono text-ink">{f.num(r.calls)}</td>
      <td className="py-2 pr-3 text-right font-mono text-ink-muted">{f.num(r.input)}</td>
      <td className="py-2 pr-3 text-right font-mono text-ink-muted">{f.num(r.output)}</td>
      <td className="py-2 pr-3 text-right font-mono text-ink">
        {/* Nothing priced is not "$0": a dash, and the asterisk says why. */}
        {r.calls && !(r.unpriced && !r.cost) ? money(r.cost) : '—'}
        {r.unpriced && (
          <span className="ml-1 text-warn" title={t('spend.unpricedNote')}>
            *
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * Dollars per million tokens, per provider and model, for the calls whose
 * provider did not say what it charged.
 *
 * "Fetch the providers' prices" fills it from the four providers that publish a
 * catalogue (server/admin/prices.js) and says, per model, what came of it — a
 * provider with no catalogue is named, so its blank reads as "to fill" and not
 * as "free". A price typed here is the administrator's and is never overwritten
 * by a fetch; editing a fetched price makes it typed.
 */
function PriceTable({
  entries,
  prices,
  onSaved,
  onError,
}: {
  entries: SpendEntry[]
  prices: SpendPrices
  onSaved: (p: SpendPrices) => void
  onError: (msg: string) => void
}) {
  const t = useT()
  const f = useFmt()
  const rows = useMemo(() => {
    const seen = pricedModels(entries)
    // A price kept for a model no line of this period mentions stays on screen.
    for (const key of Object.keys(prices)) {
      if (seen.some((s) => s.key === key || s.model === key)) continue
      const { provider, model } = splitPriceKey(key)
      seen.push({ key, provider: provider ?? '', model, reported: 0, calls: 0 })
    }
    return seen
  }, [entries, prices])
  /** What a row shows: its own price, or the bare-model price the first version saved. */
  const stored = (r: PricedModel) => prices[r.key] ?? prices[r.model]
  const [draft, setDraft] = useState<Record<string, { in: string; out: string }>>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<PriceImportLine[] | null>(null)
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        rows.flatMap((r) => {
          const p = stored(r)
          return p ? [[r.key, { in: String(p.in), out: String(p.out) }]] : []
        }),
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, rows])

  const cell = (r: PricedModel, side: 'in' | 'out') => (
    <div className="ml-auto w-32">
      <Input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className="text-right font-mono"
        aria-label={t(side === 'in' ? 'spend.priceIn' : 'spend.priceOut') + ` — ${r.model}`}
        value={draft[r.key]?.[side] ?? ''}
        onChange={(e) => {
          setSaved(false)
          const v = e.currentTarget.value
          setDraft((d) => ({ ...d, [r.key]: { in: d[r.key]?.in ?? '', out: d[r.key]?.out ?? '', [side]: v } }))
        }}
      />
    </div>
  )

  async function save() {
    setBusy(true)
    try {
      // Every price kept, then this page's rows over them: a row left as it was
      // keeps where it came from, an edited one becomes the administrator's.
      const next: SpendPrices = { ...prices }
      for (const r of rows) {
        const d = draft[r.key]
        if (!d || (d.in === '' && d.out === '')) {
          if (!prices[r.key]?.source) delete next[r.key]
          continue
        }
        const value = { in: Number(d.in) || 0, out: Number(d.out) || 0 }
        const before = stored(r)
        next[r.key] = before && before.in === value.in && before.out === value.out && prices[r.key] ? prices[r.key] : value
      }
      onSaved((await api.admin.setPrices(next)).prices)
      setSaved(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function fetchAll() {
    setBusy(true)
    setSaved(false)
    try {
      const out = await api.admin.importPrices()
      setReport(out.report)
      onSaved(out.prices)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const origin = (r: PricedModel) => {
    const p = prices[r.key]
    const reported =
      r.reported === 0 ? null : r.reported === r.calls ? t('spend.priceReported') : t('spend.priceMixed', { n: r.reported, total: r.calls })
    const table = p?.source
      ? t('spend.priceFetched', { source: p.source, date: p.at ? f.date(p.at) : '—' })
      : stored(r)
        ? t('spend.priceTyped')
        : t('spend.priceNone')
    return reported ? `${reported} · ${table}` : table
  }

  const counts = report ? report.reduce<Record<string, number>>((n, l) => ({ ...n, [l.status]: (n[l.status] || 0) + 1 }), {}) : null
  const without = report ? Array.from(new Set(report.filter((l) => l.status === 'no-api').map((l) => l.provider))) : []

  return (
    <div className="mt-10 border-t border-line pt-8">
      <div className="section-head">
        <span className="kicker">{t('spend.prices')}</span>
      </div>
      <p className="measure mb-3 text-body-sm text-ink-muted">{t('spend.pricesBlurb')}</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={fetchAll}>
          <Icon name="download" size={16} />
          {t('spend.fetchPrices')}
        </Button>
        <span className="measure text-caption text-ink-muted">{t('spend.fetchPricesHelp')}</span>
      </div>
      {counts && (
        <p className="mb-4 text-body-sm text-ink">
          {t('spend.fetchReport', {
            imported: counts.imported || 0,
            kept: counts['kept-manual'] || 0,
            missing: (counts['not-listed'] || 0) + (counts['no-key'] || 0) + (counts.error || 0),
          })}
          {without.length > 0 && (
            <span className="block text-caption text-ink-muted">{t('spend.fetchNoApi', { providers: without.join(', ') })}</span>
          )}
          {(counts['no-key'] || 0) > 0 && <span className="block text-caption text-warn">{t('spend.fetchNoKey')}</span>}
          {(counts.error || 0) > 0 && <span className="block text-caption text-warn">{t('spend.fetchError')}</span>}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-body text-ink-faint">{t('spend.pricesEmpty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-body-sm">
              <thead>
                <tr className="border-b border-line-soft text-caption uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-3 font-semibold">{t('spend.group.model')}</th>
                  <th className="py-1.5 pr-3 font-semibold">{t('spend.priceSource')}</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">{t('spend.priceIn')}</th>
                  <th className="py-1.5 text-right font-semibold">{t('spend.priceOut')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-line-soft">
                    <td className="py-2 pr-3">
                      <span className="block font-mono text-ink">{r.model}</span>
                      {r.provider && <span className="block text-caption text-ink-muted">{r.provider}</span>}
                    </td>
                    <td className="py-2 pr-3 text-caption text-ink-muted">{origin(r)}</td>
                    <td className="py-1.5 pr-3 text-right">{cell(r, 'in')}</td>
                    <td className="py-1.5 text-right">{cell(r, 'out')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="primary" disabled={busy} onClick={save}>
              {t('common.save')}
            </Button>
            {saved && <span className="text-caption text-ok">{t('spend.pricesSaved')}</span>}
          </div>
        </>
      )}
    </div>
  )
}
