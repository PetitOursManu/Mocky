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
  composed: { maxScenes: 12, minSceneMs: 1500, maxSceneMs: 15000 },
}

/**
 * The bounds the composable variant applies, restated here for the reason
 * `TEMPLATE_LIMITS` is: this process does not trust its caller, even when the
 * caller is Mocky. `validate.test.js` compares the table against the schema's.
 */
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
  // One picture or two on a stage — the face and the back; three to six on a
  // ring, because two panels on a ring are a card turning over.
  stageImagesMin: 1,
  stageImages: 2,
  ringImagesMin: 3,
  ringImages: 6,
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
  extrudedType: 24,

  // The two fields in volume that count something. Both ceilings are measured
  // rather than chosen; the numbers are in `docs/video-export.md`.
  particlesMin: 60,
  particles: 600,
  gridLinesMin: 5,
  gridLines: 16,
}

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

export const BACKGROUND_KINDS = ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles', 'image']
export const GRADIENT_DIRECTIONS = ['to-bottom', 'to-right', 'diagonal', 'radial']

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
 * It happens to be all six today. It is still its own list rather than a
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
export const RENDERABLE_TEMPLATES = ['slideshow', 'overlay', 'vertical', 'titles', 'product', 'composed']

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']

/** The five `funTitle` looks. Skia was measured at 461 MB and refused; see the schema. */
export const FUN_TITLE_TREATMENTS = ['arc', 'bounce', 'stretch', 'swap', 'stack']

/** The four solids a `solidScene` draws. No wireframe: it was measured at 2.7 s of render per second of film. */
export const SOLIDS = ['cube', 'prism', 'sphere', 'torus']

/** How a `solidScene` turns. A named move, never an axis and never an angle. */
export const SPINS = ['tumble', 'turn', 'rock']

/** How a `particleField` moves. A named drift, never a velocity, and no `still`. */
export const PARTICLE_DRIFTS = ['rise', 'orbit', 'swarm']

/** How a `waveMesh` swells, and how far it is raked. Named looks, never amplitudes. */
export const WAVE_SWELLS = ['calm', 'swell', 'ripple']
export const WAVE_TILTS = ['face', 'rake']

/** What a `depthGrid` is, and which way it runs. There is no `still`: a drift here hides nothing. */
export const GRID_FORMS = ['floor', 'tunnel']
export const GRID_TRAVELS = ['toward', 'away', 'sway']

/** What a picture stands in on a `photoStage` or a `photoRing`. A shape, never a size. */
export const STAGE_FRAMES = ['plain', 'card', 'device']

/** How a `photoStage` moves. There is no `static`: this family exists to move. */
export const STAGE_MOVES = ['orbit', 'turn', 'sway']

/** What a `codeBlock` line is for. Three measured runs on a panel, so three roles. */
export const CODE_ROLES = ['plain', 'accent', 'muted']

/** How thick an `extrudedType` is, as a share of its own type size. */
export const EXTRUDED_DEPTHS = ['shallow', 'medium', 'deep']

/** How an `extrudedType` moves. All three are small: a word seen edge-on is a bar. */
export const EXTRUDED_SPINS = ['sway', 'tilt', 'float']

/**
 * The move a scene gets when the document names none.
 *
 * The same values Mocky's schema fills in, and `validate.test.js` holds the two
 * together. It matters more than the other defaults in this file: a worker that
 * still answered `static` where the schema now answers `zoom-in` would render a
 * frozen film out of a document the panel had shown moving, and the only place
 * the disagreement would ever surface is an mp4.
 */
export const DEFAULT_KEN_BURNS = { slideshow: 'zoom-in', vertical: 'zoom-in' }

/** How an `overlay` scene moves. No `still`: a drift crops nothing, so nothing is bought by refusing it. */
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
  composed: ASPECT_RATIOS,
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
    // `zoom-in` and not `static`: a photograph nailed to the frame with a caption
    // on it is what a user described as not being a film, and an optional field
    // is a field a model omits.
    kenBurns: enumValue(value.kenBurns, KEN_BURNS, DEFAULT_KEN_BURNS.slideshow, `${where}.kenBurns`),
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
    textOverlay: readOverlay(value.textOverlay, `${where}.textOverlay`),
  }
}

