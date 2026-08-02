// A deadline on every provider call.
//
// Only fal had one. The other four awaited `fetch` with nothing to stop it, in
// front of a queue that is strictly serial and shared by every user of the
// instance — so one provider that accepts the connection and then goes quiet
// (Pollinations under load, an sd-webui whose GPU is wedged) held the queue for
// undici's 300-second body timeout while every other request waited its turn.
// One stalled provider, and image generation was dead instance-wide with no
// message anywhere.

/** How long any single provider HTTP call may take before it is abandoned. */
export const PROVIDER_TIMEOUT_MS = 90_000

/**
 * Health probes get a much shorter one. `pick()` awaits every probe in turn, so
 * a provider that accepts the connection and stalls would otherwise delay the
 * fallback to `none` by the full generation timeout — on a request that has not
 * even started generating yet.
 */
export const PROBE_TIMEOUT_MS = 10_000

/**
 * `fetch` with an abort deadline, preserving the caller's own signal if it
 * passed one.
 *
 * @param {(url: string, init?: object) => Promise<Response>} fetchImpl
 * @param {string} url
 * @param {object} [init]
 * @param {number} [timeoutMs]
 */
export async function fetchWithTimeout(fetchImpl, url, init = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: init.signal || ctrl.signal })
  } catch (err) {
    // An abort here is our own deadline, not a provider error. Say which.
    if (err?.name === 'AbortError' && ctrl.signal.aborted) {
      throw new Error(`provider did not answer within ${Math.round(timeoutMs / 1000)}s`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
