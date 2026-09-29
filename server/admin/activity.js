// What people are doing with the instance, and how the providers answer them.
//
// One ring of events feeds three views of the dashboard — who is generating
// right now, the live feed, and the health of each provider — because they are
// three questions about the same requests. A second store for provider health
// would have to be kept in step with the first by hand, and the day it was not,
// the dashboard would show a Muse run in the feed that no provider ever served.
//
// What an event records is deliberately poor: WHO, WHAT KIND of work, WHICH
// provider, HOW LONG and HOW IT ENDED. Never a prompt, a brief, a project name
// or a provider's error text. The administrator chose that (the dashboard shows
// the type of action only), and it is also the only version of this feature that
// is safe to leave on: an error message from a provider can quote the prompt it
// refused, so even the "harmless" text is kept out and reduced to an outcome.
//
// In memory, one hour, like the metrics beside it. A restart forgets it, which
// is the price of never writing a line per request to the volume.

/** The kinds of work the dashboard tells apart. Order is the display order. */
export const KINDS = ['mocky', 'muse', 'image', 'stock', 'clip', 'film']

/**
 * What the browser may say a model call is for (`x-mocky-purpose`).
 *
 * A closed list: the header is written by our own client, but it arrives from a
 * browser like everything else, and an open string would let anybody put words
 * of their choosing on the administrator's screen.
 */
export const PURPOSES = new Set([
  'generate',
  'edit',
  'fix',
  'polish',
  'audit-fix',
  'plan',
  'read-site',
  'design-system',
  'storyboard',
  'stock-pick',
  'enhance',
])

/** POST routes that are work, mapped to what they are. Everything else is not tracked. */
const POST_ROUTES = new Map([
  ['/api/muse/dossier', ['muse', 'dossier']],
  ['/api/muse/quality', ['muse', 'quality']],
  ['/api/muse/audit', ['muse', 'audit']],
  ['/api/images/generate', ['image', 'generate']],
  ['/api/images/stock/pick', ['stock', 'pick']],
  ['/api/images/stock/candidates', ['stock', 'candidates']],
  ['/api/images/stock/import', ['stock', 'import']],
  ['/api/videos/generate', ['clip', 'generate']],
  ['/api/video/compose', ['film', 'compose']],
  ['/api/video/variants', ['film', 'variants']],
  ['/api/video/render', ['film', 'queue']],
])

/**
 * Which kind of work a request is, or null when it is not work at all.
 *
 * Reads the ORIGINAL url: this runs as app-level middleware, but it must give
 * the same answer if it is ever mounted under a prefix, which is the mistake
 * `handleProviderProxy` documents about `req.url` under Express.
 */
export function classifyRequest(req) {
  const method = String(req?.method || '').toUpperCase()
  if (method !== 'POST') return null
  const path = String(req.originalUrl || req.url || '').split('?')[0]
  if (path === '/__provider/api/chat') {
    const raw = req.headers?.['x-mocky-purpose']
    const purpose = String(Array.isArray(raw) ? raw[0] : raw || '').toLowerCase()
    return { kind: 'mocky', action: PURPOSES.has(purpose) ? purpose : 'generate' }
  }
  const hit = POST_ROUTES.get(path)
  return hit ? { kind: hit[0], action: hit[1] } : null
}

/**
 * How a request ended, as a word rather than a message (see the header).
 * `aborted` is the CLIENT leaving — a cancelled generation is not a provider
 * failure, and counting it as one would make a user's Stop button read as an
 * outage.
 */
export function outcomeOf(status, aborted) {
  if (aborted) return 'aborted'
  const s = Number(status) || 0
  if (s > 0 && s < 400) return 'ok'
  if (s === 429) return 'rate-limited'
  if (s === 401 || s === 403) return 'refused'
  if (s === 408 || s === 504) return 'timeout'
  if (s === 503) return 'unavailable'
  if (s >= 400 && s < 500) return 'invalid'
  return 'failed'
}

/** Outcomes that say nothing about the provider's health. */
const NEUTRAL = new Set(['ok', 'aborted'])

