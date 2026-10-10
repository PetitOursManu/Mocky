import { useEffect, useMemo, useState } from 'react'
import { api, type SpendEntry, type SpendPrices } from '../../lib/api'
import {
  groupSpend,
  modelsByProject,
  pricedModels,
  sortSpend,
  totalOf,
  type SpendGroup,
  type SpendRow,
  type SpendSort,
} from '../../lib/spend'
import { Banner, Button, Input, Segmented } from '../../ui'
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
            <Tile label={t('spend.cost')} value={money(total.cost)} note={total.unpriced ? t('spend.unpricedNote') : undefined} />
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
          <span className="kicker text-accent-ink">{t('spend.byProject')}</span>
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
                            className="inline-flex items-center gap-1.5 border border-line-soft px-2 py-0.5 font-mono text-caption text-ink"
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

      <PriceTable entries={entries ?? []} prices={prices} onSaved={setPrices} onError={setError} />
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
        {r.calls ? money(r.cost) : '—'}
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
 * Dollars per million tokens, for the models whose provider does not say what
 * it charged. A model that does is shown as such and still editable: the table
 * prices only the calls that came back without a price.
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
  const models = useMemo(() => {
    const seen = pricedModels(entries)
    // A price set for a model no line of this period mentions is kept on screen.
    for (const m of Object.keys(prices)) if (!seen.some((s) => s.model === m)) seen.push({ model: m, reported: 0, calls: 0 })
    return seen
  }, [entries, prices])
  const [draft, setDraft] = useState<Record<string, { in: string; out: string }>>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setDraft(Object.fromEntries(Object.entries(prices).map(([m, p]) => [m, { in: String(p.in), out: String(p.out) }])))
  }, [prices])

  const cell = (model: string, side: 'in' | 'out') => (
    <div className="ml-auto w-32">
      <Input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className="text-right font-mono"
        aria-label={t(side === 'in' ? 'spend.priceIn' : 'spend.priceOut') + ` — ${model}`}
        value={draft[model]?.[side] ?? ''}
        onChange={(e) => {
          setSaved(false)
          const v = e.currentTarget.value
          setDraft((d) => ({ ...d, [model]: { in: d[model]?.in ?? '', out: d[model]?.out ?? '', [side]: v } }))
        }}
      />
    </div>
  )

  async function save() {
    setBusy(true)
    try {
      const next: SpendPrices = {}
      for (const [m, p] of Object.entries(draft)) {
        if (p.in === '' && p.out === '') continue
        next[m] = { in: Number(p.in) || 0, out: Number(p.out) || 0 }
      }
      onSaved((await api.admin.setPrices(next)).prices)
      setSaved(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 border-t border-line pt-8">
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('spend.prices')}</span>
      </div>
      <p className="measure mb-4 text-body-sm text-ink-muted">{t('spend.pricesBlurb')}</p>
      {models.length === 0 ? (
        <p className="text-body text-ink-faint">{t('spend.pricesEmpty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-body-sm">
              <thead>
                <tr className="border-b border-line-soft text-caption uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-3 font-semibold">{t('spend.group.model')}</th>
                  <th className="py-1.5 pr-3 font-semibold">{t('spend.priceSource')}</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">{t('spend.priceIn')}</th>
                  <th className="py-1.5 text-right font-semibold">{t('spend.priceOut')}</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.model} className="border-b border-line-soft">
                    <td className="py-2 pr-3 font-mono text-ink">{m.model}</td>
                    <td className="py-2 pr-3 text-caption text-ink-muted">
                      {m.reported === 0
                        ? t('spend.priceFromTable')
                        : m.reported === m.calls
                          ? t('spend.priceReported')
                          : t('spend.priceMixed', { n: m.reported, total: m.calls })}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{cell(m.model, 'in')}</td>
                    <td className="py-1.5 text-right">{cell(m.model, 'out')}</td>
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
