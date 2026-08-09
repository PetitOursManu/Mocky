// The Remotion half of the worker. Everything that imports `@remotion/*` lives
// here and nowhere else.
//
// That separation is load-bearing rather than tidy: `server.js` is imported by
// a test that runs inside Mocky's own vitest suite, where Remotion is not
// installed and never will be. A single import of `@remotion/renderer` at the
// top of the HTTP layer would make that test fail on every developer machine —
// so `server.js` reaches this module through a dynamic import, and only when a
// render is actually asked for.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { ensureBrowser, makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer'
import { compositionIdFor } from './remotion/composition.js'
import { stageImages, unstage } from './staging.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENTRY_POINT = path.join(HERE, 'remotion', 'index.js')

/**
 * The output format the timeline asks for, as a codec Remotion knows.
 *
 * vp8 rather than vp9 for webm. vp9 encodes several times slower for a gain
 * nobody watching a fifteen-second slideshow will see, and the budget is 110
 * seconds on a container limited to two cores — a format choice that turns a
 * working export into a timeout is not a quality improvement.
 */
const CODECS = { mp4: 'h264', webm: 'vp8' }

/** The codec for a container, or h264. See the note on the lookup below. */
function codecFor(outputFormat) {
  // `Object.hasOwn`, not a plain lookup, for the reason `server/video/store.js`
  // spells out beside its own container table: a plain lookup answers for the
  // whole prototype chain, so `outputFormat: "constructor"` returns a function
  // that is perfectly truthy and reaches Remotion as a codec. Every caller today
  // is validated — this is the second lock, so a validator loosened one day
  // cannot silently become an encoder argument.
  return typeof outputFormat === 'string' && Object.hasOwn(CODECS, outputFormat) ? CODECS[outputFormat] : CODECS.mp4
}

/*
 * Where a request's images are written so Chromium can load them: beside the
 * bundle, which is the one place both halves already agree on. Remotion serves
 * the bundle directory over HTTP for the render, so a file written there is
 * reachable at a root-relative path from the page — same origin, no scheme
 * games, nothing fetched from the network.
 *
 * The two obvious alternatives were tried on paper and both lose. `file://`
 * URLs cannot be loaded as subresources of an `http://` page; Chromium refuses
 * them, and the only way round it is to disable web security in a renderer that
 * is displaying model-supplied content. `data:` URLs work, but they mean up to
 * 80 MB of base64 serialised into the props of a page, which is memory the
 * container does not have to spare while it is also running an encoder.
 *
 * A wrong assumption here fails loudly rather than quietly: the composition uses
 * Remotion's `<Img>`, which cancels the render on a 404 instead of
 * screenshotting an empty box.
 *
 * The naming and the cleanup live in `staging.js` — a module with no Remotion
 * import, so the race that used to be there is now covered by a test.
 */

let bundlePromise = null

/**
 * Compile the compositions once, and hand the same served bundle to every
 * render after that.
 *
 * Memoised because webpack takes tens of seconds on a small VPS and produces
 * byte-identical output every time — paying that on each request would eat most
 * of the 120 s budget Mocky's queue allows a whole job.
 *
 * The failure is deliberately NOT memoised, which is the opposite of what
 * `quality/detect.js` does with its own import failure. The reasoning differs
 * with the failure: a missing detector package stays missing until someone
 * reinstalls, so retrying is pure waste; a bundle fails on a full /tmp or a
 * container still coming up, and those clear on their own. Caching a rejection
 * here would turn a transient condition into a worker that refuses every render
 * until it is restarted.
 */
function servedBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: ENTRY_POINT,
      // Silenced on purpose: webpack progress at container stdout writes a line
      // per percent, and a log nobody can grep is a log that hides the one line
      // that mattered.
      onProgress: () => {},
    }).catch((err) => {
      bundlePromise = null
      throw err
    })
  }
  return bundlePromise
}

/**
 * Fetch Chromium and compile the bundle before the first request needs them.
 *
 * Best effort, and it must stay that way: a warm-up that threw would take down
 * a container whose `/health` is the only thing an administrator has to work
 * with, and the real render would have reported the same problem anyway with a
 * message attached to a job. Failing here only costs the first render its head
 * start.
 *
 * @returns {Promise<{warm: boolean, detail?: string}>}
 */
