// HTTP client for the Remotion render worker.
//
// The worker is a SEPARATE Docker service, absent from the default compose file
// (`profiles: ["video-export"]`). The reason is as much legal as technical:
// Remotion is free for individuals, non-profits and companies up to three
// employees, and its licence does not address redistribution inside a
// self-hosted product. Leaving the worker out of the default image means whoever
// turns it on builds it themselves and answers for their own situation — so this
// module talks to something that, on most instances, is simply not there. Every
// function here is written for that as the normal case, not the error case.
import fs from 'node:fs'
import { assertSafeTargetResolved } from '../provider-proxy.js'

/** A health probe is a liveness question. It must answer faster than a person gives up. */
export const HEALTH_TIMEOUT_MS = 3000

/**
 * The check an administrator-configured worker URL gets: the scheme, and that it
 * parses at all.
 *
 * This is the THIRD administrator-only bypass of the SSRF guard, alongside the
 * admin text target and the sd-webui base URL. It is enumerated with them in
 * `docs/architecture/invariants.md` — that list is short and complete on purpose,
 * and a bypass added without an entry there would turn it from a rule into a
 * description.
 *
 * It exists because the guarded version had no working configuration at all: the
 * worker ships as a compose service on an `internal: true` bridge with no
 * published port, so `http://video-worker:3030` resolves into 172.16/12,
 * `assertSafeTargetResolved` refused it, and every render died before leaving
 * Mocky. The advice that refusal forced into the admin panel — "expose the
 * worker on a publicly resolvable address" — asked an operator to put an
 * unauthenticated endpoint accepting 80 MB bodies on the open internet, which is
 * a far worse trade than the one the guard was making.
 *
 * The guard's purpose is to stop a BROWSER choosing where the server fetches.
 * This URL reaches the server only through `PUT /api/admin/video/config` behind
 * `requireAdmin`, and it is local by definition — the same reasoning that
 * exempts the sd-webui base URL, whose own default is `http://127.0.0.1:7860`.
 *
 * What does not move: the scheme, because `file:` and `gopher:` are not
 * misconfigurations anyone recovers from, and `redirect: 'manual'` on both calls
 * below — a worker answering 302 towards the metadata endpoint would otherwise
 * turn an admin's typo into an SSRF the bypass never intended to grant. An
 * operator running the worker on a public host passes `assertSafeTargetResolved`
 * back in as `guard` and loses nothing.
 */
