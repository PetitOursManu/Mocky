// Who is connected right now, as far as this process has seen.
//
// Held in memory and never written: "online" is a fact about the last minute,
// and a restart that forgets it loses nothing a heartbeat does not restore
// thirty seconds later. Persisting it would put a disk write on every request
// of every user for a number nobody reads after the fact.
//
// Two signals, because either alone lies:
//  - a REQUEST says the account did something, but a person reading their canvas
//    sends nothing for minutes at a time — generation runs in the browser and the
//    server only relays the model call;
//  - a HEARTBEAT says a tab is open, and whether it is in front, but an old tab
//    left behind a dozen others keeps beating all day.
// So a visible tab or a recent request is "active", a tab that is open but
// hidden is "idle", and silence past ONLINE_MS is "offline".

/**
 * How long a tab counts as open after its last heartbeat.
 *
 * Not the 30 s the client beats at: a hidden tab has its timers throttled to one
 * a minute by every major browser (Chrome's intensive throttling), so a window
 * of 60 s would flicker every background tab offline between two beats.
 */
export const ONLINE_MS = 150_000

/** A request is proof of activity for this long. */
export const ACTIVE_REQUEST_MS = 60_000

/** Routes a heartbeat may report. Anything else is recorded as unknown. */
export const AREAS = new Set(['home', 'project', 'design', 'media', 'settings', 'admin'])

/** A tab id is minted by the client; bounded so it cannot grow the map. */
const TAB_ID = /^[a-zA-Z0-9-]{8,64}$/

/** More open tabs than this for one account is a runaway script, not a person. */
const MAX_TABS = 20

/** Forget an account entirely after this long without a sign of life. */
const FORGET_MS = 24 * 60 * 60 * 1000

export function createPresence({ now = Date.now } = {}) {
  /**
   * userId → { lastSeen, lastRequest, tabs: Map<tabId, { lastSeen, visible, area }> }
   * `lastSeen` is kept apart from the tabs because expired tabs are dropped, and
   * "last seen 3 hours ago" must survive the tab it was seen in.
   */
  const users = new Map()

  function entry(userId) {
    let e = users.get(userId)
    if (!e) {
      e = { lastSeen: 0, lastRequest: 0, tabs: new Map(), gone: new Map() }
      users.set(userId, e)
    }
    return e
  }

  return {
    /** Any authenticated request. Cheap on purpose: it runs on every one. */
    touch(userId) {
      if (!userId) return
      const e = entry(userId)
      e.lastRequest = e.lastSeen = now()
    },

    /**
     * A tab says it is open. Returns false for a malformed beat, which the route
     * still answers 204 — a heartbeat that fails loudly would only fill a console.
     */
    beat(userId, { tab, area, visible } = {}) {
      if (!userId || typeof tab !== 'string' || !TAB_ID.test(tab)) return false
      const e = entry(userId)
      // A beat can arrive AFTER the same tab's goodbye: sign-in reloads the page
      // right after the first beat is sent, and the beacon of the unloading page
      // overtakes the fetch. Without this the closed tab counts for 150 s.
      const goneAt = e.gone.get(tab)
      if (goneAt !== undefined && now() - goneAt < ONLINE_MS) return true
      if (!e.tabs.has(tab) && e.tabs.size >= MAX_TABS) {
        // Drop the stalest tab rather than refuse the newest: the newest is the
        // one somebody is looking at.
        let oldest = null
        for (const [id, t] of e.tabs) if (!oldest || t.lastSeen < e.tabs.get(oldest).lastSeen) oldest = id
        if (oldest) e.tabs.delete(oldest)
      }
      e.lastSeen = now()
      e.tabs.set(tab, {
        lastSeen: e.lastSeen,
        visible: visible !== false,
        area: AREAS.has(area) ? area : null,
      })
      return true
    },

    /** The tab is closing (`pagehide`), so it stops counting now rather than in 150 s. */
    leave(userId, tab) {
      const e = entry(userId)
      e.tabs.delete(tab)
      if (typeof tab === 'string' && TAB_ID.test(tab)) {
        e.gone.set(tab, now())
        for (const [id, at] of e.gone) if (now() - at >= ONLINE_MS) e.gone.delete(id)
      }
      // The last tab closing is an answer, not a silence: they are gone now,
      // not in 150 s. A request after this (another device) undoes it.
      if (e.tabs.size === 0) e.leftAt = now()
    },

    /** The account was deleted or signed out everywhere. */
    forget(userId) {
      users.delete(userId)
    },

    /**
     * One row per account seen since boot, most recent first.
     * `state` is 'active' | 'idle' | 'offline'; `area` is where the most recently
     * seen VISIBLE tab is, else the most recent tab, else null.
     */
    snapshot() {
      const t = now()
      const rows = []
      for (const [userId, e] of users) {
        let visibleOpen = false
        let open = 0
        let area = null
        let areaAt = -1
        for (const [id, tab] of e.tabs) {
          if (t - tab.lastSeen > ONLINE_MS) {
            e.tabs.delete(id)
            continue
          }
          open++
          // A visible tab outranks a hidden one for "where are they", whatever
          // the order the beats arrived in.
          const rank = tab.lastSeen + (tab.visible ? ONLINE_MS : 0)
          if (tab.visible) visibleOpen = true
          if (rank > areaAt) {
            areaAt = rank
            area = tab.area
          }
        }
        const lastSeen = e.lastSeen
        if (!lastSeen || t - lastSeen > FORGET_MS) {
          users.delete(userId)
          continue
        }
        const recentRequest = t - e.lastRequest <= ACTIVE_REQUEST_MS && !(e.leftAt >= e.lastRequest)
        const left = open === 0 && e.leftAt >= lastSeen
        const state =
          visibleOpen || recentRequest ? 'active' : !left && (open > 0 || t - lastSeen <= ONLINE_MS) ? 'idle' : 'offline'
        rows.push({ userId, state, area, tabs: open, lastSeen })
      }
      return rows.sort((a, b) => b.lastSeen - a.lastSeen)
    },
  }
}
