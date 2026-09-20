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
  H264_RATE_CEILING_MBPS,
  H264_RATE_FLOOR_MBPS,
  MAX_CONCURRENCY,
  MAX_FILE_MBIT,
  PIXEL_FORMAT,
  codecFor,
  encodingOptionsFor,
  h264RateFor,
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

/**
 * What x264 actually spends, per CRF, on the content the report was about.
 *
 * Measured — not derived, not guessed. A slideshow of 1080p library photographs
 * with a Ken Burns move on every scene, encoded in this container with the cap
 * lifted so the encoder was free to ask for what it wanted. The average rate it
 * asked for, in Mbit/s:
 *
 *   crf 18   13.1      crf 16   16.9      crf 14   21.8      crf 12   28.3
 *
 * They are here because the ceiling's whole claim is an inequality against
 * them: a cap under the rate its own CRF spends is not a guard, it is a second
 * quality setting nobody can see, and that is exactly what the 16 Mbit/s cap
 * had silently become when the CRF moved from 18 to 16.
 *
 * These are AVERAGES and `maxrate` bounds a peak, which is why the assertion
 * below leaves headroom rather than testing `>`. A cap of 24 against CRF 14's
 * 21.8 still cost 0.42 dB — clearing the average is not clearing the cap.
 */
const MEASURED_MBPS = { 18: 13.1, 16: 16.9, 14: 21.8, 12: 28.3 }

/**
 * How far above its own average the cap has to sit before it stops clipping.
 *
 * Measured, not a rule of thumb: at CRF 14 (21.8 Mbit/s average) a cap of 24 —
 * 1.10× — cost 0.42 dB, and 28 — 1.28× — cost 0.10. The multiplier is what
 * generalises to the next CRF somebody tries.
 */
