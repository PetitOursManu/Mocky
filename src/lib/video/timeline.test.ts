import { describe, it, expect } from 'vitest'
import {
  ANCHORS,
  BACKGROUND_KINDS,
  BLOCK_FAMILIES,
  BLOCK_KINDS,
  BLOCK_LIMITS,
  BlockSchema,
  COMPOSED_TRANSITIONS,
  ComposedSceneSchema,
  DEFAULT_KEN_BURNS,
  DEFAULT_OVERLAY_MOVE,
  EDITABLE_TEMPLATES,
  OverlaySceneSchema,
  ProductTimelineSchema,
  RenderTimelineSchema,
  SlideshowSceneSchema,
  TEMPLATE_LIMITS,
  TEXT_LIMITS,
  TextOverlaySchema,
  VIDEO_TEMPLATES,
  VideoThemeSchema,
  VideoTimelineSchema,
  timelineImageIds,
  totalDurationMs,
  MAX_TOTAL_DURATION_MS,
  type VideoTimelineInput,
} from './timeline'

const HASH = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

const scene = (patch: Record<string, unknown> = {}) => ({ imageId: HASH, durationMs: 3000, ...patch })
const timeline = (patch: Record<string, unknown> = {}) => ({ scenes: [scene()], ...patch }) as VideoTimelineInput

/** One legal scene per template, at that template's own floor. */
const SCENE_FOR: Record<string, (patch?: Record<string, unknown>) => Record<string, unknown>> = {
  slideshow: (patch = {}) => ({ imageId: HASH, durationMs: 3000, ...patch }),
  overlay: (patch = {}) => ({ imageId: HASH, durationMs: 3000, band: { title: 'Ship it' }, ...patch }),
  vertical: (patch = {}) => ({ imageId: HASH, durationMs: 3000, ...patch }),
  titles: (patch = {}) => ({ headline: 'Ship it', durationMs: 3000, ...patch }),
  product: (patch = {}) => ({ imageId: HASH, durationMs: 4000, headline: 'Ship it', bullets: ['Fast'], ...patch }),
  // No `background`, so every loop below runs over the ground a silent document
  // gets — which is the one that has to work, since it is the one a model that
  // omits an optional field produces.
  composed: (patch = {}) => ({ durationMs: 3000, layers: [{ kind: 'heading', text: 'Ship it' }], ...patch }),
}

