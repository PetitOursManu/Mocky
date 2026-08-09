import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAPTURE_FORMAT,
  CAPTURE_QUALITY,
  CODECS,
  DEFAULT_CONCURRENCY,
  H264_CRF,
  MAX_CONCURRENCY,
  PIXEL_FORMAT,
  codecFor,
  encodingOptionsFor,
  renderConcurrency,
  worstCaseBytes,
} from './encoding.js'
import { MAX_TOTAL_DURATION_MS, OUTPUT_FORMATS, RENDERABLE_TEMPLATES } from './validate.js'

/**
 * The option object, checked without producing a video.
 *
 * This is the only floor there can be. A pixel is not testable here — Remotion
 * is not installed in this repository and never will be — but the CONSTRUCTION
 * of the call is, and the defect that produced this file was entirely in the
 * construction: `renderMedia` was invoked with a codec and nothing else, so
 * every Remotion default applied, and the report came back as "the videos are
 * really bad, everything is pixelated" from someone who had rendered a forest.
 *
 * Which is why the numbers below are written out again rather than imported.
 * They are REMOTION's defaults, at the version `package.json` pins, and this
 * file's job is to fail the day the settings drift back onto one of them. A
 * test that read them from the module under test would agree with anything.
 */
const REMOTION_DEFAULTS = {
  imageFormat: 'jpeg',
  jpegQuality: 80,
  pixelFormat: 'yuv420p',
  scale: 1,
  everyNthFrame: 1,
  x264Preset: 'medium',
  /** getDefaultCrfForCodec. Two codecs, two scales, two numbers. */
  crf: { h264: 18, vp8: 9 },
}

/**
 * What the compose file actually grants the worker, read rather than retyped.
 *
 * A literal here would have been a tautology: the whole risk is an operator (or
 * a later commit) raising `cpus` and leaving the concurrency behind, or the
 * reverse. Read as text, like `tests/video-worker-separation.test.js` does — no
 * YAML parser, no new dependency, and it works on a checkout that has installed
 * nothing.
 */
const COMPOSE = (() => {
  const file = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docker-compose.yml'), 'utf8')
  const service = file.slice(file.indexOf('video-worker:', file.indexOf('# ---- Remotion render worker')))
  const read = (re) => Number(service.match(re)?.[1])
  return { cpus: read(/^\s*cpus:\s*([\d.]+)\s*$/m), concurrency: read(/^\s*RENDER_CONCURRENCY:\s*(\d+)\s*$/m) }
})()

/** Remotion's own bounds per codec, from `crf.ts`. Out of range is a throw at render time. */
const CRF_RANGE = { h264: [1, 51], vp8: [4, 63] }

const codecs = Object.values(CODECS)

describe('the codec a container asks for', () => {
  it('answers for both formats the schema allows', () => {
    // Read off the validator rather than listed here: a third container added
    // to the schema with no codec behind it would otherwise render as mp4 and
    // be reported as a success under the wrong extension.
    for (const format of OUTPUT_FORMATS) {
      expect(Object.hasOwn(CODECS, format), `${format} has no codec`).toBe(true)
      expect(() => encodingOptionsFor(codecFor(format))).not.toThrow()
    }
  })

  it('does not answer for the prototype chain', () => {
    // The lock the comment in `encoding.js` describes: a plain lookup hands
    // back a function for "constructor", which is truthy and reaches Remotion.
    expect(codecFor('constructor')).toBe(CODECS.mp4)
    expect(codecFor('toString')).toBe(CODECS.mp4)
    expect(codecFor(undefined)).toBe(CODECS.mp4)
  })
})

describe('every codec gets the capture settings', () => {
  it.each(codecs)('%s captures frames losslessly enough to be worth encoding', (codec) => {
    const options = encodingOptionsFor(codec)
    expect(options.imageFormat).toBe(CAPTURE_FORMAT)
    expect(options.jpegQuality).toBe(CAPTURE_QUALITY)
  })

  /**
   * The heart of the report. 80 is what Chromium was told, and a frame
   * quantised at 80 on its way out of the browser cannot be un-quantised by any
   * encoder setting downstream.
   */
  it.each(codecs)('%s no longer inherits the 80-quality JPEG capture', (codec) => {
    expect(encodingOptionsFor(codec).jpegQuality).not.toBe(REMOTION_DEFAULTS.jpegQuality)
    expect(encodingOptionsFor(codec).jpegQuality).toBeGreaterThan(REMOTION_DEFAULTS.jpegQuality)
  })

  /**
   * `jpegQuality` only applies while `imageFormat` is 'jpeg' — Remotion does not
   * throw on the pair, it ignores it. So a switch to 'png' that left the quality
   * key behind would read as a quality setting and be one.
   */
  it.each(codecs)('%s never carries a jpegQuality the image format would ignore', (codec) => {
    const options = encodingOptionsFor(codec)
    if (options.imageFormat !== 'jpeg') expect(options).not.toHaveProperty('jpegQuality')
  })

  /**
   * Equal to Remotion's default on purpose — the one setting here that is
   * restated rather than changed, because 4:4:4 h264 is a profile browsers do
   * not decode and Mocky plays these films in a `<video>`.
   */
  it.each(codecs)('%s states the pixel format instead of inheriting it', (codec) => {
    expect(encodingOptionsFor(codec).pixelFormat).toBe(PIXEL_FORMAT)
    expect(PIXEL_FORMAT).toBe(REMOTION_DEFAULTS.pixelFormat)
  })
})

