import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { collectUsage, fileBytes, readProjectStats, splitOwnedBytes } from './usage.js'

function tmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-usage-'))
}

/** Write the file shape PUT /api/data produces: `projects` is a JSON STRING. */
function writeUserData(dir, id, projects, design = null) {
  fs.writeFileSync(
    path.join(dir, `data-${id}.json`),
    JSON.stringify({ projects: projects === null ? null : JSON.stringify(projects), design }),
  )
}

describe('readProjectStats', () => {
  it('counts projects and their screens', () => {
    const raw = JSON.stringify([
      { id: 'a', screens: [{}, {}] },
      { id: 'b', screens: [{}] },
    ])
    expect(readProjectStats(raw)).toEqual({ projects: 2, screens: 3, deleted: 0 })
  })

  it('does not count a tombstone as a project', () => {
    // Deletions stay in the blob so they can travel to the other devices. They
    // cost storage without being projects.
    const raw = JSON.stringify([{ id: 'a', screens: [{}] }, { id: 'b', deletedAt: 123, screens: [{}, {}] }])
    expect(readProjectStats(raw)).toEqual({ projects: 1, screens: 1, deleted: 1 })
  })

  it('treats an absent or empty blob as an empty account', () => {
    expect(readProjectStats(null)).toEqual({ projects: 0, screens: 0, deleted: 0 })
    expect(readProjectStats('')).toEqual({ projects: 0, screens: 0, deleted: 0 })
  })

  it('reports unreadable rather than zero', () => {
    // A user whose blob will not parse has not got zero projects, and saying so
    // sends an administrator hunting for someone else's problem.
    expect(readProjectStats('{not json')).toBeNull()
    expect(readProjectStats('{"projects":[]}')).toBeNull() // an object, not the array
  })

  it('survives junk inside the array', () => {
    const raw = JSON.stringify([null, 'nonsense', { id: 'a' }, { id: 'b', screens: 'no' }])
    expect(readProjectStats(raw)).toEqual({ projects: 2, screens: 0, deleted: 0 })
  })
})

describe('splitOwnedBytes', () => {
  it('charges a single owner the whole file', () => {
    const out = splitOwnedBytes([{ owners: ['u1'], bytes: 900 }])
    expect(out.byUser.u1).toEqual({ bytes: 900, count: 1 })
    expect(out.unattributed).toEqual({ bytes: 0, count: 0 })
  })

  it('splits a deduplicated file between its owners so the column still sums', () => {
    // One file on disk, two people who put it there. Charging both the full
    // size would make the table add up to more than the volume holds.
    const out = splitOwnedBytes([{ owners: ['u1', 'u2'], bytes: 900 }])
    expect(out.byUser.u1.bytes).toBe(450)
    expect(out.byUser.u2.bytes).toBe(450)
    expect(out.byUser.u1.bytes + out.byUser.u2.bytes).toBe(900)
  })

  it('puts media with no recorded owner on its own line', () => {
    // Everything that existed before ownership was recorded. Its owner is
    // unknown, not absent, and guessing would print a guess as a fact.
    const out = splitOwnedBytes([{ bytes: 500 }, { owners: [], bytes: 300 }])
    expect(out.unattributed).toEqual({ bytes: 800, count: 2 })
    expect(out.byUser).toEqual({})
  })

  it('hands a deleted account’s media back to the unattributed line', () => {
    const out = splitOwnedBytes([{ owners: ['gone'], bytes: 400 }], new Set(['u1']))
    expect(out.unattributed).toEqual({ bytes: 400, count: 1 })
    expect(out.byUser.gone).toBeUndefined()
  })

  it('keeps the share of the owners that do still exist', () => {
    const out = splitOwnedBytes([{ owners: ['u1', 'gone'], bytes: 400 }], new Set(['u1']))
    expect(out.byUser.u1.bytes).toBe(400)
    expect(out.unattributed.bytes).toBe(0)
  })

  it('never lets a negative or absent size credit an account', () => {
    const out = splitOwnedBytes([{ owners: ['u1'], bytes: -5000 }, { owners: ['u1'] }])
    expect(out.byUser.u1.bytes).toBe(0)
  })
})

