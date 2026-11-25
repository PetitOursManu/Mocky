#!/usr/bin/env node
/**
 * Which projects sit in SEVERAL accounts — read-only.
 *
 * Until invariant I10 (docs/architecture/invariants.md), signing in on a
 * browser another account had used merged that account's projects into the one
 * signing in, and pushed them to the server. Each copy keeps the project's id,
 * so a project found under the same id in two accounts' files is such a copy.
 * Who it really belongs to is not recorded anywhere: this lists the copies, with
 * what tells them apart (last edit, screens), and leaves the decision to a
 * person. It writes nothing.
 *
 *   node server/tools/shared-projects.js            → a readable list
 *   node server/tools/shared-projects.js --json     → the same, as JSON
 *   docker compose exec mocky node server/tools/shared-projects.js
 *
 * In `server/` rather than `scripts/` because the runtime image only ships
 * `server/`, and that is where the data lives.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** The projects of one data file: a JSON string in `projects`, as PUT /api/data stores it. */
function projectsIn(file) {
  const raw = readJson(file, {})?.projects
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string') : []
  } catch {
    return []
  }
}

const date = (ms) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : '—')

/**
 * Every project id held by two accounts or more, with each account's copy.
 * A deleted copy (a tombstone) is listed too, marked: it still says the
 * project went through that account.
 */
export function findSharedProjects(dataDir) {
  const users = readJson(path.join(dataDir, 'users.json'), [])
  const nameOf = new Map((Array.isArray(users) ? users : []).map((u) => [u.id, u.username]))
  const byId = new Map()
  for (const entry of fs.readdirSync(dataDir)) {
    const m = /^data-(.+)\.json$/.exec(entry)
    if (!m) continue
    const account = m[1]
    for (const p of projectsIn(path.join(dataDir, entry))) {
      if (!byId.has(p.id)) byId.set(p.id, [])
      byId.get(p.id).push({
        account,
        username: nameOf.get(account) ?? null,
        name: String(p.name || ''),
        createdAt: p.createdAt ?? null,
        updatedAt: p.updatedAt ?? null,
        screens: Array.isArray(p.screens) ? p.screens.length : 0,
        deleted: Boolean(p.deletedAt),
      })
    }
  }
  return [...byId.entries()]
    .filter(([, copies]) => new Set(copies.map((c) => c.account)).size > 1)
    .map(([id, copies]) => ({
      id,
      createdAt: copies.find((c) => c.createdAt)?.createdAt ?? null,
      // Most recently edited first: the likeliest owner is whoever works on it.
      copies: copies.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

function print(shared) {
  if (!shared.length) {
    console.log('No project is held by more than one account.')
    return
  }
  console.log(`${shared.length} project(s) held by more than one account — most recently edited copy first:\n`)
  for (const s of shared) {
    console.log(`• ${s.copies[0].name || '(untitled)'}  [${s.id}]  created ${date(s.createdAt)}`)
    for (const c of s.copies) {
      const who = c.username ? `${c.username} (${c.account})` : c.account
      const flags = c.deleted ? '  DELETED in this account' : ''
      console.log(`    - ${who}: "${c.name}", ${c.screens} screen(s), last edited ${date(c.updatedAt)}${flags}`)
    }
    console.log('')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = process.env.MOCKY_DATA_DIR ? path.resolve(process.env.MOCKY_DATA_DIR) : path.join(here, '..', 'data')
  if (!fs.existsSync(dataDir)) {
    console.error(`No data directory at ${dataDir}. Set MOCKY_DATA_DIR to where Mocky keeps its data.`)
    process.exit(1)
  }
  const shared = findSharedProjects(dataDir)
  if (process.argv.includes('--json')) console.log(JSON.stringify(shared, null, 2))
  else print(shared)
}