describe('each codec gets the keys it reads, and none it would ignore', () => {
  it('h264 is driven by a CRF, capped, and never by a bitrate', () => {
    const options = encodingOptionsFor('h264')
    expect(options.crf).toBe(H264_CRF)
    // Remotion refuses the pair by name: "crf and videoBitrate can not both be
    // set." A key added here without reading that rule fails every render.
    expect(options).not.toHaveProperty('videoBitrate')
    expect(options.encodingMaxRate).toMatch(/^\d+M$/)
    expect(options.encodingBufferSize).toMatch(/^\d+M$/)
  })

  it('h264 improves on the default CRF and stays inside the range Remotion accepts', () => {
    const [min, max] = CRF_RANGE.h264
    expect(H264_CRF).toBeGreaterThanOrEqual(min)
    expect(H264_CRF).toBeLessThanOrEqual(max)
    // Lower is better. Equal to the default would be a setting that says
    // nothing, which is how this whole area went unnoticed.
    expect(H264_CRF).toBeLessThan(REMOTION_DEFAULTS.crf.h264)
  })

  /**
   * The vp8 half, and it is not symmetry for its own sake.
   *
   * Remotion emits `-crf` for vp8 and never `-b:v 0`, so libvpx reads the CRF as
   * constrained quality bounded by ffmpeg's default 200 kbit/s target. A CRF is
   * therefore the one thing this codec must NOT be given alone.
   */
  it('vp8 is driven by a bitrate, because a bare CRF caps it at a thumbnail', () => {
    const options = encodingOptionsFor('vp8')
    expect(options).not.toHaveProperty('crf')
    expect(options.videoBitrate).toMatch(/^\d+M$/)
    expect(Number.parseFloat(options.videoBitrate)).toBeGreaterThan(1)
  })

  it.each(codecs)('%s never carries an h264-only key', (codec) => {
    // `x264Preset` is h264-only. Absent from both here — the default is the
    // right trade on two cores — so the assertion is about the vp8 branch not
    // acquiring one by copy-paste.
    expect(encodingOptionsFor(codec)).not.toHaveProperty('x264Preset')
  })

  /** Remotion: "encodingMaxRate can not be set without also setting encodingBufferSize." */
  it.each(codecs)('%s never sets a max rate without a buffer', (codec) => {
    const options = encodingOptionsFor(codec)
    if (options.encodingMaxRate) expect(options.encodingBufferSize).toBeTruthy()
  })

  it.each(codecs)('%s states nothing whose default is already what we want', (codec) => {
    const options = encodingOptionsFor(codec)
    // Both default to 1 — full size, every frame. Restating them would bury the
    // settings that are actually doing something.
    expect(options).not.toHaveProperty('scale')
    expect(options).not.toHaveProperty('everyNthFrame')
    expect(REMOTION_DEFAULTS.scale).toBe(1)
    expect(REMOTION_DEFAULTS.everyNthFrame).toBe(1)
  })

  it.each(codecs)('%s carries no key with nothing in it', (codec) => {
    // An `undefined` value reaches `renderMedia` as an explicit argument and
    // takes the default anyway — a setting that looks present in a diff and is
    // not present at run time.
    for (const [key, value] of Object.entries(encodingOptionsFor(codec))) {
      expect(value, `${codec}.${key}`).toBeDefined()
      expect(value, `${codec}.${key}`).not.toBeNull()
    }
  })

  it('refuses a codec it has no settings for, by name', () => {
    // Not a fallback to the h264 table: `crf: 16` on a scale that runs to 63 is
    // a different picture, produced in silence.
    expect(() => encodingOptionsFor('vp9')).toThrow(/vp9/)
    expect(() => encodingOptionsFor('constructor')).toThrow(/constructor/)
    expect(() => encodingOptionsFor(undefined)).toThrow()
  })
})

