// The video-export contract, as Node can run it.
//
// The definition to READ is `src/lib/video/timeline.ts`. It carries the
// reasoning behind every bound, every `.strict()`, the five templates and the
// refusal to repair a document; none of that is repeated here, because a second
// copy of a rationale is a second copy to get out of date.
//
// This file exists only because the server cannot import that one. `package.json`
// declares `"node": ">=22.12"`, and at that floor type stripping is a flagged
// experiment — `node server/index.js` throws ERR_UNKNOWN_FILE_EXTENSION on a
// `.ts` import. Making the API's only validation depend on which Node minor the
// admin happens to run is a much worse trade than one mirrored file: the failure
// mode is the server booting fine everywhere the author tested and refusing to
// start on someone else's box.
//
// The repository already does this deliberately twice — `server/images/zip.js` is
// a port of `src/lib/zip.ts`, and `server/muse/quality/audit-questions.js` mirrors
// the family ids in `src/lib/audit/rules.ts`. Both are kept honest the same way
// this one is: `timeline.test.js` imports the TypeScript original (vitest resolves
// `.ts`, unlike `node`) and requires the two to agree on a corpus of documents. A
// bound loosened on one side alone fails the suite instead of quietly accepting
// on the server what the browser refuses — or, far worse, the reverse.
import { z } from 'zod'

export const VIDEO_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product']

export const TEMPLATE_LIMITS = {
  slideshow: { maxScenes: 20, minSceneMs: 1000, maxSceneMs: 15000 },
  overlay: { maxScenes: 10, minSceneMs: 1500, maxSceneMs: 15000 },
  vertical: { maxScenes: 12, minSceneMs: 1000, maxSceneMs: 8000 },
  titles: { maxScenes: 8, minSceneMs: 1500, maxSceneMs: 10000 },
  product: { maxScenes: 6, minSceneMs: 3000, maxSceneMs: 15000 },
}

export const MAX_SCENES = TEMPLATE_LIMITS.slideshow.maxScenes
export const MIN_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.minSceneMs
export const MAX_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.maxSceneMs
export const MAX_TOTAL_DURATION_MS = 120000

export const TEXT_LIMITS = {
  overlay: 120,
  bandTitle: 60,
  bandSubtitle: 90,
  titleHeadline: 70,
  titleSubtitle: 120,
  productHeadline: 70,
  productBullet: 60,
  productBullets: 3,
  productCta: 30,
}

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']

/**
 * The camera move a scene gets when the document does not name one, per template.
 * `static` is still in the enum and is now something a document has to ASK for —
 * see the long note in timeline.ts for the film that made silence stop meaning
 * "hold the frame".
 */
export const DEFAULT_KEN_BURNS = {
  slideshow: 'zoom-in',
  vertical: 'zoom-in',
}

/** How an `overlay` scene moves without cropping the capture. See timeline.ts. */
export const OVERLAY_MOVES = ['drift-up', 'drift-down', 'settle']
export const DEFAULT_OVERLAY_MOVE = 'drift-up'

export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none']
export const OVERLAY_POSITIONS = ['top', 'center', 'bottom']
export const BAND_POSITIONS = ['top', 'bottom']
export const TITLE_ANIMATIONS = ['fade', 'rise', 'stagger']
export const OUTPUT_FORMATS = ['mp4', 'webm']
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1']

const IMAGE_ID = /^[0-9a-f]{64}$/
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const FONT_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,47}$/u

export const ThemeColorSchema = z.string().regex(HEX_COLOR, 'a colour must be a hex value such as #1a1a1a')
export const ThemeFontSchema = z
  .string()
  .regex(FONT_FAMILY, 'a font must be one family name — letters, digits, spaces and hyphens, no CSS')

const hex = ThemeColorSchema
const fontFamily = ThemeFontSchema

