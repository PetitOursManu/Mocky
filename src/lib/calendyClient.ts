import { capsForScreen } from './docExport'
import { renderDocument } from './docExport/render'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from './pageFormats'
import type { Screen } from './project'
import type { CalendyPostDraft } from './campaignSchedule'

/**
 * The browser's half of "Envoyer dans Calendy". The server's half
 * (server/calendy.js) holds the token and makes every call to Calendy; this
 * side renders each piece's pages to PNG — the same render the download
 * dialog's PNG uses, so what lands in Calendy is what "Télécharger · PNG"
 * would have saved — and hands them over one at a time.
 */

export interface CalendyLink {
  connected: boolean
  host?: string
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

export function getCalendyLink(): Promise<CalendyLink> {
  return call<CalendyLink>('/api/calendy')
}

export function connectCalendy(base: string, token: string): Promise<CalendyLink> {
  return call<CalendyLink>('/api/calendy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base, token }) })
}

export function disconnectCalendy(): Promise<CalendyLink> {
  return call<CalendyLink>('/api/calendy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: null }) })
}

export interface PushResult {
  screenId: string
  /** The Calendy post, when the post itself went through. */
  calendyId?: string
  created?: boolean
  /** Pictures sent, out of the piece's pages. */
  pictures: number
  pages: number
  error?: string
}

/**
 * Send each draft: the post first (found, updated or created as an idea), then
 * its pictures, the first replacing the visual so a second send shows the piece
 * as it is now rather than appending to last week's. One piece's failure is
 * reported on that piece and the next one is tried (degrade, never fail).
 */
export async function pushToCalendy(
  drafts: CalendyPostDraft[],
  screenOf: (id: string) => Screen | undefined,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<PushResult[]> {
  const results: PushResult[] = []
  for (const [i, d] of drafts.entries()) {
    opts.onProgress?.(i, drafts.length)
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const screen = screenOf(d.screenId)
    if (!screen) {
      results.push({ screenId: d.screenId, pictures: 0, pages: 0, error: 'gone' })
      continue
    }
    let post: { id: string; created: boolean }
    try {
      post = await call('/api/calendy/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: d.date,
          time: d.time,
          titre: d.titre,
          plateformes: d.plateformes,
          imageIdee: d.imageIdee,
          calendyId: d.calendyId,
          description: d.description,
          hashtags: d.hashtags,
        }),
        signal: opts.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      results.push({ screenId: d.screenId, pictures: 0, pages: 0, error: err instanceof Error ? err.message : String(err) })
      continue
    }
    const result: PushResult = { screenId: d.screenId, calendyId: post.id, created: post.created, pictures: 0, pages: 0 }
    try {
      const format = getPageFormat(screen.page ?? DEFAULT_PAGE_FORMAT)
      const { pages } = await renderDocument(screen.code, capsForScreen(screen), format, { purpose: 'png', signal: opts.signal })
      result.pages = pages.length
      for (const [k, page] of pages.entries()) {
        await call(`/api/calendy/posts/${encodeURIComponent(post.id)}/photo/${d.slot}${k === 0 ? '?replace=1' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: page.image as BlobPart as BodyInit,
          signal: opts.signal,
        })
        result.pictures++
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      result.error = err instanceof Error ? err.message : String(err)
    }
    results.push(result)
  }
  opts.onProgress?.(drafts.length, drafts.length)
  return results
}
