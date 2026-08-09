// The worker's own reading of a render request, and its refusal to trust the
// caller.
//
// Mocky already validates every timeline against `src/lib/video/timeline.ts`
// before it reaches the queue, so on a healthy instance nothing here ever
// fires. That is exactly why it is here. This service is a plain HTTP endpoint
// on a network with no authentication of its own — the compose file keeps it on
// an internal bridge, and an internal bridge is a deployment choice, not a
// guarantee. Anything that can open a socket to :3030 can hand this process a
// document, and the thing on the other end of that document is a headless
// Chromium.
//
// It is deliberately NOT a port of the zod schema. A third copy of that file
// would be a third place to forget, and it would validate the wrong thing: what
// this worker has to know is whether the composition can RENDER the document —
// every scene has bytes to show, every enum names an effect that exists, the
// whole thing fits the render budget. The bounds it shares with Mocky are held
// honest by `validate.test.js`, which imports `server/video/timeline.js` and
// requires the two to agree. That import is test-only and must stay that way:
// the Docker build copies this directory and nothing else, so a runtime import
// of anything under `server/` would produce a container that boots and fails
// every render on a missing module.
//
// No dependency, on purpose. Adding zod here means a second version of it to
// keep in step with Mocky's, inside an image that has no egress to fetch
// anything at run time.

/** The image-library address: a SHA-256 as `digest('hex')` writes it, lower-case. */
const IMAGE_ID = /^[0-9a-f]{64}$/

/** A colour and a font family, under exactly the schema's own bounds. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const FONT_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,47}$/u

/**
 * Scene count and per-scene duration, per template.
 *
 * The numbers differ for the reasons `src/lib/video/timeline.ts` gives, and are
 * not restated here — a second copy of a rationale is a second copy to get out
 * of date. What matters on this side is that they are the SAME numbers:
 * `validate.test.js` compares this table against the mirrored schema, so a bound
 * revised on one side alone fails the suite instead of producing a worker that
 * accepts what the browser refuses.
 */
export const TEMPLATE_LIMITS = {
  slideshow: { maxScenes: 20, minSceneMs: 1000, maxSceneMs: 15000 },
  overlay: { maxScenes: 10, minSceneMs: 1500, maxSceneMs: 15000 },
  vertical: { maxScenes: 12, minSceneMs: 1000, maxSceneMs: 8000 },
  titles: { maxScenes: 8, minSceneMs: 1500, maxSceneMs: 10000 },
  product: { maxScenes: 6, minSceneMs: 3000, maxSceneMs: 15000 },
}

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

/** The slideshow's bounds under the names they had before the catalogue existed. */
export const MAX_SCENES = TEMPLATE_LIMITS.slideshow.maxScenes
export const MIN_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.minSceneMs
export const MAX_SCENE_DURATION_MS = TEMPLATE_LIMITS.slideshow.maxSceneMs
export const MAX_TOTAL_DURATION_MS = 120000
export const MAX_OVERLAY_LENGTH = TEXT_LIMITS.overlay

/**
 * The templates THIS WORKER has a composition for.
 *
 * It happens to be all five today. It is still its own list rather than a
 * reference to Mocky's, and it is allowed to lag: the worker is a separate
 * service behind an opt-in compose profile, so an operator really can be running
 * last month's build against today's Mocky. Refusing by name is what turns that
 * into a sentence naming the template instead of a video rendered as something
 * else — a `product` drawn by the slideshow composition would come back with its
 * arguments and its call to action missing, reported as a success.
 *
 * A template Mocky does not know is refused here too, for the ordinary reason:
 * this process does not trust its caller, even when the caller is Mocky.
 */
export const RENDERABLE_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product']

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']
export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none']
export const OVERLAY_POSITIONS = ['top', 'center', 'bottom']
export const BAND_POSITIONS = ['top', 'bottom']
export const TITLE_ANIMATIONS = ['fade', 'rise', 'stagger']
export const OUTPUT_FORMATS = ['mp4', 'webm']
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1']

