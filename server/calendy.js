/**
 * Calendy — the editorial calendar a campaign's pieces are sent to, as ideas
 * to validate (src/lib/campaignSchedule.ts on the other side).
 *
 * Why the SERVER makes these calls: Calendy refuses any request carrying a
 * foreign `Origin` (its anti-CSRF rule, 403), so a browser on Mocky's origin
 * cannot reach it at all — and the token, which can create and delete posts,
 * has no business in a browser anyway. So each account stores its Calendy
 * address and token here, in `calendy.json` (its own file, like
 * `mcp-prefs.json`: a person's own setting, never an admin action), and the
 * token never travels back: the browser is told only "connected to <host>".
 *
 * What is sent is always an IDEA (`statut: "idee"`). Mocky never validates,
 * schedules or publishes on the person's behalf — Calendy's own "À valider"
 * tab is where that happens.
 *
 * Calendy keeps no external id, so idempotence is Mocky's: the browser passes
 * the id a piece got last time; a post still there is updated, a post gone is
 * looked for by its day and title before a new one is created.
 *
 * Every outbound address goes through the SSRF guard: a Calendy is a public
 * site, so this is NOT one of the administrator-only bypasses. No redirect is
 * followed, and no `Origin` is sent.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import { assertSafeTargetResolved } from './provider-proxy.js'

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn']
const SLOTS = ['meta', 'linkedin']
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const ID_RE = /^[\w-]{1,64}$/
/** Calendy's own limit per picture. */
export const PHOTO_MAX = 8 * 1024 * 1024
const TIMEOUT_MS = 20_000
/** Cloudflare in front of Calendy refuses some default user agents (error 1010). */
const USER_AGENT = 'Mocky-Calendy/1.0'

/** `https://cal.example.org/`, `…/api`, `…/api/` → `https://cal.example.org`. Null when it is not an address. */
export function normalizeBase(raw) {
  let url
  try {
    url = new URL(String(raw || '').trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  url.hash = ''
  url.search = ''
  const p = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '')
  return `${url.origin}${p}`
}

export class CalendyStore {
  /** `fileName`: Sprixy keeps its links the same way, in its own file (server/sprixy.js). */
  constructor(dataDir, fileName = 'calendy.json') {
    this.file = path.join(dataDir, fileName)
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      this.links = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    } catch {
      this.links = {}
    }
  }

  /** The full record, token included — for this module's calls only. */
  get(userId) {
    const l = this.links[userId]
    return l && typeof l.base === 'string' && typeof l.token === 'string' ? l : null
  }

  /** What the browser may know. */
  view(userId) {
    const l = this.get(userId)
    if (!l) return { connected: false }
    let host = l.base
    try {
      host = new URL(l.base).host
    } catch {
      /* a stored base is always a URL; the raw string is the fallback */
    }
    return { connected: true, host }
  }

  /** Throws when it could not be written; the caller says so. */
  set(userId, link) {
    const next = { ...this.links }
    if (link) next[userId] = { base: link.base, token: link.token, at: Date.now() }
    else delete next[userId]
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, this.file)
    this.links = next
  }

  /** An account deleted takes its link with it. */
  forget(userId) {
    if (!(userId in this.links)) return
    try {
      this.set(userId, null)
    } catch {
      /* the account is gone either way */
    }
  }
}

/** A post as Mocky sends it, validated; throws a 400-worthy message otherwise. */
export function cleanPost(body) {
  const date = String(body?.date || '')
  if (!DATE_RE.test(date)) throw new Error('A date (YYYY-MM-DD) is required.')
  const time = body?.time ? String(body.time) : ''
  if (time && !TIME_RE.test(time)) throw new Error('The time must be HH:MM.')
  const titre = String(body?.titre || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!titre) throw new Error('A title is required.')
  const plateformes = [...new Set(Array.isArray(body?.plateformes) ? body.plateformes : [])].filter((p) => PLATFORMS.includes(p))
  if (!plateformes.length) throw new Error('At least one network is required.')
  const imageIdee = String(body?.imageIdee || '').slice(0, 1000)
  const calendyId = body?.calendyId && ID_RE.test(String(body.calendyId)) ? String(body.calendyId) : null
  // The publication pack's caption, sent with a NEW idea only: once the post
  // exists, its text is the person's, written in Calendy.
  const description = typeof body?.description === 'string' ? body.description.slice(0, 5000) : ''
  const hashtags = typeof body?.hashtags === 'string' ? body.hashtags.replace(/\s+/g, ' ').trim().slice(0, 1000) : ''
  return { date, time, titre, plateformes, imageIdee, calendyId, description, hashtags }
}

const samePlatforms = (a, b) => a.length === b.length && a.every((p) => b.includes(p))

/**
 * One call to Calendy. `assertTarget` is the SSRF guard (injected so the tests
 * can point it at a local fake); no redirect is followed, no Origin is sent.
 */
async function call(link, method, pathname, { json, raw, type, assertTarget, fetchImpl }) {
  const url = `${link.base}${pathname}`
  await assertTarget(url)
  const headers = { Authorization: `Bearer ${link.token}`, 'User-Agent': USER_AGENT, Accept: 'application/json' }
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (raw) {
    headers['Content-Type'] = type
    body = raw
  }
  const res = await fetchImpl(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* not JSON: the status alone answers */
  }
  return { status: res.status, data }
}

