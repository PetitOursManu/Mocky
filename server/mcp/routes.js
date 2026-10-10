/**
 * Mocky as an MCP server: every route it adds, and the one switch over them.
 *
 *   /.well-known/oauth-*                  discovery (SDK)
 *   /register /authorize /token /revoke   OAuth 2.1 (SDK router + provider.js)
 *   /mcp                                  the MCP endpoint, bearer-protected
 *   /api/connect/:id                      the consent page's two calls (session)
 *   /api/account/mcp-connections          a person's own connections
 *   /api/admin/mcp…                       the administrator's section
 *
 * X1 is enforced HERE, per request: unless an administrator switched it on AND
 * the origin is HTTPS, every MCP path answers 404 — the discovery documents
 * included, so a scanner cannot even tell the feature exists. Switching it off
 * takes effect on the next request, without a restart; the tokens stay on disk
 * and work again if it is switched back on, which is what "pause" should mean.
 */
import crypto from 'node:crypto'
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { scopeAllows } from '../access.js'
import { McpConfigStore, changedMcpFields, resolveEngine, ENGINES } from './config.js'
import { McpPrefsStore } from './prefs.js'
import { originAllowsMcp, mcpReadiness } from './https.js'
import { createOAuthStore } from './oauth-store.js'
import { createMcpOAuthProvider } from './provider.js'
import { buildMcpServer } from './tools.js'

/** The paths that must not exist while the server is off (X1). */
const MCP_PATHS = /^\/(?:mcp|mcp-shot|mcp-view|register|authorize|token|revoke)(?:\/|$)|^\/\.well-known\/oauth-(?:authorization-server|protected-resource)(?:\/|$)/

/** How long a picture link handed to an assistant works. */
export const SHOT_LINK_TTL_MS = 24 * 60 * 60 * 1000

/**
 * @param {object} d
 * @param {string} d.dataDir
 * @param {string} d.origin                 MOCKY_ORIGIN
 * @param {(id: string) => object|undefined} d.findUser
 * @param {() => object[]} d.listUsers
 * @param {(req) => object|null} d.sessionUser
 * @param {Function} d.requireUser
 * @param {Function} d.requireAdmin
 * @param {(userId: string) => string|null} d.readProjects
 * @param {() => boolean} d.maintenance     whether the instance is read-only
 * @param {{ record: Function }} d.audit
 * @param {(user) => object} d.auditActor
 * @param {(req) => string|null} d.clientIp
 * @param {ReturnType<import('./runner.js').createRunner>} d.runner
 * @param {(user:object) => boolean} d.hasTextProvider   whether this account has a generation provider
 * @param {(userId: string) => void} d.touchMcp     presence: this account is using Mocky through an assistant
 */