/**
 * The ratios a template may be rendered in.
 *
 * `vertical` is the literal `9:16` and not a default, because the composition
 * lays out the safe areas a phone feed covers with its own buttons. Handed a
 * landscape frame it would letterbox and put its caption in the wrong third — a
 * legal document rendering a film nobody described. The schema makes the other
 * two unreachable rather than discouraged; this is the same rule, restated by
 * the process that would have to draw it.
 */
const TEMPLATE_RATIOS = {
  slideshow: ASPECT_RATIOS,
  overlay: ASPECT_RATIOS,
  vertical: ['9:16'],
  titles: ASPECT_RATIOS,
  product: ASPECT_RATIOS,
}

/**
 * What an image may be, and the file name it gets on disk.
 *
 * The extension is not cosmetic: the staged images are served to Chromium over
 * HTTP by Remotion's own static server, which picks the Content-Type from the
 * extension. A file called `<hash>` with no suffix arrives as
 * application/octet-stream, and the render fails on an image that is perfectly
 * valid.
 *
 * Mocky's library only ever stores JPEG, PNG and WebP; the other two are here
 * because refusing a format Chromium can decode costs a user an export for no
 * reason.
 */
export const IMAGE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
}

/** The on-disk suffix for a MIME type, or `null` when this worker will not stage it. */
export function extensionFor(mime) {
  return IMAGE_EXTENSIONS[String(mime || '').toLowerCase().trim()] || null
}

/**
 * A refusal, as distinct from a bug.
 *
 * Everything below throws this to unwind; `validateRenderRequest` turns it into
 * a message and lets a real exception keep travelling. Without the distinction
 * a `TypeError` in this file would be reported to the user as "your timeline is
 * invalid", and they would spend the afternoon editing a correct document.
 */
class Refusal extends Error {}

/**
 * Every message that leaves this file is ONE LINE.
 *
 * Mocky splices up to 300 characters of the worker's response into the sentence
 * the user reads. A newline there breaks the layout of the panel it lands in,
 * and a stack trace makes it unreadable. `validate.test.js` holds the rule.
 */
const refuse = (message) => {
  throw new Refusal(message.replace(/\s+/g, ' ').trim())
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function object(value, where) {
  if (!isPlainObject(value)) refuse(`${where} must be a JSON object.`)
  return value
}

/**
 * Unknown keys are refused, and the message names them.
 *
 * The same reasoning as `.strict()` in the schema, one machine further along: a
 * key nothing renders is how a request is accepted, ignored, and reported as a
 * successful export of something else. Here it doubles as version-skew
 * detection — a Mocky that learned to send `audio` against a worker that never
 * learned to render it fails with the word "audio" in the message, instead of
 * returning a silent video.
 */
function onlyKeys(value, allowed, where) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) {
    refuse(
      `${where} carries ${unknown.length === 1 ? 'a key' : 'keys'} this worker does not render: ${unknown.join(', ')}. ` +
        `It renders ${allowed.join(', ')}.`,
    )
  }
  return value
}

function enumValue(value, allowed, fallback, where) {
  const picked = value === undefined || value === null ? fallback : value
  if (!allowed.includes(picked)) {
    refuse(`${where} is "${String(value)}"; this worker renders ${allowed.map((v) => `"${v}"`).join(', ')}.`)
  }
  return picked
}

/**
 * A string with something in it, no longer than a frame can carry.
 *
 * These are legibility limits, not storage ones: text in a film is burnt in at a
 * size the composition fixes, so a headline that does not fit is not a smaller
 * headline — it is a line that runs off the edge. Not trimmed and not truncated;
 * a refused document is refused, never repaired.
 */
function readText(value, max, where) {
  if (typeof value !== 'string' || value.trim() === '') refuse(`${where} must be a non-empty string.`)
  if (value.length > max) refuse(`${where} is ${value.length} characters; the maximum is ${max}.`)
  return value
}

