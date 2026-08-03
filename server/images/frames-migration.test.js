import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ImagesConfigStore } from './config.js'
import { DEFAULT_FPS, DEFAULT_FRAME_WIDTH, MAX_FRAMES } from '../videos/frames.js'

/**
 * Raising the frame defaults has to actually reach existing instances.
 *
 * `update()` rewrites the whole config, so any admin who ever saved an image
 * provider also persisted whatever the frame defaults were that day. Without the
 * migration those stale numbers shadow the new ones for good, and the only
 * symptom is that nothing changes.
 */

let dir
let file

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-cfg-'))
  // The store takes a DATA DIRECTORY and reads images-config.json inside it.
  file = path.join(dir, 'images-config.json')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (obj) => fs.writeFileSync(file, JSON.stringify(obj))

describe('legacy frame settings', () => {
  it('are dropped so the new defaults apply', () => {
    write({ content: { provider: 'pollinations' }, video: { provider: '', frames: { fps: 12, width: 960, max: 150 } } })
    const frames = new ImagesConfigStore(dir).videoProfile().frames
    expect(frames).toEqual({ fps: DEFAULT_FPS, width: DEFAULT_FRAME_WIDTH, max: MAX_FRAMES })
  })

  it('leave the rest of the video config alone', () => {
    // Dropping the block must not take the provider or the key with it.
    write({ video: { provider: 'fal', fal: { model: 'un-modele', apiKey: 'secret' }, frames: { fps: 12, width: 960, max: 150 } } })
    const v = new ImagesConfigStore(dir).videoProfile()
    expect(v.provider).toBe('fal')
    expect(v.fal.model).toBe('un-modele')
    expect(v.fal.apiKey).toBe('secret')
  })

  it('a deliberate-looking setting is kept', () => {
    // Only an EXACT match on the old triple is treated as incidental. Anything
    // else is someone's choice and must survive.
    write({ video: { frames: { fps: 12, width: 1280, max: 150 } } })
    const frames = new ImagesConfigStore(dir).videoProfile().frames
    expect(frames.width).toBe(1280)
    expect(frames.fps).toBe(12)
  })

  it('a config with no video block at all still gets the new defaults', () => {
    write({ content: { provider: 'pollinations' } })
    expect(new ImagesConfigStore(dir).videoProfile().frames.fps).toBe(DEFAULT_FPS)
  })

  it('no config file at all gets the new defaults', () => {
    expect(new ImagesConfigStore(dir).videoProfile().frames).toEqual({
      fps: DEFAULT_FPS,
      width: DEFAULT_FRAME_WIDTH,
      max: MAX_FRAMES,
    })
  })
})
