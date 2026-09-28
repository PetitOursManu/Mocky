// The dashboard's routes, mounted at /api/admin/dashboard behind requireAdmin.
//
// Everything here READS what the stores beside it already hold — presence,
// activity, the system sampler, the audit log — except the four verbs that
// change something: revoking a session, signing an account out everywhere, and
// setting or clearing the announcement. Each of those is audited.
//
// Live updates travel as Server-Sent Events rather than WebSockets. The data
// only flows one way, EventSource reconnects by itself, a reverse proxy passes
// it as the ordinary long HTTP response it is, and it costs no dependency —
// `ws` would have been the first package on the server added for one screen.

import express from 'express'
import { KINDS } from './activity.js'
import { makeAnnouncement, readAnnouncement } from './announcement.js'
import { listSessions, sessionId, tokenForId } from './sessions.js'

/** How often a live stream speaks. The sampler runs at 5 s; people and work change faster. */
export const TICK_MS = 2000

/** Open streams per account. A tab reloaded in a loop must not pile up timers. */
const MAX_STREAMS_PER_USER = 4

/** The worker is another container; asking it every tick would be rude. */
const WORKER_HEALTH_TTL_MS = 30_000

const DAY = 24 * 60 * 60 * 1000

/**
 * @param {object} d
 * @param {ReturnType<import('./presence.js').createPresence>} d.presence
 * @param {ReturnType<import('./activity.js').createActivity>} d.activity
 * @param {ReturnType<import('./system.js').createSystemMonitor>} d.system
 * @param {ReturnType<import('./audit.js').createAuditLog>} d.audit
 * @param {() => Array<object>} d.users
 * @param {{ load: () => object, save: (s: object) => void, lastUse: Map<string, number>, revokeUser: (userId: string, keepToken?: string|null) => number }} d.sessions
 * @param {(req) => string|null} d.tokenOf          the caller's own session token
 * @param {(req) => boolean} d.stillAdmin           re-checked on every tick, without counting as activity
 * @param {{ get: () => object|null, set: (a: object|null) => void }} d.announcement
 * @param {() => object} d.maintenance
 * @param {{ jobs: Array<object> }} d.queue
 * @param {() => Promise<object>} d.workerHealth
 * @param {() => object|null} d.storage
 * @param {(req) => object} d.actor
 */
