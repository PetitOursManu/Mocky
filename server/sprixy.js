/**
 * Sprixy — the self-hosted studio of 2D game assets (pixel-art sprites, icons,
 * tiles, UI). A person connects THEIR Sprixy to their Mocky account, and the
 * assets of the projects they chose to share there can go into their designs.
 *
 * Shaped like Calendy (server/calendy.js), for the same reasons: each account
 * stores its Sprixy address and token here, in `sprixy.json` (0600), the token
 * never travels back to a browser, and every call goes through the SSRF guard
 * with no redirect followed. A Sprixy is a public site: this is NOT one of the
 * administrator-only bypasses.
 *
 * The token must be a READ-ONLY catalog token (Sprixy, Settings → API tokens →
 * "Read-only catalog"). A full token can generate and spend the person's
 * provider credit, and it would sit in a plain JSON file: connecting with one
 * is refused, checked against Sprixy itself rather than guessed from its shape.
 * The catalog shows nothing until the person marks a project "Shared with apps"
 * in Sprixy, so what Mocky may use is decided there, project by project.
 *
 * Pictures come in as PNGs Sprixy has already enlarged by a whole number with
 * nearest-neighbour: pixel art resized by a browser or a canvas is smoothed
 * into a blur, so the bytes Mocky stores are already the big, sharp version,
 * and the library records them as `pixel-art` for the prompt to keep them crisp
 * (src/lib/providedPictures.ts).
 */
import express from 'express'
import { CalendyStore, normalizeBase } from './calendy.js'
import { assertSafeTargetResolved } from './provider-proxy.js'

const TIMEOUT_MS = 20_000
const USER_AGENT = 'Mocky-Sprixy/1.0'
/** Same ceiling as any picture an assistant brings (server/images/remote.js). */
const MAX_BYTES = 15 * 1024 * 1024
/** Sprixy asset ids: `ast_…`. Anything else never reaches a URL. */
const ASSET_ID_RE = /^[\w-]{1,64}$/
export const SPRIXY_ID_RE = /^sprixy:([\w-]{1,64})$/

export class SprixyStore extends CalendyStore {
  constructor(dataDir) {
    super(dataDir, 'sprixy.json')
  }
}

/** Sprixy's answer as one short sentence: never the token, never a body that could quote one. */
export function failure(status) {
  if (status === 401) return 'Sprixy refused the token.'
  if (status === 403) return 'Sprixy refused the request.'
  if (status === 404) return 'Not found on Sprixy.'
  if (status >= 300 && status < 400) return 'Sprixy answered with a redirect; check the address.'
  return `Sprixy answered ${status}.`
}

const unreachable = (err) => (/not allowed|Invalid target/.test(err?.message) ? 'This address is not allowed.' : 'Sprixy could not be reached.')

/**
 * The calls Mocky makes to a Sprixy. `assertTarget` is the SSRF guard (injected
 * so the tests can point it at a local fake).
 */
export function createSprixyClient({ assertTarget = assertSafeTargetResolved, fetchImpl = fetch } = {}) {
  async function call(link, pathname, { binary = false } = {}) {
    const url = `${link.base}${pathname}`
    await assertTarget(url)
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${link.token}`, 'User-Agent': USER_AGENT, Accept: binary ? 'image/png' : 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (binary) {
      if (res.status !== 200) return { status: res.status, data: null }
      const declared = Number(res.headers.get('content-length') || 0)
      if (declared > MAX_BYTES) throw new Error('The picture is too large.')
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > MAX_BYTES) throw new Error('The picture is too large.')
      return { status: 200, data: buf }
    }
    let data = null
    try {
      data = await res.json()
    } catch {
      /* not JSON: the status alone answers */
    }
    return { status: res.status, data }
  }

  const ok = (r) => {
    if (r.status !== 200) throw Object.assign(new Error(failure(r.status)), { status: r.status })
    return r.data
  }

  return {
    /** The projects shared with apps, and whose they are. */
    catalog: async (link) => ok(await call(link, '/api/v1/catalog')),

    /**
     * Whether this token can do more than read the catalog. A catalog token is
     * refused everywhere else (403 TOKEN_SCOPE); a full one lists the projects.
     */
    hasFullAccess: async (link) => (await call(link, '/api/v1/projects')).status === 200,

    async search(link, { query = '', kind, limit = 8 } = {}) {
      const q = new URLSearchParams({ limit: String(Math.min(24, Math.max(1, limit))) })
      if (query) q.set('q', String(query).slice(0, 200))
      if (kind) q.set('kind', String(kind).slice(0, 40))
      return ok(await call(link, `/api/v1/catalog/assets?${q}`))
    },

    async asset(link, id) {
      if (!ASSET_ID_RE.test(String(id))) throw new Error('Invalid Sprixy asset id.')
      return ok(await call(link, `/api/v1/catalog/assets/${encodeURIComponent(id)}`))
    },

    /** The PNG, enlarged by Sprixy to about `size` px on its longest side. */
    async image(link, id, { size = 512 } = {}) {
      if (!ASSET_ID_RE.test(String(id))) throw new Error('Invalid Sprixy asset id.')
      return ok(await call(link, `/api/v1/catalog/assets/${encodeURIComponent(id)}/image?size=${Math.round(size)}`, { binary: true }))
    },
  }
}

/** The connection, from the Settings panel: connect (checked first), disconnect, see what is shared. */
export function sprixyRouter({ store, requireUser, client = createSprixyClient() }) {
  const router = express.Router()

  router.get('/', requireUser, (req, res) => res.json(store.view(req.user.id)))

  router.put('/', requireUser, async (req, res) => {
    if (req.body?.base === null) {
      store.set(req.user.id, null)
      return res.json(store.view(req.user.id))
    }
    const base = normalizeBase(req.body?.base)
    const token = String(req.body?.token || '').trim()
    if (!base) return res.status(400).json({ error: 'Invalid address.' })
    if (!/^spx_[\w-]{8,200}$/.test(token)) return res.status(400).json({ error: 'A Sprixy API token (spx_…) is required.' })
    const link = { base, token }
    let catalog
    try {
      catalog = await client.catalog(link)
      if (await client.hasFullAccess(link)) {
        return res.status(400).json({
          error: 'This token has full access to Sprixy. Create a read-only catalog token in Sprixy (Settings → API tokens → Read-only catalog) and use that one.',
          code: 'full-token',
        })
      }
    } catch (err) {
      return res.status(400).json({ error: err.status ? err.message : unreachable(err) })
    }
    try {
      store.set(req.user.id, link)
    } catch {
      return res.status(500).json({ error: 'Could not save the connection.' })
    }
    res.json({ ...store.view(req.user.id), owner: catalog?.owner?.name || '', projects: sharedProjects(catalog) })
  })

  /** What the connected Sprixy shares right now — so the panel can say "nothing shared yet". */
  router.get('/catalog', requireUser, async (req, res) => {
    const link = store.get(req.user.id)
    if (!link) return res.status(409).json({ error: 'Sprixy is not connected.' })
    try {
      const catalog = await client.catalog(link)
      res.json({ owner: catalog?.owner?.name || '', projects: sharedProjects(catalog) })
    } catch (err) {
      res.status(502).json({ error: err.status ? err.message : unreachable(err) })
    }
  })

  return router
}

function sharedProjects(catalog) {
  return (Array.isArray(catalog?.projects) ? catalog.projects : []).slice(0, 100).map((p) => ({
    id: String(p.id || '').slice(0, 64),
    name: String(p.name || '').slice(0, 120),
    assetCount: Number(p.assetCount) || 0,
  }))
}