function readOverlayScene(value, where) {
  onlyKeys(value, ['imageId', 'durationMs', 'move', 'band', 'transitionOut'], where)
  // No `kenBurns`, and its absence is the template's discipline rather than an
  // oversight: a pan across a capture of an interface slides half the interface
  // out of frame and a zoom crops it, while the reason to show a screenshot is
  // that it can be read. `move` is the amplitude that discipline permits — a
  // drift inside the margin a 3% overscale leaves, which hides no pixel the
  // frame showed at rest.
  const band = object(value.band, `${where}.band`)
  onlyKeys(band, ['title', 'subtitle', 'position'], `${where}.band`)
  return {
    imageId: readImageId(value.imageId, where),
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.overlay, where),
    move: enumValue(value.move, OVERLAY_MOVES, DEFAULT_OVERLAY_MOVE, `${where}.move`),
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
    kenBurns: enumValue(value.kenBurns, KEN_BURNS, DEFAULT_KEN_BURNS.vertical, `${where}.kenBurns`),
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

/*
 * ── The composable variant ──────────────────────────────────────────────────
 *
 * A background and a stack of typed blocks. Same discipline as the five scene
 * readers above and for the same reason: ONE reader per block kind, never a
 * permissive reader plus a key list. A `values` array accepted on a `heading` is
 * a field the component does not read — a film rendered without the thing that
 * was asked for, delivered as an export.
 *
 * The absences are the interesting part, and each is a promise this file keeps
 * rather than a field nobody got round to. There is no colour anywhere, no font,
 * no CSS length and no free string: a block says what it IS, and what it looks
 * like is the palette's business and the component's. Anything else here would be
 * a way around the theme the server attaches — the guessed token `theme.ts`
 * refuses, arriving through a layer instead of through a key.
 */

/** A boolean, or the default. Never truthiness: `"false"` is a string, and it is true. */
function readBool(value, fallback, where) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') refuse(`${where} must be true or false; it is ${JSON.stringify(value)}.`)
  return value
}

/**
 * A whole number inside its own window, or the default — and a REFUSAL when
 * there is no default.
 *
 * The absent-fallback case is the one that had to be spelled out. Three fields
 * in the catalogue are integers the schema gives no default to — `counter.to`,
 * `progressBar.to` and every entry of a chart's `values` — and this function
 * used to hand `undefined` straight back for them. So a `{ kind: "counter" }`
 * with no target, or a `values: [40, null]` with a hole in it, was refused by
 * both of Mocky's copies and ACCEPTED here, then drawn as `NaN` into a frame
 * this worker had reported as rendered. `undefined` as a fallback is how the
 * three required numbers spell "required"; treating it as a value is what let
 * them through.
 */
function readInt(value, min, max, fallback, where) {
  if (value === undefined || value === null) {
    if (fallback === undefined) {
      refuse(`${where} is required; it must be a whole number between ${min} and ${max}.`)
    }
    return fallback
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    refuse(`${where} must be a whole number between ${min} and ${max}; it is ${JSON.stringify(value)}.`)
  }
  return value
}

/** An array of lines, each one something somebody will read. */
function readTextArray(value, min, max, maxLength, where) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    refuse(`${where} must be an array of ${min} to ${max} strings; it has ${Array.isArray(value) ? value.length : 'none'}.`)
  }
  return value.map((entry, i) => readText(entry, maxLength, `${where}[${i}]`))
}

/** The same, where absent and explicitly null both mean "there is none". */
function readOptionalTextArray(value, max, maxLength, where) {
  if (value === undefined || value === null) return null
  return readTextArray(value, 0, max, maxLength, where)
}