/** The same, where absent and explicitly null both mean "there is none". */
function readOptionalText(value, max, where) {
  if (value === undefined || value === null) return null
  return readText(value, max, where)
}

/** A whole number of milliseconds, inside one template's own window. */
function readDuration(value, limits, where) {
  if (!Number.isInteger(value) || value < limits.minSceneMs || value > limits.maxSceneMs) {
    refuse(
      `${where}.durationMs must be a whole number of milliseconds between ${limits.minSceneMs} and ${limits.maxSceneMs}; it is ${JSON.stringify(value)}.`,
    )
  }
  return value
}

function readImageId(value, where) {
  if (typeof value !== 'string' || !IMAGE_ID.test(value)) {
    // The two mistakes anyone actually makes, named — a URL, or upper-case hex.
    // The worker never resolves an address of its own accord (it has no egress
    // at all), so a URL here is not a slow failure, it is a request that can
    // never work.
    refuse(`${where}.imageId must be a 64-character lower-case SHA-256 from the image library, not a URL.`)
  }
  return value
}

function readOverlay(value, where) {
  if (value === undefined || value === null) return null
  object(value, where)
  onlyKeys(value, ['content', 'position'], where)
  return {
    content: readText(value.content, TEXT_LIMITS.overlay, `${where}.content`),
    position: enumValue(value.position, OVERLAY_POSITIONS, undefined, `${where}.position`),
  }
}

/*
 * Five scene readers, one per template, and no shared "read whatever is there".
 *
 * The tempting shape is one reader that accepts every field any template could
 * carry and lets `onlyKeys` sort it out. It is wrong in the direction that
 * matters: a `band` on a slideshow scene, or a `kenBurns` on an overlay one,
 * would then be accepted by the validator and ignored by the composition — a
 * film rendered without the thing that was asked for and reported as a success,
 * which is the exact failure `.strict()` exists to prevent one layer up.
 */

function readSlideshowScene(value, where) {
  onlyKeys(value, ['imageId', 'durationMs', 'kenBurns', 'transitionOut', 'textOverlay'], where)
  return {
    imageId: readImageId(value.imageId, where),
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.slideshow, where),
    kenBurns: enumValue(value.kenBurns, KEN_BURNS, 'static', `${where}.kenBurns`),
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
    textOverlay: readOverlay(value.textOverlay, `${where}.textOverlay`),
  }
}

function readOverlayScene(value, where) {
  onlyKeys(value, ['imageId', 'durationMs', 'band', 'transitionOut'], where)
  // No `kenBurns`, and its absence is the template's discipline rather than an
  // oversight: a pan across a capture of an interface slides half the interface
  // out of frame and a zoom crops it, while the reason to show a screenshot is
  // that it can be read.
  const band = object(value.band, `${where}.band`)
  onlyKeys(band, ['title', 'subtitle', 'position'], `${where}.band`)
  return {
    imageId: readImageId(value.imageId, where),
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.overlay, where),
    band: {
      title: readText(band.title, TEXT_LIMITS.bandTitle, `${where}.band.title`),
      subtitle: readOptionalText(band.subtitle, TEXT_LIMITS.bandSubtitle, `${where}.band.subtitle`),
      position: enumValue(band.position, BAND_POSITIONS, 'bottom', `${where}.band.position`),
    },
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
  }
}

function readVerticalScene(value, where) {
  onlyKeys(value, ['imageId', 'durationMs', 'kenBurns', 'transitionOut', 'textOverlay'], where)
  return {
    imageId: readImageId(value.imageId, where),
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.vertical, where),
    // `zoom-in` and not `static`: a full-bleed still on a feed reads as a
    // stalled player, and the schema defaults it the same way.
    kenBurns: enumValue(value.kenBurns, KEN_BURNS, 'zoom-in', `${where}.kenBurns`),
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
    textOverlay: readOverlay(value.textOverlay, `${where}.textOverlay`),
  }
}

