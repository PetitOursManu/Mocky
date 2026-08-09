// The video-export data contract, shared by the browser, the server queue and
// the Remotion worker.
//
// The founding rule of the feature is that the model NEVER writes Remotion
// code: it writes one JSON object, validated here, and hand-written
// compositions consume it. Everything below follows from that. This schema is
// the entire surface the model is allowed to reach, so anything it can express
// has to be something a composition already knows how to render — and anything
// it cannot express is unreachable, not merely discouraged.
//
// ── Why this is a catalogue and not one shape ────────────────────────────────
//
// Five templates, discriminated on `template`, each with its own scene kind and
// its own bounds. That is what buys variety WITHOUT reopening the founding
// rule: every new look is a composition somebody wrote and a reviewer read, not
// a string the model got to turn into code. A sixth template is a normal pull
// request; it is never a field that lets a document describe its own rendering.
//
// The corollary runs through every string below: nothing here becomes JSX, a
// CSS rule, a file name or a URL. `imageId` is a library address, colours are
// hex, a font is a bare family name, and there is no `src`, no `className`, no
// `style`.
import { z } from 'zod'

/** The catalogue. Order is the order the panel lists them in. */
export const VIDEO_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product'] as const

/**
 * Scene count and per-scene duration, per template.
 *
 * Exported as one table because the UI and the compose prompt both quote it,
 * and because a per-template bound typed a second time somewhere else is a
 * disagreement waiting to happen — the half that loses is always the one that
 * accepts, which then fails at the schema with a number nobody printed.
 *
 * The numbers differ on purpose. A slideshow beat can be one second because the
 * eye only has a picture to take in; a banded screenshot has a sentence on it
 * and 1000 ms is not a reading, it is a flash. A product card has a headline,
 * three arguments and a call to action, so its floor is three seconds — under
 * that the template renders text nobody can finish.
 */
export const TEMPLATE_LIMITS = {
  slideshow: { maxScenes: 20, minSceneMs: 1000, maxSceneMs: 15000 },
  overlay: { maxScenes: 10, minSceneMs: 1500, maxSceneMs: 15000 },
  vertical: { maxScenes: 12, minSceneMs: 1000, maxSceneMs: 8000 },
  titles: { maxScenes: 8, minSceneMs: 1500, maxSceneMs: 10000 },
  product: { maxScenes: 6, minSceneMs: 3000, maxSceneMs: 15000 },
} as const

/**
 * The slideshow's bounds, under the names they had before the catalogue existed.
 *
 * `MAX_SCENES` is still load-bearing and is not really a slideshow bound at all:
 * it is the WIDEST cap in the catalogue, which is what `/status` publishes, what
 * `compose.js` refuses an oversized selection against, and what the panel offers
 * while no composition has been chosen. The two duration aliases are now quoted
 * by nothing but the mirrors and their tests — the editor asks
 * `TEMPLATE_LIMITS` for the window of the composition it is editing, because a
 * vertical beat stops at 8 s where a slideshow beat runs to 15.
 *
 * Aliases rather than copies, so a slideshow bound revised in the table above
 * cannot leave a stale twin behind.
 */
export const MAX_SCENES = TEMPLATE_LIMITS.slideshow.maxScenes
export const MIN_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.minSceneMs
export const MAX_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.maxSceneMs

/**
 * The whole-timeline ceiling, and the reason the refinement at the bottom
 * exists: 20 scenes × 15 s is 300 s, so the per-scene bounds alone permit a
 * five-minute render. A render is minutes of CPU on a worker nobody is
 * watching, which is exactly the kind of cost that should be refused at
 * validation rather than discovered at the end of the queue.
 *
 * It applies to EVERY template, and it is written once, on the union, for that
 * reason. Per-variant ceilings would be five numbers to keep under the queue's
 * single deadline, and the fifth one would be the one that got it wrong.
 */
export const MAX_TOTAL_DURATION_MS = 120000