export async function warmUp(log = console) {
  try {
    await ensureBrowser()
    await servedBundle()
    return { warm: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    log.warn?.(`mocky-video-worker: warm-up failed, the first render will pay for it — ${detail}`)
    return { warm: false, detail }
  }
}

/**
 * Render one VideoTimeline and return its bytes.
 *
 * @param {object} options
 * @param {object} options.timeline                                       validated by `validate.js`, never a raw body
 * @param {Array<{id:string, extension:string, bytes:Buffer}>} options.images
 * @param {string|null} [options.licenseKey]  Remotion licence key, applied only when present
 * @param {AbortSignal} [options.signal]      the route's deadline
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
export async function renderTimeline({ timeline, images = [], licenseKey = null, signal } = {}) {
  await ensureBrowser()
  const serveUrl = await servedBundle()
  const staged = await stageImages(serveUrl, images)
  const { imageSrc } = staged

  // The composition reads both, and `selectComposition` has to be given the
  // same object as `renderMedia`: the geometry and the frame count come out of
  // `calculateMetadata`, so props that differ between the two calls produce a
  // video whose dimensions belong to a timeline it did not render.
  const inputProps = { timeline, imageSrc }

  // Remotion cancels through its own signal object, not an AbortSignal, so the
  // route's deadline has to be bridged. Without the bridge a render the caller
  // gave up on keeps a core busy until it finishes — and since the worker
  // serves one render at a time, that stray render is what every subsequent
  // request queues behind.
  const { cancelSignal, cancel } = makeCancelSignal()
  const onAbort = () => cancel()
  signal?.addEventListener('abort', onAbort, { once: true })
  if (signal?.aborted) cancel()

  try {
    // The composition the document's own template names. A timeline whose
    // template has no composition never reaches this line — `validate.js`
    // refuses it by name, and `compositionIdFor` throws rather than falling back
    // to the slideshow, because drawing a `product` with the slideshow would
    // produce a film with its arguments and its call to action missing and
    // report it as a success.
    const composition = await selectComposition({
      serveUrl,
      id: compositionIdFor(timeline.template),
      inputProps,
      logLevel: 'error',
    })

    const { buffer, contentType } = await renderMedia({
      composition,
      serveUrl,
      codec: codecFor(timeline.outputFormat),
      inputProps,
      // No output location: the bytes come back in memory and go straight into
      // the HTTP response. A file would need a writable path, a name nobody
      // owns, and a cleanup step that runs even when the render throws — for a
      // clip that is about to be sent over a socket anyway. The ceiling is the
      // schema's: two minutes of 1080p, which is far smaller than the 80 MB
      // request that carried the images in.
      outputLocation: null,
      cancelSignal,
      logLevel: 'error',
      // Spread rather than passed as null: from Remotion 5.0 a licensed render
      // is telemetered, so handing this key over is the moment this container
      // acquires an outbound connection. With no key configured the option is
      // not present at all, and the container has no egress — which is exactly
      // what the compose file's `internal: true` network assumes.
      ...(licenseKey ? { licenseKey } : {}),
    })

    if (!buffer) {
      // renderMedia types `buffer` as nullable because it is null whenever an
      // outputLocation was given. We never give one, so this is unreachable
      // until someone adds a file path above and forgets this line — at which
      // point the alternative is an empty 200 that Mocky reports as a
      // successful export of nothing.
      throw new Error('Remotion returned no bytes for this timeline.')
    }
    return { buffer, contentType: contentType || (timeline.outputFormat === 'webm' ? 'video/webm' : 'video/mp4') }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    // This render's own directory, never a shared one. When the route gives up
    // on an overrunning render it frees its `busy` flag at once — the abort is a
    // request, not a guarantee — so this line can run long after the NEXT render
    // has staged its own pictures. Sharing a directory made that line delete
    // them. `staging.js` carries the rest of the story.
    await unstage(staged)
  }
}
