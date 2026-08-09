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

export const VIDEO_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product', 'composed']

/**
 * The five a person can fill in by hand. `composed` is not one of them — see the
 * note in timeline.ts. The compose catalogue and the panel are keyed on this
 * list; the schema and the worker on the one above.
 */
export const EDITABLE_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product']

export const TEMPLATE_LIMITS = {
  slideshow: { maxScenes: 20, minSceneMs: 1000, maxSceneMs: 15000 },
  overlay: { maxScenes: 10, minSceneMs: 1500, maxSceneMs: 15000 },
  vertical: { maxScenes: 12, minSceneMs: 1000, maxSceneMs: 8000 },
  titles: { maxScenes: 8, minSceneMs: 1500, maxSceneMs: 10000 },
  product: { maxScenes: 6, minSceneMs: 3000, maxSceneMs: 15000 },
  composed: { maxScenes: 12, minSceneMs: 1500, maxSceneMs: 15000 },
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

/** Every bound the composable variant applies. The reasoning is in timeline.ts. */
export const BLOCK_LIMITS = {
  layersPerScene: 8,

  heading: 70,
  kicker: 40,
  quote: 180,
  attribution: 40,
  highlight: 90,
  highlightMark: 40,
  typewriter: 120,
  listItem: 60,
  listItems: 6,
  counterTo: 1000000,
  counterAffix: 8,
  counterLabel: 40,
  logoType: 24,
  buttonLabel: 30,
  formTitle: 40,
  formField: 30,
  formFields: 4,
  formSubmit: 24,
  noticeTitle: 40,
  noticeBody: 90,
  lowerTitle: 50,
  lowerSubtitle: 70,
  barValuesMin: 2,
  barValues: 8,
  barLabel: 12,
  lineValuesMin: 2,
  lineValues: 12,
  lineLabel: 24,
  equalizerBarsMin: 4,
  equalizerBars: 24,
  waveSamplesMin: 24,
  waveSamples: 96,
  mapMarkers: 8,
  caption: 70,
  galleryImagesMin: 2,
  galleryImages: 6,
  carouselImagesMin: 2,
  carouselImages: 8,
  clockLabel: 24,
  dateStamp: 30,
  progressLabel: 24,
  gridCellsMin: 4,
  gridCells: 16,
  particleDensity: 3,

  funTitle: 40,
  codeLinesMin: 2,
  codeLines: 10,
  codeLine: 64,
  codeCaption: 30,
}

/** Where a block sits: a zone of the frame, never a coordinate. See timeline.ts. */
export const ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'full',
]

/** The block catalogue, by family. The compose prompt reads this map. */
export const BLOCK_FAMILIES = {
  text: ['heading', 'kicker', 'quote', 'textHighlight', 'funTitle'],
  animatedText: ['typewriter', 'animatedList', 'counter', 'logoType'],
  interface: ['button', 'form', 'notification', 'lowerThird'],
  data: ['barChart', 'lineChart', 'equalizer', 'soundWave', 'map'],
  media: ['imageFrame', 'gallery', 'carousel', 'clock', 'dateStamp'],
  misc: ['separator', 'progressBar'],
  /** The two blocks that cost a scene rather than a corner of one. See timeline.ts. */
  setPiece: ['codeBlock', 'solidScene'],
}

/** Every block kind, flattened. The discriminator of the layer union. */
export const BLOCK_KINDS = [
  ...BLOCK_FAMILIES.text,
  ...BLOCK_FAMILIES.animatedText,
  ...BLOCK_FAMILIES.interface,
  ...BLOCK_FAMILIES.data,
  ...BLOCK_FAMILIES.media,
  ...BLOCK_FAMILIES.misc,
  ...BLOCK_FAMILIES.setPiece,
]

/** How a `funTitle` treats its line. Five looks; Skia was measured and refused. See timeline.ts. */
export const FUN_TITLE_TREATMENTS = ['arc', 'bounce', 'stretch', 'swap', 'stack']

