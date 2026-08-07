// The worker's HTTP surface: two routes, and the smallest amount of Express
// that can carry a video back.
//
// The client is `server/video/worker.js` in the Mocky repository, and its
// expectations are the specification for everything here:
//
//   GET  /health   200 {ok, version}   — anything else means "unavailable"
//   POST /render   the video bytes     — an empty body is treated as a failure
//
// It reads at most 300 characters of a non-2xx body straight into the sentence
// the user sees, which is why every refusal below is one line of plain text
// rather than JSON or an Express HTML page.
//
// Nothing here imports Remotion — and neither do `validate.js` and
// `remotion/composition.js`, which is why they can be imported at the top.
// `render.js` does, behind a dynamic import, so that the contract test
// co-located with this file can run inside Mocky's own vitest suite where those
// packages are not installed.
import express from 'express'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { validateRenderRequest } from './validate.js'
import { IMAGE_SEQUENCE } from './remotion/composition.js'

const pkg = createRequire(import.meta.url)('./package.json')

export const VERSION = pkg.version
export const DEFAULT_PORT = 3030

/**
 * Images arrive as base64 inside the JSON body — up to MAX_SCENES of them, and
 * base64 costs a third on top. Express defaults to 100 kB, which refuses every
 * real timeline with an HTML error page. The ceiling still exists because an
 * unbounded JSON body is how a worker with a 4 GB memory limit gets killed by
 * something that is not a render.
 */
export const MAX_BODY = '80mb'

/**
 * How long one render may run before the worker abandons it.
 *
 * Ten seconds under Mocky's JOB_TIMEOUT_MS, deliberately. Whichever side gives
 * up first is the side that gets to explain what happened, and "the worker gave
 * up after 110 s" names the machine an administrator can go and look at, while
 * the queue's own timeout only says the render did not finish.
 */
export const RENDER_TIMEOUT_MS = 110_000

/** Plain text, one line, no stack. See the note about the 300-character splice above. */
const fail = (res, status, message) => res.status(status).type('text/plain').send(message)

/** Loaded on demand so this module stays importable without Remotion installed. */
async function loadRenderer() {
  const { renderTimeline } = await import('./render.js')
  return renderTimeline
}

/**
 * @param {object} [deps]
 * @param {string} [deps.version]
 * @param {(opts:{timeline:object, images:Array<object>, licenseKey:string|null, signal:AbortSignal})=>Promise<{buffer:Buffer, contentType:string}>} [deps.renderVideo]
 * @param {number} [deps.timeoutMs]
 * @param {Console} [deps.log]
 */
