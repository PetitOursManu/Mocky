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
import { TEST_CARD } from './remotion/composition.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENTRY_POINT = path.join(HERE, 'remotion', 'index.js')

/** h264 in an mp4 container. `contentType` comes back from Remotion, not from here. */
const CODEC = 'h264'

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
 * Render the phase-1 test card and return its bytes.
 *
 * The timeline and the images are accepted by the route and ignored here. That
 * is the whole point of this phase — prove that a request travels from the
 * browser through Mocky's queue into Chromium and back as a playable file —
 * and it is also why the picture says so in words.
 *
 * @param {object} [options]
 * @param {string|null} [options.licenseKey]  Remotion licence key, applied only when present
 * @param {AbortSignal} [options.signal]      the route's deadline
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
export async function renderTestCard({ licenseKey = null, signal } = {}) {
  await ensureBrowser()
  const serveUrl = await servedBundle()

  const composition = await selectComposition({ serveUrl, id: TEST_CARD.id })

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
    const { buffer, contentType } = await renderMedia({
      composition,
      serveUrl,
      codec: CODEC,
      // No output location: the bytes come back in memory and go straight into
      // the HTTP response. A file would need a writable path, a name nobody
      // owns, and a cleanup step that runs even when the render throws — for
      // a three-second clip that is about to be sent over a socket anyway.
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
      throw new Error('Remotion returned no bytes for the test card.')
    }
    return { buffer, contentType: contentType || 'video/mp4' }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}
