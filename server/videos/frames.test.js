import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  ffmpegStatus,
  resetFfmpegStatus,
  extractFrames,
  frameName,
  FfmpegMissingError,
  DEFAULT_FPS,
} from './frames.js'

/**
 * ffmpeg is not assumed to exist on the machine running the tests — that is the
 * whole point of the probe — so every case here injects its own `exec`.
 */

let dir
beforeEach(() => {
  resetFfmpegStatus()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-frames-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  resetFfmpegStatus()
})

const okExec = async () => ({ stdout: 'ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023\nbuilt with gcc', stderr: '' })
const missingExec = async () => {
  throw new Error('spawn ffmpeg ENOENT')
}

describe('ffmpegStatus', () => {
  it('reports the version when the binary answers', async () => {
    const s = await ffmpegStatus({ exec: okExec })
    expect(s.available).toBe(true)
    expect(s.version).toContain('ffmpeg version 6.1.1')
  })

  it('says plainly that it is not installed, rather than leaking ENOENT', async () => {
    const s = await ffmpegStatus({ exec: missingExec })
    expect(s.available).toBe(false)
    expect(s.reason).toBe('ffmpeg is not installed in this container')
  })

  it('surfaces any other failure verbatim — that one has to be read to be fixed', async () => {
    const s = await ffmpegStatus({
      exec: async () => {
        throw new Error('Permission denied')
      },
    })
    expect(s.available).toBe(false)
    expect(s.reason).toBe('Permission denied')
  })

  it('remembers the answer, and forgets it on demand', async () => {
    let calls = 0
    const counting = async () => {
      calls++
      return { stdout: 'ffmpeg version 6', stderr: '' }
    }
    await ffmpegStatus({ exec: counting })
    await ffmpegStatus({ exec: counting })
    expect(calls).toBe(1)
    resetFfmpegStatus()
    await ffmpegStatus({ exec: counting })
    expect(calls).toBe(2)
  })
})

describe('frameName', () => {
  it('zero-pads so a directory listing sorts correctly', () => {
    expect(frameName(1)).toBe('f0001.jpg')
    expect(frameName(12)).toBe('f0012.jpg')
    // The bug this prevents: 'f10.jpg' sorts before 'f9.jpg'.
    expect([frameName(10), frameName(9)].sort()).toEqual(['f0009.jpg', 'f0010.jpg'])
  })
})

describe('extractFrames', () => {
  /** Stands in for ffmpeg: writes the files the real one would write. */
  function fakeFfmpeg(count) {
    return async (bin, args) => {
      if (args[0] === '-version') return { stdout: 'ffmpeg version 6', stderr: '' }
      const out = args[args.length - 1] // .../f%04d.jpg
      const outDir = path.dirname(out)
      fs.mkdirSync(outDir, { recursive: true })
      for (let i = 1; i <= count; i++) fs.writeFileSync(path.join(outDir, frameName(i)), `frame ${i}`)
      return { stdout: '', stderr: '' }
    }
  }

  it('refuses to run, with a typed error, when ffmpeg is missing', async () => {
    await expect(extractFrames('/tmp/x.mp4', dir, { exec: missingExec })).rejects.toBeInstanceOf(
      FfmpegMissingError,
    )
  })

  it('counts the frames that were actually written, never assumes a number', async () => {
    // A 3-second clip yields fewer frames than a 5-second one at the same rate,
    // and the sequence must report what exists — the player indexes into it.
    const out = await extractFrames('/tmp/x.mp4', dir, { exec: fakeFfmpeg(37) })
    expect(out.frames).toBe(37)
    expect(fs.existsSync(path.join(dir, 'f0037.jpg'))).toBe(true)
  })

  it('writes a poster identical to the first frame', async () => {
    await extractFrames('/tmp/x.mp4', dir, { exec: fakeFfmpeg(5) })
    const poster = fs.readFileSync(path.join(dir, 'poster.jpg'), 'utf8')
    const first = fs.readFileSync(path.join(dir, 'f0001.jpg'), 'utf8')
    // Byte-identical, so swapping the poster for the sequence shows no jump.
    expect(poster).toBe(first)
  })

  it('fails loudly when ffmpeg wrote nothing', async () => {
    const silent = async (bin, args) => {
      if (args[0] === '-version') return { stdout: 'ffmpeg version 6', stderr: '' }
      return { stdout: '', stderr: '' }
    }
    await expect(extractFrames('/tmp/x.mp4', dir, { exec: silent })).rejects.toThrow(/no frame/i)
  })

  it('passes the sampling rate, the width and the cap to ffmpeg', async () => {
    let seen = []
    const spy = async (bin, args) => {
      if (args[0] === '-version') return { stdout: 'ffmpeg version 6', stderr: '' }
      seen = args
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, frameName(1)), 'x')
      return { stdout: '', stderr: '' }
    }
    await extractFrames('/tmp/x.mp4', dir, { exec: spy, fps: 8, width: 640, max: 40 })
    expect(seen.join(' ')).toContain('fps=8,scale=640:-2')
    expect(seen[seen.indexOf('-frames:v') + 1]).toBe('40')
  })

  it('clamps absurd settings instead of trusting them', async () => {
    let seen = []
    const spy = async (bin, args) => {
      if (args[0] === '-version') return { stdout: 'ffmpeg version 6', stderr: '' }
      seen = args
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, frameName(1)), 'x')
      return { stdout: '', stderr: '' }
    }
    await extractFrames('/tmp/x.mp4', dir, { exec: spy, fps: 240, width: 99999, max: 100000 })
    expect(seen.join(' ')).toContain('fps=30,scale=1920:-2')
    expect(seen[seen.indexOf('-frames:v') + 1]).toBe('600')
    // And a nonsense value falls back to the default rather than to zero.
    await extractFrames('/tmp/x.mp4', dir, { exec: spy, fps: 0 })
    expect(seen.join(' ')).toContain(`fps=${DEFAULT_FPS},`)
  })
})
