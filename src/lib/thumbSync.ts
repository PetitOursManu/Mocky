/**
 * The picture of a screen, between devices (server/thumbs.js).
 *
 * Plain `fetch` and every failure swallowed, on purpose: a thumbnail is a
 * courtesy. A signed-out page, a maintenance window or a full disk must leave
 * the home page exactly as it would have been, drawn rectangles included.
 */

export interface ThumbItem {
  id: string
  hash: string
}

/** The address a known picture is read from. A checksum in it, so the browser may keep it. */
export function remoteThumbUrl(item: ThumbItem): string {
  return `/api/thumbs/${encodeURIComponent(item.id)}?h=${encodeURIComponent(item.hash)}`
}

export async function uploadThumb(id: string, hash: string, dataUrl: string): Promise<void> {
  if (!dataUrl.startsWith('data:image/jpeg;base64,')) return
  try {
    await fetch(`/api/thumbs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash, data: dataUrl.slice(dataUrl.indexOf(',') + 1) }),
    })
  } catch {
    /* see above */
  }
}

/** Which of these screens the server has a picture of, in exactly this state. */
export async function knownRemoteThumbs(items: ThumbItem[]): Promise<Set<string>> {
  if (items.length === 0) return new Set()
  try {
    const res = await fetch('/api/thumbs/known', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) return new Set()
    const data = await res.json()
    return new Set(Array.isArray(data?.known) ? (data.known as string[]) : [])
  } catch {
    return new Set()
  }
}