export const VideoThemeSchema = z
  .object({
    colors: z
      .object({
        background: hex.optional(),
        text: hex.optional(),
        accent: hex.optional(),
        surface: hex.optional(),
      })
      .strict()
      .optional(),
    fonts: z
      .object({
        heading: fontFamily.optional(),
        body: fontFamily.optional(),
      })
      .strict()
      .optional(),
    radiusPx: z.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .refine(
    (theme) =>
      Boolean(
        theme.radiusPx !== undefined ||
          (theme.colors && Object.values(theme.colors).some((v) => v !== undefined)) ||
          (theme.fonts && Object.values(theme.fonts).some((v) => v !== undefined)),
      ),
    { message: 'A theme must state at least one token. Omit it entirely when the project has no direction.' },
  )

/**
 * A line of text somebody will actually read. See the long note in timeline.ts:
 * `min(1)` counts characters, so `" "` passes it, and the worker's `readText`
 * refuses exactly that — a document Mocky queued and the renderer then threw
 * back after the user had waited for it.
 */
const NOT_BLANK = /\S/
const line = (max) => z.string().min(1).max(max).regex(NOT_BLANK, 'a line of text cannot be blank')

export const TextOverlaySchema = z
  .object({
    content: line(TEXT_LIMITS.overlay),
    position: z.enum(OVERLAY_POSITIONS),
  })
  .strict()

const imageId = z
  .string()
  .regex(IMAGE_ID, 'imageId must be a 64-character lower-case SHA-256 from the image library, not a URL')

const duration = (limits) => z.number().int().min(limits.minSceneMs).max(limits.maxSceneMs)

export const SlideshowSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.slideshow),
    kenBurns: z.enum(KEN_BURNS).default(DEFAULT_KEN_BURNS.slideshow),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

export const OverlaySceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.overlay),
    move: z.enum(OVERLAY_MOVES).default(DEFAULT_OVERLAY_MOVE),
    band: z
      .object({
        title: line(TEXT_LIMITS.bandTitle),
        subtitle: line(TEXT_LIMITS.bandSubtitle).nullable().default(null),
        position: z.enum(BAND_POSITIONS).default('bottom'),
      })
      .strict(),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

export const VerticalSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.vertical),
    kenBurns: z.enum(KEN_BURNS).default(DEFAULT_KEN_BURNS.vertical),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