/** What a `solidScene` draws. Four solids, and no wireframe: it was measured. See timeline.ts. */
export const SOLIDS = ['cube', 'prism', 'sphere', 'torus']

/** How a `solidScene` turns. A named move, never an axis and never an angle. */
export const SPINS = ['tumble', 'turn', 'rock']

/** What a `codeBlock` line is for. Three measured runs, so three roles. See timeline.ts. */
export const CODE_ROLES = ['plain', 'accent', 'muted']

export const BACKGROUND_KINDS = ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles', 'image']
export const GRADIENT_DIRECTIONS = ['to-bottom', 'to-right', 'diagonal', 'radial']

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

/** The four above plus a mosaic dissolve, for `composed` alone. See timeline.ts. */
export const COMPOSED_TRANSITIONS = [...TRANSITIONS, 'pixel']

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

// ── The composable variant ───────────────────────────────────────────────────
//
// One union discriminated on `kind`, plus the ground it is painted on. The
// reasoning — why a block never names a colour, why `anchor` is a zone and
// `enter` a rank, why the default ground is the one that holds still — is in
// `src/lib/video/timeline.ts` and is not repeated here.

const bounded = (min, max) => z.number().int().min(min).max(max)

const placement = {
  anchor: z.enum(ANCHORS).default('center'),
  enter: bounded(0, BLOCK_LIMITS.layersPerScene - 1).optional(),
}

const block = (kind, shape) => z.object({ kind: z.literal(kind), ...placement, ...shape }).strict()

export const HeadingBlockSchema = block('heading', {
  text: line(BLOCK_LIMITS.heading),
  level: z.enum(['display', 'title', 'subtitle']).default('title'),
})

export const KickerBlockSchema = block('kicker', {
  text: line(BLOCK_LIMITS.kicker),
})

export const QuoteBlockSchema = block('quote', {
  text: line(BLOCK_LIMITS.quote),
  attribution: line(BLOCK_LIMITS.attribution).nullable().default(null),
})

export const TextHighlightBlockSchema = block('textHighlight', {
  text: line(BLOCK_LIMITS.highlight),
  mark: line(BLOCK_LIMITS.highlightMark).nullable().default(null),
  treatment: z.enum(['marker', 'underline', 'box']).default('marker'),
})

export const FunTitleBlockSchema = block('funTitle', {
  text: line(BLOCK_LIMITS.funTitle),
  treatment: z.enum(FUN_TITLE_TREATMENTS).default('bounce'),
})

export const TypewriterBlockSchema = block('typewriter', {
  text: line(BLOCK_LIMITS.typewriter),
  caret: z.boolean().default(true),
})

export const AnimatedListBlockSchema = block('animatedList', {
  items: z.array(line(BLOCK_LIMITS.listItem)).min(1).max(BLOCK_LIMITS.listItems),
  marker: z.enum(['numeral', 'rule', 'dot']).default('numeral'),
})

export const CounterBlockSchema = block('counter', {
  to: bounded(0, BLOCK_LIMITS.counterTo),
  from: bounded(0, BLOCK_LIMITS.counterTo).default(0),
  prefix: line(BLOCK_LIMITS.counterAffix).nullable().default(null),
  suffix: line(BLOCK_LIMITS.counterAffix).nullable().default(null),
  label: line(BLOCK_LIMITS.counterLabel).nullable().default(null),
})

export const LogoTypeBlockSchema = block('logoType', {
  text: line(BLOCK_LIMITS.logoType),
  mark: z.enum(['none', 'square', 'circle', 'slash']).default('square'),
})

export const ButtonBlockSchema = block('button', {
  label: line(BLOCK_LIMITS.buttonLabel),
  variant: z.enum(['filled', 'outline']).default('filled'),
  press: z.boolean().default(true),
})

export const FormBlockSchema = block('form', {
  title: line(BLOCK_LIMITS.formTitle).nullable().default(null),
  fields: z.array(line(BLOCK_LIMITS.formField)).min(1).max(BLOCK_LIMITS.formFields),
  submit: line(BLOCK_LIMITS.formSubmit).nullable().default(null),
})

