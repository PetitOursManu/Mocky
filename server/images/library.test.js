import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { ImageLibrary } from './library.js'

// A fake provider whose output is deterministic for a given prompt+seed+size, so
// identical requests produce identical bytes (exercises both dedup paths).
function fakeProvider(id = 'fake') {
  const state = { calls: 0 }
  return {
    id,
    requiresKey: false,
    async healthy() { return true },
    async generate(req) {
      state.calls++
      return { buffer: Buffer.from(`img:${req.prompt}:${req.seed}:${req.width}x${req.height}`), contentType: 'image/jpeg', provider: id }
    },
    state,
  }
}
const noneProvider = { id: 'none', async healthy() { return true }, async generate() { return { skipped: true } } }

function fakeRegistry(primary) {
  const all = { [primary.id]: primary, none: noneProvider }
  return { get: (id) => all[id] || null, pick: async () => primary, list: () => [] }
}

let dir
beforeEach(() => {
  dir = path.join(os.tmpdir(), `muse-lib-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
})
afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('ImageLibrary.generate', () => {
  it('generates, stores a file, and records metadata', async () => {
    const provider = fakeProvider()
    const lib = new ImageLibrary(dir)
    const out = await lib.generate(
      { prompt: 'bakery hero', seed: 7, width: 800, height: 400, slotType: 'hero', project: 'p1', tags: ['warm'] },
      { registry: fakeRegistry(provider) },
    )
    expect(out.fromCache).toBe(false)
    expect(lib.fileExists(out.hash)).toBe(true)
    const meta = lib.get(out.hash)
    expect(meta).toMatchObject({ prompt: 'bakery hero', seed: 7, width: 800, height: 400, provider: 'fake', projects: ['p1'] })
    expect(meta.tags).toEqual(expect.arrayContaining(['warm', 'hero']))
  })

  it('reuses an identical prompt+seed without calling the provider again (M8)', async () => {
    const provider = fakeProvider()
    const lib = new ImageLibrary(dir)
    const reg = fakeRegistry(provider)
    const a = await lib.generate({ prompt: 'x', seed: 1, width: 100, height: 100, project: 'p1' }, { registry: reg })
    const b = await lib.generate({ prompt: 'x', seed: 1, width: 100, height: 100, project: 'p2' }, { registry: reg })
    expect(b.fromCache).toBe(true)
    expect(a.hash).toBe(b.hash)
    expect(provider.state.calls).toBe(1) // provider hit once
    expect(lib.get(a.hash).projects).toEqual(['p1', 'p2']) // usage tracked across projects
  })

  it('generates a new image when the prompt differs', async () => {
    const provider = fakeProvider()
    const lib = new ImageLibrary(dir)
    const reg = fakeRegistry(provider)
    const a = await lib.generate({ prompt: 'one', seed: 1, width: 100, height: 100 }, { registry: reg })
    const b = await lib.generate({ prompt: 'two', seed: 1, width: 100, height: 100 }, { registry: reg })
    expect(a.hash).not.toBe(b.hash)
    expect(provider.state.calls).toBe(2)
  })

  it('returns skipped for the none provider (placeholder path)', async () => {
    const lib = new ImageLibrary(dir)
    const out = await lib.generate({ prompt: 'x', providerId: 'none', width: 10, height: 10 }, { registry: fakeRegistry(fakeProvider()) })
    expect(out).toMatchObject({ hash: null, skipped: true })
  })

  it('rejects an empty prompt', async () => {
    const lib = new ImageLibrary(dir)
    await expect(lib.generate({ prompt: '  ' }, { registry: fakeRegistry(fakeProvider()) })).rejects.toThrow(/prompt/i)
  })
})

describe('ImageLibrary listing / favorites / removal', () => {
  async function seed() {
    const provider = fakeProvider()
    const lib = new ImageLibrary(dir)
    const reg = fakeRegistry(provider)
    const h1 = (await lib.generate({ prompt: 'red hero', seed: 1, width: 10, height: 10, slotType: 'hero', project: 'p1', tags: ['bold'] }, { registry: reg })).hash
    const h2 = (await lib.generate({ prompt: 'blue avatar', seed: 2, width: 10, height: 10, slotType: 'avatar', project: 'p2' }, { registry: reg })).hash
    return { lib, h1, h2 }
  }

  it('filters by query, project, favorites and slot type', async () => {
    const { lib, h1, h2 } = await seed()
    expect(lib.list({ query: 'hero' }).map((m) => m.hash)).toEqual([h1])
    expect(lib.list({ query: 'bold' }).map((m) => m.hash)).toEqual([h1]) // tag search
    expect(lib.list({ project: 'p2' }).map((m) => m.hash)).toEqual([h2])
    expect(lib.list({ slotType: 'avatar' }).map((m) => m.hash)).toEqual([h2])
    lib.toggleFavorite(h1)
    expect(lib.list({ favorites: true }).map((m) => m.hash)).toEqual([h1])
  })

  it('toggleFavorite flips the flag', async () => {
    const { lib, h1 } = await seed()
    expect(lib.toggleFavorite(h1).favorite).toBe(true)
    expect(lib.toggleFavorite(h1).favorite).toBe(false)
    expect(lib.toggleFavorite('deadbeefdeadbeef')).toBeNull()
  })

  it('remove() deletes the file and returns the projects that used it', async () => {
    const { lib, h1 } = await seed()
    const res = lib.remove(h1)
    expect(res).toMatchObject({ removed: true, projects: ['p1'] })
    expect(lib.fileExists(h1)).toBe(false)
    expect(lib.get(h1)).toBeNull()
  })

  it('onProjectDeleted drops the project from usage but KEEPS files (M8)', async () => {
    const { lib, h1 } = await seed()
    const touched = lib.onProjectDeleted('p1')
    expect(touched).toBe(1)
    expect(lib.get(h1).projects).toEqual([])
    expect(lib.fileExists(h1)).toBe(true) // file survives project deletion
  })
})

describe('ImageLibrary persistence + zip', () => {
  it('survives a restart (metadata + files persist)', async () => {
    const provider = fakeProvider()
    const reg = fakeRegistry(provider)
    const lib1 = new ImageLibrary(dir)
    const h = (await lib1.generate({ prompt: 'persist', seed: 1, width: 10, height: 10 }, { registry: reg })).hash
    const lib2 = new ImageLibrary(dir)
    expect(lib2.get(h)?.prompt).toBe('persist')
    expect(lib2.fileExists(h)).toBe(true)
  })

  it('zip() includes each image plus a manifest with prompts/seeds/tags', async () => {
    const provider = fakeProvider()
    const reg = fakeRegistry(provider)
    const lib = new ImageLibrary(dir)
    const h = (await lib.generate({ prompt: 'zipme', seed: 9, width: 10, height: 10, tags: ['hero'] }, { registry: reg })).hash
    const buf = lib.zip([h])
    // Parse the stored zip and check the manifest.
    const names = []
    let o = 0
    while (o + 4 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
      const compSize = buf.readUInt32LE(o + 18)
      const nameLen = buf.readUInt16LE(o + 26)
      const extraLen = buf.readUInt16LE(o + 28)
      const name = buf.slice(o + 30, o + 30 + nameLen).toString('utf8')
      const dataStart = o + 30 + nameLen + extraLen
      if (name === 'manifest.json') {
        const manifest = JSON.parse(buf.slice(dataStart, dataStart + compSize).toString('utf8'))
        expect(manifest.images[0]).toMatchObject({ hash: h, prompt: 'zipme', seed: 9, tags: ['hero'] })
      }
      names.push(name)
      o = dataStart + compSize
    }
    expect(names).toContain('manifest.json')
    expect(names.some((n) => n.endsWith('.jpg'))).toBe(true)
  })
})