describe('SlideshowSceneSchema', () => {
  it('applies the documented defaults so an omission is never an accident', () => {
    const s = SlideshowSceneSchema.parse({ imageId: HASH, durationMs: 2000 })
    // `zoom-in`, and it used to be `static`. A model omits an optional field, so
    // the default was what every generated slideshow actually rendered: a
    // photograph nailed to the frame with a caption on it. `static` is still in
    // the enum — a capture has real reasons to be held — but it has to be asked
    // for now. `tests/video-motion.test.js` is what holds that.
    expect(s.kenBurns).toBe(DEFAULT_KEN_BURNS.slideshow)
    expect(s.kenBurns).not.toBe('static')
    expect(s.transitionOut).toBe('crossfade')
    expect(s.textOverlay).toBe(null)
  })

  // Guards M2/M8: the timeline addresses the image library, it does not fetch.
  // A URL here would let a generated document pull third-party bytes into an
  // mp4 Mocky then serves as its own.
  it('refuses anything that is not a library hash — URLs above all', () => {
    for (const bad of ['https://example.com/a.png', '/api/images/' + HASH, 'data:image/png;base64,AAAA', '']) {
      expect(SlideshowSceneSchema.safeParse(scene({ imageId: bad })).success).toBe(false)
    }
  })

  // `data/image-library/{hash}` is a path. Two spellings of one hash is a lookup
  // that misses on a case-sensitive volume and works on the developer's laptop.
  it('refuses an upper-case hash rather than lower-casing it', () => {
    expect(SlideshowSceneSchema.safeParse(scene({ imageId: HASH.toUpperCase() })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ imageId: 'a'.repeat(63) })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ imageId: 'z'.repeat(64) })).success).toBe(false)
  })

  // No repair: a 40-second scene is a rejection, not a 15-second one. Clamping
  // would hand back a video nobody asked for and call it a success.
  it('refuses an out-of-range duration instead of clamping it', () => {
    expect(SlideshowSceneSchema.safeParse(scene({ durationMs: 40000 })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ durationMs: 999 })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ durationMs: 3000.5 })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ durationMs: '3000' })).success).toBe(false)
  })

  it('refuses an unknown animation or transition name', () => {
    expect(SlideshowSceneSchema.safeParse(scene({ kenBurns: 'spin' })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ transitionOut: 'dissolve' })).success).toBe(false)
  })

  // Strictness is what makes "no audio" a fact rather than a wish: an ignored
  // key would validate, render silently, and be reported as a success.
  it('refuses an unknown field on a scene', () => {
    expect(SlideshowSceneSchema.safeParse(scene({ audioTrack: 'x.mp3' })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ src: 'https://example.com/a.png' })).success).toBe(false)
  })

  /**
   * A caption that is present and says nothing.
   *
   * `min(1)` counts characters, so `" "` satisfied it — while the worker's
   * `readText` has always refused a string that trims to nothing. Mocky accepted
   * a document its own renderer throws back, which is the expensive direction:
   * the timeline validates, the job is queued, the user waits out a render, and
   * the refusal arrives at the end about a caption they can see on screen.
   */
  it('refuses a line of whitespace, in every field that holds one', () => {
    const blank = ['   ', '\t', '\n', '   ']
    for (const value of blank) {
      expect(SlideshowSceneSchema.safeParse(scene({ textOverlay: { content: value, position: 'top' } })).success).toBe(
        false,
      )
      expect(
        VideoTimelineSchema.safeParse({ template: 'overlay', scenes: [SCENE_FOR.overlay({ band: { title: value } })] })
          .success,
      ).toBe(false)
      expect(
        VideoTimelineSchema.safeParse({ template: 'titles', scenes: [SCENE_FOR.titles({ headline: value })] }).success,
      ).toBe(false)
      expect(
        VideoTimelineSchema.safeParse({ template: 'titles', scenes: [SCENE_FOR.titles({ subtitle: value })] }).success,
      ).toBe(false)
      expect(
        VideoTimelineSchema.safeParse({ template: 'product', scenes: [SCENE_FOR.product({ bullets: [value] })] })
          .success,
      ).toBe(false)
      expect(
        VideoTimelineSchema.safeParse({ template: 'product', scenes: [SCENE_FOR.product({ cta: value })] }).success,
      ).toBe(false)
    }
  })

  it('keeps the bound readable off the schema, so a maxLength attribute cannot drift', () => {
    // `draft.ts` reads `TextOverlaySchema.shape.content.maxLength` rather than
    // retyping 120 into an input. A refinement would wrap the string in a
    // `ZodEffects` and that read would answer `undefined`, falling silently
    // through to a copy of the number — which is why the blank check above is a
    // `regex` and not a `refine`.
    expect(TextOverlaySchema.shape.content.maxLength).toBe(TEXT_LIMITS.overlay)
  })

  it('refuses an over-long overlay instead of truncating it, and an unknown overlay field', () => {
    const overlay = (patch: Record<string, unknown>) => scene({ textOverlay: { position: 'top', ...patch } })
    expect(SlideshowSceneSchema.safeParse(overlay({ content: 'x'.repeat(120) })).success).toBe(true)
    expect(SlideshowSceneSchema.safeParse(overlay({ content: 'x'.repeat(121) })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(overlay({ content: '' })).success).toBe(false)
    expect(SlideshowSceneSchema.safeParse(scene({ textOverlay: { content: 'hi', position: 'middle' } })).success).toBe(false)
    expect(
      SlideshowSceneSchema.safeParse(scene({ textOverlay: { content: 'hi', position: 'top', size: 'xl' } })).success,
    ).toBe(false)
  })
})

/**
 * The compatibility rule, and the regression it prevents.
 *
 * Montages composed before the catalogue existed are sitting in saved drafts and
 * in the queue's journal, and none of them names a template. Reading those as
 * invalid would refuse a timeline the user had already built and been shown —
 * a break with no error message anywhere pointing at the change that caused it.
 */
describe('a document with no template', () => {
  it('is a slideshow, and says so once parsed', () => {
    const parsed = VideoTimelineSchema.parse({ scenes: [scene()] })
    expect(parsed.template).toBe('slideshow')
  })

  it('reads identically whether or not it names itself', () => {
    const bare = VideoTimelineSchema.parse({ scenes: [scene({ kenBurns: 'pan-left' })], aspectRatio: '1:1' })
    const named = VideoTimelineSchema.parse({
      template: 'slideshow',
      scenes: [scene({ kenBurns: 'pan-left' })],
      aspectRatio: '1:1',
    })
    expect(bare).toEqual(named)
  })

  // The default fills a missing key; it does not rescue a document that named
  // something else. A `product` missing its headline is a refused product, never
  // a slideshow that would have passed.
  it('does not turn a refused document of another template into a slideshow', () => {
    const res = VideoTimelineSchema.safeParse({ template: 'product', scenes: [scene()] })
    expect(res.success).toBe(false)
  })

  it('refuses a template that is not in the catalogue', () => {
    const res = VideoTimelineSchema.safeParse({ template: 'karaoke', scenes: [scene()] })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues[0].path).toEqual(['template'])
  })
})

