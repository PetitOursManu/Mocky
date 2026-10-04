/**
 * What each person chose for their assistants — `mcp-prefs.json`. Today one
 * thing: which engine writes a design's code by default (config.js `ENGINES`).
 *
 * Its own file rather than a field of `mcp-config.json`: that one is the
 * administrator's, every change to it is audited as an admin action, and a
 * person changing their own default is neither. The administrator's settings
 * still bound it — `resolveEngine` never returns an engine they switched off.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ENGINES } from './config.js'

export class McpPrefsStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'mcp-prefs.json')
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      this.prefs = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    } catch {
      this.prefs = {}
    }
  }

  /** One account's choices, with what an absent one means. */
  get(userId) {
    const p = this.prefs[userId]
    return { engine: p && ENGINES.includes(p.engine) ? p.engine : null }
  }

  /** Throws when it could not be written; the caller says so. */
  set(userId, patch) {
    const engine = ENGINES.includes(patch?.engine) ? patch.engine : null
    const next = { ...this.prefs }
    if (engine) next[userId] = { ...(next[userId] || {}), engine }
    else delete next[userId]
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, this.file)
    this.prefs = next
    return this.get(userId)
  }

  /** An account deleted takes its choices with it. */
  forget(userId) {
    if (!(userId in this.prefs)) return
    try {
      this.set(userId, { engine: null })
    } catch {
      /* the account is gone either way; a stale line is harmless */
    }
  }
}