function readTitleScene(value, where) {
  // The one scene kind with no `imageId` at all. `readImages` below therefore
  // needs nothing for a titles document, and asking for a picture would be
  // asking for something the schema cannot express.
  onlyKeys(value, ['headline', 'subtitle', 'durationMs', 'animation', 'transitionOut'], where)
  return {
    headline: readText(value.headline, TEXT_LIMITS.titleHeadline, `${where}.headline`),
    subtitle: readOptionalText(value.subtitle, TEXT_LIMITS.titleSubtitle, `${where}.subtitle`),
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.titles, where),
    animation: enumValue(value.animation, TITLE_ANIMATIONS, 'fade', `${where}.animation`),
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
  }
}

function readProductScene(value, where) {
  onlyKeys(value, ['imageId', 'durationMs', 'headline', 'bullets', 'cta', 'transitionOut'], where)
  if (!Array.isArray(value.bullets) || value.bullets.length === 0) {
    refuse(`${where}.bullets must be an array of 1 to ${TEXT_LIMITS.productBullets} strings.`)
  }
  if (value.bullets.length > TEXT_LIMITS.productBullets) {
    refuse(`${where}.bullets has ${value.bullets.length} entries; the maximum is ${TEXT_LIMITS.productBullets}.`)
  }
  return {
    imageId: readImageId(value.imageId, where),
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.product, where),
    headline: readText(value.headline, TEXT_LIMITS.productHeadline, `${where}.headline`),
    bullets: value.bullets.map((bullet, i) => readText(bullet, TEXT_LIMITS.productBullet, `${where}.bullets[${i}]`)),
    cta: readOptionalText(value.cta, TEXT_LIMITS.productCta, `${where}.cta`),
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
  }
}

const SCENE_READERS = {
  slideshow: readSlideshowScene,
  overlay: readOverlayScene,
  vertical: readVerticalScene,
  titles: readTitleScene,
  product: readProductScene,
}

/**
 * Which composition draws this document.
 *
 * Absent means `slideshow`, the same reading Mocky's schema gives it and for the
 * same reason: montages composed before the catalogue existed carry no template
 * at all, and this worker is handed them straight out of the queue's journal
 * after a restart.
 *
 * `Object.hasOwn` on the reader table rather than `RENDERABLE_TEMPLATES`
 * alone, so that a template listed as renderable with no reader behind it is a
 * refusal rather than a `value.scenes.map(undefined)` two lines down.
 */
function readTemplate(value) {
  const template = value === undefined || value === null ? 'slideshow' : value
  if (typeof template !== 'string' || !RENDERABLE_TEMPLATES.includes(template) || !Object.hasOwn(SCENE_READERS, template)) {
    refuse(
      `timeline.template is ${JSON.stringify(value)}; this worker renders ${RENDERABLE_TEMPLATES.map((t) => `"${t}"`).join(', ')}. ` +
        'Rebuild the worker image if Mocky is newer than it.',
    )
  }
  return template
}

/**
 * The art direction the SERVER attached, re-read here.
 *
 * The model never writes this — `VideoTimelineSchema` has no `theme` at all, so
 * a model that invents one is refused before the document ever leaves Mocky.
 * What arrives here has been through `attachTheme`, and this reader exists
 * because that is a sentence about a healthy instance and this process is a
 * plain HTTP endpoint on a bridge.
 *
 * The bounds are what keep a theme from becoming CSS. A colour is hex and only
 * hex; a font is ONE family name from a charset with no comma, quote, semicolon
 * or brace in it, because that value lands in a `font-family` where any of those
 * is the difference between naming a typeface and writing a declaration; the
 * radius is an integer number of pixels, so there is no unit to parse and no
 * `calc()` to smuggle.
 *
 * An empty theme is refused for the reason the schema refuses it: `{}` says "a
 * direction was read and it asks for nothing", which is not what "there is no
 * direction" means. The second is spelled by leaving the key out.
 *
 * Only the keys that were sent come back. Filling the absent ones with defaults
 * here would make a stated token and an invented one indistinguishable to the
 * composition — and the compositions are where the defaults belong, chosen once,
 * on purpose, in code a reviewer read.
 */
