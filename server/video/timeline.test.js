import { describe, it, expect } from 'vitest'
import * as node from './timeline.js'
// The TypeScript original. vitest resolves `.ts`; `node server/index.js` does
// not, which is the entire reason timeline.js exists — so this import is the one
// thing standing between the two copies and a silent divergence.
import * as web from '../../src/lib/video/timeline.ts'
import { readableIssues } from './timeline.js'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const scene = (over = {}) => ({ imageId: ID_A, durationMs: 3000, ...over })
const band = (over = {}) => ({ imageId: ID_A, durationMs: 3000, band: { title: 'Ship it' }, ...over })
const title = (over = {}) => ({ headline: 'Ship it', durationMs: 3000, ...over })
const product = (over = {}) => ({ imageId: ID_A, durationMs: 4000, headline: 'Ship it', bullets: ['Fast'], ...over })

/**
 * Every document below is run through BOTH schemas and the answers compared.
 *
 * A defect this catches, and the reason the corpus is this long: the two files
 * are edited months apart, by whoever is touching one side of the feature. A
 * bound raised on the browser alone gives a UI that accepts what the API then
 * refuses with a 400 nobody can reproduce; raised on the SERVER alone it is the
 * dangerous direction — the API accepts what nothing downstream can render.
 */
const CORPUS = [
  ['minimal, defaults unapplied', { scenes: [scene()] }],
  [
    'every field spelled out',
    {
      scenes: [
        scene({ kenBurns: 'pan-left', transitionOut: 'wipe-right', textOverlay: { content: 'Hi', position: 'top' } }),
        scene({ imageId: ID_B, durationMs: 15000, kenBurns: 'static', transitionOut: 'none', textOverlay: null }),
      ],
      outputFormat: 'webm',
      aspectRatio: '9:16',
    },
  ],
  /*
   * A job out of the journal, exactly as `data/video-jobs.json` holds it.
   *
   * `VideoQueue.enqueue` stores the PARSED document, so what is on disk from
   * before the catalogue is not the two-key object above: every default is
   * written out, `textOverlay` is an explicit `null`, the two output settings are
   * present, and there is no `template` anywhere. That combination is the one
   * that actually shipped, and it is the one that would break — an explicit
   * default meets `.strict()` on a variant chosen by a discriminator the document
   * does not carry.
   */
  [
    'a job as the journal holds it, from before the catalogue',
    {
      scenes: [
        { imageId: ID_A, durationMs: 4000, kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null },
        {
          imageId: ID_B,
          durationMs: 4000,
          kenBurns: 'zoom-in',
          transitionOut: 'none',
          textOverlay: { content: 'Le tableau de bord', position: 'bottom' },
        },
      ],
      outputFormat: 'mp4',
      aspectRatio: '16:9',
    },
  ],
  ['exactly at the total ceiling', { scenes: Array.from({ length: 20 }, () => scene({ durationMs: 6000 })) }],
  [
    'one millisecond over the ceiling',
    { scenes: [...Array.from({ length: 19 }, () => scene({ durationMs: 6000 })), scene({ durationMs: 6001 })] },
  ],
  ['twenty scenes', { scenes: Array.from({ length: 20 }, () => scene({ durationMs: 1000 })) }],
  ['twenty-one scenes', { scenes: Array.from({ length: 21 }, () => scene({ durationMs: 1000 })) }],
  ['no scenes at all', { scenes: [] }],
  ['an unknown key on the timeline', { scenes: [scene()], audio: 'track.mp3' }],
  ['an unknown key on a scene', { scenes: [scene({ src: 'https://example.test/a.jpg' })] }],
  ['an unknown key on an overlay', { scenes: [scene({ textOverlay: { content: 'Hi', position: 'top', src: 'x' } })] }],
  ['an upper-case imageId', { scenes: [scene({ imageId: 'A'.repeat(64) })] }],
  ['an imageId that is a URL', { scenes: [scene({ imageId: 'https://example.test/a.jpg' })] }],
  ['a short imageId', { scenes: [scene({ imageId: 'a'.repeat(63) })] }],
  ['a scene shorter than the floor', { scenes: [scene({ durationMs: 999 })] }],
  ['a scene longer than the cap', { scenes: [scene({ durationMs: 15001 })] }],
  ['a fractional duration', { scenes: [scene({ durationMs: 3000.5 })] }],
  ['a duration sent as a string', { scenes: [scene({ durationMs: '3000' })] }],
  ['an unknown ken-burns move', { scenes: [scene({ kenBurns: 'dolly' })] }],
  ['an unknown transition', { scenes: [scene({ transitionOut: 'star-wipe' })] }],
  ['an unknown overlay position', { scenes: [scene({ textOverlay: { content: 'Hi', position: 'middle' } })] }],
  ['an empty overlay', { scenes: [scene({ textOverlay: { content: '', position: 'top' } })] }],
  // Present and saying nothing. `min(1)` counts characters, so `" "` used to
  // pass both copies while the worker refused it — a job queued for a refusal.
  ['an overlay of whitespace', { scenes: [scene({ textOverlay: { content: '  ', position: 'top' } })] }],
  ['a band title of whitespace', { template: 'overlay', scenes: [band({ band: { title: ' ' } })] }],
  ['a band subtitle of whitespace', { template: 'overlay', scenes: [band({ band: { title: 'A', subtitle: '\t' } })] }],
  ['a headline of whitespace', { template: 'titles', scenes: [title({ headline: '\n' })] }],
  ['a product argument of whitespace', { template: 'product', scenes: [product({ bullets: [' '] })] }],
  ['a call to action of whitespace', { template: 'product', scenes: [product({ cta: '  ' })] }],
  ['an overlay of 121 characters', { scenes: [scene({ textOverlay: { content: 'x'.repeat(121), position: 'top' } })] }],
  ['an unknown output format', { scenes: [scene()], outputFormat: 'mov' }],
  ['an unknown aspect ratio', { scenes: [scene()], aspectRatio: '4:3' }],
  ['not an object at all', 'a video please'],
  ['null', null],

  // ---- the catalogue ------------------------------------------------------
  // Every template through both files, legal and refused, because the five
  // variants are five chances for one copy to drift from the other — and the
  // dangerous direction is the server accepting what nothing downstream renders.
  ['a slideshow that names itself', { template: 'slideshow', scenes: [scene()] }],
  ['a template nobody wrote', { template: 'karaoke', scenes: [scene()] }],
  ['a template that is not a string', { template: 42, scenes: [scene()] }],
  ['an overlay', { template: 'overlay', scenes: [band()] }],
  ['an overlay band spelled out', { template: 'overlay', scenes: [band({ band: { title: 'A', subtitle: 'B', position: 'top' } })] }],
  ['an overlay band across the middle', { template: 'overlay', scenes: [band({ band: { title: 'A', position: 'center' } })] }],
  ['an overlay with no band', { template: 'overlay', scenes: [scene()] }],
  ['an overlay panning a screenshot', { template: 'overlay', scenes: [band({ kenBurns: 'pan-left' })] }],
  ['an overlay under its own floor', { template: 'overlay', scenes: [band({ durationMs: 1499 })] }],
  ['an overlay past its scene cap', { template: 'overlay', scenes: Array.from({ length: 11 }, () => band({ durationMs: 1500 })) }],
  ['an overlay past the total ceiling', { template: 'overlay', scenes: Array.from({ length: 10 }, () => band({ durationMs: 15000 })) }],
  ['a vertical film', { template: 'vertical', scenes: [scene({ durationMs: 2000 })] }],
  ['a vertical film asked to be landscape', { template: 'vertical', scenes: [scene({ durationMs: 2000 })], aspectRatio: '16:9' }],
  ['a vertical film past its own scene length', { template: 'vertical', scenes: [scene({ durationMs: 8001 })] }],
  ['a titles film', { template: 'titles', scenes: [title()] }],
  ['a titles film with an image', { template: 'titles', scenes: [title({ imageId: ID_B })] }],
  ['a titles film with an unknown animation', { template: 'titles', scenes: [title({ animation: 'explode' })] }],
  ['a titles headline of 71 characters', { template: 'titles', scenes: [title({ headline: 'x'.repeat(71) })] }],
  ['a product', { template: 'product', scenes: [product()] }],
  ['a product with three arguments', { template: 'product', scenes: [product({ bullets: ['a', 'b', 'c'] })] }],
  ['a product with four arguments', { template: 'product', scenes: [product({ bullets: ['a', 'b', 'c', 'd'] })] }],
  ['a product with no arguments', { template: 'product', scenes: [product({ bullets: [] })] }],
  ['a product under its own floor', { template: 'product', scenes: [product({ durationMs: 2999 })] }],
  ['a product with a call to action', { template: 'product', scenes: [product({ cta: 'Try it free' })] }],

  // ---- the theme ----------------------------------------------------------
  // Refused on BOTH copies, and that is the enforcement: the model writes a
  // document through this schema, so a theme it invented is an unknown key.
  ['a theme written by the model', { scenes: [scene()], theme: { colors: { accent: '#c0392b' } } }],
  ['a theme on another template', { template: 'titles', scenes: [title()], theme: { radiusPx: 8 } }],
]