describe('the five templates', () => {
  /**
   * Quality is a property of the container, never of the composition.
   *
   * The catalogue is where a difference between films is supposed to live, and
   * an encoder setting that varied with the template would be a sixth
   * composition nobody could see — the `product` export coming back softer than
   * the `slideshow` one, with nothing in the interface to explain it.
   */
  it('all render at the same quality, per container', () => {
    expect(RENDERABLE_TEMPLATES).toHaveLength(5)
    for (const format of OUTPUT_FORMATS) {
      // The path `render.js` takes, verbatim: a validated timeline in, a codec
      // out, settings for that codec. The template is carried along so that a
      // day when it starts mattering, it fails here.
      const perTemplate = RENDERABLE_TEMPLATES.map((template) => {
        const timeline = { template, outputFormat: format, aspectRatio: '16:9', scenes: [] }
        return encodingOptionsFor(codecFor(timeline.outputFormat))
      })
      for (const options of perTemplate) expect(options).toEqual(perTemplate[0])
    }
  })
})

describe('how many frames exist at once', () => {
  /**
   * The default that a container makes actively wrong, rather than merely
   * inherited.
   *
   * Remotion halves the CPU threads it can SEE, and `cpus: 2.0` is a quota, not
   * an affinity mask — so on a sixteen-thread host the worker opens eight
   * Chromium tabs onto two cores. Harmless as waste; not harmless once every
   * frame in flight is a quality-100 JPEG against `mem_limit: 4g`.
   */
  it('matches the CPUs the compose file actually grants', () => {
    expect(renderConcurrency({})).toBe(DEFAULT_CONCURRENCY)
    // Both read off the file, so raising one and forgetting the other fails
    // here rather than on somebody's build machine.
    expect(COMPOSE.cpus).toBeGreaterThan(0)
    expect(COMPOSE.concurrency).toBe(COMPOSE.cpus)
    expect(DEFAULT_CONCURRENCY).toBe(COMPOSE.cpus)
  })

  it('lets an operator who raised the CPUs raise it too', () => {
    expect(renderConcurrency({ RENDER_CONCURRENCY: '6' })).toBe(6)
    expect(renderConcurrency({ RENDER_CONCURRENCY: '1' })).toBe(1)
  })

  it('caps what the environment may ask for', () => {
    // A typo in a compose file is an OOM kill mid-render, which reaches the user
    // as "the worker could not be reached" and names nothing.
    expect(renderConcurrency({ RENDER_CONCURRENCY: '200' })).toBe(MAX_CONCURRENCY)
  })

  it('falls back to the default on anything that is not a count', () => {
    // The default, never 1: a mistyped value should render the way an unset one
    // does rather than at the slowest setting there is, silently.
    for (const raw of ['', '   ', 'two', '0', '-4', 'NaN', undefined]) {
      expect(renderConcurrency({ RENDER_CONCURRENCY: raw }), JSON.stringify(raw)).toBe(DEFAULT_CONCURRENCY)
    }
  })

  it('is a whole number, because a fraction is not a process count', () => {
    expect(Number.isInteger(renderConcurrency({ RENDER_CONCURRENCY: '2.6' }))).toBe(true)
    expect(renderConcurrency({ RENDER_CONCURRENCY: '2.6' })).toBe(3)
  })
})

describe('the size these settings imply', () => {
  /**
   * The bound that has to hold, and the reason `worstCaseBytes` exists.
   *
   * The film crosses `server/video/worker.js` whole, in memory, and is written
   * by `server/video/store.js` against the instance `diskBudget` — which
   * refuses BEFORE writing precisely because a full volume fails writes
   * silently everywhere else in this repository. A quality setting is therefore
   * also a storage decision, and this is where the two meet.
   *
   * 250 MB for the longest film the schema permits: 16 Mbit/s × 120 s plus one
   * 32 Mbit buffer is 244 MB. Against the default 10 GB budget that is forty
   * maximum-length exports, and every real film is a fraction of it.
   */
  it('bounds the longest permitted mp4 under 250 MB', () => {
    const bytes = worstCaseBytes('h264', MAX_TOTAL_DURATION_MS)
    expect(bytes).toBeLessThan(250 * 1000 * 1000)
    // And not absurdly under it either: a cap low enough to pass this test
    // trivially would be a cap that spends the quality this change is for.
    expect(bytes).toBeGreaterThan(100 * 1000 * 1000)
  })

  it('bounds webm too, since the store shares one budget', () => {
    expect(worstCaseBytes('vp8', MAX_TOTAL_DURATION_MS)).toBeLessThan(250 * 1000 * 1000)
  })

  it('scales with the film and answers 0 for nothing', () => {
    const half = worstCaseBytes('h264', MAX_TOTAL_DURATION_MS / 2)
    const full = worstCaseBytes('h264', MAX_TOTAL_DURATION_MS)
    expect(half).toBeLessThan(full)
    // The buffer is a constant, so an empty film still costs one of them rather
    // than nothing — an estimate that must err upwards, erring upwards.
    expect(worstCaseBytes('h264', 0)).toBeGreaterThan(0)
    expect(worstCaseBytes('h264', -1)).toBe(worstCaseBytes('h264', 0))
  })
})
