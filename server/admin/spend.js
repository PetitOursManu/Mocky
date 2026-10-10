// What the models cost: tokens in and out, per day, account, project, provider
// and model — and the price, the provider's own when it reports one.
//
// The activity stream (activity.js) keeps an hour, in memory, and by design no
// project; the usage report (usage.js) is about bytes on disk. Neither could
// answer the two questions an administrator who pays for a key asks: "which
// model did this project use" and "where did the money go this month". This is
// the ledger for both.
//
// ── What a line holds ──────────────────────────────────────────────────────
//
// Counts and names, never content (D1): the day, the account's id, the
// project's id (as the browser declared it, checked against a charset and
// nothing else — it attributes, it does not authorise), the provider, the
// model, whether the instance's key or the person's own was used, and numbers.
// A call on a person's OWN key (F4) is recorded by model and project only: its
// tokens and its price are the person's business, and "API perso + the model"
// is all the administrator was promised to see.
//
// ── The price ──────────────────────────────────────────────────────────────
//
// A provider that reports what it charged (OpenRouter's `usage.cost`) is
// believed: no table can know a discount, a cached prompt or a routing choice.
// The tokens of every other call are priced at read time from the table an
// administrator fills in (`spend-prices.json`, dollars per million tokens), so
// correcting a price corrects the past — and a model with no price says so
// instead of counting as free.
//
// ── On disk ────────────────────────────────────────────────────────────────
//
// `spend.jsonl`, one line per call, appended — the audit log's discipline. The
// lines are folded into one per (day, account, project, provider, model, key)
// in memory, and the file is rewritten as those folded lines once it holds
// `MAX_LINES`, so it grows with the number of things that happened, not with
// the number of times they did.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const MAX_LINES = 20_000
const PROJECT_ID = /^[A-Za-z0-9_-]{1,64}$/
const NAME = /^[\w.:/@+ -]{1,200}$/

/** The day on the server's clock, as the free quota counts it (server/plan.js). */
export function dayOf(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** A project id from a header, or null — the charset is the whole check (see above). */
export function cleanProjectId(raw) {
  const id = String(raw || '').trim()
  return PROJECT_ID.test(id) ? id : null
}

const clean = (v, max = 200) => {
  const s = String(v || '').trim().slice(0, max)
  return NAME.test(s) ? s : ''
}
const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0)

const keyOf = (e) => [e.d, e.u, e.p || '', e.prov, e.m, e.src].join('|')

/**
 * One call, as a ledger line. `source` is `instance` or `browser` (own key);
 * on `browser` the numbers are dropped here, at the door.
 */
export function lineFor({ at, userId, projectId, provider, source, model, input, output, cost, estimated }) {
  const own = source === 'browser'
  const reported = !own && Number.isFinite(cost) && cost >= 0
  const line = {
    d: dayOf(at),
    u: String(userId || ''),
    p: cleanProjectId(projectId),
    prov: clean(provider, 80) || 'unknown',
    m: clean(model) || 'unknown',
    src: own ? 'browser' : 'instance',
    n: 1,
  }
  if (!own) {
    line.in = count(input)
    line.out = count(output)
    if (reported) {
      line.cost = Number(cost)
      line.costN = 1
    } else {
      // Tokens with no reported price: what the table will price.
      line.uin = line.in
      line.uout = line.out
    }
    if (estimated) line.estN = 1
  }
  return line
}

const SUMS = ['n', 'in', 'out', 'cost', 'costN', 'uin', 'uout', 'estN']

function fold(into, line) {
  for (const k of SUMS) {
    if (line[k]) into[k] = (into[k] || 0) + line[k]
  }
}

/**
 * The cost of one folded line: reported + priced, and whether some of it could
 * not be priced. Pure — the panel and the tests read the same answer.
 * @param {object} e  a folded line
 * @param {Record<string, {in:number, out:number}>} prices  dollars per million tokens
 */
export function costOf(e, prices = {}) {
  if (e.src === 'browser') return { cost: null, unpriced: false }
  const reported = e.cost || 0
  const left = (e.uin || 0) + (e.uout || 0)
  if (!left) return { cost: e.costN ? reported : 0, unpriced: false }
  const price = prices[e.m]
  if (!price) return { cost: e.costN ? reported : null, unpriced: true }
  return { cost: reported + ((e.uin || 0) * (price.in || 0) + (e.uout || 0) * (price.out || 0)) / 1e6, unpriced: false }
}

/** Prices as an administrator typed them: per model, two non-negative numbers. */
export function cleanPrices(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [model, p] of Object.entries(raw).slice(0, 500)) {
    const m = clean(model)
    if (!m || !p || typeof p !== 'object') continue
    const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(Number(v), 1e6) : 0)
    out[m] = { in: num(p.in), out: num(p.out) }
  }
  return out
}

export function createSpendLedger(dataDir, { now = () => new Date(), maxLines = MAX_LINES } = {}) {
  const file = path.join(dataDir, 'spend.jsonl')
  const pricesFile = path.join(dataDir, 'spend-prices.json')
  /** key → folded line */
  const folded = new Map()
  let lines = 0

  function add(line) {
    const k = keyOf(line)
    const cur = folded.get(k)
    if (cur) fold(cur, line)
    else {
      const first = { d: line.d, u: line.u, p: line.p, prov: line.prov, m: line.m, src: line.src }
      fold(first, line)
      folded.set(k, first)
    }
  }

  try {
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!raw.trim()) continue
      try {
        const line = JSON.parse(raw)
        if (line && line.d && line.u) {
          add(line)
          lines++
        }
      } catch {
        /* a torn last line from a crash: skipped, like the audit log's */
      }
    }
  } catch {
    /* no ledger yet */
  }

  function compact() {
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    const body = [...folded.values()].map((e) => JSON.stringify(e)).join('\n')
    fs.writeFileSync(tmp, body ? body + '\n' : '', { mode: 0o600 })
    fs.renameSync(tmp, file)
    lines = folded.size
  }

  return {
    /** One call. Never throws: counting is not worth a failed generation. */
    record(call) {
      try {
        if (!call?.userId) return
        const line = lineFor({ ...call, at: now() })
        add(line)
        fs.mkdirSync(dataDir, { recursive: true })
        fs.appendFileSync(file, JSON.stringify(line) + '\n', { mode: 0o600 })
        if (++lines > maxLines) compact()
      } catch {
        /* a full disk loses a count, not a screen */
      }
    },
    /** The folded lines from `since` (a day key) on, newest day first. */
    entries(since = '') {
      return [...folded.values()].filter((e) => e.d >= since).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0))
    },
    prices() {
      try {
        return cleanPrices(JSON.parse(fs.readFileSync(pricesFile, 'utf8')).prices)
      } catch {
        return {}
      }
    },
    setPrices(raw) {
      const prices = cleanPrices(raw)
      fs.mkdirSync(dataDir, { recursive: true })
      const tmp = `${pricesFile}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, prices }, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, pricesFile)
      return prices
    },
  }
}
