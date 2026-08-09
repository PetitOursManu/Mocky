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
  BAND_POSITIONS,
  KEN_BURNS,
  MAX_SCENES,
  MAX_SCENE_DURATION_MS,
  MAX_TOTAL_DURATION_MS,
  MIN_SCENE_DURATION_MS,
  OUTPUT_FORMATS,
  OVERLAY_POSITIONS,
  RENDERABLE_TEMPLATES,
  TEMPLATE_LIMITS,
  TEXT_LIMITS,
  TITLE_ANIMATIONS,
  TRANSITIONS,
  extensionFor,
  validateRenderRequest,
} from './validate.js'
import { COMPOSITIONS, compositionIdFor } from './remotion/composition.js'
import * as mocky from '../../server/video/timeline.js'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
/** One base64 pixel. The bytes never reach a decoder in these tests, only the length check. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const image = (id = ID_A) => ({ id, mime: 'image/png', base64: PIXEL })
const scene = (extra = {}) => ({ imageId: ID_A, durationMs: 3000, ...extra })
const body = (extra = {}) => ({ timeline: { scenes: [scene()] }, images: [image()], ...extra })

/**
 * The smallest legal document of each template, as a caller would send it —
 * defaults left out, so the readers have to supply them.
 *
 * One table rather than five helpers, because most of what follows asks the same
 * question of every template: does it round-trip, and is it refused under
 * somebody else's name.
 */