/**
 * A request refused as malformed — by Mocky's own validation as often as by the
 * provider. Counted apart: an empty prompt answered 400 in 2 ms is not an
 * outage, and folding it into the failure rate put a red badge on a provider
 * that had not been called at all.
 */
const REJECTED = 'invalid'

/** A provider label is shown as text; keep it a short, boring token. */
export function cleanProvider(p) {
  const s = String(p ?? '')
    .replace(/[^\w.:-]/g, '')
    .slice(0, 64)
  return s || 'unknown'
}

function percentile(sorted, q) {
  if (!sorted.length) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))
  return sorted[i]
}

/**
 * A request still marked live after this long was lost (a socket that never
 * closed); it is ended as a timeout rather than left in "running" forever. Far
 * above any real call — a film compose is a minute, a long generation ten.
 */
const LOST_AFTER_MS = 30 * 60 * 1000

export function createActivity({ now = Date.now, windowMs = 60 * 60 * 1000, maxEvents = 5000 } = {}) {
  let nextId = 0
  let nextSeq = 0
  const live = new Map()
  /** Finished events, oldest first. */
  const done = []

  function prune() {
    const t = now()
    for (const [id, e] of live) {
      if (t - e.startedAt > LOST_AFTER_MS) finish(id, { status: 504, aborted: false })
    }
    const floor = t - windowMs
    let drop = 0
    while (drop < done.length && done[drop].endedAt < floor) drop++
    if (done.length - drop > maxEvents) drop = done.length - maxEvents
    if (drop) done.splice(0, drop)
  }

  function finish(id, { status, aborted, ttfb, provider, source } = {}) {
    const e = live.get(id)
    if (!e) return null
    live.delete(id)
    // Known only once the body was parsed — see createTracker.
    if (provider) e.provider = cleanProvider(provider)
    if (source) e.source = source === 'browser' ? 'browser' : 'instance'
    const endedAt = now()
    const ev = {
      seq: ++nextSeq,
      userId: e.userId,
      kind: e.kind,
      action: e.action,
      provider: e.provider,
      source: e.source,
      startedAt: e.startedAt,
      endedAt,
      ms: endedAt - e.startedAt,
      ttfb: typeof ttfb === 'number' ? ttfb : null,
      status: Number(status) || 0,
      outcome: outcomeOf(status, aborted),
    }
    done.push(ev)
    return ev
  }

  return {
    /** Start tracking one request. Returns the id `end` takes. */
    begin({ userId, kind, action, provider, source = 'instance' }) {
      const id = ++nextId
      live.set(id, {
        id,
        userId,
        kind: KINDS.includes(kind) ? kind : 'mocky',
        action: String(action || 'other').slice(0, 32),
        provider: cleanProvider(provider),
        source: source === 'browser' ? 'browser' : 'instance',
        startedAt: now(),
      })
      return id
    },

    /** Milliseconds since `begin`, for the first byte. */
    elapsed(id) {
      const e = live.get(id)
      return e ? now() - e.startedAt : null
    },

    end(id, result) {
      const ev = finish(id, result)
      prune()
      return ev
    },

    /** What is running right now, oldest first. */
    inflight() {
      prune()
      return [...live.values()].sort((a, b) => a.startedAt - b.startedAt).map((e) => ({ ...e }))
    },

    /** Finished events after `since` (a seq), oldest first, at most `limit` of the newest. */
    recent({ since = 0, limit = 500 } = {}) {
      prune()
      const out = done.filter((e) => e.seq > since)
      return out.slice(Math.max(0, out.length - limit))
    },

    /** The highest seq handed out so far — what a live stream resumes from. */
    lastSeq() {
      return nextSeq
    },

    /**
     * One row per (kind, provider) over the window.
     *
     * Durations are taken from successful calls only: a refusal answered in
     * 40 ms would otherwise make a failing provider look fast.
     */
    health() {
      prune()
      const groups = new Map()
      for (const e of done) {
        const key = `${e.kind}|${e.provider}`
        let g = groups.get(key)
        if (!g) {
          g = { kind: e.kind, provider: e.provider, source: e.source, count: 0, ok: 0, aborted: 0, invalid: 0, errors: 0, outcomes: {}, ms: [], ttfb: [], lastAt: 0, lastError: null }
          groups.set(key, g)
        }
        g.count++
        g.outcomes[e.outcome] = (g.outcomes[e.outcome] || 0) + 1
        if (e.outcome === 'ok') {
          g.ok++
          g.ms.push(e.ms)
          if (e.ttfb != null) g.ttfb.push(e.ttfb)
        } else if (e.outcome === 'aborted') g.aborted++
        else if (e.outcome === REJECTED) g.invalid++
        if (!NEUTRAL.has(e.outcome) && e.outcome !== REJECTED) {
          g.errors++
          g.lastError = { at: e.endedAt, outcome: e.outcome, status: e.status }
        }
        g.lastAt = Math.max(g.lastAt, e.endedAt)
      }
      return [...groups.values()]
        .map(({ ms, ttfb, ...g }) => {
          ms.sort((a, b) => a - b)
          ttfb.sort((a, b) => a - b)
          const judged = g.count - g.aborted - g.invalid
          return {
            ...g,
            errorRate: judged > 0 ? g.errors / judged : null,
            p50: percentile(ms, 0.5),
            p95: percentile(ms, 0.95),
            ttfbP50: percentile(ttfb, 0.5),
          }
        })
        .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || b.count - a.count)
    },

    /**
     * Requests started per minute over the window, by kind — the chart on the
     * overview. Oldest bucket first, the current minute last.
     */
    perMinute(minutes = 60) {
      prune()
      const t = now()
      const end = Math.floor(t / 60_000) * 60_000
      const start = end - (minutes - 1) * 60_000
      const buckets = Array.from({ length: minutes }, (_, i) => {
        const b = { t: start + i * 60_000 }
        for (const k of KINDS) b[k] = 0
        return b
      })
      const add = (at, kind) => {
        const i = Math.floor((at - start) / 60_000)
        if (i >= 0 && i < minutes) buckets[i][kind]++
      }
      for (const e of done) add(e.startedAt, e.kind)
      for (const e of live.values()) add(e.startedAt, e.kind)
      return buckets
    },
  }
}