function readTheme(value) {
  if (value === undefined || value === null) return undefined
  object(value, 'timeline.theme')
  onlyKeys(value, ['colors', 'fonts', 'radiusPx'], 'timeline.theme')

  const theme = {}
  let stated = false

  if (value.colors !== undefined) {
    const colors = object(value.colors, 'timeline.theme.colors')
    onlyKeys(colors, ['background', 'text', 'accent', 'surface'], 'timeline.theme.colors')
    theme.colors = {}
    for (const [role, hex] of Object.entries(colors)) {
      if (hex === undefined) continue
      if (typeof hex !== 'string' || !HEX_COLOR.test(hex)) {
        refuse(`timeline.theme.colors.${role} must be a hex colour such as #1a1a1a; it is ${JSON.stringify(hex)}.`)
      }
      theme.colors[role] = hex
      stated = true
    }
  }

  if (value.fonts !== undefined) {
    const fonts = object(value.fonts, 'timeline.theme.fonts')
    onlyKeys(fonts, ['heading', 'body'], 'timeline.theme.fonts')
    theme.fonts = {}
    for (const [role, family] of Object.entries(fonts)) {
      if (family === undefined) continue
      if (typeof family !== 'string' || !FONT_FAMILY.test(family)) {
        refuse(
          `timeline.theme.fonts.${role} must be one font family name — letters, digits, spaces and hyphens, no CSS; it is ${JSON.stringify(family)}.`,
        )
      }
      theme.fonts[role] = family
      stated = true
    }
  }

  if (value.radiusPx !== undefined) {
    if (!Number.isInteger(value.radiusPx) || value.radiusPx < 0 || value.radiusPx > 9999) {
      refuse(`timeline.theme.radiusPx must be a whole number of pixels between 0 and 9999; it is ${JSON.stringify(value.radiusPx)}.`)
    }
    theme.radiusPx = value.radiusPx
    stated = true
  }

  if (!stated) {
    refuse('timeline.theme must state at least one token. Omit it entirely when the project has no direction.')
  }
  return theme
}

function readTimeline(value) {
  object(value, 'timeline')
  onlyKeys(value, ['template', 'scenes', 'outputFormat', 'aspectRatio', 'theme'], 'timeline')
  const template = readTemplate(value.template)
  const limits = TEMPLATE_LIMITS[template]

  if (!Array.isArray(value.scenes) || value.scenes.length === 0) {
    refuse('timeline.scenes must be a non-empty array.')
  }
  if (value.scenes.length > limits.maxScenes) {
    refuse(`timeline.scenes has ${value.scenes.length} entries; a ${template} renders at most ${limits.maxScenes}.`)
  }
  const readScene = SCENE_READERS[template]
  const scenes = value.scenes.map((scene, index) => {
    const where = `scenes[${index}]`
    return readScene(object(scene, where), where)
  })

  // The bound no per-scene check can see, and it is written once for every
  // template rather than five times: twenty legal scenes of fifteen seconds are
  // five minutes of Chromium on a container whose caller gives up after two — a
  // render nobody would ever collect, paid for in full.
  const total = scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
  if (total > MAX_TOTAL_DURATION_MS) {
    refuse(
      `The scenes add up to ${total} ms; this worker renders at most ${MAX_TOTAL_DURATION_MS} ms (${MAX_TOTAL_DURATION_MS / 1000} seconds).`,
    )
  }

  const ratios = TEMPLATE_RATIOS[template]
  const timeline = {
    template,
    scenes,
    outputFormat: enumValue(value.outputFormat, OUTPUT_FORMATS, 'mp4', 'timeline.outputFormat'),
    aspectRatio: enumValue(value.aspectRatio, ratios, ratios[0], 'timeline.aspectRatio'),
  }

  // Added only when it was sent, never as `theme: undefined`. The composition
  // asks whether the key is there, and a key holding nothing is a third answer
  // to a two-answer question.
  const theme = readTheme(value.theme)
  if (theme !== undefined) timeline.theme = theme
  return timeline
}