describe('the server copy matches src/lib/video/timeline.ts', () => {
  it('exports the same bounds and the same vocabularies', () => {
    expect(node.MAX_SCENES).toBe(web.MAX_SCENES)
    expect(node.MIN_SCENE_DURATION_MS).toBe(web.MIN_SCENE_DURATION_MS)
    expect(node.MAX_SCENE_DURATION_MS).toBe(web.MAX_SCENE_DURATION_MS)
    expect(node.MAX_TOTAL_DURATION_MS).toBe(web.MAX_TOTAL_DURATION_MS)
    expect(node.KEN_BURNS).toEqual([...web.KEN_BURNS])
    expect(node.TRANSITIONS).toEqual([...web.TRANSITIONS])
    expect(node.OVERLAY_POSITIONS).toEqual([...web.OVERLAY_POSITIONS])
    expect(node.OUTPUT_FORMATS).toEqual([...web.OUTPUT_FORMATS])
    expect(node.ASPECT_RATIOS).toEqual([...web.ASPECT_RATIOS])
    // The catalogue, its per-template bounds and its text limits. A template
    // added on one side alone is a document the API accepts and the browser
    // cannot build, or the reverse — and the corpus below cannot catch a
    // template it was never told about.
    expect(node.VIDEO_TEMPLATES).toEqual([...web.VIDEO_TEMPLATES])
    expect(node.TEMPLATE_LIMITS).toEqual(web.TEMPLATE_LIMITS)
    expect(node.TEXT_LIMITS).toEqual(web.TEXT_LIMITS)
    expect(node.BAND_POSITIONS).toEqual([...web.BAND_POSITIONS])
    expect(node.TITLE_ANIMATIONS).toEqual([...web.TITLE_ANIMATIONS])
  })

  /**
   * The corpus is only as good as its coverage of the union: a variant nobody
   * wrote a document for would agree by never being parsed.
   */
  it('runs at least one document of every template through both', () => {
    const covered = new Set(
      CORPUS.map(([, doc]) => (doc && typeof doc === 'object' ? doc.template || 'slideshow' : null)).filter(Boolean),
    )
    for (const template of node.VIDEO_TEMPLATES) expect(covered.has(template), template).toBe(true)
  })

  for (const [label, doc] of CORPUS) {
    it(`agrees on ${label}`, () => {
      const a = node.VideoTimelineSchema.safeParse(doc)
      const b = web.VideoTimelineSchema.safeParse(doc)
      expect(a.success, label).toBe(b.success)
      if (a.success && b.success) {
        // Not just "both accepted": the DEFAULTS have to match too, or the
        // browser previews a crossfade the worker renders as a hard cut.
        expect(a.data).toEqual(b.data)
      } else {
        expect(readableIssues(a.error)).toEqual(readableIssues(b.error))
      }
    })
  }

  it('sums durations the same way', () => {
    const t = { scenes: [scene({ durationMs: 1000 }), scene({ durationMs: 2500 })] }
    expect(node.totalDurationMs(t)).toBe(web.totalDurationMs(t))
    expect(node.totalDurationMs(t)).toBe(3500)
  })
})

