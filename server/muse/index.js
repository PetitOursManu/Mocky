// Muse composition root — wires the MCP host, router, cache, fetcher, the
// prompt-pattern library, and the anti-slop blacklist into a single object the
// backend can mount. Nothing here spawns a process eagerly: servers are lazy
// (unless a descriptor sets autoStart), so importing Muse has zero cost when the
// feature is unused (M1).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMcpConfig } from './mcp/config.js'
import { McpHost } from './mcp/host.js'
import { McpToolRouter } from './mcp/router.js'
import { MuseCache } from './fetch/cache.js'
import { InspirationFetcher, USER_AGENT } from './fetch/fetcher.js'
import { createPatternLibrary } from './prompt-patterns/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Load the anti-slop blacklist (forbidden clichés). Never throws. */
export function loadBlacklist() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'anti-slop.json'), 'utf8'))
    return Array.isArray(parsed.forbidden) ? parsed.forbidden : []
  } catch {
    return []
  }
}

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
  const patterns = createPatternLibrary()
  const blacklist = loadBlacklist()
  return { config, host, router, cache, fetcher, patterns, blacklist }
}
