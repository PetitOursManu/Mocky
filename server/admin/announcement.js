// A message the administrator shows to everybody: "restart at 22:00",
// "the image provider is down, generations fall back to Pollinations".
//
// Kept in config.json beside the maintenance state and published the same way,
// through GET /api/config, which every tab already polls once a minute and which
// a signed-out visitor reads too. A second endpoint and a second poll would buy
// nothing but another request per minute per tab.
//
// Plain text, bounded, with an optional start and an optional end: an
// announcement about tonight's restart that is still on screen next week teaches
// people to stop reading the banner, which is the one thing a banner cannot
// afford — and one written on Monday for Friday must not be on screen from Monday.
//
// A moment in the text ("the update is planned for {{datetime:…}}") is stored as
// an instant in UTC and written out by each BROWSER in its own time zone: the
// administrator in Paris and a user in Montréal read two different clocks for
// the same instant, which is the whole point. The server only checks that the
// instant parses, and rewrites it in one canonical form.

import crypto from 'node:crypto'
import { cleanMaintenanceMessage } from '../maintenance.js'

export const ANNOUNCEMENT_TONES = ['info', 'warn']

/** Thirty days: longer than that is not an announcement, it is a page. */
export const MAX_ANNOUNCEMENT_HOURS = 24 * 30

/** How far ahead an announcement may be scheduled. */
export const MAX_SCHEDULE_DAYS = 365

/**
 * `{{datetime:2026-09-29T01:22:00.000Z}}`, `{{date:…}}`, `{{time:…}}`.
 * Double braces because a person does not type them by accident; the same
 * pattern lives in src/lib/announcementText.ts, which renders it.
 */
export const MOMENT_TOKEN = /\{\{(datetime|date|time):([^{}]{1,40})\}\}/g

/** A start this close to now is "now": the form's clock and ours never agree to the second. */
const START_GRACE_MS = 60_000

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

/**
 * Every moment in the text, parsed and rewritten as ISO UTC — or a 400 naming
 * the one that does not parse. Refused rather than left as literal text: a
 * banner saying "{{date:demain}}" to every user is worse than a form that says
 * no to the one person who can fix it.
 */
export function normalizeMoments(message) {
  return String(message).replace(MOMENT_TOKEN, (_, kind, raw) => {
    const t = Date.parse(String(raw).trim())
    if (!Number.isFinite(t)) throw badRequest(`Date illisible dans le message : « ${String(raw).trim()} ».`)
    return `{{${kind}:${new Date(t).toISOString()}}}`
  })
}

/**
 * What is stored, as it may be shown, with its `status` — or null when there is
 * nothing (an empty message, or one whose end has passed).
 * 'scheduled': its start is still ahead; only the dashboard sees it.
 */
export function readAnnouncement(a, now = Date.now()) {
  if (!a || typeof a !== 'object') return null
  const message = cleanMaintenanceMessage(a.message)
  if (!message) return null
  if (typeof a.expiresAt === 'number' && a.expiresAt <= now) return null
  const startsAt = typeof a.startsAt === 'number' ? a.startsAt : null
  return {
    id: typeof a.id === 'string' ? a.id.slice(0, 32) : 'legacy',
    message,
    tone: ANNOUNCEMENT_TONES.includes(a.tone) ? a.tone : 'info',
    createdAt: typeof a.createdAt === 'number' ? a.createdAt : null,
    startsAt,
    expiresAt: typeof a.expiresAt === 'number' ? a.expiresAt : null,
    status: startsAt != null && startsAt > now ? 'scheduled' : 'live',
  }
}

/** What users see: the announcement once it has started and until it ends. */
export function liveAnnouncement(a, now = Date.now()) {
  const r = readAnnouncement(a, now)
  return r && r.status === 'live' ? r : null
}

/**
 * Build a new announcement from a request body, or throw a 400.
 *
 * A NEW id every time the text changes, so a user who dismissed yesterday's
 * notice still sees today's; the same id when only the schedule moves, so fixing
 * a typo in the end date does not bring back a banner everybody closed.
 *
 * `startsAt` is an instant (ISO string or epoch ms) or null for "now"; the
 * duration runs from the start, so "4 hours, from Friday 20:00" means what it
 * says rather than ending before it begins.
 */
export function makeAnnouncement(body, { now = Date.now(), previous = null } = {}) {
  const message = normalizeMoments(cleanMaintenanceMessage(body?.message))
  if (!message) throw badRequest('Le message est vide.')
  // Checked AFTER the moments are rewritten: a date typed short grows into its
  // ISO form, and a message cut at 500 on the way out would cut a moment in half.
  if (message.length > 500) throw badRequest('Le message dépasse 500 caractères une fois les dates écrites en entier.')
  const tone = ANNOUNCEMENT_TONES.includes(body?.tone) ? body.tone : 'info'

  let startsAt = null
  if (body?.startsAt != null && body.startsAt !== '') {
    const t = typeof body.startsAt === 'number' ? body.startsAt : Date.parse(String(body.startsAt))
    if (!Number.isFinite(t)) throw badRequest('La date de début est illisible.')
    if (t > now + MAX_SCHEDULE_DAYS * 24 * 3600_000) {
      throw badRequest(`Une annonce se programme au plus ${MAX_SCHEDULE_DAYS} jours à l’avance.`)
    }
    // A start in the past, or within the minute, is a start now.
    startsAt = t > now + START_GRACE_MS ? t : null
  }

  let expiresAt = null
  if (body?.expiresInHours != null && body.expiresInHours !== '') {
    const h = Number(body.expiresInHours)
    if (!Number.isFinite(h) || h <= 0 || h > MAX_ANNOUNCEMENT_HOURS) {
      throw badRequest(`La durée doit être comprise entre 0 et ${MAX_ANNOUNCEMENT_HOURS} heures.`)
    }
    expiresAt = (startsAt ?? now) + Math.round(h * 3600_000)
  }
  const same = previous && previous.message === message && previous.tone === tone
  return {
    id: same ? previous.id : crypto.randomBytes(6).toString('hex'),
    message,
    tone,
    createdAt: same ? previous.createdAt : now,
    startsAt,
    expiresAt,
  }
}
