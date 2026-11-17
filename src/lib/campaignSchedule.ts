import type { CampaignFormatId, CampaignPublish } from './campaign'
import { FORMAT_NETWORK, type PackCaption, type PackNetwork } from './publicationPack'

/**
 * A campaign's editorial calendar: when each piece goes out, as a month to
 * look at, as files for any calendar or spreadsheet, and as ideas in Calendy.
 *
 * Pure: the panel (CampaignPanel.tsx) draws it, `calendyClient.ts` sends it.
 * The date lives on the PIECE (`ScreenCampaign.publish`) — see campaign.ts.
 *
 * One Calendy post per PIECE, and not one post for the Instagram and Facebook
 * pieces of a day together. Calendy's post has one visual for both of those
 * networks ("meta"), shared; a campaign's Instagram post (4:5) and Facebook
 * visual (1.91:1) are two different pictures, and folding them into one post
 * would put both in one carousel. A piece is one post with its own network,
 * which is also what Calendy does for two hours on one day.
 */

export interface ScheduledPiece {
  screenId: string
  name: string
  format: CampaignFormatId
  publish: CampaignPublish
}

/** Where a piece lands in Calendy, by format. Print pieces have no network. */
export const CALENDY_TARGET: Partial<Record<CampaignFormatId, { plateformes: ('Instagram' | 'Facebook' | 'LinkedIn')[]; slot: 'meta' | 'linkedin' }>> = {
  instagram: { plateformes: ['Instagram'], slot: 'meta' },
  // A story IS an Instagram publication; its title says it is the story.
  story: { plateformes: ['Instagram'], slot: 'meta' },
  facebook: { plateformes: ['Facebook'], slot: 'meta' },
  linkedin: { plateformes: ['LinkedIn'], slot: 'linkedin' },
}

/** The pieces that have a date, in the order they go out. */
export function scheduledPieces(screens: { id: string; name: string; campaign?: { format: CampaignFormatId; publish?: CampaignPublish } }[]): ScheduledPiece[] {
  const out: ScheduledPiece[] = []
  for (const s of screens) {
    const p = s.campaign?.publish
    if (s.campaign && p?.date) out.push({ screenId: s.id, name: s.name, format: s.campaign.format, publish: p })
  }
  return out.sort((a, b) => (a.publish.date + (a.publish.time ?? '')).localeCompare(b.publish.date + (b.publish.time ?? '')))
}

/** The title a piece carries outside Mocky: the campaign, then the format. */
export function pieceTitle(campaign: string, formatLabel: string): string {
  const c = campaign.replace(/\s+/g, ' ').trim()
  return (c ? `${c} · ${formatLabel}` : formatLabel).slice(0, 200)
}

export interface CalendyPostDraft {
  screenId: string
  date: string
  time?: string
  titre: string
  plateformes: ('Instagram' | 'Facebook' | 'LinkedIn')[]
  slot: 'meta' | 'linkedin'
  imageIdee: string
  calendyId?: string
  /** The caption and the hashtags of the piece's network, from the publication pack. */
  description?: string
  hashtags?: string
}

/** The Calendy posts a set of pieces becomes, and the pieces that have no network. */
export function calendyDrafts(
  pieces: ScheduledPiece[],
  campaign: string,
  formatLabel: (f: CampaignFormatId) => string,
  captions: Partial<Record<PackNetwork, PackCaption>> = {},
): { posts: CalendyPostDraft[]; skipped: ScheduledPiece[] } {
  const posts: CalendyPostDraft[] = []
  const skipped: ScheduledPiece[] = []
  for (const p of pieces) {
    const target = CALENDY_TARGET[p.format]
    if (!target) {
      skipped.push(p)
      continue
    }
    const net = FORMAT_NETWORK[p.format]
    const caption = net ? captions[net] : undefined
    posts.push({
      screenId: p.screenId,
      date: p.publish.date,
      ...(p.publish.time ? { time: p.publish.time } : {}),
      titre: pieceTitle(campaign, formatLabel(p.format)),
      plateformes: target.plateformes,
      slot: target.slot,
      imageIdee: p.name,
      ...(p.publish.calendyId ? { calendyId: p.publish.calendyId } : {}),
      ...(caption ? { description: caption.text, hashtags: caption.hashtags.join(' ') } : {}),
    })
  }
  return { posts, skipped }
}

// ---- .ics ----

/** RFC 5545 TEXT: backslash, semicolon, comma and newline escaped. */
function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines folded at 75 OCTETS (not characters), continuation lines starting with a space. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = out.length ? 74 : 75 // a continuation's leading space counts
    if (bytes + n > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const compact = (date: string) => date.replace(/-/g, '')
const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/**
 * One event per piece. With an hour, a 15-minute event at that hour in
 * Europe/Paris, written as a floating local time with TZID — the person's own
 * clock, which is what they typed. Without one, an all-day event. The UID is
 * the screen's, so re-importing the file updates the events instead of
 * doubling them.
 */
export function toIcs(pieces: ScheduledPiece[], opts: { campaign: string; formatLabel: (f: CampaignFormatId) => string; now?: Date }): string {
  const now = opts.now ?? new Date()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mocky//Campaign calendar//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const p of pieces) {
    const title = pieceTitle(opts.campaign, opts.formatLabel(p.format))
    lines.push('BEGIN:VEVENT', `UID:${p.screenId}@mocky`, `DTSTAMP:${stamp(now)}`)
    if (p.publish.time) {
      const [h, m] = p.publish.time.split(':').map(Number)
      const end = h * 60 + m + 15
      const endTime = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}${String(end % 60).padStart(2, '0')}00`
      const endDate = end >= 24 * 60 ? nextDay(p.publish.date) : p.publish.date
      lines.push(`DTSTART;TZID=Europe/Paris:${compact(p.publish.date)}T${p.publish.time.replace(':', '')}00`)
      lines.push(`DTEND;TZID=Europe/Paris:${compact(endDate)}T${endTime}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(p.publish.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(p.publish.date))}`)
    }
    lines.push(`SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(p.name)}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

// ---- .csv ----

const csvCell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * Semicolon-separated with a BOM: what Excel opens in a French locale without
 * an import wizard. The column names are Calendy's own fields, so the file
 * reads the same in both and maps one to one if Calendy ever imports it.
 */
export function toCsv(pieces: ScheduledPiece[], opts: { campaign: string; formatLabel: (f: CampaignFormatId) => string }): string {
  const rows = [['datePublication', 'heure', 'plateformes', 'titre', 'format', 'ecran']]
  for (const p of pieces) {
    const target = CALENDY_TARGET[p.format]
    rows.push([
      p.publish.date,
      p.publish.time ?? '',
      target ? target.plateformes.join(', ') : '',
      pieceTitle(opts.campaign, opts.formatLabel(p.format)),
      opts.formatLabel(p.format),
      p.name,
    ])
  }
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

// ---- the month ----

/** `YYYY-MM` of a date, or of today. */
export function monthOf(date?: string): string {
  return (date && /^\d{4}-\d{2}/.test(date) ? date : new Date().toISOString()).slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

/** The month's weeks, Monday first; a day outside the month is null. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