export function createDashboardRouter(d) {
  const router = express.Router()
  /** res → userId, for the per-account cap and for shutdown. */
  const streams = new Map()

  let worker = null
  let workerAt = 0
  let workerPending = null
  function workerHealth() {
    if (Date.now() - workerAt > WORKER_HEALTH_TTL_MS && !workerPending) {
      workerPending = Promise.resolve()
        .then(() => d.workerHealth())
        .catch((err) => ({ available: false, reason: 'unreachable', detail: String(err?.message || err) }))
        .then((h) => {
          worker = h
          workerAt = Date.now()
          workerPending = null
        })
    }
    return worker
  }

  function nameMap() {
    return new Map(d.users().map((u) => [u.id, u]))
  }

  /** In-flight work, the render queue's running jobs included, with names attached. */
  function inflight(names) {
    return d.activity.inflight().map((e) => ({ ...e, username: names.get(e.userId)?.username || null }))
  }

  function videoQueue() {
    const jobs = Array.isArray(d.queue?.jobs) ? d.queue.jobs : []
    return {
      queued: jobs.filter((j) => j.status === 'queued').length,
      running: jobs.filter((j) => j.status === 'running').length,
    }
  }

  /**
   * One row per account — every account, not only the connected ones, so the
   * list answers "who has not been here" as well as "who is".
   */
  function people(names, live) {
    const seen = new Map(d.presence.snapshot().map((p) => [p.userId, p]))
    const hour = Date.now() - 60 * 60 * 1000
    const lastHour = new Map()
    for (const e of d.activity.recent({ limit: 5000 })) {
      if (e.startedAt < hour) continue
      let c = lastHour.get(e.userId)
      if (!c) lastHour.set(e.userId, (c = Object.fromEntries(KINDS.map((k) => [k, 0]))))
      c[e.kind]++
    }
    const rank = { active: 0, idle: 1, offline: 2 }
    return [...names.values()]
      .map((u) => {
        const p = seen.get(u.id)
        return {
          id: u.id,
          username: u.username,
          role: u.role || 'user',
          state: p?.state || 'offline',
          area: p?.area || null,
          tabs: p?.tabs || 0,
          lastSeen: p?.lastSeen || null,
          working: live.filter((e) => e.userId === u.id).map((e) => ({ kind: e.kind, action: e.action, startedAt: e.startedAt })),
          lastHour: lastHour.get(u.id) || Object.fromEntries(KINDS.map((k) => [k, 0])),
        }
      })
      .sort((a, b) => rank[a.state] - rank[b.state] || (b.lastSeen || 0) - (a.lastSeen || 0) || a.username.localeCompare(b.username))
  }

  function counts(rows) {
    let sessions = 0
    try {
      sessions = Object.keys(d.sessions.load() || {}).length
    } catch {
      /* reported as zero rather than failing the screen */
    }
    return {
      users: rows.length,
      admins: rows.filter((r) => r.role === 'admin').length,
      active: rows.filter((r) => r.state === 'active').length,
      online: rows.filter((r) => r.state !== 'offline').length,
      working: new Set(rows.filter((r) => r.working.length).map((r) => r.id)).size,
      sessions,
    }
  }

  function withNames(events, names) {
    return events.map((e) => ({ ...e, username: names.get(e.userId)?.username || null }))
  }

  /** What changes second to second: the payload of every tick, and part of the overview. */
  function live(names) {
    const running = inflight(names)
    const rows = people(names, running)
    return {
      now: Date.now(),
      people: rows,
      inflight: running,
      counts: counts(rows),
      sample: d.system.latest(),
      // Here and not only in `info`: the first reading lands a few seconds after
      // the screen opens (nobody was watching before), and "detecting…" must
      // turn into an answer without a reload.
      gpu: d.system.gpu(),
      perMinute: d.activity.perMinute(60),
      health: d.activity.health(),
      video: { ...videoQueue(), worker: workerHealth() },
      maintenance: d.maintenance(),
      // Scheduled ones too: the dashboard is where a scheduled announcement is
      // seen before anybody else sees it.
      announcement: readAnnouncement(d.announcement.get()),
    }
  }

  router.get('/overview', (req, res) => {
    const names = nameMap()
    res.setHeader('Cache-Control', 'no-store')
    res.json({
      ...live(names),
      info: d.system.info(),
      metrics: d.system.history(),
      events: withNames(d.activity.recent({ limit: 300 }), names),
      lastSeq: d.activity.lastSeq(),
      storage: d.storage(),
      security: {
        failedLogins24h: d.audit.countSince('auth.login-failed', DAY),
        lockouts24h: d.audit.countSince('auth.locked', DAY),
      },
    })
  })

  router.get('/live', (req, res) => {
    const userId = req.user.id
    const mine = [...streams].filter(([, uid]) => uid === userId).map(([r]) => r)
    for (const old of mine.slice(0, Math.max(0, mine.length - MAX_STREAMS_PER_USER + 1))) old.end()

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx buffers proxied responses by default, which would deliver a
      // minute of ticks at once. This header is how a response opts out.
      'X-Accel-Buffering': 'no',
    })
    res.write('retry: 5000\n\n')
    streams.set(res, userId)

    let since = Number(req.query.since)
    if (!Number.isFinite(since) || since < 0) since = d.activity.lastSeq()

    const send = () => {
      // A session revoked or an account demoted while the screen is open must
      // stop receiving, not keep a live view of everybody until the tab closes.
      if (!d.stillAdmin(req)) {
        res.write('event: bye\ndata: {}\n\n')
        res.end()
        return
      }
      const names = nameMap()
      const events = d.activity.recent({ since, limit: 200 })
      if (events.length) since = events[events.length - 1].seq
      res.write(`event: tick\ndata: ${JSON.stringify({ ...live(names), events: withNames(events, names), lastSeq: since })}\n\n`)
    }

    let timer = null
    try {
      send()
      timer = setInterval(() => {
        try {
          send()
        } catch {
          res.end()
        }
      }, TICK_MS)
    } catch {
      res.end()
    }
    res.on('close', () => {
      if (timer) clearInterval(timer)
      streams.delete(res)
    })
  })

  router.get('/sessions', (req, res) => {
    res.json({
      sessions: listSessions(d.sessions.load(), d.users(), {
        lastUse: d.sessions.lastUse,
        currentToken: d.tokenOf(req),
      }),
    })
  })

  router.delete('/sessions/:id', (req, res) => {
    const store = d.sessions.load()
    const token = tokenForId(store, req.params.id)
    if (!token) return res.status(404).json({ error: 'Session introuvable.' })
    // Your own session is ended by signing out, which also clears the cookie;
    // revoking it from here would leave the tab believing it is signed in.
    if (token === d.tokenOf(req)) return res.status(400).json({ code: 'own-session', error: 'Utilisez « Se déconnecter ».' })
    const owner = store[token]?.u
    delete store[token]
    d.sessions.save(store)
    d.sessions.lastUse.delete(req.params.id)
    const target = d.users().find((u) => u.id === owner)
    d.audit.record({
      action: 'session.revoke',
      actor: d.actor(req),
      target: target ? { id: target.id, name: target.username } : null,
      ip: req.ip,
    })
    res.json({ ok: true })
  })

  router.post('/users/:id/signout', (req, res) => {
    const target = d.users().find((u) => u.id === req.params.id)
    if (!target) return res.status(404).json({ error: 'Compte introuvable.' })
    // Signing yourself out everywhere keeps THIS session — the admin asked to
    // close the others, not to lose the screen they asked from.
    const keep = target.id === req.user.id ? d.tokenOf(req) : null
    const revoked = d.sessions.revokeUser(target.id, keep)
    if (!keep) d.presence.forget(target.id)
    d.audit.record({
      action: 'user.signout',
      actor: d.actor(req),
      target: { id: target.id, name: target.username },
      detail: { revoked },
      ip: req.ip,
    })
    res.json({ ok: true, revoked })
  })

  router.get('/audit', (req, res) => {
    const group = typeof req.query.group === 'string' && /^[a-z]{2,16}$/.test(req.query.group) ? req.query.group : null
    const before = typeof req.query.before === 'string' ? req.query.before.slice(0, 32) : null
    res.json({ entries: d.audit.list({ limit: Number(req.query.limit) || 200, before, group }) })
  })

  router.put('/announcement', (req, res) => {
    let next
    try {
      next = makeAnnouncement(req.body || {}, { previous: readAnnouncement(d.announcement.get()) })
    } catch (err) {
      return res.status(err?.statusCode || 400).json({ error: err.message })
    }
    d.announcement.set(next)
    d.audit.record({
      action: 'announcement.set',
      actor: d.actor(req),
      detail: { tone: next.tone, length: next.message.length, scheduled: next.startsAt != null, expires: next.expiresAt != null },
      ip: req.ip,
    })
    res.json({ announcement: readAnnouncement(next) })
  })

  router.delete('/announcement', (req, res) => {
    d.announcement.set(null)
    d.audit.record({ action: 'announcement.clear', actor: d.actor(req), ip: req.ip })
    res.json({ announcement: null })
  })

  return {
    router,
    /** Somebody has the dashboard open: the GPU is worth reading every sample. */
    watched: () => streams.size > 0,
    /** Shutdown: an open stream would hold `server.close()` until its timeout. */
    closeAll() {
      for (const res of streams.keys()) {
        try {
          res.end()
        } catch {
          /* already gone */
        }
      }
      streams.clear()
    },
    sessionId,
  }
}