/**
 * How long the browser should expect a render of `totalDurationMs` to take.
 *
 * The THIRD copy of this arithmetic — `server/video/queue.js` and
 * `worker/video/server.js` carry the other two — and the reason is the same one
 * that makes `VideoTimelineSchema` a hand-kept mirror: a bundle cannot import
 * the server's `.js`, and `worker/` is excluded from Mocky's Docker build
 * context so that Remotion's licence stays out of the default image.
 * `tests/video-render-budget.test.js` holds all three to the same answer.
 *
 * The panel needs it because the poll deadline used to be
 * `MAX_TOTAL_DURATION_MS`, and that conflated two different quantities that
 * happened to both be 120 s: how long a film may BE, and how long rendering it
 * may TAKE. Rendering 1080p in a headless browser costs about four times real
 * time, so the two have now separated — and a panel still using the old number
 * would tell a user their sixty-second film had timed out while the worker was
 * calmly halfway through it.
 */
export const JOB_BUDGET_BASE_MS = 45_000
export const JOB_BUDGET_PER_FILM_MS = 6
export const JOB_TIMEOUT_MS = 120_000

export function jobBudgetMs(totalDurationMs: number): number {
  const film = Math.max(0, Number(totalDurationMs) || 0)
  return Math.max(JOB_TIMEOUT_MS, JOB_BUDGET_BASE_MS + film * JOB_BUDGET_PER_FILM_MS)
}

/**
 * Every text bound in the catalogue, in one place, for the reason
 * `TEMPLATE_LIMITS` is: the compose prompt states them and the panel counts
 * against them.
 *
 * These are legibility limits, not storage ones. Text in a film is burnt into
 * the frame at a size the composition fixes, so a headline that does not fit is
 * not a smaller headline — it is a line that runs off the edge, or a block that
 * covers the picture underneath it.
 */
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
} as const

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static'] as const

/**
 * The camera move a scene gets when the document does not name one, per template.
 *
 * It used to be `static` on `slideshow`, and that one word is the whole of a
 * defect a user reported in four sentences: a model that omits an optional field
 * — which is what a model does with an optional field — got a photograph nailed
 * to the frame with a caption laid on it, for fifteen seconds, and said of the
 * result that it was not a film. It was right. Nothing in the document asked for
 * a freeze; the freeze was what silence meant.
 *
 * `static` stays IN the enum, and that is not a compromise. A capture of an
 * interface has real reasons to hold still, and an enum value removed is every
 * saved draft and every entry in the queue's journal that names it refused at
 * validation. What changed is which case you get by saying nothing: immobility is
 * now something a document ASKS for, and movement is what it gets by default.
 *
 * `zoom-in` on both, and the reason is the library rather than taste. A pan is
 * only a camera move on a picture wider than its frame; the image library mixes
 * portrait and landscape freely, and `cover` has already cropped a portrait still
 * inside a landscape frame, so a pan there slides the crop instead of revealing
 * anything. A zoom is the same move on every aspect ratio and every subject, and
 * it is the one that cannot drag the background in behind the picture.
 *
 * A table rather than two literals because `draft.ts` reads the defaults back off
 * these schemas — the panel has to open a new scene on the move the schema would
 * have applied, or a hand-built timeline and a model-written one naming the same
 * pictures render two different films.
 */
export const DEFAULT_KEN_BURNS = {
  slideshow: 'zoom-in',
  vertical: 'zoom-in',
} as const

/**
 * How an `overlay` scene moves — the one template whose picture must survive the
 * move intact.
 *
 * This template has no `kenBurns` and never will: a pan across a capture of an
 * interface slides half the interface out of frame and a zoom crops it, and the
 * reason to show a screenshot is that it can be read. That was taken to mean the
 * scene simply did not move, which is how the template of the reported film came
 * to be a still photograph with a band of text on it.
 *
 * The distinction the old reading missed is AMPLITUDE, not direction. A pan is
 * refused because it spends 4% of travel on a 12% overscale — an eighth of the
 * capture cropped, and a twentieth of it sliding past. A drift spends 1.2% on 3%:
 * the picture is a fortieth larger than the frame, the travel stays inside the
 * margin that leaves, and every pixel visible at rest is visible on every frame.
 * One is a camera move over a screenshot; the other is the smallest amount of
 * life that keeps a held frame from reading as a stalled render.
 *
 * There is no `still` here, deliberately, and it is the one place this file does
 * not offer the calm option: `static` exists on the other two templates because a
 * pan and a zoom really can destroy a capture and a document must be able to
 * refuse them. A drift destroys nothing, so immobility here would buy the defect
 * back and pay nothing for it.
 */