/**
 * The lines of a `codeBlock`: the only array of OBJECTS in the catalogue.
 *
 * Written out rather than folded into `readTextArray`, because each entry has
 * its own unknown-key refusal. A line carrying `{ text, colour }` has to be
 * refused by name here exactly as a block would be — the whole argument for
 * having no highlighter is that no colour reaches this file, and a permissive
 * reader on the one shape that mentions roles is where that would arrive.
 */
function readCodeLines(value, where) {
  if (!Array.isArray(value) || value.length < BLOCK_LIMITS.codeLinesMin || value.length > BLOCK_LIMITS.codeLines) {
    refuse(
      `${where} must be an array of ${BLOCK_LIMITS.codeLinesMin} to ${BLOCK_LIMITS.codeLines} lines; ` +
        `it has ${Array.isArray(value) ? value.length : 'none'}.`,
    )
  }
  return value.map((entry, i) => {
    const at = `${where}[${i}]`
    object(entry, at)
    onlyKeys(entry, ['text', 'role'], at)
    return {
      text: readText(entry.text, BLOCK_LIMITS.codeLine, `${at}.text`),
      role: enumValue(entry.role, CODE_ROLES, 'plain', `${at}.role`),
    }
  })
}

/** An array of whole numbers, each a percentage: a chart in a film has no axis to read. */
function readValues(value, min, max, where) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    refuse(`${where} must be an array of ${min} to ${max} whole numbers between 0 and 100.`)
  }
  return value.map((entry, i) => readInt(entry, 0, 100, undefined, `${where}[${i}]`))
}

/** An array of library addresses. Never a URL, for the reason `readImageId` gives. */
function readImageIdArray(value, min, max, where) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    refuse(`${where} must be an array of ${min} to ${max} image ids.`)
  }
  return value.map((entry, i) => {
    // Its own message rather than `readImageId`'s, which names a FIELD called
    // imageId — `imageIds[0].imageId` would send the reader looking for a key
    // that is not in the schema.
    if (typeof entry !== 'string' || !IMAGE_ID.test(entry)) {
      refuse(`${where}[${i}] must be a 64-character lower-case SHA-256 from the image library, not a URL.`)
    }
    return entry
  })
}

/** `HH:MM` on a 24-hour dial, or nothing. A charset with no letter in it. */
const CLOCK_TIME = /^([01]?\d|2[0-3]):[0-5]\d$/
function readClockTime(value, where) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !CLOCK_TIME.test(value)) {
    refuse(`${where} must read HH:MM on a 24-hour clock, such as 09:30; it is ${JSON.stringify(value)}.`)
  }
  return value
}

/**
 * Where a block sits and when it arrives — the two fields every one of them has.
 *
 * `enter` is left ABSENT when the document did not state it, never filled with a
 * number here. Absent means "the position it was written in", and `layerCues` in
 * the composition is the one place that reading exists; a default invented here
 * would be a second one, disagreeing with it the first time either moves.
 */
function readPlacement(value, where) {
  const out = { anchor: enumValue(value.anchor, ANCHORS, 'center', `${where}.anchor`) }
  if (value.enter !== undefined && value.enter !== null) {
    out.enter = readInt(value.enter, 0, BLOCK_LIMITS.layersPerScene - 1, undefined, `${where}.enter`)
  }
  return out
}

/** One block reader: its own keys plus the two everything carries. */
const blockReader = (own, read) => ({
  keys: ['kind', 'anchor', 'enter', ...own],
  read,
})