describe('OverlaySceneSchema', () => {
  /**
   * The template the reported film was cut in. It had no movement field at all,
   * which was read as "this template does not move" — and a still screenshot
   * with a band of text on it is exactly what the user objected to.
   *
   * `move` is the amplitude the template's discipline actually permits: a drift
   * inside the margin its overscale leaves, never a pan and never a zoom.
   */
  it('gives a capture a drift when the document names none', () => {
    const s = OverlaySceneSchema.parse({ imageId: HASH, durationMs: 3000, band: { title: 'Ship it' } })
    expect(s.move).toBe(DEFAULT_OVERLAY_MOVE)
  })

  it('refuses a camera move on a capture, whatever it is called', () => {
    for (const bad of ['pan-left', 'zoom-in', 'static', 'none']) {
      expect(
        OverlaySceneSchema.safeParse({ imageId: HASH, durationMs: 3000, move: bad, band: { title: 'Ship it' } }).success,
        bad,
      ).toBe(false)
    }
    // And `kenBurns` remains unreachable here, which is the older half of the
    // same rule: the field the model must not have is still absent, not renamed.
    expect(
      OverlaySceneSchema.safeParse({ imageId: HASH, durationMs: 3000, kenBurns: 'pan-left', band: { title: 'Ship it' } })
        .success,
    ).toBe(false)
  })
})