export const OVERLAY_MOVES = ['drift-up', 'drift-down', 'settle'] as const

/**
 * `drift-up`, so that a film composed before this field existed renders exactly
 * as it did: the drift was already unconditional in `OverlayBandVideo`, always in
 * that direction. The field turned one hard-coded move into a choice; it did not
 * change what anybody's saved timeline looks like.
 */
export const DEFAULT_OVERLAY_MOVE = 'drift-up'

export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none'] as const
export const OVERLAY_POSITIONS = ['top', 'center', 'bottom'] as const
/**
 * A band sits above or below the screenshot's content, never across it: the
 * whole point of that template is that the capture stays readable, and `center`
 * is exactly where the thing being shown lives.
 */
export const BAND_POSITIONS = ['top', 'bottom'] as const
export const TITLE_ANIMATIONS = ['fade', 'rise', 'stagger'] as const
export const OUTPUT_FORMATS = ['mp4', 'webm'] as const
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const

/** The image-library address: a SHA-256, lower-case, exactly as `digest('hex')` writes it. */
const IMAGE_ID = /^[0-9a-f]{64}$/

/**
 * A colour, and the one place in this file where letter case is tolerated.
 *
 * `imageId` is lower-case only because it is a PATH — two spellings of one hash
 * are two names for one file on a case-sensitive volume. A hex colour addresses
 * nothing: `#F6F4EE` and `#f6f4ee` are the same paint, and design documents are
 * written by people and by models who upper-case as often as not. Refusing the
 * capital would drop a stated token and hand the composition its own default
 * instead, which is the exact failure the theme exists to avoid.
 *
 * Three-digit hex is allowed because `parseColors` reads it out of documents.
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * ONE font family name — never a CSS font stack, and never anything that could
 * close a declaration.
 *
 * A colour cannot escape its own syntax; a font name can. This value ends up in
 * a `font-family`, and a comma, a quote, a semicolon or a brace there is the
 * difference between naming a typeface and writing CSS. So the charset is
 * letters, digits, spaces and hyphens, and the composition appends its own
 * fallback stack — which it has to do anyway, because nothing in Mocky loads a
 * webfont and the renderer may simply not have the face.
 */
const FONT_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,47}$/u

/**
 * Exported so `theme.ts` can ask whether a token is expressible instead of
 * retyping these two regexes — the same discipline `draft.ts` uses to read the
 * overlay length off the schema. It matters more here than there: the builder
 * drops what it cannot express, and a copy of the rule that drifted would emit
 * a theme the server then refuses whole.
 */
export const ThemeColorSchema = z.string().regex(HEX_COLOR, 'a colour must be a hex value such as #1a1a1a')
export const ThemeFontSchema = z
  .string()
  .regex(FONT_FAMILY, 'a font must be one family name — letters, digits, spaces and hyphens, no CSS')

const hex = ThemeColorSchema
const fontFamily = ThemeFontSchema

