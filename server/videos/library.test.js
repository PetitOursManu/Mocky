import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { VideoLibrary } from './library.js'
import { frameName } from './frames.js'

let dataDir
beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-videolib-'))
})
afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true })
})

/** Stands in for ffmpeg: writes `count` frames plus a poster into outDir. */
function fakeExtract(count = 4) {
  return async (_src, outDir) => {
    fs.mkdirSync(outDir, { recursive: true })
    for (let i = 1; i <= count; i++) fs.writeFileSync(path.join(outDir, frameName(i)), `f${i}`)
    fs.writeFileSync(path.join(outDir, 'poster.jpg'), 'f1')
    return { frames: count, width: 960, fps: 12 }
  }
}

const spec = { prompt: 'a slow pan over a misty valley', provider: 'fal', model: 'fal-ai/ltx-video' }

describe('VideoLibrary.ingest', () => {
  it('stores the clip, cuts it, and records what came out', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract(6) })
    const out = await lib.ingest(Buffer.from('mp4-bytes'), spec)

    expect(out.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(out.meta.frames).toBe(6)
    expect(out.fromCache).toBe(false)
    expect(fs.existsSync(lib.sourcePath(out.hash))).toBe(true)
    expect(fs.existsSync(lib.posterPath(out.hash))).toBe(true)
  })

  it('does not cut the same bytes twice', async () => {
    let cuts = 0
    const counting = async (src, outDir) => {
      cuts++
      return fakeExtract(3)(src, outDir)
    }
    const lib = new VideoLibrary(dataDir, { extract: counting })
    const a = await lib.ingest(Buffer.from('same'), spec)
    const b = await lib.ingest(Buffer.from('same'), { ...spec, prompt: 'written differently' })

    expect(b.hash).toBe(a.hash)
    expect(b.fromCache).toBe(true)
    expect(cuts).toBe(1)
  })

  it('refuses an empty clip rather than storing a broken sequence', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract() })
    await expect(lib.ingest(Buffer.alloc(0), spec)).rejects.toThrow(/empty/i)
  })

  it('leaves nothing behind when the cut fails', async () => {
    // A half-written directory would be found by posterPath on the next run and
    // served as a working sequence with no frames in it.
    const lib = new VideoLibrary(dataDir, {
      extract: async () => {
        throw new Error('ffmpeg exploded')
      },
    })
    await expect(lib.ingest(Buffer.from('bad'), spec)).rejects.toThrow(/exploded/)
    expect(fs.readdirSync(path.join(dataDir, 'video-library'))).toEqual([])
  })
})

describe('the request cache', () => {
  it('returns a hit for an identical ask — video is the expensive call', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract() })
    const first = await lib.ingest(Buffer.from('clip'), spec)
    const hit = lib.cached(spec)
    expect(hit?.hash).toBe(first.hash)
    expect(hit?.fromCache).toBe(true)
  })

  it('misses when anything about the ask changed', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract() })
    await lib.ingest(Buffer.from('clip'), spec)
    expect(lib.cached({ ...spec, prompt: 'something else' })).toBe(null)
    expect(lib.cached({ ...spec, model: 'fal-ai/kling-video' })).toBe(null)
    expect(lib.cached({ ...spec, negative: 'no people' })).toBe(null)
  })

  it('misses when the files are gone, however healthy the metadata looks', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract() })
    const out = await lib.ingest(Buffer.from('clip'), spec)
    fs.rmSync(lib.dirFor(out.hash), { recursive: true, force: true })
    expect(lib.cached(spec)).toBe(null)
  })

  it('survives a restart', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract() })
    const out = await lib.ingest(Buffer.from('clip'), spec)
    const reopened = new VideoLibrary(dataDir, { extract: fakeExtract() })
    expect(reopened.cached(spec)?.hash).toBe(out.hash)
    expect(reopened.meta(out.hash)?.frames).toBe(4)
  })
})

describe('framePath', () => {
  it('serves frames inside the sequence and refuses everything else', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract(4) })
    const { hash } = await lib.ingest(Buffer.from('clip'), spec)

    expect(lib.framePath(hash, 1)).toContain('f0001.jpg')
    expect(lib.framePath(hash, 4)).toContain('f0004.jpg')
    expect(lib.framePath(hash, 0)).toBe(null)
    expect(lib.framePath(hash, 5)).toBe(null)
    expect(lib.framePath(hash, -1)).toBe(null)
    expect(lib.framePath(hash, 'nope')).toBe(null)
    // The index is the only user-controlled part of the path, so it must not be
    // able to walk out of the directory.
    expect(lib.framePath(hash, '../../../../etc/passwd')).toBe(null)
    expect(lib.framePath(hash, '1/../../../etc/passwd')).toBe(null)
    expect(lib.framePath(hash, '%2e%2e%2fpasswd')).toBe(null)
    expect(lib.framePath('not-a-hash', 1)).toBe(null)
  })

  it('serves frames written by something other than this instance', async () => {
    // A restore, a second worker, or a seed script writes the directory; this
    // object's in-memory snapshot predates it. The files are there, so the
    // frames must serve — bounds come from the filesystem, not from metadata.
    const writer = new VideoLibrary(dataDir, { extract: fakeExtract(4) })
    const { hash } = await writer.ingest(Buffer.from('clip'), spec)

    const stale = new VideoLibrary(dataDir, { extract: fakeExtract(4) })
    stale.state = { byHash: {}, byRequest: {} } // knows nothing

    expect(stale.framePath(hash, 2)).toContain('f0002.jpg')
    expect(stale.framePath(hash, 9)).toBe(null)
  })
})

describe('remove', () => {
  it('deletes the files and forgets the cached request', async () => {
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract() })
    const { hash } = await lib.ingest(Buffer.from('clip'), spec)

    expect(lib.remove(hash)?.removed).toBe(true)
    expect(lib.meta(hash)).toBe(null)
    expect(lib.cached(spec)).toBe(null)
    expect(fs.existsSync(path.join(dataDir, 'video-library', hash))).toBe(false)
    expect(lib.remove(hash)).toBe(null)
  })
})

describe('list', () => {
  it('is newest-first and filterable by project', async () => {
    let t = 1_000
    const lib = new VideoLibrary(dataDir, { extract: fakeExtract(), now: () => (t += 1_000) })
    await lib.ingest(Buffer.from('a'), { ...spec, prompt: 'a', project: 'p1' })
    await lib.ingest(Buffer.from('b'), { ...spec, prompt: 'b', project: 'p2' })
    await lib.ingest(Buffer.from('c'), { ...spec, prompt: 'c', project: 'p1' })

    expect(lib.list().map((m) => m.prompt)).toEqual(['c', 'b', 'a'])
    expect(lib.list({ project: 'p1' }).map((m) => m.prompt)).toEqual(['c', 'a'])
  })
})
