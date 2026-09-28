/**
 * The heartbeat behind Admin → Activity: "this tab is open, it is (or is not)
 * in front, and it is on this screen".
 *
 * Needed because nothing else says it. Generation runs in the browser, so a
 * person reading their canvas sends the server nothing for minutes on end, and
 * the only thing their account would otherwise show is the time of their last
 * model call. See server/admin/presence.js for how the beats become "active",
 * "idle" and "offline".
 *
 * What travels is a random id minted per tab, the route name and a boolean —
 * never a project, a screen or anything typed. 30 s, because a hidden tab has
 * its timers throttled to one a minute anyway and the server allows 150 s.
 */

const BEAT_MS = 30_000
const URL_ = '/api/presence'

function mintTabId(): string {
  try {
    return `tab-${crypto.randomUUID()}`
  } catch {
    // An insecure origin (plain http on a LAN IP) has no randomUUID.
    return `tab-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }
}

/** One id per page load: two tabs of the same account are two tabs. */
const TAB = mintTabId()

let areaOf: () => string = () => 'home'
let running = false

/** Send one beat now — on start, on a route change, on becoming visible. */
export function beatNow(): void {
  if (!running) return
  fetch(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    // Survives the tab closing mid-request, like the beacon below.
    keepalive: true,
    body: JSON.stringify({ tab: TAB, area: areaOf(), visible: document.visibilityState === 'visible' }),
  }).catch(() => {
    /* offline: the next beat, or the server's own timeout, settles it */
  })
}

/**
 * Start beating for a signed-in account. Returns the stop function — call it on
 * sign-out, so a tab that has lost its session does not keep asking.
 */
export function startPresence(area: () => string): () => void {
  areaOf = area
  running = true
  beatNow()
  const timer = window.setInterval(beatNow, BEAT_MS)
  const onVisibility = () => beatNow()
  // `pagehide` rather than `beforeunload`: it also fires on mobile when the tab
  // is swapped out, and it does not disable the back/forward cache.
  const onHide = () => {
    try {
      navigator.sendBeacon?.(URL_, new Blob([JSON.stringify({ tab: TAB, leaving: true })], { type: 'application/json' }))
    } catch {
      /* the 150 s timeout covers it */
    }
  }
  // Coming back from the back/forward cache is a page that never reloaded.
  const onShow = (e: PageTransitionEvent) => {
    if (e.persisted) beatNow()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHide)
  window.addEventListener('pageshow', onShow)
  return () => {
    running = false
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onHide)
    window.removeEventListener('pageshow', onShow)
  }
}