describe('the catalogue', () => {
  it('accepts one legal document per template', () => {
    for (const template of VIDEO_TEMPLATES) {
      const res = VideoTimelineSchema.safeParse({ template, scenes: [SCENE_FOR[template]()] })
      expect(res.success, template).toBe(true)
    }
  })

  // `.strict()` on every variant, not only on the one that shipped first. An
  // unknown key is how a field nothing renders is accepted in silence and the
  // export is reported as a success — and there is still no audio.
  it('refuses an unknown key on every template, on the document and on the scene', () => {
    for (const template of VIDEO_TEMPLATES) {
      const scenes = [SCENE_FOR[template]()]
      expect(VideoTimelineSchema.safeParse({ template, scenes, audio: 'track.mp3' }).success, template).toBe(false)
      expect(VideoTimelineSchema.safeParse({ template, scenes, fps: 60 }).success, template).toBe(false)
      expect(
        VideoTimelineSchema.safeParse({ template, scenes: [SCENE_FOR[template]({ src: 'x.png' })] }).success,
        template,
      ).toBe(false)
    }
  })

  /**
   * The 120-second ceiling holds for every template, and the test is written so
   * it cannot go vacuous.
   *
   * Three of the five cannot reach the ceiling with their own caps — 8 titles ×
   * 10 s is 80 s — so asserting "the biggest legal document is refused" would
   * silently pass for the wrong reason. The rule under test is the one that
   * matters: the largest document a template allows is accepted if and only if
   * it fits the whole-timeline budget, and refused with the budget named when it
   * does not.
   */
  it('applies the whole-timeline ceiling to every template', () => {
    for (const template of VIDEO_TEMPLATES) {
      const { maxScenes, maxSceneMs } = TEMPLATE_LIMITS[template]
      const scenes = Array.from({ length: maxScenes }, () => SCENE_FOR[template]({ durationMs: maxSceneMs }))
      const res = VideoTimelineSchema.safeParse({ template, scenes })
      const fits = maxScenes * maxSceneMs <= MAX_TOTAL_DURATION_MS
      expect(res.success, `${template}: ${maxScenes} × ${maxSceneMs} ms`).toBe(fits)
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path[0] === 'scenes')
        expect(issue?.message).toContain(String(MAX_TOTAL_DURATION_MS))
      }
    }
  })

  it('refuses one scene past the cap each template sets for itself', () => {
    for (const template of VIDEO_TEMPLATES) {
      const { maxScenes, minSceneMs } = TEMPLATE_LIMITS[template]
      const scenes = Array.from({ length: maxScenes + 1 }, () => SCENE_FOR[template]({ durationMs: minSceneMs }))
      expect(VideoTimelineSchema.safeParse({ template, scenes }).success, template).toBe(false)
      expect(VideoTimelineSchema.safeParse({ template, scenes: [] }).success, template).toBe(false)
    }
  })

  it('refuses a scene outside the duration window its template sets, without clamping it', () => {
    for (const template of VIDEO_TEMPLATES) {
      const { minSceneMs, maxSceneMs } = TEMPLATE_LIMITS[template]
      const under = { template, scenes: [SCENE_FOR[template]({ durationMs: minSceneMs - 1 })] }
      const over = { template, scenes: [SCENE_FOR[template]({ durationMs: maxSceneMs + 1 })] }
      expect(VideoTimelineSchema.safeParse(under).success, template).toBe(false)
      expect(VideoTimelineSchema.safeParse(over).success, template).toBe(false)
    }
  })

  /**
   * The ratio IS the vertical template, so the other two are unreachable rather
   * than discouraged. Asked for 16:9 a vertical composition would letterbox and
   * put its captions in the wrong third — a legal document rendering a film
   * nobody described.
   */
  it('lets the vertical template express no ratio but 9:16', () => {
    const scenes = [SCENE_FOR.vertical()]
    expect(VideoTimelineSchema.parse({ template: 'vertical', scenes }).aspectRatio).toBe('9:16')
    expect(VideoTimelineSchema.safeParse({ template: 'vertical', scenes, aspectRatio: '9:16' }).success).toBe(true)
    expect(VideoTimelineSchema.safeParse({ template: 'vertical', scenes, aspectRatio: '16:9' }).success).toBe(false)
    expect(VideoTimelineSchema.safeParse({ template: 'vertical', scenes, aspectRatio: '1:1' }).success).toBe(false)
  })

  it('caps a product at three arguments and refuses a fourth rather than dropping it', () => {
    const product = (bullets: string[]) => ({
      template: 'product',
      scenes: [SCENE_FOR.product({ bullets })],
    })
    expect(VideoTimelineSchema.safeParse(product(['a', 'b', 'c'])).success).toBe(true)
    expect(VideoTimelineSchema.safeParse(product(['a', 'b', 'c', 'd'])).success).toBe(false)
    expect(VideoTimelineSchema.safeParse(product([])).success).toBe(false)
  })

  it('needs no image for a titles film, and reports none', () => {
    const parsed = VideoTimelineSchema.parse({ template: 'titles', scenes: [SCENE_FOR.titles()] })
    expect(timelineImageIds(parsed)).toEqual([])
  })

  // The defect this prevents: `scenes.map((s) => s.imageId)` at a call site,
  // which hands `[undefined]` to a library lookup for a text-only film.
  it('lists every image once, in first-use order', () => {
    const parsed = VideoTimelineSchema.parse({
      scenes: [scene({ imageId: OTHER }), scene({ imageId: HASH }), scene({ imageId: OTHER })],
    })
    expect(timelineImageIds(parsed)).toEqual([OTHER, HASH])
  })
})

describe('VideoTimelineSchema', () => {
  it('defaults the output to mp4 / 16:9', () => {
    const t = VideoTimelineSchema.parse(timeline())
    expect(t.outputFormat).toBe('mp4')
    expect(t.aspectRatio).toBe('16:9')
  })

  it('refuses an empty timeline and one past the scene cap', () => {
    expect(VideoTimelineSchema.safeParse({ scenes: [] }).success).toBe(false)
    const many = Array.from({ length: 21 }, () => scene({ durationMs: 1000 }))
    expect(VideoTimelineSchema.safeParse({ scenes: many }).success).toBe(false)
  })

  // The whole point of the refinement: every scene here is individually legal,
  // and together they are a five-minute render.
  it('refuses a timeline whose scenes are each valid but total more than two minutes', () => {
    const twenty = Array.from({ length: 20 }, () => scene({ durationMs: 15000 }))
    const res = VideoTimelineSchema.safeParse({ scenes: twenty })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'scenes')
      expect(issue?.message).toContain(String(MAX_TOTAL_DURATION_MS))
      expect(issue?.message).toContain('300000') // says what was actually asked for
    }
  })

  it('accepts exactly the ceiling — the limit is inclusive', () => {
    const eight = Array.from({ length: 8 }, () => scene({ durationMs: 15000 }))
    const res = VideoTimelineSchema.safeParse({ scenes: eight })
    expect(res.success).toBe(true)
    if (res.success) expect(totalDurationMs(res.data)).toBe(MAX_TOTAL_DURATION_MS)
  })

  it('refuses an unknown top-level field, including the audio nobody implemented', () => {
    expect(VideoTimelineSchema.safeParse({ scenes: [scene()], audio: { url: 'x.mp3' } }).success).toBe(false)
    expect(VideoTimelineSchema.safeParse({ scenes: [scene()], fps: 60 }).success).toBe(false)
  })

  it('refuses an unknown format or ratio', () => {
    expect(VideoTimelineSchema.safeParse(timeline({ outputFormat: 'mov' })).success).toBe(false)
    expect(VideoTimelineSchema.safeParse(timeline({ aspectRatio: '4:3' })).success).toBe(false)
  })

  it('keeps distinct scenes distinct through parsing', () => {
    const t = VideoTimelineSchema.parse({
      scenes: [scene({ imageId: HASH, kenBurns: 'zoom-in' }), scene({ imageId: OTHER, transitionOut: 'none' })],
      aspectRatio: '9:16',
    })
    expect(t.scenes.map((s) => (s as { imageId: string }).imageId)).toEqual([HASH, OTHER])
    expect(t.template).toBe('slideshow')
    if (t.template === 'slideshow') {
      expect(t.scenes[0].kenBurns).toBe('zoom-in')
      expect(t.scenes[1].transitionOut).toBe('none')
    }
    expect(t.aspectRatio).toBe('9:16')
  })

  // A rejection must leave nothing usable behind, or a caller will be tempted
  // to ship the half of the document that parsed.
  it('returns no data at all when it rejects', () => {
    const res = VideoTimelineSchema.safeParse({ scenes: [scene({ durationMs: 99999 })] })
    expect(res.success).toBe(false)
    expect((res as { data?: unknown }).data).toBeUndefined()
  })
})

