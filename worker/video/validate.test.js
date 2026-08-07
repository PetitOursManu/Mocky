// The worker's refusal to trust its caller, and its agreement with Mocky about
// what a legal timeline is.
//
// Two jobs in one file, because they are the same question asked twice. The
// first half checks that a malformed document is refused with a sentence
// naming the field. The second half imports Mocky's own mirrored schema and
// requires the bounds to match — a worker that accepted a 40-second scene the
// browser refuses would be a second, looser contract nobody wrote down.
//
// THAT IMPORT IS TEST-ONLY. The Docker build copies `worker/video/` and nothing
// else, so a runtime import of anything under `server/` produces a container
// that boots and then fails every render on a missing module. It is safe here
// for the same reason `server.test.js` is safe: this file never ships.
import { describe, it, expect } from 'vitest'
import {
  ASPECT_RATIOS,
  KEN_BURNS,
  MAX_SCENES,
  MAX_SCENE_DURATION_MS,
  MAX_TOTAL_DURATION_MS,
  MIN_SCENE_DURATION_MS,
  OUTPUT_FORMATS,
  OVERLAY_POSITIONS,
  TRANSITIONS,
  extensionFor,
  validateRenderRequest,
} from './validate.js'
import * as mocky from '../../server/video/timeline.js'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
/** One base64 pixel. The bytes never reach a decoder in these tests, only the length check. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const image = (id = ID_A) => ({ id, mime: 'image/png', base64: PIXEL })
const scene = (extra = {}) => ({ imageId: ID_A, durationMs: 3000, ...extra })
const body = (extra = {}) => ({ timeline: { scenes: [scene()] }, images: [image()], ...extra })

const refusal = (input) => {
  const result = validateRenderRequest(input)
  expect(result.ok, `expected a refusal, got ${JSON.stringify(result).slice(0, 200)}`).toBe(false)
  return result.message
}

describe('a request the worker accepts', () => {
  it('applies the same defaults the schema declares, rather than leaving them undefined', () => {
    const result = validateRenderRequest(body())
    expect(result.ok).toBe(true)
    expect(result.timeline).toEqual({
      scenes: [{ imageId: ID_A, durationMs: 3000, kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null }],
      outputFormat: 'mp4',
      aspectRatio: '16:9',
    })
  })

  /**
   * The renderer writes files named after the id and the extension, so both
   * have to be settled before it runs. Decoding here also means garbage fails
   * as a 400 naming the image, not as a Chromium decode error two minutes into
   * a render.
   */
  it('decodes each image once and gives it a file extension', () => {
    const result = validateRenderRequest(body())
    expect(result.images).toHaveLength(1)
    expect(result.images[0]).toMatchObject({ id: ID_A, extension: '.png' })
    expect(Buffer.isBuffer(result.images[0].bytes)).toBe(true)
    expect(result.images[0].bytes.length).toBeGreaterThan(0)
  })

  /**
   * A timeline naming one image across ten scenes is the common shape, and
   * `collectImages` on the Mocky side already deduplicates it. Staging one file
   * per scene would write the same bytes ten times into a directory the render
   * then serves.
   */
  it('returns one entry per distinct image, not one per scene', () => {
    const result = validateRenderRequest({
      timeline: { scenes: [scene(), scene(), scene({ imageId: ID_B })] },
      images: [image(ID_A), image(ID_B)],
    })
    expect(result.ok).toBe(true)
    expect(result.images.map((i) => i.id)).toEqual([ID_A, ID_B])
  })

  it('accepts an overlay and keeps its text byte for byte', () => {
    const content = '  Trois <b>petits</b> points…  '
    const result = validateRenderRequest({
      timeline: { scenes: [scene({ textOverlay: { content, position: 'bottom' } })] },
      images: [image()],
    })
    expect(result.ok).toBe(true)
    // Not trimmed, not escaped, not rewritten. The composition renders it as a
    // React child, which is where escaping belongs; doing it here would put
    // `&lt;b&gt;` on screen.
    expect(result.timeline.scenes[0].textOverlay).toEqual({ content, position: 'bottom' })
  })
})