export const NotificationBlockSchema = block('notification', {
  title: line(BLOCK_LIMITS.noticeTitle),
  body: line(BLOCK_LIMITS.noticeBody).nullable().default(null),
  mark: z.enum(['none', 'dot', 'check', 'bell']).default('dot'),
})

export const LowerThirdBlockSchema = block('lowerThird', {
  title: line(BLOCK_LIMITS.lowerTitle),
  subtitle: line(BLOCK_LIMITS.lowerSubtitle).nullable().default(null),
  side: z.enum(['left', 'right']).default('left'),
})

export const BarChartBlockSchema = block('barChart', {
  values: z.array(bounded(0, 100)).min(BLOCK_LIMITS.barValuesMin).max(BLOCK_LIMITS.barValues),
  labels: z.array(line(BLOCK_LIMITS.barLabel)).max(BLOCK_LIMITS.barValues).nullable().default(null),
  baseline: z.boolean().default(true),
})

export const LineChartBlockSchema = block('lineChart', {
  values: z.array(bounded(0, 100)).min(BLOCK_LIMITS.lineValuesMin).max(BLOCK_LIMITS.lineValues),
  label: line(BLOCK_LIMITS.lineLabel).nullable().default(null),
  area: z.boolean().default(true),
})

export const EqualizerBlockSchema = block('equalizer', {
  bars: bounded(BLOCK_LIMITS.equalizerBarsMin, BLOCK_LIMITS.equalizerBars).default(12),
  tempo: z.enum(['slow', 'steady', 'fast']).default('steady'),
})

export const SoundWaveBlockSchema = block('soundWave', {
  samples: bounded(BLOCK_LIMITS.waveSamplesMin, BLOCK_LIMITS.waveSamples).default(48),
  shape: z.enum(['pulse', 'sweep', 'breathe']).default('sweep'),
})

export const MapBlockSchema = block('map', {
  region: z.enum(['world', 'europe', 'americas', 'asia', 'africa']).default('world'),
  markers: bounded(0, BLOCK_LIMITS.mapMarkers).default(3),
  connections: z.boolean().default(true),
})

export const ImageFrameBlockSchema = block('imageFrame', {
  imageId,
  move: z.enum(KEN_BURNS).default('zoom-in'),
  treatment: z.enum(['bleed', 'inset', 'card']).default('card'),
  caption: line(BLOCK_LIMITS.caption).nullable().default(null),
})

export const GalleryBlockSchema = block('gallery', {
  imageIds: z.array(imageId).min(BLOCK_LIMITS.galleryImagesMin).max(BLOCK_LIMITS.galleryImages),
  layout: z.enum(['grid', 'row', 'stack']).default('grid'),
})

export const CarouselBlockSchema = block('carousel', {
  imageIds: z.array(imageId).min(BLOCK_LIMITS.carouselImagesMin).max(BLOCK_LIMITS.carouselImages),
  direction: z.enum(['left', 'right']).default('left'),
})

export const ClockBlockSchema = block('clock', {
  face: z.enum(['analog', 'digital']).default('analog'),
  time: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'time must read HH:MM on a 24-hour clock, such as 09:30')
    .nullable()
    .default(null),
  sweep: z.enum(['real', 'fast']).default('fast'),
  label: line(BLOCK_LIMITS.clockLabel).nullable().default(null),
})

export const DateStampBlockSchema = block('dateStamp', {
  text: line(BLOCK_LIMITS.dateStamp),
  treatment: z.enum(['plain', 'boxed', 'rule']).default('rule'),
})

export const SeparatorBlockSchema = block('separator', {
  treatment: z.enum(['rule', 'double', 'dots']).default('rule'),
  extent: z.enum(['short', 'measure', 'full']).default('measure'),
})

export const ProgressBarBlockSchema = block('progressBar', {
  to: bounded(0, 100),
  label: line(BLOCK_LIMITS.progressLabel).nullable().default(null),
  showValue: z.boolean().default(true),
})