export function createMcpServerRoutes(d) {
  const config = new McpConfigStore(d.dataDir)
  const prefs = new McpPrefsStore(d.dataDir)
  const store = createOAuthStore(d.dataDir)
  const originOk = originAllowsMcp(d.origin)
  const origin = originOk ? new URL(d.origin).origin : null
  const resource = () => `${origin}/mcp`
  const active = () => originOk && config.get().enabled

  const actorOf = (userId) => {
    const u = d.findUser(userId)
    return u ? d.auditActor(u) : { id: userId, name: '?' }
  }

  const provider = createMcpOAuthProvider({
    store,
    config: () => config.get(),
    resource,
    findUser: d.findUser,
    maintenance: d.maintenance,
    onEvent(e) {
      if (e.type === 'connect') {
        d.audit.record({ action: 'mcp.connect', actor: actorOf(e.userId), detail: { client: e.clientName } })
      } else if (e.type === 'reuse') {
        // Two parties held one refresh token. The connection is already gone;
        // this line is how an administrator learns that it happened.
        d.audit.record({ action: 'mcp.token-reuse', target: actorOf(e.userId), detail: { client: e.clientName } })
      }
    },
  })

  const authRouter = originOk
    ? mcpAuthRouter({
        provider,
        issuerUrl: new URL(origin),
        resourceServerUrl: new URL(resource()),
        resourceName: 'Mocky',
        // A confidential client's secret must not expire under a connection
        // the person meant to keep: the SDK's default is 30 days.
        clientRegistrationOptions: { clientSecretExpirySeconds: 0 },
      })
    : null

  const bearer = originOk
    ? requireBearerAuth({
        verifier: provider,
        resourceMetadataUrl: `${origin}/.well-known/oauth-protected-resource/mcp`,
      })
    : null

  /*
   * Picture links for an assistant whose host does not show a tool's image
   * inline: `/mcp-shot/<hash>.jpg?e=<expiry>&s=<signature>`. A capability URL,
   * like a share link, but narrower: one JPEG of the top of one screen, for a
   * day, signed with a key that lives in memory — a restart retires every link,
   * which costs an assistant nothing (it can ask for the picture again).
   */
  const shotKey = crypto.randomBytes(32)
  const sign = (hash, exp) => crypto.createHmac('sha256', shotKey).update(`${hash}.${exp}`).digest('base64url')
  function shotLink(hash) {
    const exp = Date.now() + SHOT_LINK_TTL_MS
    return `${origin}/mcp-shot/${hash}.jpg?e=${exp}&s=${sign(hash, exp)}`
  }
  /**
   * The live view's document (phase 5, server/mcp/view.js): the same signature,
   * the same day — a link to the picture and a link to the moving screen are
   * one capability, so they are one key.
   */
  function viewLink(hash) {
    const exp = Date.now() + SHOT_LINK_TTL_MS
    return `${origin}/mcp-view/${hash}.html?e=${exp}&s=${sign(hash, exp)}`
  }
  function shotLinkValid(hash, exp, sig) {
    if (!/^[a-f0-9]{64}$/.test(hash) || !/^\d{10,16}$/.test(String(exp)) || Number(exp) < Date.now()) return false
    const want = Buffer.from(sign(hash, exp))
    const got = Buffer.from(String(sig || ''))
    return want.length === got.length && crypto.timingSafeEqual(want, got)
  }

  function protectedResourceMetadata() {
    return { resource: resource(), authorization_servers: [`${origin}/`], resource_name: 'Mocky' }
  }

  function connectionsWithNames(list) {
    return list.map((c) => ({ ...c, username: d.findUser(c.userId)?.username ?? null }))
  }

  /** Connections of accounts no longer on the list go at once, not at their next call. */
  function revokeDisallowed() {
    let n = 0
    for (const c of store.listConnections()) {
      const u = d.findUser(c.userId)
      if (!u || !scopeAllows(config.get().access, u)) n += store.revoke(c.id) ? 1 : 0
    }
    return n
  }

  function mount(app) {
    // ---- the switch (X1) ----------------------------------------------------
    app.use((req, res, next) => {
      if (!MCP_PATHS.test(req.path)) return next()
      if (!active()) return res.status(404).json({ error: 'Not found.' })
      // Some clients look for the resource metadata at the root rather than
      // under /mcp; it is the same document either way.
      if (req.path === '/.well-known/oauth-protected-resource') {
        res.setHeader('Cache-Control', 'no-store')
        return res.json(protectedResourceMetadata())
      }
      return authRouter(req, res, next)
    })

    // ---- the MCP endpoint ---------------------------------------------------
    // Stateless: one server and one transport per request, so nothing about a
    // conversation is held here and a restart loses nothing.
    app.post('/mcp', (req, res, next) => bearer(req, res, next), async (req, res) => {
      const { userId } = req.auth.extra
      const user = d.findUser(userId)
      // Using Mocky through an assistant is being here: the admin sees the
      // account connected, with an "MCP" mark (server/admin/presence.js).
      d.touchMcp(userId)
      const server = buildMcpServer({
        user,
        readProjects: () => d.readProjects(userId),
        linkFor: (projectId, screenId) =>
          `${origin}/p/${encodeURIComponent(projectId)}${screenId ? `?screen=${encodeURIComponent(screenId)}` : ''}`,
        runner: d.runner,
        maintenance: d.maintenance,
        dailyQuota: () => config.get().dailyQuota,
        // Which engine writes the code: the assistant's request, else this
        // person's choice, within what the administrator allows (phase 4).
        engine: (requested) => resolveEngine(config.get(), { requested, preferred: prefs.get(userId).engine }),
        engines: () => config.get().engines,
        hasTextProvider: d.hasTextProvider,
        shotLink,
        viewLink,
        origin,
        pictures: d.pictures,
      })
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      try {
        await server.connect(transport)
        await transport.handleRequest(req, res)
      } catch (err) {
        if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null })
        console.error(`mocky: mcp request failed — ${err?.message || err}`)
      }
    })
    // Behind the switch (MCP_PATHS) like everything else here: off, it is 404.
    app.get('/mcp-shot/:file', (req, res) => {
      const m = /^([a-f0-9]{64})\.jpg$/.exec(req.params.file)
      if (!m || !shotLinkValid(m[1], req.query.e, req.query.s)) return res.status(404).end()
      const jpeg = d.runner.readShot(m[1], 'jpg')
      if (!jpeg) return res.status(404).end()
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.end(jpeg)
    })

    /*
     * A screen, alive, for the live view. This is model-written code served
     * from Mocky's origin, so the response makes it what the composer's iframe
     * makes it: `sandbox allow-scripts`, an opaque origin with no cookie, no
     * storage and no Mocky behind it — whoever opens the link, framed or not.
     * Its own meta policy (Preview.tsx) still forbids every outbound verb.
     * Framable from anywhere, which is the point: the host's view frames it,
     * and the signature is what decides who may. By saying nothing rather than
     * `frame-ancestors *`: a star matches network schemes only, and a host's
     * view may well run in an opaque origin, which the star would refuse.
     */
    app.get('/mcp-view/:file', (req, res) => {
      const m = /^([a-f0-9]{64})\.html$/.exec(req.params.file)
      if (!m || !shotLinkValid(m[1], req.query.e, req.query.s)) return res.status(404).end()
      const html = d.runner.readShot(m[1], 'html')
      if (!html) return res.status(404).end()
      res.removeHeader('X-Frame-Options')
      res.setHeader('Content-Security-Policy', 'sandbox allow-scripts')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.setHeader('Referrer-Policy', 'no-referrer')
      res.end(html)
    })

    for (const method of ['get', 'delete']) {
      app[method]('/mcp', (_req, res) => {
        res.setHeader('Allow', 'POST')
        res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null })
      })
    }

    // ---- the consent page ---------------------------------------------------
    app.get('/api/connect/:id', d.requireUser, (req, res) => {
      if (!active()) return res.status(404).json({ error: 'Not found.' })
      const info = provider.describePending(req.params.id)
      if (!info) return res.status(404).json({ error: 'expired' })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ ...info, allowed: scopeAllows(config.get().access, req.user), username: req.user.username })
    })

    app.post('/api/connect/:id', d.requireUser, (req, res) => {
      if (!active()) return res.status(404).json({ error: 'Not found.' })
      try {
        const out = provider.decide(req.params.id, req.user, req.body?.approve === true)
        res.json(out)
      } catch {
        res.status(404).json({ error: 'expired' })
      }
    })

    // ---- a person's own connections ----------------------------------------
    app.get('/api/account/mcp-connections', d.requireUser, (req, res) => {
      res.json({
        active: active(),
        allowed: scopeAllows(config.get().access, req.user),
        mcpUrl: originOk ? resource() : null,
        connections: store.listConnections(req.user.id),
        // Who writes the code: what the administrator allows, and this
        // person's default within it.
        engines: config.get().engines,
        engine: resolveEngine(config.get(), { preferred: prefs.get(req.user.id).engine }),
      })
    })

    app.put('/api/account/mcp-prefs', d.requireUser, (req, res) => {
      const engine = req.body?.engine
      if (!ENGINES.includes(engine)) return res.status(400).json({ error: 'Unknown engine.' })
      if (!config.get().engines?.[engine]) return res.status(409).json({ error: 'This engine is not allowed on this Mocky.' })
      try {
        prefs.set(req.user.id, { engine })
      } catch {
        return res.status(500).json({ error: 'Could not save.' })
      }
      res.json({ engine: resolveEngine(config.get(), { preferred: engine }) })
    })

    app.delete('/api/account/mcp-connections/:id', d.requireUser, (req, res) => {
      const c = store.getConnection(req.params.id)
      // Someone else's connection answers like a missing one (X5).
      if (!c || c.userId !== req.user.id) return res.status(404).json({ error: 'Not found.' })
      store.revoke(c.id)
      d.audit.record({ action: 'mcp.revoke', actor: d.auditActor(req.user), detail: { client: c.clientName }, ip: d.clientIp(req) })
      res.json({ ok: true })
    })

    // ---- the administrator's section ---------------------------------------
    app.get('/api/admin/mcp', d.requireAdmin, (req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.json({
        config: config.get(),
        readiness: mcpReadiness(d.origin, req),
        active: active(),
        connections: connectionsWithNames(store.listConnections()),
        users: d.listUsers().map((u) => ({ id: u.id, username: u.username, role: u.role })),
        runner: d.runner.status(),
      })
    })

    app.put('/api/admin/mcp/config', d.requireAdmin, (req, res) => {
      const before = config.get()
      const wantsOn = req.body?.enabled === true && !before.enabled
      if (wantsOn) {
        const ready = mcpReadiness(d.origin, req)
        if (!ready.ok) return res.status(409).json({ error: 'https', readiness: ready })
      }
      let after
      try {
        after = config.update(req.body || {})
      } catch (err) {
        return res.status(500).json({ error: `Could not save: ${err?.message || err}` })
      }
      const revoked = revokeDisallowed()
      const fields = changedMcpFields(before, after)
      if (fields.length) {
        d.audit.record({ action: 'mcp.config', actor: d.auditActor(req.user), detail: { fields, connectionsRevoked: revoked }, ip: d.clientIp(req) })
      }
      res.json({ config: after, active: active(), revoked })
    })

    // ---- the runner, from the admin section ------------------------------------
    // Usable before the MCP server is switched on: it is how an administrator
    // learns whether this machine can generate headlessly at all.

    /** Free: Chromium, this build's runner page, one fixed screen photographed. */
    app.post('/api/admin/mcp/runner/check', d.requireAdmin, async (_req, res) => {
      try {
        const png = await d.runner.check()
        res.json({ ok: true, image: `data:image/png;base64,${png.toString('base64')}` })
      } catch (err) {
        res.status(503).json({ ok: false, error: err?.code || String(err?.message || err).slice(0, 300) })
      }
    })

    /**
     * Paid: a real generation, in the administrator's OWN account, through the
     * runner — the whole path an assistant will take, minus the assistant.
     */
    app.post('/api/admin/mcp/runner/try', d.requireAdmin, (req, res) => {
      const why = d.runner.availability()
      if (!why.available) return res.status(503).json({ error: why.reason })
      if (!d.hasTextProvider(req.user)) return res.status(409).json({ error: 'no-provider' })
      const brief = String(req.body?.brief || '').trim().slice(0, 4000)
      if (!brief) return res.status(400).json({ error: 'empty' })
      const device = ['desktop', 'mobile', 'tablet'].includes(req.body?.device) ? req.body.device : 'desktop'
      const { job, existing } = d.runner.enqueue(req.user.id, { brief, device, projectName: 'Essai MCP', lang: 'fr' })
      res.json({ job, existing })
    })

    app.get('/api/admin/mcp/runner/jobs/:id', d.requireAdmin, (req, res) => {
      const job = d.runner.get(req.params.id, req.user.id)
      if (!job) return res.status(404).json({ error: 'Not found.' })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ job, link: job.result ? `${origin || ''}/p/${job.result.projectId}?screen=${job.result.screenId}` : null })
    })

    app.get('/api/admin/mcp/runner/shots/:hash', d.requireAdmin, (req, res) => {
      const png = d.runner.readShot(req.params.hash)
      if (!png) return res.status(404).end()
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.end(png)
    })

    app.delete('/api/admin/mcp/connections/:id', d.requireAdmin, (req, res) => {
      const c = store.getConnection(req.params.id)
      if (!c) return res.status(404).json({ error: 'Not found.' })
      store.revoke(c.id)
      d.audit.record({
        action: 'mcp.revoke',
        actor: d.auditActor(req.user),
        target: actorOf(c.userId),
        detail: { client: c.clientName },
        ip: d.clientIp(req),
      })
      res.json({ ok: true })
    })
  }

  return {
    mount,
    active,
    /** An account deleted: whatever it granted goes with it. */
    onUserDeleted: (userId) => {
      store.revokeUser(userId)
      prefs.forget(userId)
    },
    flush: () => store.flush(),
  }
}