/**
 * The project's art direction, as much of it as a film can carry.
 *
 * **The model never writes this.** It is not in `VideoTimelineSchema` at all, so
 * a `theme` key in a model's answer is refused like any other unknown key; the
 * server attaches it afterwards, to `RenderTimelineSchema`, out of the direction
 * the project already has. That is what makes an export look like the site it
 * came from instead of like a generic template, and it costs zero tokens.
 *
 * **Every field is optional, and an absence is honest.** `parseDesignSpec`
 * distinguishes the tokens a document DECLARED from the ones `parseDesignSystem`
 * invented so that something always renders, and only the declared ones belong
 * here. A guessed accent presented as the project's accent is a false claim the
 * user cannot see through: the film would simply be the wrong colour, with
 * nothing anywhere saying so. When the direction says nothing, the composition
 * uses its own default — which is a choice somebody made, on purpose, once.
 *
 * The refinement refuses `{}` for the same reason. An empty theme block says "a
 * direction was read and it asks for nothing", which is not what "there is no
 * direction" means; the second is spelled by leaving `theme` out.
 */
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
    /**
     * In pixels, and a number rather than a CSS length, so there is no unit to
     * parse and no `calc()` to smuggle. The ceiling is 9999 because that is what
     * `parseRadius` maps `rounded-full` to, and a pill is a real declared choice.
     */
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
 * A line of text somebody will actually read — not merely a non-empty string.
 *
 * `min(1)` counts CHARACTERS, so `" "` satisfies it, and the worker's own
 * `readText` has always refused a string that trims to nothing. Mocky therefore
 * validated a document its renderer refuses, which is the expensive direction of
 * a disagreement between the two: the timeline passes, the job is queued, the
 * user waits out a render, and the refusal arrives at the end of it about a
 * caption they can see on their own screen. The panel already agreed with the
 * worker — `draftBlockers` trims before it calls a required box filled — so this
 * is the schema catching up with both of its neighbours.
 *
 * A `regex` check and not a `refine`, deliberately: a refinement wraps the string
 * in a `ZodEffects`, and `draft.ts` reads
 * `TextOverlaySchema.shape.content.maxLength` off the schema precisely so a
 * `maxLength` attribute cannot drift from the rule. Wrapped, that read answers
 * `undefined` and falls through to a copy of the number — the drift it exists to
 * prevent, arriving silently.
 *
 * Refused, never trimmed. Trimming is a repair, and the caller is a model that
 * can simply be told.
 */
const NOT_BLANK = /\S/
const line = (max: number) => z.string().min(1).max(max).regex(NOT_BLANK, 'a line of text cannot be blank')

export const TextOverlaySchema = z
  .object({
    // 120 characters is a legibility limit, not a storage one: an overlay is
    // burnt into the frame at a fixed size, and a paragraph rendered there is
    // unreadable at any aspect ratio.
    content: line(TEXT_LIMITS.overlay),
    position: z.enum(OVERLAY_POSITIONS),
  })
  .strict()

/**
 * An identifier into Mocky's image library, never a location. M2 forbids
 * storing or displaying a third-party image and M8 makes the content hash the
 * identity of a stored one; accepting a URL here would hand the model a way to
 * pull remote bytes into a file Mocky then hosts as its own.
 *
 * Lower-case only. `data/image-library/{hash}` is a path, so `AB…` and `ab…`
 * would be two names for one file on a case-sensitive volume and one file with
 * two spellings elsewhere — a lookup miss that only reproduces on Linux is not
 * worth the tolerance.
 */
const imageId = z
  .string()
  .regex(IMAGE_ID, 'imageId must be a 64-character lower-case SHA-256 from the image library, not a URL')

/** A whole number of milliseconds, inside one template's own window. */
const duration = (limits: { minSceneMs: number; maxSceneMs: number }) =>
  z.number().int().min(limits.minSceneMs).max(limits.maxSceneMs)

// ── The five scene kinds ─────────────────────────────────────────────────────

export const SlideshowSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.slideshow),
    kenBurns: z.enum(KEN_BURNS).default(DEFAULT_KEN_BURNS.slideshow),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    // Absent and explicitly null mean the same thing — no overlay — because the
    // model writes this object and asking it to spell out `"textOverlay": null`
    // on every silent scene buys nothing but a retry.
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

/**
 * A screenshot with a band of text on it.
 *
 * No `kenBurns`, and that is the template's whole discipline: a pan across a
 * capture of an interface slides half the interface out of frame, and a zoom
 * crops it. The reason to show a screenshot is that it can be read.
 *
 * `move` is what that discipline was missing. "No camera move" was written down
 * as a rule and read as "no movement", and the film that came back was the
 * complaint: a still capture with a title on it. The three moves this field
 * offers are all inside the margin the 3% overscale leaves — see `OVERLAY_MOVES`
 * for the arithmetic that separates them from the pan.
 */
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

