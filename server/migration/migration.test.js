import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  deriveKeys,
  newPairingCode,
  open,
  parseAuthHeader,
  parsePairingCode,
  seal,
  signRequest,
  verifyRequest,
  MAX_SKEW_MS,
} from './crypto.js'
import { listFiles, resolveInside, safeRelPath } from './manifest.js'
import { comparePreflight } from './preflight.js'
import { createMigrationSource, CHUNK_BYTES, MAX_FAILURES } from './source.js'
import { createMigrationDestination, parseSourceUrl, MigrationError } from './destination.js'
import { maintenanceBlocks, cleanMaintenanceMessage } from '../maintenance.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-migr-'))

describe('pairing code', () => {
  it('round-trips through the forgiving parser', () => {
    const code = newPairingCode()
    expect(code).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/)
    const bytes = parsePairingCode(code)
    expect(bytes?.length).toBe(20)
    // What a person actually types: lower case, spaces, O for 0.
    const typed = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o')
    expect(parsePairingCode(typed)?.equals(bytes)).toBe(true)
  })

  it('refuses what cannot be a code', () => {
    expect(parsePairingCode('')).toBeNull()
    expect(parsePairingCode('ABCD')).toBeNull()
    expect(parsePairingCode('U'.repeat(32))).toBeNull() // U is not in the alphabet
  })

  it('derives the same keys on both sides and different keys per code', () => {
    const a = deriveKeys(parsePairingCode(newPairingCode()))
    const b = deriveKeys(parsePairingCode(newPairingCode()))
    expect(a.id).toMatch(/^[0-9a-f]{32}$/)
    expect(a.id).not.toBe(b.id)
    expect(a.auth.equals(a.enc)).toBe(false)
  })
})

describe('request signatures and sealed responses', () => {
  const keys = deriveKeys(parsePairingCode(newPairingCode()))
  const other = deriveKeys(parsePairingCode(newPairingCode()))

  it('accepts its own signature and nothing else', () => {
    const t = 1_700_000_000_000
    const { header } = signRequest(keys, 'GET', '/api/migration/manifest', t)
    const parsed = parseAuthHeader(header)
    expect(verifyRequest(keys, parsed, 'GET', '/api/migration/manifest', t)).toBe('ok')
    // Another path, another method, another key: all the same forgery.
    expect(verifyRequest(keys, parsed, 'GET', '/api/migration/file?path=users.json&offset=0', t)).toBe('bad-signature')
    expect(verifyRequest(keys, parsed, 'POST', '/api/migration/manifest', t)).toBe('bad-signature')
    expect(verifyRequest(other, parsed, 'GET', '/api/migration/manifest', t)).toBe('bad-signature')
    expect(verifyRequest(keys, parsed, 'GET', '/api/migration/manifest', t + MAX_SKEW_MS + 1)).toBe('stale')
  })

  it('opens only under the same key, path and request nonce', () => {
    const body = seal(keys, '/p', 'n1', Buffer.from('secret'))
    expect(open(keys, '/p', 'n1', body).toString()).toBe('secret')
    expect(() => open(keys, '/p', 'n2', body)).toThrow()
    expect(() => open(keys, '/q', 'n1', body)).toThrow()
    expect(() => open(other, '/p', 'n1', body)).toThrow()
    const tampered = Buffer.from(body)
    tampered[14] ^= 1
    expect(() => open(keys, '/p', 'n1', tampered)).toThrow()
  })

  it('never leaves the plaintext readable on the wire', () => {
    const body = seal(keys, '/p', 'n', Buffer.from('"hash":"abcdef"'))
    expect(body.toString('latin1')).not.toContain('hash')
  })
})