const BLOCK_READERS = {
  heading: blockReader(['text', 'level'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.heading, `${w}.text`),
    level: enumValue(v.level, ['display', 'title', 'subtitle'], 'title', `${w}.level`),
  })),
  kicker: blockReader(['text'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.kicker, `${w}.text`),
  })),
  quote: blockReader(['text', 'attribution'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.quote, `${w}.text`),
    attribution: readOptionalText(v.attribution, BLOCK_LIMITS.attribution, `${w}.attribution`),
  })),
  textHighlight: blockReader(['text', 'mark', 'treatment'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.highlight, `${w}.text`),
    mark: readOptionalText(v.mark, BLOCK_LIMITS.highlightMark, `${w}.mark`),
    treatment: enumValue(v.treatment, ['marker', 'underline', 'box'], 'marker', `${w}.treatment`),
  })),
  funTitle: blockReader(['text', 'treatment'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.funTitle, `${w}.text`),
    treatment: enumValue(v.treatment, FUN_TITLE_TREATMENTS, 'bounce', `${w}.treatment`),
  })),
  typewriter: blockReader(['text', 'caret'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.typewriter, `${w}.text`),
    caret: readBool(v.caret, true, `${w}.caret`),
  })),
  animatedList: blockReader(['items', 'marker'], (v, w) => ({
    items: readTextArray(v.items, 1, BLOCK_LIMITS.listItems, BLOCK_LIMITS.listItem, `${w}.items`),
    marker: enumValue(v.marker, ['numeral', 'rule', 'dot'], 'numeral', `${w}.marker`),
  })),
  counter: blockReader(['to', 'from', 'prefix', 'suffix', 'label'], (v, w) => ({
    to: readInt(v.to, 0, BLOCK_LIMITS.counterTo, undefined, `${w}.to`),
    from: readInt(v.from, 0, BLOCK_LIMITS.counterTo, 0, `${w}.from`),
    prefix: readOptionalText(v.prefix, BLOCK_LIMITS.counterAffix, `${w}.prefix`),
    suffix: readOptionalText(v.suffix, BLOCK_LIMITS.counterAffix, `${w}.suffix`),
    label: readOptionalText(v.label, BLOCK_LIMITS.counterLabel, `${w}.label`),
  })),
  logoType: blockReader(['text', 'mark'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.logoType, `${w}.text`),
    mark: enumValue(v.mark, ['none', 'square', 'circle', 'slash'], 'square', `${w}.mark`),
  })),
  button: blockReader(['label', 'variant', 'press'], (v, w) => ({
    label: readText(v.label, BLOCK_LIMITS.buttonLabel, `${w}.label`),
    variant: enumValue(v.variant, ['filled', 'outline'], 'filled', `${w}.variant`),
    press: readBool(v.press, true, `${w}.press`),
  })),
  form: blockReader(['title', 'fields', 'submit'], (v, w) => ({
    title: readOptionalText(v.title, BLOCK_LIMITS.formTitle, `${w}.title`),
    fields: readTextArray(v.fields, 1, BLOCK_LIMITS.formFields, BLOCK_LIMITS.formField, `${w}.fields`),
    submit: readOptionalText(v.submit, BLOCK_LIMITS.formSubmit, `${w}.submit`),
  })),
  notification: blockReader(['title', 'body', 'mark'], (v, w) => ({
    title: readText(v.title, BLOCK_LIMITS.noticeTitle, `${w}.title`),
    body: readOptionalText(v.body, BLOCK_LIMITS.noticeBody, `${w}.body`),
    mark: enumValue(v.mark, ['none', 'dot', 'check', 'bell'], 'dot', `${w}.mark`),
  })),
  lowerThird: blockReader(['title', 'subtitle', 'side'], (v, w) => ({
    title: readText(v.title, BLOCK_LIMITS.lowerTitle, `${w}.title`),
    subtitle: readOptionalText(v.subtitle, BLOCK_LIMITS.lowerSubtitle, `${w}.subtitle`),
    side: enumValue(v.side, ['left', 'right'], 'left', `${w}.side`),
  })),
  barChart: blockReader(['values', 'labels', 'baseline'], (v, w) => ({
    values: readValues(v.values, BLOCK_LIMITS.barValuesMin, BLOCK_LIMITS.barValues, `${w}.values`),
    labels: readOptionalTextArray(v.labels, BLOCK_LIMITS.barValues, BLOCK_LIMITS.barLabel, `${w}.labels`),
    baseline: readBool(v.baseline, true, `${w}.baseline`),
  })),
  lineChart: blockReader(['values', 'label', 'area'], (v, w) => ({
    values: readValues(v.values, BLOCK_LIMITS.lineValuesMin, BLOCK_LIMITS.lineValues, `${w}.values`),
    label: readOptionalText(v.label, BLOCK_LIMITS.lineLabel, `${w}.label`),
    area: readBool(v.area, true, `${w}.area`),
  })),
  // No audio anywhere in this feature, deliberately, so these two are a MOTIF:
  // bars and a waveform driven by a curve the composition owns. Nothing is being
  // listened to and nothing claims to be.
  equalizer: blockReader(['bars', 'tempo'], (v, w) => ({
    bars: readInt(v.bars, BLOCK_LIMITS.equalizerBarsMin, BLOCK_LIMITS.equalizerBars, 12, `${w}.bars`),
    tempo: enumValue(v.tempo, ['slow', 'steady', 'fast'], 'steady', `${w}.tempo`),
  })),
  soundWave: blockReader(['samples', 'shape'], (v, w) => ({
    samples: readInt(v.samples, BLOCK_LIMITS.waveSamplesMin, BLOCK_LIMITS.waveSamples, 48, `${w}.samples`),
    shape: enumValue(v.shape, ['pulse', 'sweep', 'breathe'], 'sweep', `${w}.shape`),
  })),
  map: blockReader(['region', 'markers', 'connections'], (v, w) => ({
    region: enumValue(v.region, ['world', 'europe', 'americas', 'asia', 'africa'], 'world', `${w}.region`),
    markers: readInt(v.markers, 0, BLOCK_LIMITS.mapMarkers, 3, `${w}.markers`),
    connections: readBool(v.connections, true, `${w}.connections`),
  })),
  // The same world on a sphere, and the same three fields the flat map has: a
  // count of markers and never their positions, because a latitude is a
  // coordinate under another name.
  globe: blockReader(['region', 'markers', 'connections'], (v, w) => ({
    region: enumValue(v.region, ['world', 'europe', 'americas', 'asia', 'africa'], 'world', `${w}.region`),
    markers: readInt(v.markers, 0, BLOCK_LIMITS.mapMarkers, 3, `${w}.markers`),
    connections: readBool(v.connections, true, `${w}.connections`),
  })),
  // A column chart with volume. `plinth` is where the flat chart has `baseline`:
  // a plate rather than a rule, since a line drawn in space is the one element
  // whose thickness a projection is free to change.
  solidChart: blockReader(['values', 'labels', 'plinth'], (v, w) => ({
    values: readValues(v.values, BLOCK_LIMITS.barValuesMin, BLOCK_LIMITS.barValues, `${w}.values`),
    labels: readOptionalTextArray(v.labels, BLOCK_LIMITS.barValues, BLOCK_LIMITS.barLabel, `${w}.labels`),
    plinth: readBool(v.plinth, true, `${w}.plinth`),
  })),
  imageFrame: blockReader(['imageId', 'move', 'treatment', 'caption'], (v, w) => ({
    imageId: readImageId(v.imageId, w),
    move: enumValue(v.move, KEN_BURNS, 'zoom-in', `${w}.move`),
    treatment: enumValue(v.treatment, ['bleed', 'inset', 'card'], 'card', `${w}.treatment`),
    caption: readOptionalText(v.caption, BLOCK_LIMITS.caption, `${w}.caption`),
  })),
  gallery: blockReader(['imageIds', 'layout'], (v, w) => ({
    imageIds: readImageIdArray(v.imageIds, BLOCK_LIMITS.galleryImagesMin, BLOCK_LIMITS.galleryImages, `${w}.imageIds`),
    layout: enumValue(v.layout, ['grid', 'row', 'stack'], 'grid', `${w}.layout`),
  })),
  carousel: blockReader(['imageIds', 'direction'], (v, w) => ({
    imageIds: readImageIdArray(v.imageIds, BLOCK_LIMITS.carouselImagesMin, BLOCK_LIMITS.carouselImages, `${w}.imageIds`),
    direction: enumValue(v.direction, ['left', 'right'], 'left', `${w}.direction`),
  })),
  // The clock does not read this machine's own. Two renders of one timeline have
  // to produce the same bytes, or the content-addressed export store is storing
  // two files for one film.
  clock: blockReader(['face', 'time', 'sweep', 'label'], (v, w) => ({
    face: enumValue(v.face, ['analog', 'digital'], 'analog', `${w}.face`),
    time: readClockTime(v.time, `${w}.time`),
    sweep: enumValue(v.sweep, ['real', 'fast'], 'fast', `${w}.sweep`),
    label: readOptionalText(v.label, BLOCK_LIMITS.clockLabel, `${w}.label`),
  })),
  dateStamp: blockReader(['text', 'treatment'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.dateStamp, `${w}.text`),
    treatment: enumValue(v.treatment, ['plain', 'boxed', 'rule'], 'rule', `${w}.treatment`),
  })),
  // The two blocks that stand a selected picture in real perspective. Refused by
  // name like every other kind, and it matters as much here as it does for a
  // solid: an image built before `three` was added has no canvas at all, so the
  // failure would be a blank zone reported as a successful export.
  photoStage: blockReader(['imageIds', 'frame', 'move'], (v, w) => ({
    imageIds: readImageIdArray(v.imageIds, BLOCK_LIMITS.stageImagesMin, BLOCK_LIMITS.stageImages, `${w}.imageIds`),
    frame: enumValue(v.frame, STAGE_FRAMES, 'card', `${w}.frame`),
    move: enumValue(v.move, STAGE_MOVES, 'orbit', `${w}.move`),
  })),
  photoRing: blockReader(['imageIds', 'frame', 'direction'], (v, w) => ({
    imageIds: readImageIdArray(v.imageIds, BLOCK_LIMITS.ringImagesMin, BLOCK_LIMITS.ringImages, `${w}.imageIds`),
    frame: enumValue(v.frame, STAGE_FRAMES, 'plain', `${w}.frame`),
    direction: enumValue(v.direction, ['left', 'right'], 'left', `${w}.direction`),
  })),
  separator: blockReader(['treatment', 'extent'], (v, w) => ({
    treatment: enumValue(v.treatment, ['rule', 'double', 'dots'], 'rule', `${w}.treatment`),
    extent: enumValue(v.extent, ['short', 'measure', 'full'], 'measure', `${w}.extent`),
  })),
  progressBar: blockReader(['to', 'label', 'showValue'], (v, w) => ({
    to: readInt(v.to, 0, 100, undefined, `${w}.to`),
    label: readOptionalText(v.label, BLOCK_LIMITS.progressLabel, `${w}.label`),
    showValue: readBool(v.showValue, true, `${w}.showValue`),
  })),
  // No language and no theme: the roles ARE the schema, because the palette
  // offers four measured runs on a panel and a highlighter's thirty token
  // colours have nowhere to land. See `CODE_ROLES` in the schema.
  codeBlock: blockReader(['lines', 'caption', 'reveal'], (v, w) => ({
    lines: readCodeLines(v.lines, `${w}.lines`),
    caption: readOptionalText(v.caption, BLOCK_LIMITS.codeCaption, `${w}.caption`),
    reveal: enumValue(v.reveal, ['type', 'lines'], 'lines', `${w}.reveal`),
  })),
  // The one block whose renderer is a dependency. This worker refusing a solid
  // it has no geometry for is the same refusal `RENDERABLE_TEMPLATES` makes one
  // level up, and it matters more here: an image built before `three` was added
  // has no canvas at all, so the failure would be a blank zone reported as a
  // successful export.
  solidScene: blockReader(['solid', 'spin', 'size'], (v, w) => ({
    solid: enumValue(v.solid, SOLIDS, 'cube', `${w}.solid`),
    spin: enumValue(v.spin, SPINS, 'tumble', `${w}.spin`),
    size: enumValue(v.size, ['small', 'medium', 'large'], 'medium', `${w}.size`),
  })),
  // The second block whose renderer is a dependency, and the same refusal
  // applies for the same reason: an image built before `three` was added has no
  // canvas at all, so the failure would be a blank zone reported as a success.
  extrudedType: blockReader(['text', 'level', 'depth', 'spin'], (v, w) => ({
    text: readText(v.text, BLOCK_LIMITS.extrudedType, `${w}.text`),
    level: enumValue(v.level, ['display', 'title'], 'display', `${w}.level`),
    depth: enumValue(v.depth, EXTRUDED_DEPTHS, 'medium', `${w}.depth`),
    spin: enumValue(v.spin, EXTRUDED_SPINS, 'sway', `${w}.spin`),
  })),
  // The three fields drawn in volume. Same renderer as the two above and the
  // same refusal for the same reason: an image built before `three` was added
  // has no canvas at all, so what a stale worker would produce is a blank half
  // of a frame reported as a successful export. There is no seed in any of
  // them, and there is nowhere for one to arrive: two renders of one document
  // have to produce the same bytes, or the content-addressed store files one
  // film twice.
  particleField: blockReader(['count', 'drift'], (v, w) => ({
    count: readInt(v.count, BLOCK_LIMITS.particlesMin, BLOCK_LIMITS.particles, 280, `${w}.count`),
    drift: enumValue(v.drift, PARTICLE_DRIFTS, 'rise', `${w}.drift`),
  })),
  waveMesh: blockReader(['swell', 'tilt'], (v, w) => ({
    swell: enumValue(v.swell, WAVE_SWELLS, 'swell', `${w}.swell`),
    tilt: enumValue(v.tilt, WAVE_TILTS, 'rake', `${w}.tilt`),
  })),
  depthGrid: blockReader(['lines', 'form', 'travel'], (v, w) => ({
    lines: readInt(v.lines, BLOCK_LIMITS.gridLinesMin, BLOCK_LIMITS.gridLines, 10, `${w}.lines`),
    form: enumValue(v.form, GRID_FORMS, 'tunnel', `${w}.form`),
    travel: enumValue(v.travel, GRID_TRAVELS, 'toward', `${w}.travel`),
  })),
}

