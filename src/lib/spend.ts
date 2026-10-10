/**
 * The administrator's spending panel, as arithmetic: lines of the ledger
 * (server/admin/spend.js) grouped by what the panel was asked to group by, and
 * sorted by what it was asked to sort by. Pure, so the sums a person reads are
 * the sums a test checked.
 *
 * Two rules carry over from the ledger. A call on a person's own key adds to
 * `ownCalls` and to nothing else: its tokens and price were never recorded, and
 * a zero there would read as "free" rather than "not ours". And a group is
 * `unpriced` as soon as ONE of its lines is — a total that silently left a model
 * out is the number an administrator would trust and should not.
 */
import type { SpendEntry } from './api'

export type SpendGroup = 'day' | 'month' | 'user' | 'project' | 'model' | 'provider'
export type SpendSort = 'key' | 'calls' | 'input' | 'output' | 'cost'

export interface SpendRow {
  key: string
  /** What the row is, for display: a day, a month, an account, a project, a model. */
  label: string
  /** For a project row: whose. */
  owner?: string | null
  deleted?: boolean
  calls: number
  input: number
  output: number
  cost: number
  ownCalls: number
  unpriced: boolean
  estimated: number
  reported: number
}

function keyOf(e: SpendEntry, by: SpendGroup): { key: string; label: string; owner?: string | null; deleted?: boolean } {
  switch (by) {
    case 'day':
      return { key: e.day, label: e.day }
    case 'month':
      return { key: e.day.slice(0, 7), label: e.day.slice(0, 7) }
    case 'user':
      return { key: e.userId, label: e.username ?? '' }
    case 'project':
      return {
        key: `${e.userId}|${e.projectId ?? ''}`,
        label: e.project ?? '',
        owner: e.username,
        deleted: e.projectId ? e.projectDeleted : false,
      }
    case 'model':
      return { key: e.model, label: e.model }
    case 'provider':
      return { key: e.provider, label: e.provider }
  }
}

export function groupSpend(entries: SpendEntry[], by: SpendGroup): SpendRow[] {
  const rows = new Map<string, SpendRow>()
  for (const e of entries) {
    const k = keyOf(e, by)
    let row = rows.get(k.key)
    if (!row) {
      row = { ...k, calls: 0, input: 0, output: 0, cost: 0, ownCalls: 0, unpriced: false, estimated: 0, reported: 0 }
      rows.set(k.key, row)
    }
    if (e.source === 'browser') {
      row.ownCalls += e.calls
      continue
    }
    row.calls += e.calls
    row.input += e.input
    row.output += e.output
    row.cost += e.cost ?? 0
    row.unpriced = row.unpriced || e.unpriced
    row.estimated += e.estimated
    row.reported += e.reported
  }
  return [...rows.values()]
}

/** Totals of the same rows: what the footer says. */
export type SpendTotal = Omit<SpendRow, 'key' | 'label' | 'owner' | 'deleted'>

export function totalOf(rows: SpendRow[]): SpendTotal {
  return rows.reduce<SpendTotal>(
    (t, r) => ({
      calls: t.calls + r.calls,
      input: t.input + r.input,
      output: t.output + r.output,
      cost: t.cost + r.cost,
      ownCalls: t.ownCalls + r.ownCalls,
      unpriced: t.unpriced || r.unpriced,
      estimated: t.estimated + r.estimated,
      reported: t.reported + r.reported,
    }),
    { calls: 0, input: 0, output: 0, cost: 0, ownCalls: 0, unpriced: false, estimated: 0, reported: 0 },
  )
}

/**
 * Sorted copy. `key` sorts days and months newest first and names
 * alphabetically, because that is the order each is read in; every number
 * sorts largest first unless `ascending`.
 */
export function sortSpend(rows: SpendRow[], by: SpendSort, group: SpendGroup, ascending = false): SpendRow[] {
  const sign = ascending ? -1 : 1
  const timeline = group === 'day' || group === 'month'
  return [...rows].sort((a, b) => {
    if (by === 'key') {
      const cmp = timeline ? b.key.localeCompare(a.key) : a.label.localeCompare(b.label)
      return cmp * sign
    }
    return (b[by] - a[by]) * sign || a.key.localeCompare(b.key)
  })
}

export interface ProjectModels {
  userId: string
  username: string | null
  projects: Array<{
    projectId: string | null
    name: string | null
    deleted: boolean
    models: Array<{ model: string; provider: string; own: boolean; calls: number }>
  }>
}

/**
 * Which models each project used, per account — the instance's and the
 * person's own, told apart. Accounts and projects with the most calls first.
 */
export function modelsByProject(entries: SpendEntry[]): ProjectModels[] {
  const users = new Map<string, ProjectModels & { calls: number }>()
  for (const e of entries) {
    let u = users.get(e.userId)
    if (!u) {
      u = { userId: e.userId, username: e.username, projects: [], calls: 0 }
      users.set(e.userId, u)
    }
    u.calls += e.calls
    let p = u.projects.find((x) => x.projectId === e.projectId)
    if (!p) {
      p = { projectId: e.projectId, name: e.project, deleted: e.projectId ? e.projectDeleted : false, models: [] }
      u.projects.push(p)
    }
    const own = e.source === 'browser'
    const m = p.models.find((x) => x.model === e.model && x.own === own)
    if (m) m.calls += e.calls
    else p.models.push({ model: e.model, provider: e.provider, own, calls: e.calls })
  }
  const callsOf = (p: ProjectModels['projects'][number]) => p.models.reduce((n, m) => n + m.calls, 0)
  return [...users.values()]
    .sort((a, b) => b.calls - a.calls)
    .map(({ calls: _calls, ...u }) => ({
      ...u,
      projects: u.projects
        .map((p) => ({ ...p, models: [...p.models].sort((a, b) => b.calls - a.calls) }))
        .sort((a, b) => callsOf(b) - callsOf(a)),
    }))
}

/** The key a price is stored under — server/admin/spend.js `priceKey`, the same two halves. */
export const priceKey = (provider: string, model: string) => `${provider}::${model}`

export interface PricedModel {
  key: string
  provider: string
  model: string
  reported: number
  calls: number
}

/**
 * The models the instance paid for in these lines — the ones a price can apply
 * to — one row per PROVIDER and model: the same model sold by two providers has
 * two prices.
 */
export function pricedModels(entries: SpendEntry[]): PricedModel[] {
  const out = new Map<string, PricedModel>()
  for (const e of entries) {
    if (e.source === 'browser') continue
    const key = priceKey(e.provider, e.model)
    const m = out.get(key) ?? { key, provider: e.provider, model: e.model, reported: 0, calls: 0 }
    m.reported += e.reported
    m.calls += e.calls
    out.set(key, m)
  }
  return [...out.values()].sort((a, b) => b.calls - a.calls)
}

/** A stored price's key, split back: `provider::model`, or a bare model name from the first version. */
export function splitPriceKey(key: string): { provider: string | null; model: string } {
  const i = key.indexOf('::')
  return i < 0 ? { provider: null, model: key } : { provider: key.slice(0, i), model: key.slice(i + 2) }
}