/**
 * The rule the whole theme rests on: the model does not choose the look.
 *
 * It is enforced by absence rather than by an instruction — `theme` is simply
 * not a field a composed document has — so a model that writes one is refused
 * exactly like a model that writes an audio track, with no repair path and no
 * quiet stripping.
 */
describe('a theme in a composed document', () => {
  it('is refused like any other unknown key, on every template', () => {
    for (const template of VIDEO_TEMPLATES) {
      const doc = {
        template,
        scenes: [SCENE_FOR[template]()],
        theme: { colors: { accent: '#c0392b' } },
      }
      const res = VideoTimelineSchema.safeParse(doc)
      expect(res.success, template).toBe(false)
      if (!res.success) expect(JSON.stringify(res.error.issues)).toContain('theme')
    }
  })

  it('is accepted only by the schema the SERVER builds the render document with', () => {
    const doc = { scenes: [scene()], theme: { colors: { accent: '#c0392b' }, radiusPx: 14 } }
    expect(VideoTimelineSchema.safeParse(doc).success).toBe(false)
    expect(RenderTimelineSchema.safeParse(doc).success).toBe(true)
  })

  it('still refuses everything else the timeline refuses', () => {
    expect(RenderTimelineSchema.safeParse({ scenes: [scene()], audio: 'x.mp3' }).success).toBe(false)
    expect(RenderTimelineSchema.safeParse({ template: 'karaoke', scenes: [scene()] }).success).toBe(false)
    const twenty = Array.from({ length: 20 }, () => scene({ durationMs: 15000 }))
    expect(RenderTimelineSchema.safeParse({ scenes: twenty }).success).toBe(false)
  })
})

