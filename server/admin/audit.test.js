import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cleanDetail, createAuditLog } from './audit.js'

const dirs = []
function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-audit-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

describe('cleanDetail', () => {
  // The whole point of the rule: a configuration body passed by mistake must
  // not put a provider key on the administrator's screen or on the volume.
  it('drops anything that smells of a secret, and anything nested', () => {
    expect(
      cleanDetail({
        apiKey: 'sk-live-123',
        password: 'hunter2',
        licenseKey: 'rem-abc',
        sessionToken: 't',
        config: { apiKey: 'sk-nested' },
        fields: ['provider', 'apiKey'],
        on: true,
        count: 3,
      }),
    ).toEqual({ fields: ['provider', 'apiKey'], on: true, count: 3 })
  })

  it('bounds strings and strips control characters', () => {
    const out = cleanDetail({ message: `line one\nline two${'x'.repeat(500)}` })
    expect(out.message).not.toContain('\n')
    expect(out.message.length).toBe(120)
  })

  it('answers null for nothing worth keeping', () => {
    expect(cleanDetail({ secret: 'x' })).toBeNull()
    expect(cleanDetail(null)).toBeNull()
    expect(cleanDetail(['a'])).toBeNull()
  })
})

describe('createAuditLog', () => {
  it('records, lists newest first, and survives a restart', () => {
    const dir = tmp()
    let t = 1000
    const log = createAuditLog({ dataDir: dir, now: () => t })
    log.record({ action: 'user.create', actor: { id: 'a1', name: 'root' }, target: { id: 'u2', name: 'bob' } })
    t++
    log.record({ action: 'auth.login-failed', target: { name: 'bob' }, ip: '10.0.0.8' })
    expect(log.list().map((e) => e.action)).toEqual(['auth.login-failed', 'user.create'])

    const again = createAuditLog({ dataDir: dir, now: () => t })
    expect(again.list()).toHaveLength(2)
    expect(again.list({ group: 'user' })[0].target).toEqual({ id: 'u2', name: 'bob' })
  })

  it('refuses an action that is not on the list', () => {
    const log = createAuditLog({ dataDir: tmp() })
    expect(log.record({ action: 'anything.goes' })).toBeNull()
    expect(log.list()).toEqual([])
  })

  it('skips a torn last line instead of failing to boot', () => {
    const dir = tmp()
    const log = createAuditLog({ dataDir: dir })
    log.record({ action: 'maintenance.on' })
    fs.appendFileSync(path.join(dir, 'audit.jsonl'), '{"action":"maintenance.off","at":')
    expect(createAuditLog({ dataDir: dir }).list()).toHaveLength(1)
  })

  it('keeps at most `max` entries and compacts the file', () => {
    const dir = tmp()
    const log = createAuditLog({ dataDir: dir, max: 5 })
    for (let i = 0; i < 12; i++) log.record({ action: 'auth.login', detail: { i } })
    expect(log.list({ limit: 50 })).toHaveLength(5)
    expect(log.list()[0].detail).toEqual({ i: 11 })
    const lines = fs.readFileSync(path.join(dir, 'audit.jsonl'), 'utf8').split('\n').filter(Boolean)
    expect(lines.length).toBeLessThanOrEqual(10)
  })

  it('pages with `before` and counts recent failures', () => {
    let t = 0
    const log = createAuditLog({ dataDir: tmp(), now: () => t })
    const ids = []
    for (let i = 0; i < 4; i++) {
      t += 1000
      ids.push(log.record({ action: 'auth.login-failed' }).id)
    }
    expect(log.list({ before: ids[2] }).map((e) => e.id)).toEqual([ids[1], ids[0]])
    expect(log.countSince('auth.login-failed', 2500)).toBe(3)
  })
})
