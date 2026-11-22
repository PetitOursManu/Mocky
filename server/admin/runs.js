/**
 * One generation, as a trace: every call it made, how long each took, the
 * tokens and the price the provider reported — read back by the account that
 * ran it (`GET /api/runs/:id`).
 *
 * Why it exists: "one prompt" is measured in calls, seconds and money
 * (plans/sites-interactifs.md, §6), and the two stores that already see a call
 * cannot answer per run. The activity ring keeps one event per request with no
 * tokens; the spending ledger folds tokens by DAY. A run id the browser sends
 * beside every call of one generation (`x-mocky-run`, lib/proxy.ts) is the
 * thread both are hung on here.
 *
 * In memory only, like presence and activity: a trace is read during or just
 * after the run it describes, and a restart losing it costs a re-run, not a
 * record anybody relied on. Bounded twice — runs (oldest dropped) and calls per
 * run — so a client that sends the header forever cannot grow it.
 *
 * Never content (D1): purpose, provider, model, timings, counts. A run id names
 * and never authorises — it is read only for the account that sent it.
 */

const RUN_ID = /^[A-Za-z0-9_-]{8,64}$/
const MAX_RUNS = 300
const MAX_CALLS = 200
const TTL_MS = 2 * 60 * 60 * 1000

export function cleanRunId(raw) {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return RUN_ID.test(v) ? v : null
}

const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0)
const word = (v, n = 60) => (typeof v === 'string' ? v.replace(/[^\w.:/@+-]/g, '').slice(0, n) : '')

export function createRunLog({ now = () => Date.now(), maxRuns = MAX_RUNS, maxCalls = MAX_CALLS, ttlMs = TTL_MS } = {}) {
  /** key `${userId}|${runId}` → run */
  const runs = new Map()

  const prune = () => {
    const limit = now() - ttlMs
    for (const [k, r] of runs) if (r.lastAt < limit) runs.delete(k)
    while (runs.size > maxRuns) runs.delete(runs.keys().next().value)
  }
  const runOf = (userId, runId) => {
    const id = cleanRunId(runId)
    if (!id || !userId) return null
    const key = `${userId}|${id}`
    let r = runs.get(key)
    if (!r) {
      prune()
      r = { runId: id, startedAt: now(), lastAt: now(), calls: [], usage: { calls: 0, input: 0, output: 0, cost: 0, priced: 0, estimated: 0 } }
      runs.set(key, r)
    }
    r.lastAt = now()
    return r
  }

  return {
    /** A request of the run ended (from the activity tracker). */
    call(userId, runId, e) {
      const r = runOf(userId, runId)
      if (!r || r.calls.length >= maxCalls) return
      r.calls.push({
        kind: word(e.kind, 20),
        action: word(e.action, 40),
        provider: word(e.provider, 80),
        ms: Math.round(num(e.ms)),
        ttfb: e.ttfb == null ? null : Math.round(num(e.ttfb)),
        status: Math.round(num(e.status)),
        outcome: word(e.outcome, 20),
      })
    },
    /** Tokens a model call reported (from the spending meter). */
    usage(userId, runId, u) {
      const r = runOf(userId, runId)
      if (!r) return
      r.usage.calls += 1
      r.usage.input += Math.round(num(u.input))
      r.usage.output += Math.round(num(u.output))
      if (Number.isFinite(u.cost) && u.cost >= 0) {
        r.usage.cost += u.cost
        r.usage.priced += 1
      }
      if (u.estimated) r.usage.estimated += 1
      if (u.model && !r.model) r.model = word(u.model, 80)
    },
    /** The trace, for the account that ran it — or null. */
    get(userId, runId) {
      const id = cleanRunId(runId)
      if (!id || !userId) return null
      const r = runs.get(`${userId}|${id}`)
      if (!r) return null
      const ms = r.calls.reduce((s, c) => s + c.ms, 0)
      return {
        runId: r.runId,
        startedAt: new Date(r.startedAt).toISOString(),
        wallMs: r.lastAt - r.startedAt,
        model: r.model || null,
        calls: r.calls.slice(),
        totals: { requests: r.calls.length, requestMs: ms, ...r.usage, cost: Math.round(r.usage.cost * 1e6) / 1e6 },
      }
    },
  }
}