const DOCUMENTS = {
  slideshow: { template: 'slideshow', scenes: [{ imageId: ID_A, durationMs: 3000 }] },
  overlay: { template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 3000, band: { title: 'The dashboard' } }] },
  vertical: { template: 'vertical', scenes: [{ imageId: ID_A, durationMs: 3000 }], aspectRatio: '9:16' },
  titles: { template: 'titles', scenes: [{ headline: 'Designed in the browser', durationMs: 3000 }] },
  product: {
    template: 'product',
    scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'One screen, one film', bullets: ['Your own colours'] }],
  },
}

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
      // Absent means slideshow here as it does in Mocky's schema, and a document
      // from the queue's journal really can be older than the catalogue.
      template: 'slideshow',
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
   * A template this image has no composition for is refused BY NAME, and the
   * message says to rebuild.
   *
   * This is the version skew the paragraph above describes, made real: the
   * worker is a separate service behind an opt-in compose profile, so an
   * operator can be running last month's build against today's Mocky. Rendering
   * a template the image has never heard of with the nearest composition it does
   * have would produce a film with half of what was asked for missing, reported
   * as a success.
   */
  it('rejects a template it has no composition for, and says to rebuild', () => {
    const message = refusal({ timeline: { template: 'karaoke', scenes: [scene()] }, images: [image()] })
    expect(message).toContain('template')
    expect(message).toContain('karaoke')
    expect(message.toLowerCase()).toContain('rebuild')
  })

  it('renders a document that names itself a slideshow, and one that names nothing', () => {
    expect(validateRenderRequest(body()).timeline.template).toBe('slideshow')
    const named = { timeline: { template: 'slideshow', scenes: [scene()] }, images: [image()] }
    expect(validateRenderRequest(named).timeline.template).toBe('slideshow')
  })

  /**
   * A job straight out of the journal, which is what a restarted Mocky holds.
   *
   * Not the two-key object above: `VideoQueue.enqueue` stores the PARSED
   * document, so a montage from before the catalogue has every default spelled
   * out, `textOverlay` as an explicit `null`, both output settings present — and
   * no `template`. Every one of those is a key `onlyKeys` has to already know
   * about on a variant chosen by a discriminator the document does not carry,
   * and the whole point of the compatibility rule is that this render still
   * happens, drawn by the composition it was always drawn by.
   */
  it('renders a job out of the journal, from before the catalogue', () => {
    const journalled = {
      timeline: {
        scenes: [
          { imageId: ID_A, durationMs: 4000, kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null },
          {
            imageId: ID_B,
            durationMs: 6000,
            kenBurns: 'pan-left',
            transitionOut: 'wipe-right',
            textOverlay: { content: 'The dashboard', position: 'bottom' },
          },
        ],
        outputFormat: 'mp4',
        aspectRatio: '16:9',
      },
      images: [image(ID_A), image(ID_B)],
    }
    const result = validateRenderRequest(journalled)
    expect(result.ok, result.message).toBe(true)
    expect(result.timeline.template).toBe('slideshow')
    expect(result.timeline.scenes).toEqual(journalled.timeline.scenes)
    expect(result.images.map((i) => i.id)).toEqual([ID_A, ID_B])
    // And the composition it selects is the one that always drew it. A fallback
    // here would be worse than a refusal: the film comes back looking like
    // something else and is reported as a success.
    expect(compositionIdFor(result.timeline.template)).toBe(COMPOSITIONS.slideshow)
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

describe('the catalogue', () => {
  const imagesFor = (timeline) => {
    const ids = [...new Set(timeline.scenes.map((s) => s.imageId).filter(Boolean))]
    return ids.map((id) => image(id))
  }

  /**
   * Each template accepted under its own name, with its own defaults applied.
   *
   * The defaults matter as much as the acceptance: a worker that left
   * `band.position` undefined where the schema fills in `bottom` renders a
   * different film from the one the user was shown, and nothing anywhere says
   * so.
   */
  it('accepts each template and applies its own defaults', () => {
    const expected = {
      slideshow: { kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null },
      overlay: { band: { title: 'The dashboard', subtitle: null, position: 'bottom' }, transitionOut: 'crossfade' },
      // `zoom-in` and not `static`: a full-bleed still on a feed reads as a
      // stalled player.
      vertical: { kenBurns: 'zoom-in', transitionOut: 'crossfade', textOverlay: null },
      titles: { subtitle: null, animation: 'fade', transitionOut: 'crossfade' },
      product: { cta: null, transitionOut: 'crossfade' },
    }
    for (const [template, timeline] of Object.entries(DOCUMENTS)) {
      const result = validateRenderRequest({ timeline: structuredClone(timeline), images: imagesFor(timeline) })
      expect(result.ok, `${template}: ${result.message}`).toBe(true)
      expect(result.timeline.template, template).toBe(template)
      expect(result.timeline.scenes[0], template).toMatchObject(expected[template])
    }
  })

  /**
   * A document written for one template, handed in under another's name, is
   * refused — which is the composition-level half of the founding rule. Each
   * composition draws one scene kind; a `product` document drawn by the overlay
   * composition would come back without its arguments and its call to action,
   * and be delivered as a successful export.
   *
   * The slideshow/vertical pair is deliberately absent from this loop: the two
   * scene kinds are the SAME shape, and what tells them apart is their bounds
   * and their ratio. The test below covers exactly that, rather than asserting a
   * refusal that would have to be faked.
   */
  it('refuses a scene written for another template', () => {
    const sameShape = new Set(['slideshow:vertical', 'vertical:slideshow'])
    for (const [written, timeline] of Object.entries(DOCUMENTS)) {
      for (const named of RENDERABLE_TEMPLATES) {
        if (named === written || sameShape.has(`${written}:${named}`)) continue
        const swapped = { ...structuredClone(timeline), template: named }
        // A vertical document carries `aspectRatio: '9:16'`, which every other
        // template also allows — so a refusal here is always about the scene.
        const result = validateRenderRequest({ timeline: swapped, images: imagesFor(timeline) })
        expect(result.ok, `a ${written} document accepted as a ${named}`).toBe(false)
      }
    }
  })

  /**
   * The pair the loop above skips, and the two things that actually separate
   * them: a vertical beat tops out at 8 s where a slideshow beat runs to 15, and
   * a vertical film is 9:16 and nothing else.
   *
   * The ratio is a literal in the schema rather than a discouraged value,
   * because the composition lays out the bands a phone feed covers with its own
   * buttons. Handed a landscape frame it would letterbox and put its caption in
   * the wrong third — a legal document rendering a film nobody described.
   */
  it('tells a vertical from a slideshow by its bounds and its ratio', () => {
    const long = { scenes: [{ imageId: ID_A, durationMs: 12000 }] }
    expect(validateRenderRequest({ timeline: { template: 'slideshow', ...long }, images: [image()] }).ok).toBe(true)
    expect(refusal({ timeline: { template: 'vertical', ...long }, images: [image()] })).toContain('durationMs')

    const landscape = { template: 'vertical', scenes: [{ imageId: ID_A, durationMs: 3000 }], aspectRatio: '16:9' }
    expect(refusal({ timeline: landscape, images: [image()] })).toContain('aspectRatio')
  })

  /**
   * A `titles` film has no `imageId` anywhere, and that is the template rather
   * than an edge case: it is what an instance with an empty media library can
   * still export. A missing-image check written as `scenes.map((s) => s.imageId)`
   * would refuse it for not sending bytes for a picture it never named.
   */
  it('renders a titles film with no images at all', () => {
    const result = validateRenderRequest({ timeline: structuredClone(DOCUMENTS.titles), images: [] })
    expect(result.ok, result.message).toBe(true)
    expect(result.images).toEqual([])
  })

  /** Each template's own scene ceiling, not the slideshow's twenty. */
  it('applies each template its own scene count', () => {
    for (const [template, timeline] of Object.entries(DOCUMENTS)) {
      const { maxScenes, minSceneMs } = TEMPLATE_LIMITS[template]
      const one = structuredClone(timeline.scenes[0])
      const scenes = Array.from({ length: maxScenes + 1 }, () => ({ ...structuredClone(one), durationMs: minSceneMs }))
      const message = refusal({ timeline: { ...timeline, scenes }, images: imagesFor(timeline) })
      expect(message, template).toContain(String(maxScenes))
    }
  })

  /**
   * Text is burnt into the frame at a size the composition fixes, so a headline
   * over the limit is not a smaller headline — it is a line that runs off the
   * edge. Refused, never truncated: a repaired document is one nobody validated.
   */
  it('refuses text longer than the frame can carry, in every template that has any', () => {
    const over = (n) => 'x'.repeat(n + 1)
    const cases = [
      [{ template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 3000, band: { title: over(TEXT_LIMITS.bandTitle) } }] }, TEXT_LIMITS.bandTitle],
      [
        {
          template: 'overlay',
          scenes: [{ imageId: ID_A, durationMs: 3000, band: { title: 'ok', subtitle: over(TEXT_LIMITS.bandSubtitle) } }],
        },
        TEXT_LIMITS.bandSubtitle,
      ],
      [{ template: 'titles', scenes: [{ headline: over(TEXT_LIMITS.titleHeadline), durationMs: 3000 }] }, TEXT_LIMITS.titleHeadline],
      [
        { template: 'titles', scenes: [{ headline: 'ok', subtitle: over(TEXT_LIMITS.titleSubtitle), durationMs: 3000 }] },
        TEXT_LIMITS.titleSubtitle,
      ],
      [
        {
          template: 'product',
          scenes: [{ imageId: ID_A, durationMs: 4000, headline: over(TEXT_LIMITS.productHeadline), bullets: ['a'] }],
        },
        TEXT_LIMITS.productHeadline,
      ],
      [
        {
          template: 'product',
          scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets: [over(TEXT_LIMITS.productBullet)] }],
        },
        TEXT_LIMITS.productBullet,
      ],
      [
        {
          template: 'product',
          scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets: ['a'], cta: over(TEXT_LIMITS.productCta) }],
        },
        TEXT_LIMITS.productCta,
      ],
    ]
    for (const [timeline, limit] of cases) {
      expect(refusal({ timeline, images: [image()] }), JSON.stringify(timeline).slice(0, 90)).toContain(String(limit))
    }
  })

  /**
   * One to three arguments, never exactly three: a composition that lays out
   * three lays out two, and demanding the third only teaches the model to pad.
   * A fourth is refused rather than dropped.
   */
  it('takes one to three product arguments and refuses a fourth', () => {
    const withBullets = (bullets) => ({
      template: 'product',
      scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets }],
    })
    expect(validateRenderRequest({ timeline: withBullets(['a', 'b', 'c']), images: [image()] }).ok).toBe(true)
    expect(refusal({ timeline: withBullets([]), images: [image()] })).toContain('bullets')
    expect(refusal({ timeline: withBullets(['a', 'b', 'c', 'd']), images: [image()] })).toContain('bullets')
  })
})