/** Full-bleed 9:16, one picture at a time, short beats. */
export const VerticalSceneSchema = z
  .object({
    imageId,
    durationMs: duration(TEMPLATE_LIMITS.vertical),
    kenBurns: z.enum(KEN_BURNS).default(DEFAULT_KEN_BURNS.vertical),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
    textOverlay: TextOverlaySchema.nullable().default(null),
  })
  .strict()

/**
 * Words on the theme's own background. The only scene kind with no `imageId` at
 * all — which is the point of the template, and the reason `timelineImageIds`
 * exists rather than every caller reaching for `scene.imageId`.
 */
export const TitleSceneSchema = z
  .object({
    headline: line(TEXT_LIMITS.titleHeadline),
    subtitle: line(TEXT_LIMITS.titleSubtitle).nullable().default(null),
    durationMs: duration(TEMPLATE_LIMITS.titles),
    animation: z.enum(TITLE_ANIMATIONS).default('fade'),
    transitionOut: z.enum(TRANSITIONS).default('crossfade'),
  })
  .strict()

/**
 * One product: a picture, a line, up to three arguments and a call to action.
 *
 * `bullets` is one to three rather than exactly three. A composition that lays
 * out three lays out two, and demanding the third only teaches the model to pad
 * — a filler argument in somebody's advertisement is worse than a shorter card.
 */
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

// ── The five documents ───────────────────────────────────────────────────────

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
  // `.strict()` here and on every nested object is the load-bearing part. An
  // unknown key is how a field the compositions do not read gets accepted in
  // silence: the model asks for an audio track, or an `src`, validation passes,
  // the render ignores it, and the user is told the export succeeded while
  // watching something it did not ask for. There is no audio, and a schema that
  // strips unknown keys cannot say so.
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
    /*
     * Not an enum with a default: the ratio is the template.
     *
     * A vertical composition lays out safe areas for a phone feed, and asked for
     * 16:9 it would produce a letterboxed rectangle with its captions in the
     * wrong third — a legal document rendering a film nobody described. Making
     * the other two ratios UNREACHABLE here is cheaper than a rule saying not to
     * ask for them, and it is the same trick as having no `fps` field at all.
     */
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

/**
 * A document with no `template` is a slideshow.
 *
 * Not politeness: montages composed before the catalogue existed are sitting in
 * saved drafts and in the queue's journal, and every one of them would start
 * failing validation the day this file shipped. That is a silent regression —
 * the export panel would refuse a timeline the user had built and been shown.
 *
 * This is a DEFAULT, not the repair the schema forbids. `kenBurns` and `move`
 * are filled in exactly the same way. It adds nothing a document did not already
 * say, it can only ever produce the one shape those documents already had, and
 * a document that names a template it does not match is still refused whole.
 */
const withDefaultTemplate = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const doc = value as Record<string, unknown>
  return doc.template === undefined ? { ...doc, template: 'slideshow' } : doc
}

/**
 * The ceiling, applied to the union rather than to each variant.
 *
 * It has to see the whole document — every scene kind carries `durationMs`, and
 * what no per-scene check can see is that legal scenes add up to an illegal
 * film.
 */
