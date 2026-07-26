// Muse composition root — wires the MCP host, router, cache, and fetcher into a
// single object the backend can mount. Nothing here spawns a process eagerly:
// servers are lazy (unless a descriptor sets autoStart), so importing Muse has
// zero cost when the feature is unused (M1).
import path from 'node:path'
import { loadMcpConfig } from './mcp/config.js'
import { McpHost } from './mcp/host.js'
import { McpToolRouter } from './mcp/router.js'
import { MuseCache } from './fetch/cache.js'
import { InspirationFetcher, USER_AGENT } from './fetch/fetcher.js'

/**
 * @param {object} deps
 * @param {string} deps.rootDir  repo root (holds mocky.mcp.json)
 * @param {string} deps.dataDir  server/data (holds the muse cache + future stores)
 * @param {(desc:object)=>Promise<object>} [deps.factory]  MCP client factory (tests inject a fake)
 */
export function createMuse({ rootDir, dataDir, factory } = {}) {
  const config = loadMcpConfig(rootDir)
  const host = new McpHost(config, factory ? { factory } : undefined)
  const router = new McpToolRouter(host)
  const cache = new MuseCache(path.join(dataDir, 'muse-cache.json'))
  const fetcher = new InspirationFetcher(router, cache, { userAgent: USER_AGENT })
  return { config, host, router, cache, fetcher }
}
