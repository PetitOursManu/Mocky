import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { VideoLibrary } from './library.js'

/**
 * Re-cutting an existing clip.
 *
 * The point of the feature is that `ingest` keeps `source.mp4`, so raising the
 * frame rate does not mean paying a provider again. The point of these tests is
 * the failure path: a re-cut that dies halfway must leave the clip exactly as it
 * was, because the frames are the only thing the app can serve and the source
 * alone is useless to it.
 */

let dir
let lib
/** What the injected extractor should do on its next call. */
let behaviour

/** Stands in for ffmpeg: writes n frames plus a poster, or throws. */
async function fakeExtract(videoPath, outDir, opts = {}) {
  if (behaviour.throws) throw behaviour.throws
  fs.mkdirSync(outDir, { recursive: true })
  const frames = behaviour.frames
  for (let i = 1; i <= frames; i++) {
    fs.writeFileSync(path.join(outDir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.alloc(behaviour.bytes || 10, i))
  }
  fs.writeFileSync(path.join(outDir, 'poster.jpg'), Buffer.alloc(10, 1))
  return { frames, width: opts.width || 960, fps: opts.fps || 12, poster: 'poster.jpg' }
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-recut-'))
  behaviour = { frames: 4, bytes: 10 }
  lib = new VideoLibrary(dir, { extract: fakeExtract, now: () => 1000 })
  await lib.ingest(Buffer.from('un clip'), { prompt: 'test', provider: 'test' }, { fps: 12, width: 960 })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const onlyHash = () => Object.keys(lib.state.byHash)[0]

describe('recut', () => {
  it('replaces the sequence and keeps the hash', () => {
    const hash = onlyHash()
    expect(lib.meta(hash).frames).toBe(4)

    behaviour = { frames: 9 }
    return lib.recut(hash, { fps: 24, width: 1440 }).then((out) => {
      // The hash is the SHA-256 of the SOURCE, not of the frames, so every URL
      // already handed out to a screen stays valid across a re-cut.
      expect(out.hash).toBe(hash)
      expect(lib.meta(hash).frames).toBe(9)
      expect(lib.meta(hash).fps).toBe(24)
      expect(lib.meta(hash).width).toBe(1440)
    })
  })

  it('keeps the source, so it can be cut again and again', async () => {
    const hash = onlyHash()
    behaviour = { frames: 9 }
    await lib.recut(hash)
    expect(lib.sourcePath(hash)).toBeTruthy()
    behaviour = { frames: 3 }
    await lib.recut(hash)
    expect(lib.meta(hash).frames).toBe(3)
  })

  it('leaves no stale frames when the new cut is shorter', async () => {
    const hash = onlyHash()
    behaviour = { frames: 12 }
    await lib.recut(hash)
    behaviour = { frames: 3 }
    await lib.recut(hash)
    // Frame 4 of the twelve-frame cut must be gone: meta says three, so nothing
    // would ever request it again and it would sit on the disk for good.
    const files = fs.readdirSync(path.dirname(lib.sourcePath(hash)))
    expect(files.filter((f) => f.startsWith('f') && f.endsWith('.jpg'))).toHaveLength(3)
  })

  it('destroys nothing when the extractor fails', async () => {
    const hash = onlyHash()
    const before = fs.readdirSync(path.dirname(lib.sourcePath(hash))).sort()

    behaviour = { throws: new Error('ffmpeg est tombé') }
    await expect(lib.recut(hash)).rejects.toThrow('ffmpeg')

    // This is the whole reason the new sequence is staged in a sibling directory
    // rather than written over the old one.
    expect(fs.readdirSync(path.dirname(lib.sourcePath(hash))).sort()).toEqual(before)
    expect(lib.meta(hash).frames).toBe(4)
  })

  it('leaves no staging directory behind, success or failure', async () => {
    const hash = onlyHash()
    behaviour = { throws: new Error('boum') }
    await lib.recut(hash).catch(() => {})
    behaviour = { frames: 5 }
    await lib.recut(hash)
    expect(fs.readdirSync(dir).filter((n) => n.endsWith('.recut'))).toHaveLength(0)
  })

  it('refuses a clip whose source was never kept', async () => {
    const hash = onlyHash()
    fs.rmSync(lib.sourcePath(hash))
    await expect(lib.recut(hash)).rejects.toMatchObject({ code: 'NO_SOURCE' })
    // And the frames are still there — refusing is not deleting.
    expect(lib.posterPath(hash)).toBeTruthy()
  })

  it('returns null for a hash it has never heard of', async () => {
    expect(await lib.recut('a'.repeat(64))).toBeNull()
  })
})

describe('clipSize', () => {
  it('measures frames and source together', async () => {
    const hash = onlyHash()
    const small = lib.clipSize(hash)
    expect(small).toBeGreaterThan(0)

    behaviour = { frames: 20, bytes: 100 }
    await lib.recut(hash)
    // The disk budget is charged on this difference, so it has to move when the
    // sequence does.
    expect(lib.clipSize(hash)).toBeGreaterThan(small)
  })

  it('is zero for an unknown clip', () => {
    expect(lib.clipSize('b'.repeat(64))).toBe(0)
  })
})
