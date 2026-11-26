// Which engine draws a film, and what happens when it cannot.
//
// Two engines render the same compositions — HyperFrames (`render.hyperframes.js`,
// Apache-2.0) and Remotion (`render.js`) — and only `remotion/clock.js` differs
// between them. HyperFrames is the default since 2026-11: it rendered the
// reference corpus to within an SSIM of 0.986 of Remotion's frames on every
// frame, at the same speed, and it carries no licence question. Remotion stays
// as the FALLBACK, because a younger engine (0.9.x when it was adopted) that
// fails on a film nobody has tried yet should cost a retry, not an export.
//
// No engine is imported here: `server.js` imports this file at the top and is
// itself imported by a test that runs where neither engine is installed.

export const ENGINES = ['hyperframes', 'remotion']
export const DEFAULT_ENGINE = 'hyperframes'

const MODULES = {
  hyperframes: './render.hyperframes.js',
  remotion: './render.js',
}

/**
 * The engines to try, in order.
 *
 * `MOCKY_VIDEO_ENGINE` names the first (unknown values are the default, as a
 * mistyped setting should behave like an unset one); the other follows unless
 * `MOCKY_VIDEO_FALLBACK=none`. An image built without Remotion sets it (to
 * `false`), and so would an administrator who prefers a failed export to a film drawn by
 * the engine they did not choose.
 */
export function enginesFor(env = process.env) {
  const asked = String(env?.MOCKY_VIDEO_ENGINE || '').trim().toLowerCase()
  const first = ENGINES.includes(asked) ? asked : DEFAULT_ENGINE
  // `none`, or `false` — which is what the Dockerfile writes when the image was
  // built WITHOUT Remotion (`WITH_REMOTION=false`), so that image never tries
  // to load an engine it does not carry.
  const off = ['none', 'false'].includes(String(env?.MOCKY_VIDEO_FALLBACK || '').trim().toLowerCase())
  return off ? [first] : [first, ...ENGINES.filter((e) => e !== first)]
}

/** Loaded on demand, so a missing engine is a failed render, not a failed boot. */
export async function loadEngine(engine) {
  return import(MODULES[engine])
}

/**
 * Render with the first engine that succeeds.
 *
 * Falls back on any failure EXCEPT the caller giving up: an aborted render is
 * the deadline speaking, and starting a second engine after it would render a
 * film nobody is waiting for while the slot looks free. The fallback shares the
 * same signal, so it gets what is left of the deadline and no more.
 *
 * @returns {Promise<{buffer: Buffer, contentType: string, engine: string}>}
 */
export async function renderWithFallback(options, { engines = enginesFor(), load = loadEngine, log = console } = {}) {
  let first = null
  for (const engine of engines) {
    if (options.signal?.aborted) break
    try {
      const { renderTimeline } = await load(engine)
      const result = await renderTimeline(options)
      return { ...result, engine }
    } catch (err) {
      if (options.signal?.aborted) throw err
      first ??= { engine, err }
      const detail = err instanceof Error ? err.message : String(err)
      const next = engines[engines.indexOf(engine) + 1]
      log.warn?.(`mocky-video-worker: ${engine} could not render this film${next ? `, trying ${next}` : ''} — ${detail}`)
    }
  }
  // The FIRST engine's error is the one reported: it is the engine that was
  // chosen, and a fallback that merely failed too says less about why.
  throw first ? first.err : new Error('The render was abandoned before any engine started.')
}

/** Every engine warmed in order, each on its own terms; never throws. */
export async function warmUpEngines({ engines = enginesFor(), load = loadEngine, log = console } = {}) {
  const report = {}
  for (const engine of engines) {
    try {
      const { warmUp } = await load(engine)
      report[engine] = await warmUp(log)
    } catch (err) {
      report[engine] = { warm: false, detail: err instanceof Error ? err.message : String(err) }
      log.warn?.(`mocky-video-worker: the ${engine} engine could not be loaded — ${report[engine].detail}`)
    }
  }
  return report
}
