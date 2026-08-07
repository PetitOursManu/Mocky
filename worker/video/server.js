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
// Nothing here imports Remotion. `render.js` does, behind a dynamic import, so
// that the contract test co-located with this file can run inside Mocky's own
// vitest suite where those packages are not installed.
import express from 'express'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const pkg = createRequire(import.meta.url)('./package.json')

export const VERSION = pkg.version
export const DEFAULT_PORT = 3030

/**
 * Images arrive as base64 inside the JSON body — up to MAX_SCENES of them, and
 * base64 costs a third on top. Express defaults to 100 kB, which would refuse
 * every real timeline with an HTML error page long before phase 2 could send
 * one. The ceiling still exists because an unbounded JSON body is how a worker
 * with a 4 GB memory limit gets killed by something that is not a render.
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
  const { renderTestCard } = await import('./render.js')
  return renderTestCard
}

/**
 * @param {object} [deps]
 * @param {string} [deps.version]
 * @param {(opts:{timeline:unknown, images:unknown, licenseKey:string|null, signal:AbortSignal})=>Promise<{buffer:Buffer, contentType:string}>} [deps.renderVideo]
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
    busy = true

    const controller = new AbortController()
    let timer = null
    const expired = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs)
      // Unref'd so a pending deadline cannot be the reason the container
      // refuses to stop when an administrator asks it to.
      timer.unref?.()
    })

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const licenseKey = typeof body.licenseKey === 'string' && body.licenseKey.trim() ? body.licenseKey.trim() : null

    try {
      /*
       * Raced rather than awaited, for the reason the queue on the Mocky side
       * races too: aborting is a request, not a guarantee. A renderer that
       * ignores the signal would otherwise hold `busy` for as long as it liked,
       * and every later request would get a 429 explaining that a render is in
       * progress — which is true, and useless, and lasts until a restart.
       */
      const running = Promise.resolve().then(() =>
        render({ timeline: body.timeline, images: body.images, licenseKey, signal: controller.signal }),
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
      // Stated in the response as well as burnt into the picture. A file that
      // reaches the video library carries no header with it, but a developer
      // reading a network trace and wondering why the images were ignored
      // should not have to open the mp4 to find out.
      res.set('x-mocky-worker-phase', 'test-card')
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

  log.warn?.(
    'mocky-video-worker: PHASE 1 — /render returns a three-second test card and ignores the timeline and images it is sent.',
  )
  log.log?.(`mocky-video-worker ${VERSION} listening on 0.0.0.0:${port}`)

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