/**
 * The regression the catalogue could have shipped, asserted rather than implied.
 *
 * The corpus above only requires the two copies to AGREE, and two copies that
 * both refuse a document agree perfectly. What a montage saved before the
 * catalogue needs is to be accepted, read as a slideshow, and come out with the
 * same values it went in with — no `template` anywhere on disk, every default
 * already written out by the parse that stored it, and `.strict()` waiting on
 * the other side.
 */
describe('a montage saved before the catalogue existed', () => {
  const JOURNALLED = {
    scenes: [
      { imageId: ID_A, durationMs: 4000, kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null },
      {
        imageId: ID_B,
        durationMs: 6000,
        kenBurns: 'pan-left',
        transitionOut: 'wipe-right',
        textOverlay: { content: 'Le tableau de bord', position: 'bottom' },
      },
    ],
    outputFormat: 'mp4',
    aspectRatio: '16:9',
  }

  it('is still accepted, as a slideshow, with every value it was stored with', () => {
    const parsed = node.VideoTimelineSchema.parse(JOURNALLED)
    expect(parsed.template).toBe('slideshow')
    expect(parsed.scenes).toEqual(JOURNALLED.scenes)
    expect(parsed.aspectRatio).toBe('16:9')
    // And identically in the browser, which is what refuses it in the panel.
    expect(web.VideoTimelineSchema.parse(JOURNALLED)).toEqual(parsed)
  })

  it('still reaches the renderer, theme and all', () => {
    // `/render` re-parses the body and then attaches the direction. A document
    // with no template has to survive BOTH schemas, not only the inbound one —
    // `RenderTimelineSchema` is a second discriminated union with the same
    // preprocess, and a default written on one of them alone is an export that
    // fails after the user was told it was queued.
    const timeline = node.VideoTimelineSchema.parse(JOURNALLED)
    const { timeline: themed, notice } = node.attachTheme(timeline, { colors: { accent: '#c0392b' } })
    expect(notice).toBe(null)
    expect(themed.template).toBe('slideshow')
    expect(themed.theme).toEqual({ colors: { accent: '#c0392b' } })
    expect(node.timelineImageIds(themed)).toEqual([ID_A, ID_B])
  })
})

