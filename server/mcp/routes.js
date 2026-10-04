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
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { scopeAllows } from '../access.js'
import { McpConfigStore, changedMcpFields } from './config.js'
import { originAllowsMcp, mcpReadiness } from './https.js'
import { createOAuthStore } from './oauth-store.js'
import { createMcpOAuthProvider } from './provider.js'
import { buildMcpServer } from './tools.js'

/** The paths that must not exist while the server is off (X1). */
const MCP_PATHS = /^\/(?:mcp|register|authorize|token|revoke)(?:\/|$)|^\/\.well-known\/oauth-(?:authorization-server|protected-resource)(?:\/|$)/

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
 */
export function createMcpServerRoutes(d) {
  const config = new McpConfigStore(d.dataDir)
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
      const server = buildMcpServer({
        user,
        readProjects: () => d.readProjects(userId),
        linkFor: (projectId) => `${origin}/p/${encodeURIComponent(projectId)}`,
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
      })
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
    onUserDeleted: (userId) => store.revokeUser(userId),
    flush: () => store.flush(),
  }
}