export const TitleSceneSchema = z
  .object({
    headline: line(TEXT_LIMITS.titleHeadline),
    subtitle: line(TEXT_LIMITS.titleSubtitle).nullable().default(null),
    durationMs: duration(TEMPLATE_LIMITS.titles),
    animation: z.enum(TITLE_ANIMATIONS).default('fade'),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

export const ProductSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.product),
    headline: line(TEXT_LIMITS.productHeadline),
    bullets: z.array(line(TEXT_LIMITS.productBullet)).min(1).max(TEXT_LIMITS.productBullets),
    cta: line(TEXT_LIMITS.productCta).nullable().default(null),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

const OUTPUT_SHAPE = {
  outputFormat: z.enum(OUTPUT_FORMATS).default('mp4'),
  aspectRatio: z.enum(ASPECT_RATIOS).default('16:9'),
}

export const SlideshowTimelineSchema = z
  .object({
    template: z.literal('slideshow'),
    scenes: z.array(SlideshowSceneSchema).min(1).max(TEMPLATE_LIMITS.slideshow.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

export const OverlayTimelineSchema = z
  .object({
    template: z.literal('overlay'),
    scenes: z.array(OverlaySceneSchema).min(1).max(TEMPLATE_LIMITS.overlay.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

export const VerticalTimelineSchema = z
  .object({
    template: z.literal('vertical'),
    scenes: z.array(VerticalSceneSchema).min(1).max(TEMPLATE_LIMITS.vertical.maxScenes),
    outputFormat: OUTPUT_SHAPE.outputFormat,
    aspectRatio: z.literal('9:16').default('9:16'),
  })
  .strict()

export const TitlesTimelineSchema = z
  .object({
    template: z.literal('titles'),
    scenes: z.array(TitleSceneSchema).min(1).max(TEMPLATE_LIMITS.titles.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

export const ProductTimelineSchema = z
  .object({
    template: z.literal('product'),
    scenes: z.array(ProductSceneSchema).min(1).max(TEMPLATE_LIMITS.product.maxScenes),
    ...OUTPUT_SHAPE,
  })
  .strict()

/** A document with no `template` is a slideshow. See the note in timeline.ts. */
const withDefaultTemplate = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return value.template === undefined ? { ...value, template: 'slideshow' } : value
}

const refuseOverBudget = (timeline, ctx) => {
  const total = totalDurationMs(timeline)
  if (total > MAX_TOTAL_DURATION_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scenes'],
      message:
        `Total duration is ${total} ms; the maximum is ${MAX_TOTAL_DURATION_MS} ms ` +
        `(${MAX_TOTAL_DURATION_MS / 1000} seconds). Shorten or remove scenes.`,
    })
  }
}

export const VideoTimelineSchema = z
  .preprocess(
    withDefaultTemplate,
    z.discriminatedUnion('template', [
      SlideshowTimelineSchema,
      OverlayTimelineSchema,
      VerticalTimelineSchema,
      TitlesTimelineSchema,
      ProductTimelineSchema,
    ]),
  )
  .superRefine(refuseOverBudget)

const THEME_SHAPE = { theme: VideoThemeSchema.optional() }

export const RenderTimelineSchema = z
  .preprocess(
    withDefaultTemplate,
    z.discriminatedUnion('template', [
      SlideshowTimelineSchema.extend(THEME_SHAPE),
      OverlayTimelineSchema.extend(THEME_SHAPE),
      VerticalTimelineSchema.extend(THEME_SHAPE),
      TitlesTimelineSchema.extend(THEME_SHAPE),
      ProductTimelineSchema.extend(THEME_SHAPE),
    ]),
  )
  .superRefine(refuseOverBudget)

/** Sum of the scene durations, in ms. The render budget. */
export function totalDurationMs(timeline) {
  return (timeline?.scenes || []).reduce((sum, scene) => sum + scene.durationMs, 0)
}

/**
 * Every library image a timeline needs, deduplicated, in first-use order.
 *
 * The `titles` template has no images at all, so the old `scenes.map((s) =>
 * s.imageId)` would hand its callers `[undefined]` — and both of them (the
 * existence check in `/render`, `collectImages` in the worker client) would go
 * looking for a file named after nothing and report the wrong failure for it.
 */
export function timelineImageIds(timeline) {
  const ids = []
  for (const scene of timeline?.scenes || []) {
    if (typeof scene?.imageId === 'string' && !ids.includes(scene.imageId)) ids.push(scene.imageId)
  }
  return ids
}

/**
 * The theme the SERVER attaches, never the model.
 *
 * Degrades rather than refuses (Q1): a direction that cannot be read is a film
 * rendered in the compositions' own colours, not a lost export. The user waited
 * in a queue for this; losing it over a decoration would be the wrong trade, and
 * the notice says what was dropped so nothing is silent.
 *
 * All or nothing, though. A theme with one field quietly removed is a repair —
 * the thing this feature refuses everywhere else — and it would render a film
 * in the project's colours with somebody else's typeface, which is worse than
 * rendering it in the template's own. The builder that writes these
 * (`src/lib/video/theme.ts`) omits what it cannot express, so a refusal here
 * means a caller that is not Mocky.
 *
 * @param {object} timeline  a document already accepted by VideoTimelineSchema
 * @param {unknown} theme    whatever the caller offered as a theme, or null
 * @returns {{timeline: object, notice: string|null}}
 */
export function attachTheme(timeline, theme) {
  if (theme === undefined || theme === null) return { timeline, notice: null }

  const parsed = VideoThemeSchema.safeParse(theme)
  if (!parsed.success) {
    // The schema's own sentences already end in a full stop about half the time,
    // and two of them in a row reads as a typo in the one message the user gets.
    const why = (readableIssues(parsed.error)[0]?.message || 'the theme was refused').replace(/\s*\.\s*$/, '')
    return {
      timeline,
      notice: `The project's art direction was not applied to this film: ${why}. It was rendered with the template's own colours.`,
    }
  }

  // Re-validated whole rather than spread and trusted: `RenderTimelineSchema` is
  // what the worker's contract is written against, and building the document
  // that goes to it without ever running it through its own schema is how a key
  // nobody renders gets in on this side of the wire.
  const merged = RenderTimelineSchema.safeParse({ ...timeline, theme: parsed.data })
  if (!merged.success) return { timeline, notice: "The project's art direction could not be attached to this film." }
  return { timeline: merged.data, notice: null }
}

/**
 * A zod error as something a person can act on.
 *
 * `error.message` is a JSON dump of the whole issue tree, which in a 400 body
 * reads as a stack trace and sends the caller to the wrong field. What the
 * caller needs is the path and the sentence, and the schema already writes the
 * sentences — see the imageId message, which names the two mistakes anyone
 * actually makes (a URL, or upper-case hex).
 */
export function readableIssues(error) {
  return (error?.issues || []).map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}