/**
 * The pictures, checked against the scenes that need them.
 *
 * Returned deduplicated and filtered to what the timeline actually references.
 * Mocky's `collectImages` already sends exactly that set, so the filtering
 * changes nothing today — it is here so that a caller sending its whole library
 * costs this worker one map lookup rather than a hundred files written to disk
 * and served to a browser.
 */
function readImages(value, timeline) {
  if (!Array.isArray(value)) refuse('images must be an array of { id, mime, base64 } objects.')

  const byId = new Map()
  value.forEach((entry, index) => {
    const where = `images[${index}]`
    object(entry, where)
    onlyKeys(entry, ['id', 'mime', 'base64'], where)
    if (typeof entry.id !== 'string' || !IMAGE_ID.test(entry.id)) {
      refuse(`${where}.id must be a 64-character lower-case SHA-256.`)
    }
    const extension = extensionFor(entry.mime)
    if (!extension) {
      refuse(`${where}.mime is ${JSON.stringify(entry.mime)}; this worker stages ${Object.keys(IMAGE_EXTENSIONS).join(', ')}.`)
    }
    if (typeof entry.base64 !== 'string' || entry.base64.trim() === '') {
      refuse(`${where}.base64 must be a non-empty base64 string.`)
    }
    // Decoded here rather than in `render.js` so that garbage fails as a 400
    // naming the image, not as a Chromium decode error two minutes later.
    // `Buffer.from` is lenient — it drops what it cannot read — so an empty
    // result is the only signal it gives, and it is enough.
    const bytes = Buffer.from(entry.base64, 'base64')
    if (bytes.length === 0) {
      refuse(`${where}.base64 did not decode to any bytes.`)
    }
    byId.set(entry.id, { id: entry.id, mime: entry.mime, extension, bytes })
  })

  // Only the scenes that HAVE an image. A `titles` document has none at all, and
  // `scenes.map((s) => s.imageId)` would hand this loop `[undefined]` — a
  // perfectly valid film refused for not sending bytes for a picture it never
  // named. The same trap `timelineImageIds` exists to close on the Mocky side.
  const needed = [...new Set(timeline.scenes.map((scene) => scene.imageId).filter((id) => typeof id === 'string'))]
  const missing = needed.filter((id) => !byId.has(id))
  if (missing.length) {
    // Named, because the alternative is a video with a blank scene in the
    // middle reported as a success. The images travel inside the request
    // precisely so this can be checked before a single frame is rendered.
    refuse(`No image bytes were sent for ${missing.length === 1 ? 'scene image' : 'scene images'} ${missing.join(', ')}.`)
  }
  return needed.map((id) => byId.get(id))
}

/**
 * Read a `/render` body.
 *
 * @param {unknown} body
 * @returns {{ok: true, timeline: object, images: Array<{id:string, mime:string, extension:string, bytes:Buffer}>}
 *          | {ok: false, message: string}}
 */
export function validateRenderRequest(body) {
  try {
    const root = object(body, 'The request body')
    // The envelope is checked as strictly as the timeline, and for the same
    // reason: `licenseKey` is the only companion field this worker knows, and a
    // future one silently dropped here is a feature reported as working.
    onlyKeys(root, ['timeline', 'images', 'licenseKey'], 'The request body')
    const timeline = readTimeline(root.timeline)
    const images = readImages(root.images === undefined ? [] : root.images, timeline)
    return { ok: true, timeline, images }
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, message: err.message }
    throw err
  }
}