describe('paths from the other side', () => {
  it('accepts the shapes the stores write', () => {
    for (const p of ['users.json', 'data-231e9ccf-b2c8-439d-91bc-4ef373eb6f55.json', `image-library/${'a'.repeat(64)}.jpg`, `video-library/${'b'.repeat(64)}/frame-0001.jpg`])
      expect(safeRelPath(p)).toBe(p)
  })

  it('refuses everything that could leave the directory', () => {
    for (const p of ['../users.json', 'a/../../b', '/etc/passwd', 'C:/x', 'a\\b', '.migration/staged.json', 'a//b', '', 'x\u0000y', 'a/./b'])
      expect(safeRelPath(p)).toBeNull()
    expect(resolveInside('/data', '../x')).toBeNull()
  })

  it('lists neither sessions, replay caches, temp files, its own state nor symlinks', () => {
    const dir = tmp()
    for (const f of ['users.json', 'sessions.json', 'sso-jti.json', 'config.json', 'x.json.abc.tmp']) fs.writeFileSync(path.join(dir, f), '{}')
    fs.mkdirSync(path.join(dir, '.migration'))
    fs.writeFileSync(path.join(dir, '.migration', 'staged.json'), '{}')
    let linked = false
    try {
      fs.symlinkSync(os.tmpdir(), path.join(dir, 'escape'))
      linked = true
    } catch {
      /* Windows without the privilege: the refusal is still asserted below when it exists */
    }
    const { files, skipped } = listFiles(dir)
    expect(files.map((f) => f.path)).toEqual(['config.json', 'users.json'])
    if (linked) expect(skipped).toContain('escape')
  })
})

describe('preflight', () => {
  const source = {
    mocky: '0.2.0',
    node: 'v22.12.0',
    now: 1000,
    summary: { bytes: 1000 },
    maintenance: true,
    queue: { active: 0 },
    needs: {},
    sso: { enabled: false },
  }
  const local = { mocky: '0.2.0', node: 'v22.12.0', now: 1000, disk: { free: 10_000 }, writable: true, empty: true }
  const byId = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c.status]))

  it('passes a like-for-like server', () => {
    const r = comparePreflight(source, local)
    expect(r.blocking).toBe(false)
    expect(r.checks.every((c) => c.status === 'ok')).toBe(true)
  })

  it('blocks on the four things that are certain to break', () => {
    expect(byId(comparePreflight(source, { ...local, node: 'v20.11.0' })).node).toBe('fail')
    expect(byId(comparePreflight(source, { ...local, mocky: '0.1.9' })).version).toBe('fail')
    expect(byId(comparePreflight(source, { ...local, disk: { free: 1050 } })).disk).toBe('fail')
    expect(byId(comparePreflight(source, { ...local, writable: false })).writable).toBe('fail')
    expect(comparePreflight(source, { ...local, writable: false }).blocking).toBe(true)
  })

  it('only warns on what the admin can still fix', () => {
    const r = comparePreflight(
      { ...source, mocky: '0.1.0', needs: { ffmpeg: true, videoWorker: 'http://w:3030' }, sso: { enabled: true, secretTag: 'a', dashyUrl: 'x' }, trustProxy: true, maintenance: false, queue: { active: 2 } },
      { ...local, empty: false, ffmpeg: false, worker: { available: false }, sso: { enabled: true, secretTag: 'b', dashyUrl: 'x' } },
    )
    expect(r.blocking).toBe(false)
    const s = byId(r)
    for (const id of ['version', 'empty', 'ffmpeg', 'worker', 'sso', 'proxy', 'maintenance', 'queue']) expect(s[id]).toBe('warn')
  })

  it('fails a clock too far off for the signatures to work', () => {
    expect(byId(comparePreflight(source, { ...local, now: 1000 + 5 * 60_000 })).clock).toBe('fail')
  })
})

describe('maintenance', () => {
  const on = { on: true }
  it('lets reads, sign-in and admins through, and nothing else', () => {
    expect(maintenanceBlocks({ method: 'PUT', path: '/api/data' }, { on: false }, false)).toBe(false)
    expect(maintenanceBlocks({ method: 'GET', path: '/api/data' }, on, false)).toBe(false)
    expect(maintenanceBlocks({ method: 'POST', path: '/api/login' }, on, false)).toBe(false)
    expect(maintenanceBlocks({ method: 'POST', path: '/api/logout' }, on, false)).toBe(false)
    // The heartbeat writes nothing; refusing it would show everyone offline.
    expect(maintenanceBlocks({ method: 'POST', path: '/api/presence' }, on, false)).toBe(false)
    expect(maintenanceBlocks({ method: 'PUT', path: '/api/data' }, on, true)).toBe(false)
    for (const [method, p] of [
      ['PUT', '/api/data'],
      ['POST', '/__provider/v1/chat/completions'],
      ['POST', '/api/register'],
      ['DELETE', '/api/images/abc'],
      ['POST', '/api/some-route-added-next-year'],
    ])
      expect(maintenanceBlocks({ method, path: p }, on, false)).toBe(true)
  })

  it('keeps the message to bounded plain text', () => {
    expect(cleanMaintenanceMessage('  Retour à 14h\u0007 ')).toBe('Retour à 14h')
    expect(cleanMaintenanceMessage('x'.repeat(900)).length).toBe(500)
  })
})