/** Every block this worker has a component for, in the schema's own order. */
export const RENDERABLE_BLOCKS = Object.keys(BLOCK_READERS)

/**
 * One layer.
 *
 * Refused by NAME when the kind is unknown, exactly as a template is, and for
 * the same reason: this image can be older than the Mocky pointed at it, and a
 * block drawn with the nearest component it does have is a film missing the
 * thing that was asked for, reported as a success.
 */
function readBlock(value, where) {
  object(value, where)
  const kind = value.kind
  if (typeof kind !== 'string' || !Object.hasOwn(BLOCK_READERS, kind)) {
    refuse(
      `${where}.kind is ${JSON.stringify(kind)}; this worker draws ${RENDERABLE_BLOCKS.join(', ')}. ` +
        'Rebuild the worker image if Mocky is newer than it.',
    )
  }
  const reader = BLOCK_READERS[kind]
  onlyKeys(value, reader.keys, where)
  return { kind, ...readPlacement(value, where), ...reader.read(value, where) }
}

const BACKGROUND_READERS = {
  solid: { keys: [], read: () => ({}) },
  hairlines: { keys: [], read: () => ({}) },
  gradient: {
    keys: ['direction'],
    read: (v, w) => ({ direction: enumValue(v.direction, GRADIENT_DIRECTIONS, 'to-bottom', `${w}.direction`) }),
  },
  gridPulse: {
    keys: ['cells'],
    read: (v, w) => ({ cells: readInt(v.cells, BLOCK_LIMITS.gridCellsMin, BLOCK_LIMITS.gridCells, 8, `${w}.cells`) }),
  },
  particles: {
    keys: ['density'],
    read: (v, w) => ({ density: readInt(v.density, 1, BLOCK_LIMITS.particleDensity, 2, `${w}.density`) }),
  },
  image: {
    keys: ['imageId', 'move'],
    read: (v, w) => ({ imageId: readImageId(v.imageId, w), move: enumValue(v.move, KEN_BURNS, 'zoom-in', `${w}.move`) }),
  },
}