describe('readableIssues', () => {
  // `error.message` is a JSON dump of the issue tree. Put in a 400 body it reads
  // as a stack trace, and the one sentence the caller needs is buried in it.
  it('gives a path and a sentence per issue, not a JSON blob', () => {
    const parsed = node.VideoTimelineSchema.safeParse({ scenes: [scene({ imageId: 'nope' })] })
    expect(parsed.success).toBe(false)
    const issues = readableIssues(parsed.error)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('scenes.0.imageId')
    expect(issues[0].message).toMatch(/lower-case SHA-256/)
  })

  it('names the total-duration rule against the scenes list, not a scene', () => {
    const parsed = node.VideoTimelineSchema.safeParse({
      scenes: Array.from({ length: 20 }, () => scene({ durationMs: 15000 })),
    })
    const issues = readableIssues(parsed.error)
    expect(issues[0].path).toBe('scenes')
    expect(issues[0].message).toMatch(/300000 ms; the maximum is 120000 ms/)
  })

  it('survives something that is not a zod error', () => {
    expect(readableIssues(null)).toEqual([])
    expect(readableIssues({})).toEqual([])
  })
})

/**
 * The theme is mirrored too, and it has to be: the browser builds one and the
 * server is what decides whether it may be attached. A rule loosened on the
 * server alone would let a font stack through that the browser would never emit
 * and no composition can safely put in a `font-family`.
 */