/** Calendy's answer as one short sentence: never the token, never a body that could quote one. */
function failure(status) {
  if (status === 401) return 'Calendy refused the token.'
  if (status === 403) return 'Calendy refused the request.'
  if (status === 404) return 'Not found on Calendy.'
  if (status === 413) return 'The picture is too large for Calendy.'
  if (status >= 300 && status < 400) return 'Calendy answered with a redirect; check the address.'
  return `Calendy answered ${status}.`
}

export function calendyRouter({ store, requireUser, assertTarget = assertSafeTargetResolved, fetchImpl = fetch }) {
  const router = express.Router()
  const deps = { assertTarget, fetchImpl }

  router.get('/', requireUser, (req, res) => res.json(store.view(req.user.id)))

  /** Connect (checked against Calendy before it is kept) or disconnect with `{ base: null }`. */
  router.put('/', requireUser, async (req, res) => {
    if (req.body?.base === null) {
      store.set(req.user.id, null)
      return res.json(store.view(req.user.id))
    }
    const base = normalizeBase(req.body?.base)
    const token = String(req.body?.token || '').trim()
    if (!base) return res.status(400).json({ error: 'Invalid address.' })
    if (!token || token.length > 512) return res.status(400).json({ error: 'A token is required.' })
    try {
      // A day nobody posts on: the token is checked, nothing is listed.
      const r = await call({ base, token }, 'GET', '/api/posts?du=1900-01-01&au=1900-01-01', deps)
      if (r.status !== 200) return res.status(400).json({ error: failure(r.status) })
    } catch (err) {
      return res.status(400).json({ error: /not allowed|Invalid target/.test(err?.message) ? 'This address is not allowed.' : 'Calendy could not be reached.' })
    }
    try {
      store.set(req.user.id, { base, token })
    } catch {
      return res.status(500).json({ error: 'Could not save the connection.' })
    }
    res.json(store.view(req.user.id))
  })

  /**
   * The post a piece becomes: the one it became last time if it still exists,
   * otherwise one already there on that day with that title and those
   * networks, otherwise a new idea. Answers its id.
   */
  router.post('/posts', requireUser, async (req, res) => {
    const link = store.get(req.user.id)
    if (!link) return res.status(409).json({ error: 'Calendy is not connected.' })
    let post
    try {
      post = cleanPost(req.body)
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }
    try {
      if (post.calendyId) {
        const r = await call(link, 'GET', `/api/posts/${encodeURIComponent(post.calendyId)}`, deps)
        if (r.status === 200 && r.data?.id === post.calendyId) {
          // The day and the time follow the piece; the text written in
          // Calendy since is the person's and is not touched.
          const u = await call(link, 'PUT', `/api/posts/${encodeURIComponent(post.calendyId)}`, { ...deps, json: { datePublication: post.date, heure: post.time } })
          if (u.status !== 200) return res.status(502).json({ error: failure(u.status) })
          return res.json({ id: post.calendyId, created: false })
        }
        if (r.status !== 404) return res.status(502).json({ error: failure(r.status) })
      }
      const q = new URLSearchParams({ du: post.date, au: post.date, q: post.titre })
      const found = await call(link, 'GET', `/api/posts?${q}`, deps)
      if (found.status !== 200) return res.status(502).json({ error: failure(found.status) })
      const twin = (Array.isArray(found.data) ? found.data : []).find(
        (p) => p?.titre === post.titre && p?.datePublication === post.date && samePlatforms(p?.plateformes ?? [], post.plateformes),
      )
      if (twin && ID_RE.test(String(twin.id))) return res.json({ id: String(twin.id), created: false })
      const made = await call(link, 'POST', '/api/posts', {
        ...deps,
        json: {
          titre: post.titre,
          datePublication: post.date,
          heure: post.time,
          plateformes: post.plateformes,
          imageIdee: post.imageIdee,
          ...(post.description ? { description: post.description } : {}),
          ...(post.hashtags ? { hashtags: post.hashtags } : {}),
          statut: 'idee',
        },
      })
      const id = made.data?.id
      if ((made.status !== 200 && made.status !== 201) || !ID_RE.test(String(id))) return res.status(502).json({ error: failure(made.status) })
      res.json({ id: String(id), created: true })
    } catch (err) {
      res.status(502).json({ error: /not allowed/.test(err?.message) ? 'This address is not allowed.' : 'Calendy could not be reached.' })
    }
  })

  /** One picture of a post's visual. `?replace=1` on the first: the visual is the piece as it is now. */
  router.post(
    '/posts/:id/photo/:slot',
    requireUser,
    express.raw({ type: ['image/png', 'image/jpeg'], limit: PHOTO_MAX }),
    async (req, res) => {
      const link = store.get(req.user.id)
      if (!link) return res.status(409).json({ error: 'Calendy is not connected.' })
      const { id, slot } = req.params
      if (!ID_RE.test(id) || !SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid post or visual.' })
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      if (!Buffer.isBuffer(req.body) || !req.body.length || !['image/png', 'image/jpeg'].includes(type)) {
        return res.status(400).json({ error: 'A PNG or JPEG picture is required.' })
      }
      try {
        const method = req.query.replace === '1' ? 'PUT' : 'POST'
        const r = await call(link, method, `/api/posts/${encodeURIComponent(id)}/photo/${slot}`, { ...deps, raw: req.body, type })
        if (r.status !== 200 && r.status !== 201) return res.status(502).json({ error: failure(r.status) })
        res.json({ ok: true })
      } catch (err) {
        res.status(502).json({ error: /not allowed/.test(err?.message) ? 'This address is not allowed.' : 'Calendy could not be reached.' })
      }
    },
  )

  return router
}
