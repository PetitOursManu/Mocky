/**
 * The MCP server's administrator settings — `mcp-config.json`.
 *
 * Off by default, and off means ABSENT (invariant X1): no `/mcp`, no OAuth
 * endpoint, no well-known document. The MCP server lets a language model act as
 * an account, from outside, so nothing about it exists until an administrator
 * turns it on — and it is never on over plain HTTP (`https.js`).
 *
 * Who may connect is a scope that FAILS CLOSED (server/access.js `scopeAllows`):
 * an empty list by default, and an administrator is not let in by their role.
 *
 * Nothing secret lives here; the tokens are in `mcp-oauth.json` (oauth-store.js).
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/** Which OAuth clients may register: the two assistants this was built for, or any. */
export const CLIENT_POLICIES = ['known', 'any']

/**
 * Where the known clients send a person back after consent. Hosts, not exact
 * URIs: the path is theirs to move, the host is what identifies them. Loopback
 * is a client on the person's own machine (Claude Code, Claude Desktop through
 * a local bridge): the code it receives never leaves that machine.
 *
 * Checked 2026-10-04: claude.ai/api/mcp/auth_callback and
 * chatgpt.com/connector_platform_oauth_redirect.
 */
export const KNOWN_REDIRECT_HOSTS = ['claude.ai', 'claude.com', 'chatgpt.com']

export const TOKEN_BOUNDS = {
  accessMin: { min: 5, max: 24 * 60, default: 60 },
  refreshDays: { min: 1, max: 365, default: 30 },
}

export function defaultMcpConfig() {
  return {
    enabled: false,
    access: { mode: 'allowlist', userIds: [] },
    clients: 'known',
    tokenTtl: { accessMin: TOKEN_BOUNDS.accessMin.default, refreshDays: TOKEN_BOUNDS.refreshDays.default },
    /** Headless generations at once, instance-wide (phase 2b). */
    concurrency: 1,
    /** Optional cap on MCP generations per account per day; null = none (the UI has none either). */
    dailyQuota: null,
  }
}

const int = (v, { min, max, default: d }) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}

const ids = (v) =>
  Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))].slice(0, 1000) : []

/** Apply a patch to a config. Lists are REPLACED, never merged — same as every other scope. */
export function mergeMcpConfig(current, patch) {
  const base = { ...defaultMcpConfig(), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}
  const access = p.access && typeof p.access === 'object' ? p.access : {}
  const ttl = p.tokenTtl && typeof p.tokenTtl === 'object' ? p.tokenTtl : {}
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : Boolean(base.enabled),
    access: {
      mode: access.mode === 'all' || access.mode === 'allowlist' ? access.mode : base.access?.mode === 'all' ? 'all' : 'allowlist',
      userIds: 'userIds' in access ? ids(access.userIds) : ids(base.access?.userIds),
    },
    clients: CLIENT_POLICIES.includes(p.clients) ? p.clients : CLIENT_POLICIES.includes(base.clients) ? base.clients : 'known',
    tokenTtl: {
      accessMin: int('accessMin' in ttl ? ttl.accessMin : base.tokenTtl?.accessMin, TOKEN_BOUNDS.accessMin),
      refreshDays: int('refreshDays' in ttl ? ttl.refreshDays : base.tokenTtl?.refreshDays, TOKEN_BOUNDS.refreshDays),
    },
    concurrency: int('concurrency' in p ? p.concurrency : base.concurrency, { min: 1, max: 4, default: 1 }),
    dailyQuota:
      'dailyQuota' in p
        ? p.dailyQuota === null || p.dailyQuota === '' ? null : int(p.dailyQuota, { min: 1, max: 10_000, default: null })
        : base.dailyQuota ?? null,
  }
}

/** The fields a patch actually touched, for the audit log (never the values of a list). */
export function changedMcpFields(before, after) {
  const out = []
  for (const k of ['enabled', 'clients', 'concurrency', 'dailyQuota']) if (before[k] !== after[k]) out.push(k)
  if (before.access.mode !== after.access.mode) out.push('access.mode')
  if (JSON.stringify(before.access.userIds) !== JSON.stringify(after.access.userIds)) out.push('access.userIds')
  if (before.tokenTtl.accessMin !== after.tokenTtl.accessMin) out.push('tokenTtl.accessMin')
  if (before.tokenTtl.refreshDays !== after.tokenTtl.refreshDays) out.push('tokenTtl.refreshDays')
  return out
}

export class McpConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'mcp-config.json')
    this.config = this._load()
  }

  _load() {
    try {
      return mergeMcpConfig(defaultMcpConfig(), JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch {
      return defaultMcpConfig()
    }
  }

  get() {
    return this.config
  }

  /** Returns the new config; throws when it could not be written (the caller says so). */
  update(patch) {
    const next = mergeMcpConfig(this.config, patch)
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, this.file)
    this.config = next
    return next
  }
}
