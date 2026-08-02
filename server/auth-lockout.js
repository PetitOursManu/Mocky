// Per-ACCOUNT lockout, distinct from the per-IP rate limit next to it.
//
// The two stop different attacks and neither substitutes for the other:
//   • the per-IP window stops one machine hammering many accounts;
//   • this stops many machines hammering one account.
// An attacker with a handful of addresses walks straight past a per-IP counter,
// which is exactly the case a self-hosted instance on the public web faces.
//
// A separate module rather than a closure inside index.js so the thresholds can
// be tested directly: reaching them over HTTP is impossible in one burst,
// because the per-IP limiter answers first — which is what made the behaviour
// look broken when it was not.
//
// In memory on purpose. A restart clearing the counters also clears whatever
// progress an attacker had made, and the alternative is writing to disk on
// every failed password, which is a denial-of-service lever of its own.

/** Failures within the window before an account is frozen. */
export const LOCK_AFTER = 10
/** How long the window lasts, and how long a freeze lasts once triggered. */
export const LOCK_MS = 15 * 60_000
/** Ceiling on tracked usernames, so cycling names cannot grow this for ever. */
const MAX_TRACKED = 5000

export function createLockout({ lockAfter = LOCK_AFTER, lockMs = LOCK_MS, now = () => Date.now() } = {}) {
  /** username → { count, first, until } */
  const failures = new Map()

  return {
    /** Seconds remaining on a freeze, or 0 when the account is free to try. */
    lockedFor(username) {
      const rec = failures.get(username)
      if (!rec?.until) return 0
      if (now() > rec.until) {
        failures.delete(username)
        return 0
      }
      return Math.ceil((rec.until - now()) / 1000)
    },

    /**
     * Record a wrong password.
     *
     * Called for unknown usernames too. Skipping them would make the lockout an
     * account-enumeration oracle: "this one froze, so it exists" is half of what
     * a guesser wants, and it is free to observe.
     */
    fail(username) {
      const t = now()
      let rec = failures.get(username)
      if (!rec || t - rec.first > lockMs) rec = { count: 0, first: t, until: 0 }
      rec.count++
      if (rec.count >= lockAfter) rec.until = t + lockMs
      failures.set(username, rec)

      if (failures.size > MAX_TRACKED) {
        for (const [k, v] of failures) if (t - v.first > lockMs) failures.delete(k)
      }
      return rec.until ? Math.ceil((rec.until - t) / 1000) : 0
    },

    /** A correct password wipes the slate for that account. */
    succeed(username) {
      failures.delete(username)
    },

    /** Test seam. */
    size() {
      return failures.size
    },
  }
}
