/**
 * When a piece of media was made, in the words somebody actually wants.
 *
 * The library lists images, clips and films side by side, and every one of them
 * carries a `createdAt` nobody was showing. Without it the grid is a wall of
 * thumbnails in an order the reader has to trust, and the question they ask
 * first — "is the film I just rendered in here?" — has no answer on screen.
 *
 * TODAY is relative and everything else is absolute, which is the rule the user
 * asked for and also the right one: "il y a 3 minutes" answers "did my render
 * land?" at a glance, while "il y a 4 jours" makes somebody count backwards from
 * today to work out which Tuesday that was.
 *
 * Pure, and taking `now` as an argument, so the boundaries can be tested rather
 * than waited for. `Intl` does the month names and the 24/12-hour clock, because
 * a hand-written French month table is how a library ends up saying "Mars" in an
 * English interface.
 */

/** One entry of the vocabulary, resolved by the caller's own translator. */
export type MediaTimeLabel =
  | { kind: 'seconds'; n: number }
  | { kind: 'minutes'; n: number }
  | { kind: 'hours'; n: number }
  | { kind: 'absolute'; text: string }

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

/**
 * Is `then` on the same calendar day as `now`?
 *
 * Calendar day, NOT "less than 24 hours ago", and the difference is the whole
 * point: at 00:30 something made at 23:00 yesterday is ninety minutes old and
 * belongs to a different day. Saying "il y a 1 heure" there is true and useless
 * — the reader is looking for what they did *today*.
 */
function sameDay(then: Date, now: Date): boolean {
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  )
}

export function mediaTimeLabel(createdAt: number, now = Date.now(), lang = 'fr'): MediaTimeLabel | null {
  // A record with no timestamp — an older library entry, a partial write —
  // shows nothing rather than "il y a 56 ans". Absent is honest; 1970 is not.
  if (!Number.isFinite(createdAt) || createdAt <= 0) return null

  const then = new Date(createdAt)
  const nowDate = new Date(now)

  if (sameDay(then, nowDate)) {
    // Clamped at zero: a clock that drifts a second ahead of the server would
    // otherwise render "il y a -1 seconde" on a fresh export.
    const ago = Math.max(0, now - createdAt)
    if (ago < MINUTE) return { kind: 'seconds', n: Math.floor(ago / SECOND) }
    if (ago < HOUR) return { kind: 'minutes', n: Math.floor(ago / MINUTE) }
    return { kind: 'hours', n: Math.floor(ago / HOUR) }
  }

  // Not today: the day and the time, both, because a media library is browsed
  // by "the one from Tuesday evening" as often as by name.
  return {
    kind: 'absolute',
    text: new Intl.DateTimeFormat(lang, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(then),
  }
}
