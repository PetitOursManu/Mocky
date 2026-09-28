/**
 * Moments inside an announcement, written in the READER's time zone.
 *
 * The administrator types "Mise à jour prévue le" and inserts a date; what is
 * stored is `{{datetime:2026-09-29T01:22:00.000Z}}` — an instant, not a clock
 * reading — and every browser writes it out in its own zone and language. A user
 * in Paris reads "29/09/2026 à 03h22", one in Montréal "28/09/2026 à 21h22", and
 * both are right. Writing the admin's clock into the text instead would be
 * correct for exactly the people who share the admin's time zone.
 *
 * The pattern is the server's (`MOMENT_TOKEN` in server/admin/announcement.js),
 * which refuses a moment that does not parse; one that still fails here — a
 * message stored by hand — stays literal text rather than breaking the banner.
 */

export type MomentKind = 'datetime' | 'date' | 'time'
export interface Moment {
  kind: MomentKind
  at: number
}
export type Piece = string | Moment

const TOKEN = /\{\{(datetime|date|time):([^{}]{1,40})\}\}/g

/** The text cut into plain runs and moments, in order. */
export function splitMoments(message: string): Piece[] {
  const out: Piece[] = []
  let last = 0
  for (const m of message.matchAll(TOKEN)) {
    const at = Date.parse(m[2].trim())
    if (!Number.isFinite(at)) continue
    if (m.index! > last) out.push(message.slice(last, m.index))
    out.push({ kind: m[1] as MomentKind, at })
    last = m.index! + m[0].length
  }
  if (last < message.length) out.push(message.slice(last))
  return out
}

/** What the admin's "Insert" button writes into the text. */
export function momentToken(kind: MomentKind, at: Date): string {
  return `{{${kind}:${at.toISOString()}}}`
}

export interface MomentFormat {
  lang: 'fr' | 'en'
  /** For tests; a browser uses its own. */
  timeZone?: string
  /** For English, the browser's own English locale (en-US writes the month first). */
  locale?: string
}

function localeOf(f: MomentFormat): string {
  if (f.lang === 'fr') return 'fr-FR'
  return f.locale && /^en\b/i.test(f.locale) ? f.locale : 'en-GB'
}

/**
 * "29/09/2026 à 03h22" · "29/09/2026" · "03h22" in French; "29/09/2026 at 03:22"
 * in English (or "09/29/2026 at 03:22" in a US browser). French writes the hour
 * with an h, which is how the notice it replaces was written by hand.
 */
export function formatMoment(m: Moment, f: MomentFormat): string {
  const locale = localeOf(f)
  const tz = f.timeZone ? { timeZone: f.timeZone } : {}
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', ...tz }).format(m.at)
  let time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, ...tz }).format(m.at)
  if (f.lang === 'fr') time = time.replace(':', 'h')
  if (m.kind === 'date') return date
  if (m.kind === 'time') return time
  return f.lang === 'fr' ? `${date} à ${time}` : `${date} at ${time}`
}

/** The zone the reader sees it in, for a tooltip: "heure d’été d’Europe centrale", "EDT". */
export function zoneOf(at: number, f: MomentFormat): string | null {
  try {
    const parts = new Intl.DateTimeFormat(localeOf(f), {
      timeZoneName: 'long',
      ...(f.timeZone ? { timeZone: f.timeZone } : {}),
    }).formatToParts(at)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null
  } catch {
    return null
  }
}