export function assertWorkerTarget(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    // `new URL` throws "Invalid URL" with no hint of which field it read. The
    // admin panel prints this string next to the input it came from.
    throw new Error(`The render worker URL could not be parsed: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`The render worker URL must be http or https, not ${parsed.protocol}`)
  }
  return parsed
}

export function createVideoWorker({ config, fetchImpl = fetch, guard = assertWorkerTarget } = {}) {
  /**
   * Where to send this call, checked afresh every time.
   *
   * Read at call time, not at construction, so an admin who fixes the URL sees
   * it take effect without a restart — the same rule `frameSettings` follows in
   * the videos service.
   *
   * `guard` is a parameter, not a hard-coded call, because an operator who runs
   * the worker on a public host and wants the full SSRF guard back can pass
   * `assertSafeTargetResolved` here and lose nothing. A refusal is reported as a
   * reason an admin can read rather than swallowed, because "unavailable" with
   * no explanation is how a configuration problem becomes a support thread.
   */
  async function target() {
    const cfg = config?.get?.() || {}
    const url = typeof cfg.workerUrl === 'string' ? cfg.workerUrl.trim().replace(/\/+$/, '') : ''
    if (!url) return { reason: 'not-configured', detail: 'No render worker URL is configured.' }
    try {
      await guard(url)
    } catch (err) {
      return { reason: 'blocked-target', detail: err instanceof Error ? err.message : String(err) }
    }
    return { url, licenseKey: cfg.licenseKey || null }
  }

  /**
   * Is a worker there, and what is it?
   *
   * Never throws — it is called from a status route that has to answer
   * something, and from an admin panel where "I could not tell" is a legitimate
   * answer but a 500 is not (Q1's posture: failing to CHECK must not look like
   * failing to DO).
   *
   * @returns {Promise<{available:boolean, reason?:string, detail?:string, version?:string}>}
   */
  async function health() {
    const t = await target()
    if (!t.url) return { available: false, reason: t.reason, detail: t.detail }
    try {
      const res = await fetchImpl(`${t.url}/health`, {
        headers: { accept: 'application/json' },
        // Not followed, for the same reason the provider proxy does not follow
        // them: a target that passes the guard and then answers 302 towards the
        // metadata endpoint walks around the check in one step.
        redirect: 'manual',
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { available: false, reason: 'http-error', detail: `The worker answered ${res.status}.` }
      }
      const body = await res.json().catch(() => ({}))
      const version = typeof body?.version === 'string' ? body.version : undefined
      return { available: true, version }
    } catch (err) {
      // A timeout, a refused connection and a DNS failure all land here and all
      // mean the same thing to the admin: nothing is listening at that address.
      return { available: false, reason: 'unreachable', detail: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Ask the worker for one video.
   *
   * Unlike `health`, this DOES throw: it runs inside the queue, whose whole job
   * is to turn a rejection into a job marked `error` with the message attached.
   * Swallowing here would produce a job that succeeded with nothing to show.
   *
   * @param {object} timeline  already parsed by VideoTimelineSchema — never a raw body
   * @param {Array<{id:string, mime:string, base64:string}>} images
   * @returns {Promise<{buffer:Buffer, contentType:string, bytes:number}>}
   */
  async function render(timeline, images, { signal } = {}) {
    const t = await target()
    if (!t.url) {
      const err = new Error(t.detail)
      err.code = t.reason
      throw err
    }
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      redirect: 'manual',
      // The licence key travels with the request because the worker is what
      // renders, and from Remotion 5.0 telemetry is mandatory for a licensed
      // render. Sending it is therefore the moment the worker container acquires
      // an outbound connection to Remotion; with no key it has none at all. That
      // consequence belongs to the admin, which is why the key is entered
      // explicitly and why the panel must say so at the point of entry rather
      // than turning egress on quietly.
      body: JSON.stringify({ timeline, images, licenseKey: t.licenseKey || undefined }),
      signal,
    }

    let res
    try {
      res = await fetchImpl(`${t.url}/render`, request)
    } catch (err) {
      // An abort is the queue's timeout doing its job and already has a message
      // the user can read; rewriting it would replace "we gave up after 120 s"
      // with "the network failed", which is not what happened.
      if (err?.name === 'AbortError') throw err
      // Everything else arrives as undici's bare "fetch failed", which lands on
      // the job as the entire explanation. Naming the worker is the difference
      // between an admin checking the compose profile and a user filing a bug
      // against Mocky. The URL itself stays out: it is admin configuration, and
      // this message is read by whoever asked for the export.
      throw new Error(`The render worker could not be reached: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`The render worker answered ${res.status}${detail ? `: ${detail.slice(0, 300)}` : '.'}`)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!buffer.length) throw new Error('The render worker returned an empty file.')
    return {
      buffer,
      contentType: res.headers?.get?.('content-type') || 'video/mp4',
      bytes: buffer.length,
    }
  }

  // `target` is exported for tests and for the queue's own diagnostics, and it
  // is the one function here that returns the licence key in clear. Nothing may
  // hand its result to a response: `publicVideoConfig()` is the only shape the
  // config leaves the server in, and it turns that key into a boolean. A route
  // answering `res.json(await worker.target())` would undo every other
  // precaution in this file in one line.
  return { health, render, target }
}

/**
 * The picture bytes a timeline needs, keyed by the id that names them.
 *
 * They travel inside the request rather than as `${origin}/api/images/:hash`
 * URLs, and that is not the obvious choice — those URLs are deliberately
 * unauthenticated (see the mount in server/index.js) precisely so a client with
 * no session can fetch them. But the worker is a container under an opt-in
 * compose profile, with no guarantee of a route back to Mocky and no way to know
 * what Mocky's own origin looks like from inside it: on a home server that is
 * frequently a name which only resolves on the LAN. A render that fails because
 * the worker could not reach the images is a failure with nothing to fix in the
 * worker. Sending the bytes is bounded by MAX_SCENES and removes the question.
 *
 * Deduplicated, because a timeline reusing one image across ten scenes is the
 * common shape and would otherwise be sent ten times.
 *
 * Throws when a file has gone. The routes check existence at enqueue time, but a
 * render happens later, and an image the user deleted in between must fail the
 * job with a sentence naming it — not produce a video with a missing frame.
 */
export function collectImages(library, timeline) {
  const ids = [...new Set((timeline?.scenes || []).map((s) => s.imageId))]
  return ids.map((id) => {
    const file = library.filePath(id)
    if (!file || !library.fileExists(id)) {
      throw new Error(`Image ${id} is no longer in the library, so this timeline cannot be rendered.`)
    }
    return { id, mime: library.mimeFor(id), base64: fs.readFileSync(file).toString('base64') }
  })
}