/**
 * The middleware: classify, find the account, time the request to its first
 * byte and to its end.
 *
 * `userOf` must NOT refuse anything — an anonymous request simply is not
 * tracked, and the route itself answers it as it always did. The tracker only
 * watches; the one thing it changes is that `res.writeHead` is wrapped to note
 * the time of the first byte, which is what "how fast does this provider
 * answer" means for a streamed generation whose END is the length of the page.
 */
export function createTracker({ activity, userOf, providerOf = () => ({ provider: 'unknown' }) }) {
  return function track(req, res, next) {
    const c = classifyRequest(req)
    if (!c) return next()
    let user = null
    try {
      user = userOf(req)
    } catch {
      user = null
    }
    if (!user) return next()
    // Asked twice: now, for the in-flight row, and again at the end, because
    // this runs BEFORE express.json() — the body that names an image profile or
    // a stock library is only parsed by the time the request closes.
    const where = () => {
      try {
        return { provider: 'unknown', source: 'instance', ...providerOf(c, req) }
      } catch {
        return { provider: 'unknown', source: 'instance' }
      }
    }
    const first = where()
    const id = activity.begin({ userId: user.id, kind: c.kind, action: c.action, provider: first.provider, source: first.source })
    let ttfb = null
    const writeHead = res.writeHead
    res.writeHead = function (...args) {
      if (ttfb === null) ttfb = activity.elapsed(id)
      return writeHead.apply(this, args)
    }
    res.once('close', () => {
      const last = where()
      activity.end(id, { status: res.statusCode, aborted: !res.writableFinished, ttfb, provider: last.provider, source: last.source })
    })
    next()
  }
}
