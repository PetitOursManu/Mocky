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

export const MAX_SCENES = 20
export const MIN_SCENE_DURATION_MS = 1000
export const MAX_SCENE_DURATION_MS = 15000
export const MAX_TOTAL_DURATION_MS = 120000
export const MAX_OVERLAY_LENGTH = 120

export const KEN_BURNS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']
export const TRANSITIONS = ['crossfade', 'wipe-left', 'wipe-right', 'none']
export const OVERLAY_POSITIONS = ['top', 'center', 'bottom']
export const OUTPUT_FORMATS = ['mp4', 'webm']
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1']

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

function readOverlay(value, where) {
  if (value === undefined || value === null) return null
  object(value, where)
  onlyKeys(value, ['content', 'position'], where)
  if (typeof value.content !== 'string' || value.content.trim() === '') {
    refuse(`${where}.content must be a non-empty string.`)
  }
  if (value.content.length > MAX_OVERLAY_LENGTH) {
    refuse(`${where}.content is ${value.content.length} characters; the maximum is ${MAX_OVERLAY_LENGTH}.`)
  }
  return {
    content: value.content,
    position: enumValue(value.position, OVERLAY_POSITIONS, undefined, `${where}.position`),
  }
}

function readScene(value, index) {
  const where = `scenes[${index}]`
  object(value, where)
  onlyKeys(value, ['imageId', 'durationMs', 'kenBurns', 'transitionOut', 'textOverlay'], where)

  if (typeof value.imageId !== 'string' || !IMAGE_ID.test(value.imageId)) {
    // The two mistakes anyone actually makes, named — a URL, or upper-case hex.
    // The worker never resolves an address of its own accord (it has no egress
    // at all), so a URL here is not a slow failure, it is a request that can
    // never work.
    refuse(`${where}.imageId must be a 64-character lower-case SHA-256 from the image library, not a URL.`)
  }
  if (!Number.isInteger(value.durationMs) || value.durationMs < MIN_SCENE_DURATION_MS || value.durationMs > MAX_SCENE_DURATION_MS) {
    refuse(
      `${where}.durationMs must be a whole number of milliseconds between ${MIN_SCENE_DURATION_MS} and ${MAX_SCENE_DURATION_MS}; it is ${JSON.stringify(value.durationMs)}.`,
    )
  }
  return {
    imageId: value.imageId,
    durationMs: value.durationMs,
    kenBurns: enumValue(value.kenBurns, KEN_BURNS, 'static', `${where}.kenBurns`),
    transitionOut: enumValue(value.transitionOut, TRANSITIONS, 'crossfade', `${where}.transitionOut`),
    textOverlay: readOverlay(value.textOverlay, `${where}.textOverlay`),
  }
}

function readTimeline(value) {
  object(value, 'timeline')
  onlyKeys(value, ['scenes', 'outputFormat', 'aspectRatio'], 'timeline')

  if (!Array.isArray(value.scenes) || value.scenes.length === 0) {
    refuse('timeline.scenes must be a non-empty array.')
  }
  if (value.scenes.length > MAX_SCENES) {
    refuse(`timeline.scenes has ${value.scenes.length} entries; the maximum is ${MAX_SCENES}.`)
  }
  const scenes = value.scenes.map(readScene)

  // The bound no per-scene check can see. Twenty legal scenes of fifteen
  // seconds are five minutes of Chromium on a container whose caller gives up
  // after two — a render nobody would ever collect, paid for in full.
  const total = scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
  if (total > MAX_TOTAL_DURATION_MS) {
    refuse(
      `The scenes add up to ${total} ms; this worker renders at most ${MAX_TOTAL_DURATION_MS} ms (${MAX_TOTAL_DURATION_MS / 1000} seconds).`,
    )
  }

  return {
    scenes,
    outputFormat: enumValue(value.outputFormat, OUTPUT_FORMATS, 'mp4', 'timeline.outputFormat'),
    aspectRatio: enumValue(value.aspectRatio, ASPECT_RATIOS, '16:9', 'timeline.aspectRatio'),
  }
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

  const needed = [...new Set(timeline.scenes.map((scene) => scene.imageId))]
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