const PEAK_HEADROOM = 1.25

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
   * The inequality the ceiling exists to satisfy, and the one that had broken.
   *
   * A short film gets the ceiling, so if the ceiling is under the rate this CRF
   * spends then every short film is silently rate-limited — no error, no
   * notice, a decibel gone. Written as a lookup on the CRF actually configured
   * rather than on the number 14, so that lowering the CRF one more notch fails
   * here instead of re-creating the defect.
   */
  it('never caps a short film below what its own CRF spends', () => {
    const wanted = MEASURED_MBPS[H264_CRF]
    expect(wanted, `no measurement on record for crf ${H264_CRF} — measure it before shipping it`).toBeGreaterThan(0)
    // A short film gets the ceiling, so this inequality IS what every short
    // export looks like.
    expect(h264RateFor(8000).maxRateMbps).toBe(H264_RATE_CEILING_MBPS)
    expect(H264_RATE_CEILING_MBPS).toBeGreaterThanOrEqual(wanted * PEAK_HEADROOM)
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

describe('every template in the catalogue', () => {
  /**
   * Quality is a property of the container, never of the composition.
   *
   * The catalogue is where a difference between films is supposed to live, and
   * an encoder setting that varied with the template would be a composition
   * nobody could see — the `product` export coming back softer than the
   * `slideshow` one, with nothing in the interface to explain it.
   */
  it('all render at the same quality, per container', () => {
    expect(RENDERABLE_TEMPLATES).toHaveLength(6)
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

  /**
   * The bound, now that the rate is a function of the length.
   *
   * This is the whole safety argument for making it one: a per-second allowance
   * that grows as films get shorter is only sound if the FILE it implies stays
   * inside the same budget at every length. Swept rather than spot-checked,
   * because the interesting lengths are the ones nobody would think to write
   * down — the crossover where the ceiling stops binding and the budget starts.
   */
  it('never exceeds the file budget, at any length the schema permits', () => {
    const budgetBytes = (MAX_FILE_MBIT * 1_000_000) / 8
    for (let ms = 0; ms <= MAX_TOTAL_DURATION_MS; ms += 250) {
      expect(worstCaseBytes('h264', ms), `${ms} ms`).toBeLessThanOrEqual(budgetBytes)
    }
  })

  it('is unchanged for the longest film, which is where the budget came from', () => {
    // 244 MB, the number `render.js` quotes and the disk budget was sized
    // against. A change here is a change to a claim written down elsewhere.
    expect(h264RateFor(MAX_TOTAL_DURATION_MS).maxRateMbps).toBe(16)
    expect(worstCaseBytes('h264', MAX_TOTAL_DURATION_MS)).toBe(244_000_000)
  })
})

describe('the bitrate a film of a given length may spend', () => {
  it('gives a short film the ceiling and a long one the budget', () => {
    expect(h264RateFor(5_000).maxRateMbps).toBe(H264_RATE_CEILING_MBPS)
    expect(h264RateFor(30_000).maxRateMbps).toBe(H264_RATE_CEILING_MBPS)
    // Past the crossover the budget is what answers, and it answers less.
    expect(h264RateFor(MAX_TOTAL_DURATION_MS).maxRateMbps).toBeLessThan(H264_RATE_CEILING_MBPS)
  })

  it('never goes below what a film got before the rate was a function', () => {
    // The floor is the old flat cap. No length may come out of this worse than
    // it did, which is what makes the change safe to reason about at all.
    for (let ms = 0; ms <= MAX_TOTAL_DURATION_MS; ms += 500) {
      expect(h264RateFor(ms).maxRateMbps, `${ms} ms`).toBeGreaterThanOrEqual(H264_RATE_FLOOR_MBPS)
    }
  })

  it('never grants more to a longer film than to a shorter one', () => {
    let previous = Infinity
    for (let ms = 0; ms <= MAX_TOTAL_DURATION_MS; ms += 500) {
      const mbps = h264RateFor(ms).maxRateMbps
      expect(mbps, `${ms} ms`).toBeLessThanOrEqual(previous)
      previous = mbps
    }
  })

  it('takes the strictest answer for a duration it cannot read', () => {
    // A caller that forgot to say how long the film is must not be handed the
    // shortest film's allowance. "I don't know" is not short.
    for (const bad of [undefined, null, Number.NaN, 'soon', '8000', {}]) {
      expect(h264RateFor(bad).maxRateMbps, JSON.stringify(bad)).toBe(h264RateFor(MAX_TOTAL_DURATION_MS).maxRateMbps)
    }
    expect(encodingOptionsFor('h264').encodingMaxRate).toBe(`${H264_RATE_FLOOR_MBPS}M`)
  })

  it('treats an empty film as short rather than unreadable, and 0 is a number', () => {
    // 0 ms is a legitimate degenerate answer — a film with nothing in it — and
    // reading it as "unknown" would hand `worstCaseBytes(0)` the two-minute
    // settings and quietly change a bound two tests up.
    expect(h264RateFor(0).maxRateMbps).toBe(H264_RATE_CEILING_MBPS)
    expect(h264RateFor(-1).maxRateMbps).toBe(h264RateFor(0).maxRateMbps)
  })

  it('always pairs the rate with a buffer twice its size', () => {
    // Remotion refuses `encodingMaxRate` without `encodingBufferSize`, and
    // ffmpeg measures the cap over that window. They are one object for that
    // reason and must never be computed apart.
    for (const ms of [0, 5_000, 45_000, MAX_TOTAL_DURATION_MS]) {
      const { maxRateMbps, bufferMbit } = h264RateFor(ms)
      expect(bufferMbit).toBe(maxRateMbps * 2)
    }
  })

  it('reaches the encoder as the two keys, in step', () => {
    const options = encodingOptionsFor('h264', 8_000)
    const { maxRateMbps, bufferMbit } = h264RateFor(8_000)
    expect(options.encodingMaxRate).toBe(`${maxRateMbps}M`)
    expect(options.encodingBufferSize).toBe(`${bufferMbit}M`)
  })

  it('leaves webm alone, since nobody has profiled it', () => {
    // The h264 allowance moves with the film; vp8's does not, and the asymmetry
    // is deliberate — a length-dependent rate for a codec nobody has measured
    // would be the same unmeasured guess that put the h264 cap under its own CRF.
    const short = encodingOptionsFor('vp8', 5_000)
    const long = encodingOptionsFor('vp8', MAX_TOTAL_DURATION_MS)
    expect(short).toEqual(long)
    expect(short).not.toHaveProperty('crf')
  })
})