describe('VideoThemeSchema', () => {
  it('takes hex in either case, because a colour is not a path', () => {
    expect(VideoThemeSchema.safeParse({ colors: { background: '#F6F4EE' } }).success).toBe(true)
    expect(VideoThemeSchema.safeParse({ colors: { background: '#f6f4ee' } }).success).toBe(true)
    expect(VideoThemeSchema.safeParse({ colors: { background: '#fff' } }).success).toBe(true)
  })

  /**
   * The defect this closes: a font name is the one theme field that could carry
   * CSS syntax, because it ends up in a `font-family`. A stack, a quote, a
   * semicolon or a brace there is the difference between naming a typeface and
   * writing a declaration — so the schema takes ONE family name and the
   * composition appends its own fallbacks.
   */
  it('refuses anything in a font but one plain family name', () => {
    expect(VideoThemeSchema.safeParse({ fonts: { heading: 'Cormorant Garamond' } }).success).toBe(true)
    expect(VideoThemeSchema.safeParse({ fonts: { heading: 'IBM Plex Sans' } }).success).toBe(true)
    for (const bad of [
      'Inter, sans-serif',
      "Inter'; background: url(http://evil.test)",
      'Inter</style><script>',
      'Inter;}body{display:none}',
      'x'.repeat(49),
      '',
    ]) {
      expect(VideoThemeSchema.safeParse({ fonts: { heading: bad } }).success, bad).toBe(false)
    }
  })

  it('refuses a colour that is not hex, so nothing arbitrary reaches a stylesheet', () => {
    for (const bad of ['red', 'rgb(1,2,3)', 'var(--x)', 'url(http://evil.test)', '#12345', 'F6F4EE']) {
      expect(VideoThemeSchema.safeParse({ colors: { accent: bad } }).success, bad).toBe(false)
    }
  })

  it('takes a radius as whole pixels, with no unit to parse and no calc() to smuggle', () => {
    expect(VideoThemeSchema.safeParse({ radiusPx: 0 }).success).toBe(true)
    expect(VideoThemeSchema.safeParse({ radiusPx: 9999 }).success).toBe(true)
    expect(VideoThemeSchema.safeParse({ radiusPx: 10000 }).success).toBe(false)
    expect(VideoThemeSchema.safeParse({ radiusPx: 12.5 }).success).toBe(false)
    expect(VideoThemeSchema.safeParse({ radiusPx: '12px' }).success).toBe(false)
  })

  // "No direction" is spelled by leaving `theme` out. An empty block would claim
  // a direction was read and asked for nothing, which is a different fact.
  it('refuses a theme that states nothing at all', () => {
    expect(VideoThemeSchema.safeParse({}).success).toBe(false)
    expect(VideoThemeSchema.safeParse({ colors: {} }).success).toBe(false)
  })

  it('refuses an unknown token rather than ignoring it', () => {
    expect(VideoThemeSchema.safeParse({ colors: { accent: '#000000' }, shadow: 'lg' }).success).toBe(false)
    expect(VideoThemeSchema.safeParse({ colors: { accent: '#000000', border: '#111111' } }).success).toBe(false)
    expect(VideoThemeSchema.safeParse({ fonts: { mono: 'Fira Code' } }).success).toBe(false)
  })
})

describe('ProductTimelineSchema', () => {
  it('is the one place the bullets bound lives, and it is not repaired', () => {
    const res = ProductTimelineSchema.safeParse({
      template: 'product',
      scenes: [SCENE_FOR.product({ bullets: ['a', 'b', 'c', 'd'] })],
    })
    expect(res.success).toBe(false)
  })
})

/**
 * The composable variant, which is the one place a document gets to arrange
 * itself — and therefore the one place the founding rule has to be checked by
 * absence rather than by presence.
 *
 * Every test below is about something a block CANNOT say. That is the shape of
 * the guarantee: the model picks blocks, their order, their zone and their
 * parameters, and it never reaches a colour, a font, a CSS length, a coordinate
 * or a millisecond. What it cannot express is unreachable rather than
 * discouraged, exactly as there is no `fps` field and no `src`.
 */