export function createApp({ version = VERSION, renderVideo, timeoutMs = RENDER_TIMEOUT_MS, log = console } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: MAX_BODY }))

  const render = renderVideo || (async (opts) => (await loadRenderer())(opts))

  /*
   * One render at a time.
   *
   * Mocky's queue already serialises jobs, so on a healthy instance this flag
   * never trips — and that is exactly why it is here. The worker is a plain
   * HTTP service on a network; nothing stops a second Mocky, a retried request
   * or a curl from arriving mid-render, and two Remotion renders on the two
   * cores this container is limited to do not take half the time each, they
   * take rather more than the same total while both look hung.
   */
  let busy = false

  app.get('/health', (_req, res) => {
    res.json({ ok: true, version })
  })

  app.post('/render', async (req, res) => {
    if (busy) {
      return fail(res, 429, 'The render worker is already rendering. It runs one video at a time; try again when that one finishes.')
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const licenseKey = typeof body.licenseKey === 'string' && body.licenseKey.trim() ? body.licenseKey.trim() : null

    /*
     * Checked here, before the slot is taken, and checked at all because this
     * worker does not trust its caller.
     *
     * Mocky validates the same document against the zod schema before it ever
     * enqueues a job, so on a healthy instance this never refuses anything. It
     * is defence in depth for the case the compose file describes but cannot
     * enforce: a plain HTTP service, no authentication of its own, one internal
     * bridge away from anything that can open a socket. `validate.js` carries
     * the full reasoning.
     *
     * Refusing before `busy = true` matters on its own — a caller sending a
     * malformed body in a loop would otherwise hold the render slot closed
     * against the one request that was correct.
     */
    const parsed = validateRenderRequest(body)
    if (!parsed.ok) {
      return fail(res, 400, `The render request was refused: ${parsed.message}`)
    }

    busy = true

    const controller = new AbortController()
    let timer = null
    const expired = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs)
      // Unref'd so a pending deadline cannot be the reason the container
      // refuses to stop when an administrator asks it to.
      timer.unref?.()
    })

    try {
      /*
       * Raced rather than awaited, for the reason the queue on the Mocky side
       * races too: aborting is a request, not a guarantee. A renderer that
       * ignores the signal would otherwise hold `busy` for as long as it liked,
       * and every later request would get a 429 explaining that a render is in
       * progress — which is true, and useless, and lasts until a restart.
       */
      const running = Promise.resolve().then(() =>
        // The PARSED timeline and images, never `req.body`. The validator
        // applies the schema's own defaults — `kenBurns: 'static'`,
        // `transitionOut: 'crossfade'`, `aspectRatio: '16:9'` — and decodes the
        // base64 once, so the renderer never has to decide what an absent field
        // meant.
        render({ timeline: parsed.timeline, images: parsed.images, licenseKey, signal: controller.signal }),
      )
      const outcome = await Promise.race([running.then((value) => ({ value })), expired])

      if (outcome.timedOut) {
        controller.abort()
        return fail(res, 504, `The render did not finish within ${Math.round(timeoutMs / 1000)} seconds and was abandoned.`)
      }

      const { buffer, contentType } = outcome.value || {}
      if (!buffer || !buffer.length) {
        return fail(res, 500, 'The render produced no bytes.')
      }

      res.status(200)
      res.type(contentType || 'video/mp4')
      // Which composition produced these bytes. It replaced
      // `x-mocky-worker-phase: test-card`, whose job was to warn that the
      // response was NOT the requested timeline — a worker that renders the
      // timeline has nothing to apologise for, but a developer reading a
      // network trace still wants to know what rendered it without opening the
      // file. It is also the fastest way to catch a container left behind on an
      // older image.
      res.set('x-mocky-worker-composition', IMAGE_SEQUENCE.id)
      res.send(buffer)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      // Logged in full here, sent in one line there. The container's log is
      // where the stack belongs; the user's error message is not.
      log.error?.(`mocky-video-worker: render failed — ${detail}`)
      fail(res, 500, `The render failed: ${detail}`)
    } finally {
      clearTimeout(timer)
      busy = false
    }
  })

  // A workerUrl with a path in it (`http://host:3030/api`) is a typo an admin
  // makes once. Express answers it with an HTML "Cannot POST" page, 300
  // characters of which end up quoted inside the user's error message.
  app.use((req, res) => fail(res, 404, `No such route on the render worker: ${req.method} ${req.path}`))

  // Same reasoning for a body Express itself refuses — too large, or not valid
  // JSON. Four arguments, because that is how Express recognises an error
  // handler; `_next` is unused and has to be there.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = Number(err?.status) || 400
    fail(res, status, `The request was refused: ${err?.message || 'malformed body'}`)
  })

  return app
}

/**
 * Start listening. Separate from `createApp` so tests build the app without
 * binding a port, and so the warm-up can run after the socket is open rather
 * than before it — a container that answers `/health` while it is still
 * fetching Chromium is far easier to diagnose than one that answers nothing.
 */
export async function start({ port = Number(process.env.PORT) || DEFAULT_PORT, log = console } = {}) {
  const app = createApp({ log })

  await new Promise((resolve) => {
    // 0.0.0.0, not loopback: inside a container, listening on 127.0.0.1 would
    // make the service reachable only by itself. The equivalent protection is
    // on the compose side — an internal network with no published port.
    app.listen(port, '0.0.0.0', resolve)
  })

  log.log?.(`mocky-video-worker ${VERSION} listening on 0.0.0.0:${port} — composition ${IMAGE_SEQUENCE.id}`)

  // Caught, including the import itself. `warmUp` already degrades on its own,
  // but a renderer that will not even load — a half-finished `npm install`, a
  // platform Remotion has no binary for — would otherwise take down the one
  // thing an administrator has to work with. A container answering /health and
  // failing every render is diagnosable; a container that exits on boot is a
  // restart loop and a log line nobody catches.
  try {
    const { warmUp } = await import('./render.js')
    await warmUp(log)
    log.log?.('mocky-video-worker: ready')
  } catch (err) {
    log.error?.(
      'mocky-video-worker: the renderer could not be loaded — /health answers, every /render will fail. ' +
        (err instanceof Error ? err.message : String(err)),
    )
  }
}

// Only when run directly, so importing this file from a test costs nothing.
// `pathToFileURL` rather than string concatenation: on Windows a developer's
// path is `C:\...`, which never equals a `file://` URL built by hand, and the
// worker would silently refuse to start when run from a checkout.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((err) => {
    console.error(`mocky-video-worker: could not start — ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
