// Load and normalize mocky.mcp.json — the declarative list of local MCP servers
// Mocky's backend may spawn (stdio transport). Missing/invalid config is never
// fatal: it resolves to an empty server list so Muse simply has no live
// inspiration source (M3 — Muse degrades, never blocks).
//
// A normalized descriptor:
//   { name, command, args, env, autoStart, role, idleTimeoutMs }
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 min keep-alive

/** Coerce one raw `mcpServers[name]` entry into a normalized descriptor, or null if unusable. */
function normalizeServer(name, raw) {
  if (!raw || typeof raw !== 'object') return null
  const command = typeof raw.command === 'string' ? raw.command.trim() : ''
  if (!command) return null
  const args = Array.isArray(raw.args) ? raw.args.filter((a) => typeof a === 'string') : []
  const env =
    raw.env && typeof raw.env === 'object'
      ? Object.fromEntries(Object.entries(raw.env).filter(([, v]) => typeof v === 'string'))
      : {}
  const role = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : 'generic'
  const idle = Number(raw.idleTimeoutMs)
  return {
    name,
    command,
    args,
    env,
    autoStart: raw.autoStart === true,
    role,
    idleTimeoutMs: Number.isFinite(idle) && idle > 0 ? idle : DEFAULT_IDLE_TIMEOUT_MS,
  }
}

/**
 * Parse an already-read config object into `{ servers: descriptor[] }`.
 * Exposed separately so tests can feed a literal object without touching disk.
 */
export function parseMcpConfig(obj) {
  const servers = []
  const map = obj && typeof obj === 'object' ? obj.mcpServers : null
  if (map && typeof map === 'object') {
    for (const [name, raw] of Object.entries(map)) {
      const desc = normalizeServer(name, raw)
      if (desc) servers.push(desc)
    }
  }
  return { servers }
}

/**
 * Load `mocky.mcp.json` from `rootDir` (repo root). Returns `{ servers: [] }`
 * on any error (missing file, bad JSON) — never throws.
 */
export function loadMcpConfig(rootDir) {
  const file = path.join(rootDir, 'mocky.mcp.json')
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return { servers: [] }
  }
  let obj
  try {
    obj = JSON.parse(raw)
  } catch {
    return { servers: [] }
  }
  return parseMcpConfig(obj)
}