describe('the theme, on both copies', () => {
  const THEMES = [
    ['a full theme', { colors: { background: '#F6F4EE', text: '#111111', accent: '#c0392b', surface: '#fff' }, fonts: { heading: 'Cormorant Garamond', body: 'Inter' }, radiusPx: 14 }],
    ['nothing at all', {}],
    ['an empty colour block', { colors: {} }],
    ['a font stack', { fonts: { body: 'Inter, sans-serif' } }],
    ['a font closing a declaration', { fonts: { heading: 'Inter;}body{display:none}' } }],
    ['a named colour', { colors: { accent: 'rebeccapurple' } }],
    ['a colour function', { colors: { accent: 'var(--brand)' } }],
    ['a radius with a unit', { radiusPx: '14px' }],
    ['a pill radius', { radiusPx: 9999 }],
    ['a radius past the ceiling', { radiusPx: 10000 }],
    ['a token nobody renders', { colors: { accent: '#000000' }, shadow: 'lg' }],
    ['not an object', 'the brand colours'],
  ]

  for (const [label, theme] of THEMES) {
    it(`agrees on ${label}`, () => {
      const a = node.VideoThemeSchema.safeParse(theme)
      const b = web.VideoThemeSchema.safeParse(theme)
      expect(a.success, label).toBe(b.success)
      if (a.success && b.success) expect(a.data).toEqual(b.data)
    })
  }
})

/**
 * `attachTheme` is the injection point — the one place a look enters a document
 * the model wrote, on the server, after that document was accepted.
 */
describe('attachTheme', () => {
  const base = () => node.VideoTimelineSchema.parse({ scenes: [scene()] })

  it('leaves the document alone when there is no direction', () => {
    const t = base()
    expect(node.attachTheme(t, null)).toEqual({ timeline: t, notice: null })
    expect(node.attachTheme(t, undefined)).toEqual({ timeline: t, notice: null })
  })

  it('produces a document the render schema accepts, and the timeline schema does not', () => {
    const { timeline, notice } = node.attachTheme(base(), { colors: { accent: '#c0392b' } })
    expect(notice).toBe(null)
    expect(timeline.theme).toEqual({ colors: { accent: '#c0392b' } })
    expect(node.RenderTimelineSchema.safeParse(timeline).success).toBe(true)
    expect(node.VideoTimelineSchema.safeParse(timeline).success).toBe(false)
  })

  /**
   * The defect: losing a render over a decoration.
   *
   * The user has already waited in a queue for this. A direction that cannot be
   * read costs the colours and nothing else (Q1) — and it says so, because a
   * film quietly rendered in the wrong palette is indistinguishable from one
   * rendered in the right one by anybody who did not write the direction.
   */
  it('drops a refused theme and keeps the film, with a notice naming what happened', () => {
    const t = base()
    const { timeline, notice } = node.attachTheme(t, { fonts: { heading: 'Inter, sans-serif' } })
    expect(timeline).toEqual(t)
    expect(timeline.theme).toBeUndefined()
    expect(notice).toMatch(/art direction/i)
    // One sentence, one full stop each: the schema's own messages end in one
    // about half the time and two in a row reads as a typo.
    expect(notice).not.toMatch(/\.\./)
  })

  // All or nothing. Removing the one field that failed would be the repair this
  // feature refuses everywhere else, and it would render a film in the project's
  // colours with somebody else's typeface.
  it('never keeps half a theme', () => {
    const { timeline } = node.attachTheme(base(), { colors: { accent: '#c0392b' }, radiusPx: 12.5 })
    expect(timeline.theme).toBeUndefined()
  })
})

describe('timelineImageIds', () => {
  it('lists every image once, in first-use order', () => {
    const t = node.VideoTimelineSchema.parse({
      scenes: [scene({ imageId: ID_B }), scene(), scene({ imageId: ID_B })],
    })
    expect(node.timelineImageIds(t)).toEqual([ID_B, ID_A])
    expect(web.timelineImageIds(t)).toEqual([ID_B, ID_A])
  })

  /**
   * The defect: `scenes.map((s) => s.imageId)` on a text-only film hands its
   * callers `[undefined]`, and both of them — the existence check in /render and
   * `collectImages` — then fail on an image named after nothing.
   */
  it('reports no images for a titles film rather than one called undefined', () => {
    const t = node.VideoTimelineSchema.parse({ template: 'titles', scenes: [title()] })
    expect(node.timelineImageIds(t)).toEqual([])
    expect(web.timelineImageIds(t)).toEqual([])
  })
})