/**
 * The ground a composed scene is painted on.
 *
 * Absent means `hairlines`, the same reading the schema gives it: the house's
 * own field of 1 px rules, and the one surface `composedPalette` measures every
 * run against by default.
 */
function readBackground(value, where) {
  if (value === undefined || value === null) return { kind: 'hairlines' }
  object(value, where)
  const kind = value.kind
  if (typeof kind !== 'string' || !Object.hasOwn(BACKGROUND_READERS, kind)) {
    refuse(`${where}.kind is ${JSON.stringify(kind)}; this worker paints ${BACKGROUND_KINDS.join(', ')}.`)
  }
  const reader = BACKGROUND_READERS[kind]
  onlyKeys(value, ['kind', ...reader.keys], where)
  return { kind, ...reader.read(value, where) }
}

function readComposedScene(value, where) {
  onlyKeys(value, ['durationMs', 'background', 'layers', 'transitionOut'], where)
  if (!Array.isArray(value.layers) || value.layers.length === 0) {
    refuse(`${where}.layers must be an array of 1 to ${BLOCK_LIMITS.layersPerScene} blocks.`)
  }
  if (value.layers.length > BLOCK_LIMITS.layersPerScene) {
    refuse(
      `${where}.layers has ${value.layers.length} blocks; a composed scene draws at most ${BLOCK_LIMITS.layersPerScene}. ` +
        'A frame carrying more elements than that is denser than any composition in this image.',
    )
  }
  return {
    durationMs: readDuration(value.durationMs, TEMPLATE_LIMITS.composed, where),
    background: readBackground(value.background, `${where}.background`),
    layers: value.layers.map((layer, i) => readBlock(layer, `${where}.layers[${i}]`)),
    // Its own vocabulary, one value wider than the shared one: see the note on
    // `COMPOSED_TRANSITIONS`. `entranceStyle` draws all five.
    transitionOut: enumValue(value.transitionOut, COMPOSED_TRANSITIONS, 'crossfade', `${where}.transitionOut`),
  }
}

