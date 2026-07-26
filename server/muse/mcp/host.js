// McpHost — owns the lifecycle of every declared MCP server:
//   • lazy spawn on first use (never at boot unless autoStart)
//   • keep-alive with a per-server idle timeout, then graceful kill
//   • graceful shutdown of all servers on process exit
//   • a status snapshot for GET /api/mcp/status
//
// Hard rule (M3): a spawn/connect failure NEVER throws out of ensure() — it
// records `error` state and resolves to null, so a Muse run degrades instead of
// crashing a generation.
//
// The SDK client is injected via `factory` so the host is unit-testable with a
// fake (no subprocess): factory(descriptor) → adapter | throws.
import { createStdioClientFactory } from './realClient.js'

/** @typedef {'stopped'|'starting'|'ready'|'error'} ServerState */

export class McpHost {
  /**
   * @param {{servers: Array<object>}} config  normalized config (see config.js)
   * @param {object} [opts]
   * @param {(desc:object)=>Promise<object>} [opts.factory]  client factory (injectable)
   * @param {()=>number} [opts.now]  clock (injectable)
   * @param {{setTimeout:Function, clearTimeout:Function}} [opts.scheduler]  timers (injectable)
   */
  constructor(config, opts = {}) {
    this.descriptors = (config?.servers || []).slice()
    this.byName = new Map(this.descriptors.map((d) => [d.name, d]))
    this.factory = opts.factory || createStdioClientFactory()
    this.now = opts.now || (() => Date.now())
    this.scheduler = opts.scheduler || {
      setTimeout: (fn, ms) => {
        const t = setTimeout(fn, ms)
        // Don't let an idle keep-alive timer hold the process open.
        if (typeof t.unref === 'function') t.unref()
        return t
      },
      clearTimeout: (t) => clearTimeout(t),
    }
    this.shuttingDown = false
    /** @type {Map<string, {state:ServerState, adapter:object|null, tools:Array, startPromise:Promise|null, startedAt:number|null, lastUsedAt:number|null, lastError:string|null, idleTimer:any}>} */
    this.records = new Map(
      this.descriptors.map((d) => [
        d.name,
        { state: 'stopped', adapter: null, tools: [], startPromise: null, startedAt: null, lastUsedAt: null, lastError: null, idleTimer: null },
      ]),
    )
  }

  /** Descriptors declaring a given semantic role (used by the router). */
  serversForRole(role) {
    return this.descriptors.filter((d) => d.role === role)
  }

  /**
   * Ensure a server is connected and return its adapter, or null if it can't be
   * reached (unknown name, shutting down, or spawn/connect failure). Never throws.
   */
  async ensure(name) {
    if (this.shuttingDown) return null
    const desc = this.byName.get(name)
    const rec = this.records.get(name)
    if (!desc || !rec) return null

    if (rec.state === 'ready' && rec.adapter) {
      rec.lastUsedAt = this.now()
      this._resetIdle(name)
      return rec.adapter
    }
    if (rec.state === 'starting' && rec.startPromise) {
      return rec.startPromise
    }

    rec.state = 'starting'
    rec.lastError = null
    rec.startPromise = (async () => {
      try {
        const adapter = await this.factory(desc)
        // A shutdown may have been requested while we were connecting.
        if (this.shuttingDown) {
          try { await adapter.close() } catch { /* ignore */ }
          rec.state = 'stopped'
          rec.adapter = null
          return null
        }
        rec.adapter = adapter
        rec.tools = Array.isArray(adapter.tools) ? adapter.tools : []
        rec.state = 'ready'
        rec.startedAt = this.now()
        rec.lastUsedAt = this.now()
        rec.lastError = null
        this._resetIdle(name)
        return adapter
      } catch (err) {
        rec.state = 'error'
        rec.adapter = null
        rec.tools = []
        rec.lastError = err instanceof Error ? err.message : String(err)
        this._clearIdle(name)
        return null
      } finally {
        rec.startPromise = null
      }
    })()
    return rec.startPromise
  }

  /**
   * Call a tool on a server, ensuring it's up first. Throws if the server is
   * unavailable (the router catches and degrades) — but a *successful* ensure
   * followed by a tool error propagates the tool error to the caller.
   */
  async callTool(name, toolName, args) {
    const adapter = await this.ensure(name)
    if (!adapter) {
      const rec = this.records.get(name)
      throw new Error(`MCP server "${name}" is unavailable${rec?.lastError ? `: ${rec.lastError}` : ''}`)
    }
    const rec = this.records.get(name)
    rec.lastUsedAt = this.now()
    this._resetIdle(name)
    return adapter.callTool(toolName, args)
  }

  /** Snapshot for the health endpoint. */
  status() {
    return this.descriptors.map((d) => {
      const rec = this.records.get(d.name)
      return {
        name: d.name,
        role: d.role,
        command: [d.command, ...(d.args || [])].join(' '),
        state: rec.state,
        tools: (rec.tools || []).map((t) => t.name),
        startedAt: rec.startedAt,
        lastUsedAt: rec.lastUsedAt,
        lastError: rec.lastError,
      }
    })
  }

  /** Auto-start any server flagged `autoStart` (best-effort, never blocks). */
  async startAutoStart() {
    await Promise.all(
      this.descriptors.filter((d) => d.autoStart).map((d) => this.ensure(d.name).catch(() => null)),
    )
  }

  /** Gracefully close every connected server and cancel timers. */
  async shutdown() {
    this.shuttingDown = true
    const closes = []
    for (const [name, rec] of this.records) {
      this._clearIdle(name)
      if (rec.adapter) {
        const adapter = rec.adapter
        rec.adapter = null
        rec.state = 'stopped'
        closes.push(Promise.resolve().then(() => adapter.close()).catch(() => null))
      } else if (rec.state !== 'error') {
        rec.state = 'stopped'
      }
    }
    await Promise.all(closes)
  }

  // --- idle keep-alive ---
  _resetIdle(name) {
    const desc = this.byName.get(name)
    const rec = this.records.get(name)
    if (!desc || !rec) return
    this._clearIdle(name)
    if (desc.idleTimeoutMs > 0) {
      rec.idleTimer = this.scheduler.setTimeout(() => this._idleKill(name), desc.idleTimeoutMs)
    }
  }

  _clearIdle(name) {
    const rec = this.records.get(name)
    if (rec?.idleTimer != null) {
      this.scheduler.clearTimeout(rec.idleTimer)
      rec.idleTimer = null
    }
  }

  async _idleKill(name) {
    const rec = this.records.get(name)
    if (!rec || rec.state !== 'ready' || !rec.adapter) return
    const adapter = rec.adapter
    rec.adapter = null
    rec.tools = []
    rec.state = 'stopped'
    rec.idleTimer = null
    try {
      await adapter.close()
    } catch {
      /* already gone */
    }
  }
}
