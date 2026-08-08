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

/**
 * Storing a derivation. The library is where an image-to-image result becomes
 * indistinguishable from anything else, so it is the last place any of this can
 * still be checked.
 */
describe('ImageLibrary.generate — with a source image', () => {
  const SOURCE = { buffer: Buffer.from('source-bytes'), contentType: 'image/png' }
  const OTHER = { buffer: Buffer.from('other-bytes'), contentType: 'image/png' }

  /** Echoes the source back, so the stored bytes prove it was actually used. */
  function editProvider(id = 'editor') {
    const state = { calls: 0, lastInit: null, lastStrength: null }
    return {
      id,
      async healthy() { return true },
      async generate(req) {
        state.calls++
        state.lastInit = req.init || null
        state.lastStrength = req.strength ?? null
        return {
          buffer: Buffer.from(`edit:${req.prompt}:${req.init ? req.init.buffer.toString('hex') : 'none'}`),
          contentType: 'image/jpeg',
          provider: id,
          ...(req.init ? { edited: true, strengthApplied: true } : {}),
        }
      },
      state,
    }
  }

  it('forwards the bytes and the strength, and records where they came from', async () => {
    const provider = editProvider()
    const lib = new ImageLibrary(dir)
    const out = await lib.generate(
      { prompt: 'a variant', seed: 1, width: 10, height: 10, init: SOURCE, strength: 0.45 },
      { registry: fakeRegistry(provider) },
    )
    expect(provider.state.lastInit.buffer.equals(SOURCE.buffer)).toBe(true)
    expect(provider.state.lastStrength).toBe(0.45)
    expect(lib.get(out.hash).derivedFrom).toBe(crypto.createHash('sha256').update(SOURCE.buffer).digest('hex'))
  })

  /**
   * The defect: two variants of two DIFFERENT pictures share a prompt, a seed
   * and a size. With the source out of the request key, the second request is a
   * cache hit and the user is handed a derivative of somebody else's photograph.
   */
  it('does not serve one source\'s derivative for another\'s', async () => {
    const provider = editProvider()
    const lib = new ImageLibrary(dir)
    const spec = { prompt: 'same words', seed: 1, width: 10, height: 10, strength: 0.45 }
    const a = await lib.generate({ ...spec, init: SOURCE }, { registry: fakeRegistry(provider) })
    const b = await lib.generate({ ...spec, init: OTHER }, { registry: fakeRegistry(provider) })
    expect(b.fromCache).toBe(false)
    expect(a.hash).not.toBe(b.hash)
    expect(provider.state.calls).toBe(2)
  })

  it('still reuses an identical derivation rather than paying twice', async () => {
    const provider = editProvider()
    const lib = new ImageLibrary(dir)
    const spec = { prompt: 'same words', seed: 1, width: 10, height: 10, init: SOURCE, strength: 0.45 }
    await lib.generate(spec, { registry: fakeRegistry(provider) })
    const b = await lib.generate(spec, { registry: fakeRegistry(provider) })
    expect(b.fromCache).toBe(true)
    expect(provider.state.calls).toBe(1)
  })

  /**
   * A key written before image-to-image existed must still hash to the same
   * value: folding two empty fields in unconditionally would make the first boot
   * after that change re-pay a provider for the entire library.
   */
  it('leaves the plain generation key byte-identical', () => {
    const spec = { provider: 'p', prompt: 'x', negative: '', seed: 3, width: 10, height: 10 }
    expect(ImageLibrary.requestKey(spec)).toBe(ImageLibrary.requestKey({ ...spec, initHash: null, strength: null }))
  })

  it('refuses to store a result that does not claim to be derived', async () => {
    // A provider that silently ignored the source image returns a fine picture
    // of the right size, reported as a success. Once those bytes are in the
    // library nothing can ever tell them apart from a real derivative again.
    const liar = {
      id: 'liar',
      async healthy() { return true },
      async generate() {
        return { buffer: Buffer.from('from-the-prompt-alone'), contentType: 'image/jpeg', provider: 'liar' }
      },
    }
    const lib = new ImageLibrary(dir)
    await expect(
      lib.generate({ prompt: 'p', seed: 1, width: 10, height: 10, init: SOURCE }, { registry: fakeRegistry(liar) }),
    ).rejects.toThrow(/sans confirmer qu'elle dérive/i)
    expect(lib.list({ includePending: true })).toEqual([])
  })

  it('keeps a pending image out of the listing', async () => {
    const provider = editProvider()
    const lib = new ImageLibrary(dir)
    const reg = fakeRegistry(provider)
    const confirmed = await lib.generate({ prompt: 'confirmed', seed: 1, width: 10, height: 10 }, { registry: reg })
    const waiting = await lib.generate(
      { prompt: 'awaiting a human', seed: 1, width: 10, height: 10, pending: true },
      { registry: reg },
    )
    expect(lib.get(waiting.hash).pending).toBe(true)
    expect(lib.list().map((m) => m.hash)).toEqual([confirmed.hash])
    expect(lib.list({ includePending: true })).toHaveLength(2)
  })

  /**
   * The store is content-addressed, so a pending variant whose bytes match an
   * image already here lands on THAT entry. Marking it would pull a picture the
   * user accepted weeks ago out of their own library, because of a duplicate
   * they never saw.
   */
  it('never marks an image that was already in the library', async () => {
    const provider = editProvider()
    const lib = new ImageLibrary(dir)
    const reg = fakeRegistry(provider)
    // The fake provider's bytes depend on the prompt alone, so a different seed
    // is a different request that produces identical pixels — exactly the case.
    const first = await lib.generate({ prompt: 'same picture', seed: 1, width: 10, height: 10 }, { registry: reg })
    const dup = await lib.generate(
      { prompt: 'same picture', seed: 2, width: 10, height: 10, pending: true },
      { registry: reg },
    )
    expect(dup.hash).toBe(first.hash)
    expect(lib.get(first.hash).pending).toBeUndefined()
    expect(lib.list()).toHaveLength(1)
  })
})

/**
 * The flag that gates the video montage, and the three things about it that a
 * refactor is most likely to get exactly backwards.
 */
describe('ImageLibrary confirmation', () => {
  const pendingLib = async () => {
    const lib = new ImageLibrary(dir)
    const reg = fakeRegistry(fakeProvider())
    const out = await lib.generate(
      { prompt: 'a take nobody has seen', seed: 3, width: 10, height: 10, pending: true, owner: 'u1' },
      { registry: reg },
    )
    return { lib, hash: out.hash }
  }

  it('puts a confirmed image back in the listing', async () => {
    const { lib, hash } = await pendingLib()
    expect(lib.list()).toEqual([])
    lib.confirm(hash)
    expect(lib.list().map((m) => m.hash)).toEqual([hash])
  })

  /**
   * `delete`, never `pending: false`. The library is full of images that predate
   * this field entirely, and they are eligible precisely because the key is
   * absent — so a confirmed image has to end up in the same shape, or "is this
   * mountable" quietly becomes two different questions with two different
   * answers for the same picture.
   */
  it('removes the key rather than setting it false', async () => {
    const { lib, hash } = await pendingLib()
    lib.confirm(hash)
    expect(Object.prototype.hasOwnProperty.call(lib.get(hash), 'pending')).toBe(false)
  })

  it('survives a reload, and confirming twice is not an error', async () => {
    const { lib, hash } = await pendingLib()
    lib.confirm(hash)
    // The panel confirms a batch; a retry after a dropped response must not turn
    // into a 404 on an image that is already fine.
    expect(lib.confirm(hash)).toMatchObject({ hash })
    expect(new ImageLibrary(dir).list().map((m) => m.hash)).toEqual([hash])
  })

  it('says nothing about a hash it has never seen', async () => {
    const { lib } = await pendingLib()
    expect(lib.confirm('f'.repeat(64))).toBeNull()
  })

  /**
   * The guard's single source. Two routes ask this question and they must not be
   * free to answer it apart: an unknown hash is a different fault with a
   * different HTTP status, and reporting it here would make /render answer 409
   * for a picture that is simply gone.
   */
  it('reports only the pending ids, never the unknown ones', async () => {
    const { lib, hash } = await pendingLib()
    const reg = fakeRegistry(fakeProvider())
    const seen = await lib.generate({ prompt: 'already kept', seed: 4, width: 10, height: 10 }, { registry: reg })
    const ghost = 'f'.repeat(64)
    expect(lib.pendingAmong([hash, seen.hash, ghost, hash])).toEqual([hash])
    lib.confirm(hash)
    expect(lib.pendingAmong([hash, seen.hash, ghost])).toEqual([])
  })

  /**
   * THE UPGRADE. Not a hypothetical: this is what every existing instance looks
   * like the first time it boots this version.
   *
   * The index on disk was written before `pending` existed, so no entry carries
   * the key. The flag was spelled as an exception rather than as `confirmed:
   * boolean` precisely so that absence means eligible — but the block comment
   * saying so cannot fail a build, and the tests above all create their fixtures
   * through `generate()`, which is the one path that could not regress. So the
   * legacy file is written by hand here, read back through `_load()`, and asked
   * the two questions the montage asks: does it show up, and would /render
   * refuse it.
   *
   * Get this wrong and video export stops working on update, for everybody, with
   * every other test still green.
   */
  it('leaves an image written before the flag existed fully mountable', () => {
    const hash = 'a'.repeat(64)
    const legacy = {
      byHash: {
        [hash]: {
          hash,
          prompt: 'made two versions ago',
          negative: null,
          provider: 'fake',
          seed: 1,
          width: 100,
          height: 100,
          mime: 'image/jpeg',
          createdAt: 1,
          tags: [],
          projects: ['p1'],
          owners: ['u1'],
          favorite: false,
        },
      },
      byRequest: {},
    }
    fs.writeFileSync(path.join(dir, 'image-library.json'), JSON.stringify(legacy))
    fs.mkdirSync(path.join(dir, 'image-library'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'image-library', `${hash}.jpg`), Buffer.from('bytes'))

    const lib = new ImageLibrary(dir)
    // Nothing to backfill: the key is absent and that IS the answer.
    expect(Object.prototype.hasOwnProperty.call(lib.get(hash), 'pending')).toBe(false)
    expect(lib.list().map((m) => m.hash)).toEqual([hash])
    expect(lib.pendingAmong([hash])).toEqual([])
    // And it stays that way: confirming an image that was never pending is a
    // no-op, not a rewrite that would make it look different from its neighbours.
    expect(lib.confirm(hash)).toMatchObject({ hash })
    expect(Object.prototype.hasOwnProperty.call(lib.get(hash), 'pending')).toBe(false)
  })

  /**
   * Ownership is a set (M8), so this is membership. It is what stops one account
   * confirming another's discards on an instance-wide library.
   */
  it('recognises the account that asked for the image, and only that one', async () => {
    const { lib, hash } = await pendingLib()
    expect(lib.ownedBy(hash, 'u1')).toBe(true)
    expect(lib.ownedBy(hash, 'u2')).toBe(false)
    expect(lib.ownedBy(hash, undefined)).toBe(false)
    expect(lib.ownedBy('f'.repeat(64), 'u1')).toBe(false)
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