// ---- the two halves, talking over real HTTP --------------------------------

function listen(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv))
  })
}

describe('source and destination', () => {
  let srcDir, dstDir, srv, base, source, events

  beforeEach(async () => {
    srcDir = tmp()
    dstDir = tmp()
    fs.writeFileSync(path.join(srcDir, 'users.json'), JSON.stringify([{ id: 'u1', username: 'ada' }]))
    fs.writeFileSync(path.join(srcDir, 'sessions.json'), JSON.stringify({ tok: { u: 'u1' } }))
    fs.writeFileSync(path.join(srcDir, 'data-u1.json'), JSON.stringify({ projects: '[]' }))
    fs.mkdirSync(path.join(srcDir, 'image-library'))
    // Bigger than one chunk, so resuming and reassembly are exercised.
    fs.writeFileSync(path.join(srcDir, 'image-library', `${'c'.repeat(64)}.jpg`), crypto.randomBytes(CHUNK_BYTES + 1234))
    events = []
    const facts = { maintenance: false, queue: { active: 0 }, mocky: '0.2.0', node: process.version, now: Date.now() }
    source = createMigrationSource({ dataDir: srcDir, facts: () => ({ ...facts, now: Date.now() }), log: (e, d) => events.push([e, d]) })
    const app = express()
    app.use('/api/migration', source.router)
    srv = await listen(app)
    base = `http://127.0.0.1:${srv.address().port}`
    source._facts = facts
  })

  afterEach(() => srv.close())

  const destination = () =>
    createMigrationDestination({
      dataDir: dstDir,
      localFacts: async () => ({ mocky: '0.2.0', node: process.version, now: Date.now(), disk: { free: 1e12 }, writable: true, empty: true }),
      compare: comparePreflight,
    })

  const waitPass = async (d) => {
    for (let i = 0; i < 200; i++) {
      const s = d.status()
      if (s.pass && !s.pass.running) return s
      await new Promise((r) => setTimeout(r, 25))
    }
    throw new Error('pass did not finish')
  }

  it('is closed until an admin creates a code', async () => {
    const res = await fetch(`${base}/api/migration/manifest`)
    expect(res.status).toBe(401)
  })

  it('refuses a wrong code, then revokes itself after enough of them', async () => {
    source.create('admin')
    const d = destination()
    await expect(d.connect(base, newPairingCode())).rejects.toMatchObject({ code: 'refused' })
    // Signed with a real id but a wrong key: the failures that count.
    const code = source.create('admin').code
    const keys = deriveKeys(parsePairingCode(code))
    const forged = { ...keys, auth: crypto.randomBytes(32) }
    for (let i = 0; i < MAX_FAILURES; i++) {
      const { header } = signRequest(forged, 'GET', '/api/migration/manifest')
      await fetch(`${base}/api/migration/manifest`, { headers: { authorization: header } })
    }
    expect(source.status().active).toBe(false)
  })

  it('refuses a replayed request', async () => {
    const code = source.create('admin').code
    const keys = deriveKeys(parsePairingCode(code))
    const { header } = signRequest(keys, 'GET', '/api/migration/manifest')
    expect((await fetch(`${base}/api/migration/manifest`, { headers: { authorization: header } })).status).toBe(200)
    expect((await fetch(`${base}/api/migration/manifest`, { headers: { authorization: header } })).status).toBe(401)
  })

  it('serves only what its manifest listed', async () => {
    const code = source.create('admin').code
    const keys = deriveKeys(parsePairingCode(code))
    const get = (rel) => fetch(`${base}${rel}`, { headers: { authorization: signRequest(keys, 'GET', rel).header } })
    expect((await get('/api/migration/manifest')).status).toBe(200)
    expect((await get('/api/migration/file?path=sessions.json&offset=0')).status).toBe(404)
    expect((await get('/api/migration/file?path=..%2F..%2Fetc%2Fpasswd&offset=0')).status).toBe(404)
    expect((await get('/api/migration/file?path=users.json&offset=0')).status).toBe(200)
  })

  it('copies everything but the sessions, and is ready only once the source is frozen', async () => {
    const code = source.create('admin').code
    const d = destination()
    const connected = await d.connect(base, code)
    expect(connected.summary.users).toBe(1)

    d.startPass()
    let s = await waitPass(d)
    expect(s.pass.error).toBeNull()
    expect(s.pass.failedCount).toBe(0)
    expect(s.ready).toBe(false) // source not in maintenance

    // The source changes and freezes; the final pass moves only the delta.
    fs.writeFileSync(path.join(srcDir, 'data-u1.json'), JSON.stringify({ projects: '[{"id":"p1"}]' }))
    source._facts.maintenance = true
    d.startPass()
    s = await waitPass(d)
    expect(s.pass.filesTotal).toBe(1)
    expect(s.ready).toBe(true)

    fs.writeFileSync(path.join(dstDir, 'users.json'), JSON.stringify([{ id: 'local-admin' }]))
    d.finalize()
    expect(JSON.parse(fs.readFileSync(path.join(dstDir, 'users.json'), 'utf8'))[0].id).toBe('u1')
    expect(JSON.parse(fs.readFileSync(path.join(dstDir, 'sessions.json'), 'utf8'))).toEqual({})
    expect(fs.readFileSync(path.join(dstDir, 'data-u1.json'), 'utf8')).toContain('p1')
    const img = `image-library/${'c'.repeat(64)}.jpg`
    expect(fs.readFileSync(path.join(dstDir, img)).equals(fs.readFileSync(path.join(srcDir, img)))).toBe(true)
    // What was there before is moved aside, not deleted.
    const prev = fs.readdirSync(path.join(dstDir, '.migration')).find((n) => n.startsWith('previous-'))
    expect(fs.existsSync(path.join(dstDir, '.migration', prev, 'users.json'))).toBe(true)

    const v = await destination().verifyImport()
    expect(v.same).toBe(v.total)
  })

  it('removes on the destination what the source deleted between passes', async () => {
    const code = source.create('admin').code
    const d = destination()
    await d.connect(base, code)
    d.startPass()
    await waitPass(d)
    fs.rmSync(path.join(srcDir, 'data-u1.json'))
    source._facts.maintenance = true
    d.startPass()
    await waitPass(d)
    d.finalize()
    expect(fs.existsSync(path.join(dstDir, 'data-u1.json'))).toBe(false)
  })

  it('blocks a destination whose disk cannot hold the source', async () => {
    const code = source.create('admin').code
    const d = createMigrationDestination({
      dataDir: dstDir,
      localFacts: async () => ({ mocky: '0.2.0', node: process.version, now: Date.now(), disk: { free: 1000 }, writable: true, empty: true }),
      compare: comparePreflight,
    })
    const s = await d.connect(base, code)
    expect(s.preflight.blocking).toBe(true)
    expect(s.preflight.checks.find((c) => c.id === 'disk')).toMatchObject({ status: 'fail' })
    expect(() => d.startPass()).not.toThrow()
    await waitPass(d)
    expect(d.status().pass.error).toBe('preflight')
  })

  it('will not finalize before a clean final pass', async () => {
    const code = source.create('admin').code
    const d = destination()
    await d.connect(base, code)
    expect(() => d.finalize()).toThrow(MigrationError)
  })
})

describe('source URL', () => {
  it('keeps http(s) and refuses the rest', () => {
    expect(parseSourceUrl('https://old.example.com/')).toBe('https://old.example.com')
    expect(parseSourceUrl('http://192.168.1.20:8787')).toBe('http://192.168.1.20:8787')
    for (const bad of ['file:///etc/passwd', 'gopher://x', 'https://user:pw@x', 'not a url'])
      expect(() => parseSourceUrl(bad)).toThrow(MigrationError)
  })
})