describe('collectUsage', () => {
  const users = [
    { id: 'u1', username: 'ana', role: 'admin', createdAt: 1 },
    { id: 'u2', username: 'bo', createdAt: 2 },
  ]

  it('reports projects, screens and bytes per user', () => {
    const dir = tmpDataDir()
    writeUserData(dir, 'u1', [{ id: 'p1', screens: [{}, {}] }])
    writeUserData(dir, 'u2', [])
    fs.mkdirSync(path.join(dir, 'avatars'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'avatars', 'u1'), Buffer.alloc(64))

    const out = collectUsage({ dataDir: dir, users })
    const ana = out.users.find((u) => u.username === 'ana')
    expect(ana.projects).toBe(1)
    expect(ana.screens).toBe(2)
    expect(ana.bytes.avatar).toBe(64)
    expect(ana.bytes.data).toBeGreaterThan(0)
    expect(ana.bytes.total).toBe(ana.bytes.data + ana.bytes.avatar + ana.bytes.media)
    expect(out.users.find((u) => u.username === 'bo').projects).toBe(0)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('counts an account with no data file at all as empty, not broken', () => {
    const dir = tmpDataDir()
    const out = collectUsage({ dataDir: dir, users })
    expect(out.users.every((u) => u.readable)).toBe(true)
    expect(out.users.every((u) => u.bytes.total === 0)).toBe(true)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('flags a blob it could not read instead of reporting zero projects', () => {
    const dir = tmpDataDir()
    fs.writeFileSync(path.join(dir, 'data-u1.json'), '{"projects":"{not json"}')
    const out = collectUsage({ dataDir: dir, users })
    const ana = out.users.find((u) => u.username === 'ana')
    expect(ana.readable).toBe(false)
    expect(ana.projects).toBe(0)
    // The bytes are still real and still counted — only the contents are opaque.
    expect(ana.bytes.data).toBeGreaterThan(0)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('attributes image bytes to their owner and the rest to the unattributed line', () => {
    const dir = tmpDataDir()
    const images = {
      list: () => [
        { hash: 'a', owners: ['u1'] },
        { hash: 'b', owners: ['u1', 'u2'] },
        { hash: 'c' }, // predates ownership being recorded
      ],
      fileSize: (h) => ({ a: 1000, b: 400, c: 7000 })[h] || 0,
    }
    const out = collectUsage({ dataDir: dir, users, images })
    expect(out.users.find((u) => u.username === 'ana').bytes.media).toBe(1200)
    expect(out.users.find((u) => u.username === 'bo').bytes.media).toBe(200)
    expect(out.unattributed).toEqual({ bytes: 7000, count: 1 })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('walks a scroll sequence’s directory rather than stat-ing one file', () => {
    const dir = tmpDataDir()
    const seq = path.join(dir, 'video-library', 'v1')
    fs.mkdirSync(seq, { recursive: true })
    fs.writeFileSync(path.join(seq, 'source.mp4'), Buffer.alloc(2000))
    fs.writeFileSync(path.join(seq, 'f0001.jpg'), Buffer.alloc(500))
    const videos = {
      list: () => [{ hash: 'v1', owners: ['u2'] }],
      dirFor: () => seq,
    }
    const out = collectUsage({ dataDir: dir, users, videos })
    expect(out.users.find((u) => u.username === 'bo').bytes.media).toBe(2500)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  /**
   * Exported films are on the same volume and count against the same ceiling, so
   * a media column that ignored them would report a user as holding less disk
   * than the budget is charging them for — and the two numbers sit side by side
   * on the Admin screen.
   */
  it('counts an exported film with the rest of a user’s media', () => {
    const dir = tmpDataDir()
    const videoExports = {
      list: () => [{ hash: 'e1', owners: ['u1'] }],
      fileSize: () => 3000,
    }
    const out = collectUsage({ dataDir: dir, users, videoExports })
    expect(out.users.find((u) => u.username === 'ana').bytes.media).toBe(3000)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('sorts the heaviest account first', () => {
    const dir = tmpDataDir()
    writeUserData(dir, 'u2', [{ id: 'p', screens: new Array(20).fill({ code: 'x'.repeat(200) }) }])
    writeUserData(dir, 'u1', [])
    const out = collectUsage({ dataDir: dir, users })
    expect(out.users[0].username).toBe('bo')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('passes the instance total through untouched', () => {
    const dir = tmpDataDir()
    const instance = { bytes: 42, maxBytes: 100, ratio: 0.42 }
    expect(collectUsage({ dataDir: dir, users, instance }).instance).toEqual(instance)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('fileBytes', () => {
  it('is 0 for a missing path and for a directory', () => {
    const dir = tmpDataDir()
    expect(fileBytes(path.join(dir, 'nope'))).toBe(0)
    expect(fileBytes(dir)).toBe(0)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