export const CodeBlockSchema = block('codeBlock', {
  lines: z
    .array(
      z
        .object({
          text: line(BLOCK_LIMITS.codeLine),
          role: z.enum(CODE_ROLES).default('plain'),
        })
        .strict(),
    )
    .min(BLOCK_LIMITS.codeLinesMin)
    .max(BLOCK_LIMITS.codeLines),
  caption: line(BLOCK_LIMITS.codeCaption).nullable().default(null),
  reveal: z.enum(['type', 'lines']).default('lines'),
})

export const SolidSceneBlockSchema = block('solidScene', {
  solid: z.enum(SOLIDS).default('cube'),
  spin: z.enum(SPINS).default('tumble'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
})

export const BlockSchema = z.discriminatedUnion('kind', [
  HeadingBlockSchema,
  KickerBlockSchema,
  QuoteBlockSchema,
  TextHighlightBlockSchema,
  FunTitleBlockSchema,
  TypewriterBlockSchema,
  AnimatedListBlockSchema,
  CounterBlockSchema,
  LogoTypeBlockSchema,
  ButtonBlockSchema,
  FormBlockSchema,
  NotificationBlockSchema,
  LowerThirdBlockSchema,
  BarChartBlockSchema,
  LineChartBlockSchema,
  EqualizerBlockSchema,
  SoundWaveBlockSchema,
  MapBlockSchema,
  ImageFrameBlockSchema,
  GalleryBlockSchema,
  CarouselBlockSchema,
  ClockBlockSchema,
  DateStampBlockSchema,
  SeparatorBlockSchema,
  ProgressBarBlockSchema,
  CodeBlockSchema,
  SolidSceneBlockSchema,
])

const bg = (kind, shape) => z.object({ kind: z.literal(kind), ...shape }).strict()

export const SolidBackgroundSchema = bg('solid', {})
export const HairlinesBackgroundSchema = bg('hairlines', {})
export const GradientBackgroundSchema = bg('gradient', {
  direction: z.enum(GRADIENT_DIRECTIONS).default('to-bottom'),
})
export const GridPulseBackgroundSchema = bg('gridPulse', {
  cells: bounded(BLOCK_LIMITS.gridCellsMin, BLOCK_LIMITS.gridCells).default(8),
})
export const ParticlesBackgroundSchema = bg('particles', {
  density: bounded(1, BLOCK_LIMITS.particleDensity).default(2),
})
export const ImageBackgroundSchema = bg('image', {
  imageId,
  move: z.enum(KEN_BURNS).default('zoom-in'),
})

export const BackgroundSchema = z.discriminatedUnion('kind', [
  SolidBackgroundSchema,
  GradientBackgroundSchema,
  HairlinesBackgroundSchema,
  GridPulseBackgroundSchema,
  ParticlesBackgroundSchema,
  ImageBackgroundSchema,
])

export const ComposedSceneSchema = z
  .object({
    durationMs: duration(TEMPLATE_LIMITS.composed),
    background: BackgroundSchema.default({ kind: 'hairlines' }),
    layers: z.array(BlockSchema).min(1).max(BLOCK_LIMITS.layersPerScene),
    transitionOut: z.enum(COMPOSED_TRANSITIONS).default('crossfade'),
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

export const ComposedTimelineSchema = z
  .object({
    template: z.literal('composed'),
    scenes: z.array(ComposedSceneSchema).min(1).max(TEMPLATE_LIMITS.composed.maxScenes),
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
      ComposedTimelineSchema,
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
      ComposedTimelineSchema.extend(THEME_SHAPE),
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
  const push = (value) => {
    if (typeof value === 'string' && value && !ids.includes(value)) ids.push(value)
  }
  for (const scene of timeline?.scenes || []) {
    push(scene?.imageId)
    // A composed scene keeps its pictures on the ground and on its blocks, never
    // on the scene — and a gallery holds six. See the note in timeline.ts.
    if (scene?.background?.kind === 'image') push(scene.background.imageId)
    for (const layer of scene?.layers || []) {
      push(layer?.imageId)
      for (const id of layer?.imageIds || []) push(id)
    }
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