describe('the theme', () => {
  const themed = (theme) => ({ timeline: { scenes: [scene()], theme }, images: [image()] })

  /**
   * The model never writes this — `VideoTimelineSchema` has no `theme` at all,
   * so a model that invents one is refused before the document leaves Mocky. The
   * server attaches it afterwards, and the worker re-reads it here for the
   * ordinary reason: this process is a plain HTTP endpoint on a bridge, and it
   * does not trust its caller.
   */
  it('accepts what the server attached and returns only the tokens that were stated', () => {
    const theme = { colors: { background: '#F6F4EE', accent: '#123' }, fonts: { heading: 'Cormorant Garamond' }, radiusPx: 0 }
    const result = validateRenderRequest(themed(theme))
    expect(result.ok, result.message).toBe(true)
    // Not filled in with defaults: the compositions own those, and a stated
    // token has to stay distinguishable from an invented one.
    expect(result.timeline.theme).toEqual(theme)
  })

  /**
   * Nothing in a theme may become CSS. A colour is hex and only hex; a font is
   * ONE family name from a charset with no comma, quote, semicolon or brace in
   * it, because that value lands in a `font-family` where any of those is the
   * difference between naming a typeface and writing a declaration.
   */
  it('refuses a colour or a font that could become a declaration', () => {
    expect(refusal(themed({ colors: { accent: 'red' } }))).toContain('accent')
    expect(refusal(themed({ colors: { accent: '#12345' } }))).toContain('accent')
    expect(refusal(themed({ colors: { accent: 'var(--x)' } }))).toContain('accent')
    for (const hostile of ['Inter, sans-serif', 'Inter"; color: red', 'Inter;}', "Inter'"]) {
      expect(refusal(themed({ fonts: { body: hostile } })), hostile).toContain('body')
    }
  })

  /** No unit to parse and no `calc()` to smuggle. */
  it('refuses a radius that is not a whole number of pixels', () => {
    expect(refusal(themed({ radiusPx: '12px' }))).toContain('radiusPx')
    expect(refusal(themed({ radiusPx: 12.5 }))).toContain('radiusPx')
    expect(refusal(themed({ radiusPx: -1 }))).toContain('radiusPx')
    expect(validateRenderRequest(themed({ radiusPx: 9999 })).ok).toBe(true)
  })

  /**
   * `{}` says "a direction was read and it asks for nothing", which is not what
   * "there is no direction" means — that one is spelled by leaving the key out.
   */
  it('refuses an empty theme and an unknown token', () => {
    expect(refusal(themed({}))).toContain('at least one token')
    expect(refusal(themed({ colors: {} }))).toContain('at least one token')
    expect(refusal(themed({ shadow: 'soft' }))).toContain('shadow')
    expect(refusal(themed({ colors: { border: '#fff' } }))).toContain('border')
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
    expect(TEMPLATE_LIMITS).toEqual(mocky.TEMPLATE_LIMITS)
    expect(TEXT_LIMITS).toEqual(mocky.TEXT_LIMITS)
    expect(KEN_BURNS).toEqual(mocky.KEN_BURNS)
    expect(TRANSITIONS).toEqual(mocky.TRANSITIONS)
    expect(OVERLAY_POSITIONS).toEqual(mocky.OVERLAY_POSITIONS)
    expect(BAND_POSITIONS).toEqual(mocky.BAND_POSITIONS)
    expect(TITLE_ANIMATIONS).toEqual(mocky.TITLE_ANIMATIONS)
    expect(OUTPUT_FORMATS).toEqual(mocky.OUTPUT_FORMATS)
    expect(ASPECT_RATIOS).toEqual(mocky.ASPECT_RATIOS)
  })

  /**
   * Every template Mocky can compose has a composition in this image.
   *
   * The lag the README describes is between two DEPLOYED IMAGES — an operator
   * running last month's worker against today's Mocky — and it is handled at run
   * time by refusing the template by name. Inside one commit there is nothing to
   * lag behind: a template in the schema with no reader here is an export that
   * fails after the user was told it was queued.
   */
  it('has a composition for every template the schema can produce', () => {
    expect([...RENDERABLE_TEMPLATES].sort()).toEqual([...mocky.VIDEO_TEMPLATES].sort())
  })

  /**
   * And what this validator accepts is exactly what `compositionIdFor` can
   * resolve.
   *
   * The two lists are one file apart and it is easy to grow only one of them.
   * The failure is expensive in a way a refusal is not: the request passes
   * validation, `busy` is taken, and the throw lands in the route's catch as a
   * 500 with a message about a composition — for a document that should have
   * been a 400 naming the template, before anything was reserved.
   */
  it('accepts exactly the templates the worker can select a composition for', () => {
    expect([...RENDERABLE_TEMPLATES].sort()).toEqual(Object.keys(COMPOSITIONS).sort())
  })

  /**
   * The same corpus through both, because equal constants are not the same as
   * equal answers — the text limits, the integer check on `durationMs`, the
   * per-template ratios and the total-duration refinement are all written twice,
   * in two languages.
   *
   * Against `RenderTimelineSchema` and not `VideoTimelineSchema`, because that is
   * the document this worker is handed: the theme has already been attached by
   * the server. Mocky's inbound schema is the stricter of the two on purpose —
   * it has no `theme` at all, so a model that writes one is refused — and that
   * asymmetry is the whole point of there being two schemas.
   */
  it('agrees with the schema on a corpus of documents', () => {
    const corpus = [
      // The slideshow, including documents older than the catalogue.
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

      // One of each template, legal and not.
      ...Object.values(DOCUMENTS),
      { template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 1400, band: { title: 'too short' } }] },
      { template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 3000, band: { title: 'x', position: 'center' } }] },
      { template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 3000 }] },
      { template: 'vertical', scenes: [{ imageId: ID_A, durationMs: 3000 }], aspectRatio: '16:9' },
      { template: 'vertical', scenes: [{ imageId: ID_A, durationMs: 9000 }] },
      { template: 'titles', scenes: [{ headline: 'ok', durationMs: 3000, animation: 'stagger' }] },
      { template: 'titles', scenes: [{ headline: 'ok', durationMs: 3000, animation: 'karaoke' }] },
      { template: 'titles', scenes: [{ imageId: ID_A, headline: 'ok', durationMs: 3000 }] },
      { template: 'product', scenes: [{ imageId: ID_A, durationMs: 2000, headline: 'ok', bullets: ['a'] }] },
      { template: 'product', scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets: ['a', 'b', 'c', 'd'] }] },
      { template: 'product', scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets: ['a'], cta: 'Go' }] },
      { template: 'karaoke', scenes: [scene()] },

      /*
       * Text that is present and says nothing.
       *
       * `readText` here has always refused a string that trims to nothing, and
       * `min(1)` in the schema counts characters — so `" "` passed Mocky and was
       * refused by this process. That is the expensive direction of a
       * disagreement: the timeline validates, the job is queued, the user waits,
       * and the refusal arrives at the end of it about a caption they can see on
       * their own screen.
       */
      { scenes: [scene({ textOverlay: { content: '   ', position: 'top' } })] },
      { template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 3000, band: { title: ' ' } }] },
      { template: 'overlay', scenes: [{ imageId: ID_A, durationMs: 3000, band: { title: 'ok', subtitle: '\t' } }] },
      { template: 'titles', scenes: [{ headline: ' ', durationMs: 3000 }] },
      { template: 'titles', scenes: [{ headline: 'ok', subtitle: '  ', durationMs: 3000 }] },
      { template: 'product', scenes: [{ imageId: ID_A, durationMs: 4000, headline: '\n', bullets: ['a'] }] },
      { template: 'product', scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets: [' '] }] },
      { template: 'product', scenes: [{ imageId: ID_A, durationMs: 4000, headline: 'ok', bullets: ['a'], cta: ' ' }] },

      // The theme, which only the server may attach.
      { scenes: [scene()], theme: { colors: { background: '#F6F4EE' }, radiusPx: 4 } },
      { scenes: [scene()], theme: { fonts: { heading: 'Cormorant Garamond', body: 'Inter' } } },
      { scenes: [scene()], theme: {} },
      { scenes: [scene()], theme: { colors: { accent: 'red' } } },
      { scenes: [scene()], theme: { fonts: { body: 'Inter, sans-serif' } } },
      { scenes: [scene()], theme: { radiusPx: '12px' } },
      { scenes: [scene()], theme: { shadow: 'soft' } },
    ]

    for (const timeline of corpus) {
      const bySchema = mocky.RenderTimelineSchema.safeParse(structuredClone(timeline))
      // Every distinct image the document names, so a rejection can only ever
      // come from the timeline itself and not from a missing picture. Filtered,
      // because a `titles` document names none.
      const images = [...new Set((timeline.scenes || []).map((s) => s.imageId).filter(Boolean))].map((id) => image(id))
      const byWorker = validateRenderRequest({ timeline: structuredClone(timeline), images })

      expect(byWorker.ok, `disagreement on ${JSON.stringify(timeline).slice(0, 140)}`).toBe(bySchema.success)
      if (bySchema.success) {
        // Including the defaults: a worker that left `kenBurns` undefined where
        // the schema filled in 'static' would render a different video from the
        // one the user was shown.
        expect(byWorker.timeline, `defaults differ on ${JSON.stringify(timeline).slice(0, 140)}`).toEqual(bySchema.data)
      }
    }
  })
})