describe('a request the worker refuses', () => {
  /**
   * The bound no per-scene check can see. Twenty legal fifteen-second scenes
   * are five minutes of Chromium on a container whose caller gave up after two
   * — a render nobody will ever collect, paid for in full.
   */
  it('rejects a total over the ceiling even when every scene is legal', () => {
    const scenes = Array.from({ length: 9 }, () => scene({ durationMs: MAX_SCENE_DURATION_MS }))
    const message = refusal({ timeline: { scenes }, images: [image()] })
    expect(message).toContain(String(MAX_TOTAL_DURATION_MS))
  })

  it('rejects more scenes than the schema allows', () => {
    const scenes = Array.from({ length: MAX_SCENES + 1 }, () => scene({ durationMs: MIN_SCENE_DURATION_MS }))
    expect(refusal({ timeline: { scenes }, images: [image()] })).toContain(String(MAX_SCENES))
  })

  it('rejects a scene shorter or longer than the schema allows, and a fractional one', () => {
    expect(refusal({ timeline: { scenes: [scene({ durationMs: 999 })] }, images: [image()] })).toContain('durationMs')
    expect(refusal({ timeline: { scenes: [scene({ durationMs: MAX_SCENE_DURATION_MS + 1 })] }, images: [image()] })).toContain('durationMs')
    expect(refusal({ timeline: { scenes: [scene({ durationMs: 2000.5 })] }, images: [image()] })).toContain('durationMs')
  })

  /**
   * An unknown key is refused rather than ignored, which is `.strict()` one
   * machine further along. It doubles as version-skew detection: a Mocky that
   * learned to send `audio` against a worker that never learned to render it
   * fails with the word in the message, instead of returning a silent video.
   */
  it('rejects a key it does not render, and names it', () => {
    expect(refusal({ timeline: { scenes: [scene()], audio: 'track.mp3' }, images: [image()] })).toContain('audio')
    expect(refusal({ timeline: { scenes: [scene({ blur: 4 })] }, images: [image()] })).toContain('blur')
    expect(refusal({ timeline: { scenes: [scene()] }, images: [image()], callbackUrl: 'http://x' })).toContain('callbackUrl')
  })

  /**
   * The worker has no egress at all, so a URL here is not a slow failure — it
   * is a request that can never work. Upper-case hex is the other mistake
   * anyone actually makes.
   */
  it('rejects an imageId that is a URL or upper-case hex', () => {
    expect(refusal({ timeline: { scenes: [scene({ imageId: 'https://example.test/a.png' })] }, images: [] })).toContain('imageId')
    expect(refusal({ timeline: { scenes: [scene({ imageId: ID_A.toUpperCase() })] }, images: [] })).toContain('imageId')
  })

  it('rejects an effect, a transition, a position, a format or a ratio it cannot render', () => {
    expect(refusal({ timeline: { scenes: [scene({ kenBurns: 'spin' })] }, images: [image()] })).toContain('kenBurns')
    expect(refusal({ timeline: { scenes: [scene({ transitionOut: 'dissolve' })] }, images: [image()] })).toContain('transitionOut')
    expect(
      refusal({ timeline: { scenes: [scene({ textOverlay: { content: 'hi', position: 'left' } })] }, images: [image()] }),
    ).toContain('position')
    expect(refusal({ timeline: { scenes: [scene()], outputFormat: 'mov' }, images: [image()] })).toContain('outputFormat')
    expect(refusal({ timeline: { scenes: [scene()], aspectRatio: '4:3' }, images: [image()] })).toContain('aspectRatio')
  })

  it('rejects an overlay longer than a frame can carry', () => {
    const long = { content: 'x'.repeat(121), position: 'top' }
    expect(refusal({ timeline: { scenes: [scene({ textOverlay: long })] }, images: [image()] })).toContain('120')
  })

  /**
   * The images travel inside the request precisely so this can be settled
   * before a single frame is rendered. Without the check the export is a video
   * with a blank scene in the middle, reported as a success.
   */
  it('rejects a scene whose image was not sent, and names the image', () => {
    const message = refusal({ timeline: { scenes: [scene(), scene({ imageId: ID_B })] }, images: [image(ID_A)] })
    expect(message).toContain(ID_B)
  })

  it('rejects an image format it cannot stage, and empty bytes', () => {
    expect(refusal({ timeline: { scenes: [scene()] }, images: [{ ...image(), mime: 'application/pdf' }] })).toContain('application/pdf')
    expect(refusal({ timeline: { scenes: [scene()] }, images: [{ ...image(), base64: '' }] })).toContain('base64')
  })

  it('rejects a body that is not an object at all', () => {
    expect(refusal(null)).toContain('object')
    expect(refusal('{}')).toContain('object')
    expect(refusal({ timeline: [scene()], images: [] })).toContain('object')
  })

  /**
   * Mocky splices up to 300 characters of this message into the sentence the
   * user reads. A newline there breaks the panel it lands in, and a stack trace
   * makes it unreadable.
   */
  it('always answers with a single line', () => {
    const messages = [
      refusal({ timeline: { scenes: [scene({ durationMs: 10 })] }, images: [] }),
      refusal({ timeline: { scenes: [] }, images: [] }),
      refusal({ timeline: { scenes: [scene()], audio: {} }, images: [] }),
    ]
    for (const message of messages) {
      expect(message).not.toContain('\n')
      expect(message.length).toBeLessThan(300)
    }
  })
})

