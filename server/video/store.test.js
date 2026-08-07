import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { VideoExportStore } from './store.js'
import { VideoLibrary } from '../videos/library.js'

let dataDir
beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-vidstore-'))
})
afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true })
})

const MP4 = Buffer.from('pretend-this-is-an-mp4')
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')

/** A disk budget with a switch, so a test can make the volume full on demand. */
function fakeBudget({ full = false, maxBytes = 1000 } = {}) {
  return {
    used: 0,
    full,
    wouldExceed(bytes) {
      return this.full || this.used + bytes > maxBytes
    },
    add(bytes) {
      this.used += bytes
    },
    remove(bytes) {
      this.used = Math.max(0, this.used - bytes)
    },
    usage() {
      return { bytes: this.used, maxBytes, ratio: this.used / maxBytes }
    },
  }
}

const spec = { owner: 'u1', format: 'mp4', aspectRatio: '16:9', scenes: 3, durationMs: 9000 }

describe('VideoExportStore.put', () => {
  it('keeps the file whole and records the shape of the render', () => {
    const store = new VideoExportStore(dataDir, { now: () => 42 })
    const out = store.put(MP4, spec)

    expect(out.hash).toBe(sha(MP4))
    expect(out.fromCache).toBe(false)
    // Byte for byte: the hash is only meaningful because nothing re-encodes.
    expect(fs.readFileSync(store.filePath(out.hash))).toEqual(MP4)
    expect(out.meta).toMatchObject({
      bytes: MP4.length,
      container: 'mp4',
      mime: 'video/mp4',
      scenes: 3,
      durationMs: 9000,
      aspectRatio: '16:9',
      owners: ['u1'],
      createdAt: 42,
    })
  })

  /**
   * The defect this exists to stop: filing an export through
   * `VideoLibrary.ingest`, which would run ffmpeg to cut 150 stills nothing
   * displays and put a frameless row in the scroll-sequence list.
   */
  it('cuts no frames and stays out of the scroll-sequence library', () => {
    const store = new VideoExportStore(dataDir)
    const { hash } = store.put(MP4, spec)

    // One file, and it is the film. No poster, no 0001.jpg, no directory.
    expect(fs.readdirSync(store.dir)).toEqual([`${hash}.mp4`])
    expect(store.meta(hash).frames).toBeUndefined()

    const library = new VideoLibrary(dataDir)
    expect(library.list()).toEqual([])
    expect(library.dirFor(hash) && fs.existsSync(library.dirFor(hash))).toBe(false)
  })

  it('does not store the same bytes twice, and remembers both owners', () => {
    const budget = fakeBudget()
    const store = new VideoExportStore(dataDir, { budget })

    const first = store.put(MP4, spec)
    const second = store.put(MP4, { ...spec, owner: 'u2' })

    expect(second.fromCache).toBe(true)
    expect(second.hash).toBe(first.hash)
    expect(fs.readdirSync(store.dir)).toHaveLength(1)
    // Charged once. A second write would bill the ceiling for a file that is
    // already on the disk, and the ceiling would start refusing renders early.
    expect(budget.used).toBe(MP4.length)
    expect(store.meta(first.hash).owners).toEqual(['u1', 'u2'])
    expect(store.ownedBy(first.hash, 'u2')).toBe(true)
    expect(store.ownedBy(first.hash, 'u3')).toBe(false)
  })

  it('picks the container from a table, never from the caller', () => {
    const store = new VideoExportStore(dataDir)
    const webm = store.put(Buffer.from('webm-bytes'), { ...spec, format: 'webm' })
    expect(store.filePath(webm.hash).endsWith('.webm')).toBe(true)
    expect(store.mimeFor(webm.hash)).toBe('video/webm')

    // A format the schema would never emit falls back rather than reaching the
    // path: `${hash}.${format}` with an attacker-chosen format is a traversal.
    const odd = store.put(Buffer.from('other-bytes'), { ...spec, format: '../../etc/passwd' })
    expect(path.dirname(store.filePath(odd.hash))).toBe(store.dir)
    expect(store.filePath(odd.hash).endsWith('.mp4')).toBe(true)

    // And an inherited key is not a container: a plain lookup would have made
    // `container.ext` undefined and written `<hash>.undefined`, a name no route
    // can ever find again.
    const proto = store.put(Buffer.from('proto-bytes'), { ...spec, format: 'constructor' })
    expect(store.filePath(proto.hash).endsWith('.mp4')).toBe(true)
    expect(store.downloadName(proto.hash)).toBe(`mocky-export-${proto.hash.slice(0, 12)}.mp4`)
  })

  it('refuses before writing when the volume is full', () => {
    const budget = fakeBudget({ full: true })
    const store = new VideoExportStore(dataDir, { budget })

    expect(() => store.put(MP4, spec)).toThrowError(/storage limit/i)
    try {
      store.put(MP4, spec)
    } catch (err) {
      expect(err.code).toBe('QUOTA')
    }
    // Nothing partial left behind: a full volume fails writes silently in every
    // other store here, so this one must not write at all.
    expect(fs.readdirSync(store.dir)).toEqual([])
    expect(store.list()).toEqual([])
  })

  it('refuses a render that would cross the ceiling, not only one that is over it', () => {
    const budget = fakeBudget({ maxBytes: 10 })
    const store = new VideoExportStore(dataDir, { budget })
    expect(() => store.put(Buffer.alloc(11), spec)).toThrow()
    expect(budget.used).toBe(0)
  })

  it('refuses an empty file rather than storing a hash of nothing', () => {
    const store = new VideoExportStore(dataDir)
    expect(() => store.put(Buffer.alloc(0), spec)).toThrowError(/empty/i)
  })
})

describe('VideoExportStore persistence', () => {
  it('reloads its index, and finds a file the index never knew about', () => {
    const store = new VideoExportStore(dataDir)
    const { hash } = store.put(MP4, spec)

    const reopened = new VideoExportStore(dataDir)
    expect(reopened.meta(hash)).toMatchObject({ owners: ['u1'] })
    expect(reopened.filePath(hash)).toBeTruthy()

    // A restored backup, or a second process: the file is on disk and the
    // in-memory index is a snapshot from before it. Serving a 404 for a file
    // that is plainly there is the bug `framePath` already had once.
    const bare = new VideoExportStore(fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-vidstore-bare-')))
    fs.copyFileSync(store.filePath(hash), path.join(bare.dir, `${hash}.mp4`))
    expect(bare.filePath(hash)).toBeTruthy()
    expect(bare.fileSize(hash)).toBe(MP4.length)
  })

  it('reads nothing outside its own directory', () => {
    const store = new VideoExportStore(dataDir)
    expect(store.filePath('../../etc/passwd')).toBeNull()
    expect(store.filePath('NOTHEX'.repeat(10))).toBeNull()
    expect(store.filePath('a'.repeat(63))).toBeNull()
  })
})

describe('VideoExportStore.remove', () => {
  it('is the only thing that deletes, and gives the bytes back', () => {
    const budget = fakeBudget()
    const store = new VideoExportStore(dataDir, { budget })
    const { hash } = store.put(MP4, spec)
    expect(budget.used).toBe(MP4.length)

    expect(store.remove(hash)).toMatchObject({ removed: true })
    expect(budget.used).toBe(0)
    expect(store.filePath(hash)).toBeNull()
    expect(store.meta(hash)).toBeNull()
    expect(new VideoExportStore(dataDir).meta(hash)).toBeNull()
    expect(store.remove(hash)).toBeNull()
  })
})