const refuseOverBudget = (timeline: { scenes: ReadonlyArray<{ durationMs: number }> }, ctx: z.RefinementCtx) => {
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

/**
 * What a caller — a model, the editor, the API — may hand in.
 *
 * There is no `theme` here, and that is the whole enforcement of "the model does
 * not choose the look": the objects are `.strict()`, so a `theme` written by a
 * model is refused exactly like an `audio` key, with the same message and the
 * same absence of a repair path.
 */
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

/**
 * The document as the renderer receives it: the validated timeline, plus the
 * theme the SERVER attached to it.
 *
 * Two schemas rather than one optional field, because the difference is who is
 * allowed to write which key. Everything a model may say is in
 * `VideoTimelineSchema`; `theme` can only be added by code that already holds
 * the project's direction, after the model's document has been accepted. One
 * schema with an optional theme would accept a model that wrote its own, and
 * the whole point is that it cannot.
 */
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

/**
 * No repair, ever. There is no `clampScene`, no truncation of a 200-character
 * overlay, no dropping of the twenty-first scene — a rejection is a rejection,
 * and the caller retries with the message.
 *
 * The temptation is real, because every one of those repairs turns a failed
 * model call into a shipped video. It is also exactly the hole this schema was
 * written to close: a repaired document is one nobody validated. Clamping a 40 s
 * scene to 15 s does not produce the video that was asked for, it produces a
 * different one that happens to be legal, and the user has no way to tell which
 * they are looking at. Worse, repair is where the total-duration rule dies: fix
 * each scene independently and twenty of them still add up to five minutes.
 *
 * The catalogue does not soften it: a document naming `product` is validated as
 * a product and refused as a product. It is never re-tried as a slideshow
 * because that one would have passed.
 */
export type VideoTemplate = (typeof VIDEO_TEMPLATES)[number]
export type TextOverlay = z.infer<typeof TextOverlaySchema>
export type VideoTheme = z.infer<typeof VideoThemeSchema>

export type SlideshowScene = z.infer<typeof SlideshowSceneSchema>
export type OverlayScene = z.infer<typeof OverlaySceneSchema>
export type VerticalScene = z.infer<typeof VerticalSceneSchema>
export type TitleScene = z.infer<typeof TitleSceneSchema>
export type ProductScene = z.infer<typeof ProductSceneSchema>

export type SlideshowTimeline = z.infer<typeof SlideshowTimelineSchema>
export type OverlayTimeline = z.infer<typeof OverlayTimelineSchema>
export type VerticalTimeline = z.infer<typeof VerticalTimelineSchema>
export type TitlesTimeline = z.infer<typeof TitlesTimelineSchema>
export type ProductTimeline = z.infer<typeof ProductTimelineSchema>

export type VideoTimeline = z.infer<typeof VideoTimelineSchema>
export type RenderTimeline = z.infer<typeof RenderTimelineSchema>

/**
 * What a caller may hand in — defaults not yet applied.
 *
 * Written out rather than taken from `z.input`, because `z.preprocess` declares
 * its own input as `unknown` and that would silently disable every check the
 * editor gets from this type. The second arm is the compatibility rule in the
 * type system: a slideshow may arrive without naming itself.
 */
export type SlideshowTimelineInput = z.input<typeof SlideshowTimelineSchema>

export type VideoTimelineInput =
  | z.input<typeof SlideshowTimelineSchema>
  | Omit<z.input<typeof SlideshowTimelineSchema>, 'template'>
  | z.input<typeof OverlayTimelineSchema>
  | z.input<typeof VerticalTimelineSchema>
  | z.input<typeof TitlesTimelineSchema>
  | z.input<typeof ProductTimelineSchema>

export type KenBurns = (typeof KEN_BURNS)[number]
export type OverlayMove = (typeof OVERLAY_MOVES)[number]
export type Transition = (typeof TRANSITIONS)[number]
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number]
export type BandPosition = (typeof BAND_POSITIONS)[number]
export type TitleAnimation = (typeof TITLE_ANIMATIONS)[number]
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

/** Sum of the scene durations, in ms. The render budget, and what the UI shows. */
export function totalDurationMs(timeline: { scenes: ReadonlyArray<{ durationMs: number }> }): number {
  return timeline.scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
}

/**
 * Every library image a timeline needs, deduplicated, in first-use order.
 *
 * A function and not `scenes.map((s) => s.imageId)` at each call site, because
 * one template has no images at all: a `titles` film would produce `[undefined]`
 * there, and the two callers that matter — the existence check in `/render` and
 * `collectImages` in the worker client — would then look up a file called
 * "undefined" and report the wrong failure for it.
 */
export function timelineImageIds(timeline: Pick<VideoTimeline, 'scenes'>): string[] {
  const ids: string[] = []
  for (const scene of timeline.scenes) {
    // `in` rather than a cast, so the day a sixth template arrives without an
    // image the compiler already knows this loop handles it.
    if ('imageId' in scene && typeof scene.imageId === 'string' && !ids.includes(scene.imageId)) {
      ids.push(scene.imageId)
    }
  }
  return ids
}