describe('extensionFor', () => {
  /**
   * Not cosmetic: the staged files are served to Chromium by Remotion's static
   * server, which picks the Content-Type from the extension. A file with no
   * suffix arrives as application/octet-stream and the render fails on an image
   * that was perfectly valid.
   */
  it('names a suffix for every format the library stores', () => {
    expect(extensionFor('image/jpeg')).toBe('.jpg')
    expect(extensionFor('image/png')).toBe('.png')
    expect(extensionFor('image/webp')).toBe('.webp')
    expect(extensionFor('IMAGE/PNG ')).toBe('.png')
    expect(extensionFor('text/html')).toBeNull()
    expect(extensionFor(undefined)).toBeNull()
  })
})

describe('agreement with Mocky', () => {
  /**
   * A worker accepting what the browser refuses is a second, looser contract
   * nobody wrote down — and the direction that actually bites is the other one:
   * a worker refusing what Mocky validated is an export that fails after the
   * user was told it was queued.
   *
   * `server/video/timeline.js` is itself a hand-kept mirror of
   * `src/lib/video/timeline.ts`, held honest by `timeline.test.js`. Comparing
   * against it therefore ties all three together.
   */
  it('shares every bound and every enumeration with the timeline schema', () => {
    expect(MAX_SCENES).toBe(mocky.MAX_SCENES)
    expect(MIN_SCENE_DURATION_MS).toBe(mocky.MIN_SCENE_DURATION_MS)
    expect(MAX_SCENE_DURATION_MS).toBe(mocky.MAX_SCENE_DURATION_MS)
    expect(MAX_TOTAL_DURATION_MS).toBe(mocky.MAX_TOTAL_DURATION_MS)
    expect(KEN_BURNS).toEqual(mocky.KEN_BURNS)
    expect(TRANSITIONS).toEqual(mocky.TRANSITIONS)
    expect(OVERLAY_POSITIONS).toEqual(mocky.OVERLAY_POSITIONS)
    expect(OUTPUT_FORMATS).toEqual(mocky.OUTPUT_FORMATS)
    expect(ASPECT_RATIOS).toEqual(mocky.ASPECT_RATIOS)
  })

  /**
   * The same corpus through both, because equal constants are not the same as
   * equal answers — the overlay length, the integer check on `durationMs` and
   * the total-duration refinement are all written twice, in two languages.
   */
  it('agrees with the schema on a corpus of documents', () => {
    const corpus = [
      { scenes: [scene()] },
      { scenes: [scene({ kenBurns: 'pan-left', transitionOut: 'wipe-right' })], aspectRatio: '9:16' },
      { scenes: [scene({ textOverlay: { content: 'ok', position: 'top' } })] },
      { scenes: [scene({ durationMs: 999 })] },
      { scenes: [scene({ durationMs: 2000.5 })] },
      { scenes: [scene({ kenBurns: 'spin' })] },
      { scenes: [scene({ textOverlay: { content: 'x'.repeat(121), position: 'top' } })] },
      { scenes: [] },
      { scenes: Array.from({ length: 9 }, () => scene({ durationMs: MAX_SCENE_DURATION_MS })) },
      { scenes: [scene()], audio: 'no' },
      { scenes: [scene()], outputFormat: 'webm', aspectRatio: '1:1' },
    ]

    for (const timeline of corpus) {
      const bySchema = mocky.VideoTimelineSchema.safeParse(structuredClone(timeline))
      // Every distinct image the document names, so a rejection can only ever
      // come from the timeline itself and not from a missing picture.
      const images = [...new Set((timeline.scenes || []).map((s) => s.imageId))].map((id) => image(id))
      const byWorker = validateRenderRequest({ timeline: structuredClone(timeline), images })

      expect(byWorker.ok, `disagreement on ${JSON.stringify(timeline).slice(0, 120)}`).toBe(bySchema.success)
      if (bySchema.success) {
        // Including the defaults: a worker that left `kenBurns` undefined where
        // the schema filled in 'static' would render a different video from the
        // one the user was shown.
        expect(byWorker.timeline).toEqual(bySchema.data)
      }
    }
  })
})