const SCENE_READERS = {
  slideshow: readSlideshowScene,
  overlay: readOverlayScene,
  vertical: readVerticalScene,
  titles: readTitleScene,
  product: readProductScene,
  composed: readComposedScene,
}

/**
 * Every picture one scene needs, wherever it sits on it.
 *
 * Four of the six templates keep theirs on the scene. A composed scene keeps
 * none there: the ground carries one when it is a photograph, and `imageFrame`,
 * `gallery` and `carousel` blocks carry theirs anywhere in the stack — a gallery
 * holds six. A `scenes.map((s) => s.imageId)` here would have staged one picture
 * out of seven and left the composition pointing at addresses with no file
 * behind them, which is a blank frame rendered and reported as a success.
 */
function sceneImageIds(scene) {
  const ids = []
  const push = (value) => {
    if (typeof value === 'string' && value) ids.push(value)
  }
  push(scene?.imageId)
  if (scene?.background?.kind === 'image') push(scene.background.imageId)
  for (const layer of scene?.layers || []) {
    push(layer?.imageId)
    for (const id of layer?.imageIds || []) push(id)
  }
  return ids
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

  // Only the scenes that HAVE an image, and every place one can sit on a scene.
  // A `titles` document has none at all, and `scenes.map((s) => s.imageId)`
  // would hand this loop `[undefined]` — a perfectly valid film refused for not
  // sending bytes for a picture it never named. The same trap `timelineImageIds`
  // exists to close on the Mocky side.
  const needed = [...new Set(timeline.scenes.flatMap(sceneImageIds))]
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