describe('the composable variant', () => {
  const composed = (patch: Record<string, unknown> = {}) => ({
    template: 'composed',
    scenes: [SCENE_FOR.composed(patch)],
  })
  const withLayers = (...layers: Record<string, unknown>[]) => composed({ layers })

  it('applies the documented defaults, so an omission is never an accident', () => {
    const s = ComposedSceneSchema.parse({ durationMs: 3000, layers: [{ kind: 'heading', text: 'Ship it' }] })
    expect(s.background).toEqual({ kind: 'hairlines' })
    expect(s.transitionOut).toBe('crossfade')
    expect(s.layers[0].anchor).toBe('center')
    // Absent and NOT filled in: "the position it was written in" is a reading
    // `layerCues` owns, and a number written here would be a second one.
    expect('enter' in s.layers[0]).toBe(false)
  })

  it('renders on every ground the schema names, and refuses one it does not', () => {
    const grounds: Record<string, Record<string, unknown>> = {
      solid: { kind: 'solid' },
      gradient: { kind: 'gradient' },
      hairlines: { kind: 'hairlines' },
      gridPulse: { kind: 'gridPulse' },
      particles: { kind: 'particles' },
      image: { kind: 'image', imageId: HASH },
    }
    for (const kind of BACKGROUND_KINDS) {
      expect(VideoTimelineSchema.safeParse(composed({ background: grounds[kind] })).success, kind).toBe(true)
    }
    expect(VideoTimelineSchema.safeParse(composed({ background: { kind: 'video' } })).success).toBe(false)
    // A ground that is a picture needs the picture, like every other template.
    expect(VideoTimelineSchema.safeParse(composed({ background: { kind: 'image' } })).success).toBe(false)
  })

  it('has one family per block kind, and a kind for every family entry', () => {
    const flat = Object.values(BLOCK_FAMILIES).flat()
    expect([...flat].sort()).toEqual([...BLOCK_KINDS].sort())
    // No kind in two families: a prompt built from this map would offer it twice
    // and a reader would have to guess which group is the real one.
    expect(new Set(flat).size).toBe(flat.length)
  })

  /**
   * The union and the catalogue, in both directions.
   *
   * A kind in `BLOCK_KINDS` with no member behind it is a name the compose prompt
   * offers and the schema refuses — a call spent on a document that cannot pass.
   * A member with no name is a component nothing can reach.
   */
  it('accepts exactly the block kinds it publishes', () => {
    const members = BlockSchema.options.map((option) => option.shape.kind.value)
    expect([...members].sort()).toEqual([...BLOCK_KINDS].sort())
  })

  it('refuses a block kind nobody wrote, by leaving it out of the union', () => {
    expect(VideoTimelineSchema.safeParse(withLayers({ kind: 'video', src: 'x.mp4' })).success).toBe(false)
    expect(VideoTimelineSchema.safeParse(withLayers({ kind: 'constructor' })).success).toBe(false)
  })

  /**
   * The rule the whole variant rests on: a block says WHAT it is, never what it
   * looks like.
   *
   * Each of these is a real way the founding rule would leak — a colour is the
   * theme the server attaches, a font is the one family a container has, a
   * className and a style are CSS, and a coordinate is a layout the model
   * described. `.strict()` is what makes every one of them a refusal rather than
   * a key nothing renders.
   */
  it('cannot express a colour, a font, a CSS length, a class or a coordinate', () => {
    for (const smuggled of [
      { color: '#ff0000' },
      { background: '#ff0000' },
      { fontFamily: 'Inter' },
      { fontSize: '32px' },
      { className: 'text-red-500' },
      { style: { color: 'red' } },
      { x: 120, y: 40 },
      { delayMs: 400 },
      { css: 'transform: scale(2)' },
    ]) {
      expect(
        VideoTimelineSchema.safeParse(withLayers({ kind: 'heading', text: 'Ship it', ...smuggled })).success,
        JSON.stringify(smuggled),
      ).toBe(false)
    }
  })

  it('places a block in a zone and never at a pixel', () => {
    for (const anchor of ANCHORS) {
      expect(VideoTimelineSchema.safeParse(withLayers({ kind: 'kicker', text: 'Motion', anchor })).success, anchor).toBe(
        true,
      )
    }
    expect(VideoTimelineSchema.safeParse(withLayers({ kind: 'kicker', text: 'Motion', anchor: 'middle' })).success).toBe(
      false,
    )
  })

  it('times a block by rank and never in milliseconds', () => {
    const rank = (enter: unknown) => VideoTimelineSchema.safeParse(withLayers({ kind: 'kicker', text: 'Go', enter }))
    expect(rank(0).success).toBe(true)
    expect(rank(BLOCK_LIMITS.layersPerScene - 1).success).toBe(true)
    // A rank past the number of blocks a scene can hold is a rank nothing can
    // order, and a rank in milliseconds is the rhythm the composition owns.
    expect(rank(BLOCK_LIMITS.layersPerScene).success).toBe(false)
    expect(rank(-1).success).toBe(false)
    expect(rank(400).success).toBe(false)
    expect(rank(1.5).success).toBe(false)
  })

  it('bounds the stack at both ends', () => {
    const heading = { kind: 'heading', text: 'Ship it' }
    expect(VideoTimelineSchema.safeParse(composed({ layers: [] })).success).toBe(false)
    expect(
      VideoTimelineSchema.safeParse(
        composed({ layers: Array.from({ length: BLOCK_LIMITS.layersPerScene }, () => heading) }),
      ).success,
    ).toBe(true)
    expect(
      VideoTimelineSchema.safeParse(
        composed({ layers: Array.from({ length: BLOCK_LIMITS.layersPerScene + 1 }, () => heading) }),
      ).success,
    ).toBe(false)
  })

  it('bounds every text field, and refuses a line of whitespace in each', () => {
    const cases: [Record<string, unknown>, string, number][] = [
      [{ kind: 'heading' }, 'text', BLOCK_LIMITS.heading],
      [{ kind: 'kicker' }, 'text', BLOCK_LIMITS.kicker],
      [{ kind: 'quote' }, 'text', BLOCK_LIMITS.quote],
      [{ kind: 'typewriter' }, 'text', BLOCK_LIMITS.typewriter],
      [{ kind: 'logoType' }, 'text', BLOCK_LIMITS.logoType],
      [{ kind: 'button' }, 'label', BLOCK_LIMITS.buttonLabel],
      [{ kind: 'notification' }, 'title', BLOCK_LIMITS.noticeTitle],
      [{ kind: 'lowerThird' }, 'title', BLOCK_LIMITS.lowerTitle],
      [{ kind: 'dateStamp' }, 'text', BLOCK_LIMITS.dateStamp],
    ]
    for (const [base, field, max] of cases) {
      const at = (value: string) => VideoTimelineSchema.safeParse(withLayers({ ...base, [field]: value })).success
      expect(at('x'.repeat(max)), `${base.kind}.${field} at the cap`).toBe(true)
      expect(at('x'.repeat(max + 1)), `${base.kind}.${field} past the cap`).toBe(false)
      expect(at(''), `${base.kind}.${field} empty`).toBe(false)
      expect(at('  '), `${base.kind}.${field} blank`).toBe(false)
    }
  })

  it('bounds every array and every count', () => {
    const ok = (layer: Record<string, unknown>) => VideoTimelineSchema.safeParse(withLayers(layer)).success
    expect(ok({ kind: 'animatedList', items: [] })).toBe(false)
    expect(ok({ kind: 'animatedList', items: Array.from({ length: BLOCK_LIMITS.listItems }, () => 'a') })).toBe(true)
    expect(ok({ kind: 'animatedList', items: Array.from({ length: BLOCK_LIMITS.listItems + 1 }, () => 'a') })).toBe(
      false,
    )
    expect(ok({ kind: 'barChart', values: [10] })).toBe(false)
    expect(ok({ kind: 'barChart', values: [10, 200] })).toBe(false)
    expect(ok({ kind: 'barChart', values: [10, 20] })).toBe(true)
    expect(ok({ kind: 'equalizer', bars: BLOCK_LIMITS.equalizerBarsMin - 1 })).toBe(false)
    expect(ok({ kind: 'equalizer', bars: BLOCK_LIMITS.equalizerBars + 1 })).toBe(false)
    expect(ok({ kind: 'gallery', imageIds: [HASH] })).toBe(false)
    expect(ok({ kind: 'gallery', imageIds: [HASH, OTHER] })).toBe(true)
    expect(ok({ kind: 'progressBar', to: 101 })).toBe(false)
    expect(ok({ kind: 'progressBar', to: 100 })).toBe(true)
  })

  /**
   * A clock that read the render host's own time would burn a fact about the
   * MACHINE into a film, and two renders of one timeline would differ — which the
   * content-addressed export store cannot have. So the time is stated, in a
   * charset with no letter in it.
   */
  it('takes a clock time from the document, in a shape that can never become anything', () => {
    const time = (value: unknown) => VideoTimelineSchema.safeParse(withLayers({ kind: 'clock', time: value })).success
    expect(time('09:30')).toBe(true)
    expect(time('23:59')).toBe(true)
    expect(time(null)).toBe(true)
    expect(time('24:00')).toBe(false)
    expect(time('now')).toBe(false)
    expect(time('9:3')).toBe(false)
  })

  /**
   * The mosaic dissolve belongs to this variant alone, and the other five keep
   * the vocabulary their saved drafts were written against.
   */
  it('gives the composed scene one transition the others do not have', () => {
    expect(COMPOSED_TRANSITIONS).toContain('pixel')
    expect(VideoTimelineSchema.safeParse(composed({ transitionOut: 'pixel' })).success).toBe(true)
    for (const template of EDITABLE_TEMPLATES) {
      const doc = { template, scenes: [SCENE_FOR[template]({ transitionOut: 'pixel' })] }
      expect(VideoTimelineSchema.safeParse(doc).success, template).toBe(false)
    }
  })

  /**
   * Where a composed film keeps its pictures, and why the walk had to change.
   *
   * They are nowhere near `scene.imageId`: one may be the ground, and the rest
   * are on blocks anywhere in the stack — a gallery holds six. A caller still
   * reading the scene would have staged one picture out of eight and left the
   * composition pointing at addresses with no file behind them.
   */
  it('finds every picture, on the ground and anywhere in the stack', () => {
    const third = 'c'.repeat(64)
    const doc = VideoTimelineSchema.parse(
      composed({
        background: { kind: 'image', imageId: HASH },
        layers: [
          { kind: 'imageFrame', imageId: OTHER },
          { kind: 'gallery', imageIds: [third, HASH] },
        ],
      }),
    )
    expect(timelineImageIds(doc)).toEqual([HASH, OTHER, third])
  })
})
