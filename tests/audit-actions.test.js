import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUDIT_ACTIONS } from '../server/admin/audit.js'
import { dashboard } from '../src/i18n/parts/dashboard.ts'

/**
 * Every action a route records is one the audit log KEEPS, and one the panel
 * can name.
 *
 * `record()` drops an action missing from AUDIT_ACTIONS without a word — it
 * never throws, by design, so an audit line cannot fail a saved setting. That
 * silence is how the free plan's first version shipped two audited routes
 * (`user.plan`, `config.freePlan`) whose entries were never written: the route
 * worked, the panel had labels for them, and the log stayed empty.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function serverSources(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...serverSources(p))
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      out.push(p)
    }
  }
  return out
}

/** The literal actions passed to an audit log's `record({ action: '…' })`. */
function recordedActions() {
  const found = new Set()
  for (const file of serverSources(path.join(root, 'server'))) {
    const src = fs.readFileSync(file, 'utf8')
    for (const m of src.matchAll(/audit\.record\(\{\s*action:\s*'([\w.-]+)'/g)) found.add(m[1])
  }
  return [...found].sort()
}

describe('audit actions', () => {
  it('finds the routes it is meant to check', () => {
    // A regex that stopped matching would make the next test pass on nothing.
    expect(recordedActions()).toEqual(expect.arrayContaining(['auth.login', 'user.plan', 'config.freePlan']))
  })

  it('every action a route records is in AUDIT_ACTIONS', () => {
    const missing = recordedActions().filter((a) => !AUDIT_ACTIONS.includes(a))
    expect(missing).toEqual([])
  })

  it('every action in AUDIT_ACTIONS has a label in both languages', () => {
    for (const lang of ['fr', 'en']) {
      const missing = AUDIT_ACTIONS.filter((a) => !(`dashboard.audit.action.${a}` in dashboard[lang]))
      expect({ lang, missing }).toEqual({ lang, missing: [] })
    }
  })
})
