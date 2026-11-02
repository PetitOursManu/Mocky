/**
 * A link given to Muse that is a PICTURE, not a page.
 *
 * Muse's inspiration field takes addresses, and Muse reads PAGES: a direct link
 * to a flyer (`…/carte-remerciement-flyer.jpg`) came back with no text, the
 * dossier was written from the request alone, and the screen followed nothing
 * the person had pointed at. What they gave was a reference picture, and the
 * composer already knows what to do with one pasted: a site capture, with its
 * Reproduce / Redesign choice. So the composer asks the server whether each link
 * is a picture (POST /api/muse/linked-image, SSRF-guarded, nothing kept), and a
 * picture leaves the field for the capture row.
 *
 * Only the ADDRESS goes up; the bytes come down once and live where a pasted
 * capture lives — in the tab, until the screen is made (M2).
 */

/** How long the field must hold still before its links are looked at: a URL being typed is not one yet. */
export const LINK_PROBE_DELAY_MS = 700

/** Why a picture link could not become a capture — an i18n key, or null to leave the link to Muse. */
export type LinkedImageRefusal = 'project.siteLinkTooLarge' | 'project.siteLinkUnreadable'

export type LinkedImageAnswer =
  /** A picture: its bytes, and a name for the thumbnail's tooltip. */
  | { kind: 'picture'; blob: Blob; name: string }
  /** A page, or an address the server could not read: Muse's to try, as before. */
  | { kind: 'page' }
  /** A picture that cannot be used: the person is told why. */
  | { kind: 'refused'; reason: LinkedImageRefusal }

/** The last segment of the address's path, decoded — what a pasted file would be called. */
export function linkName(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || ''
    return decodeURIComponent(last).slice(0, 120)
  } catch {
    return ''
  }
}

/** The field without `url`, one address per line — what its placeholder asks for. */
export function withoutLink(text: string, url: string): string {
  return (text || '')
    .split(/\s+/)
    .filter((part) => part && part !== url)
    .join('\n')
}

/**
 * Ask the server what `url` is. Throws only when `signal` aborts: every other
 * failure is an answer, because a link the composer could not read is still a
 * link Muse may read (M3).
 */
export async function probeLinkedImage(url: string, signal?: AbortSignal): Promise<LinkedImageAnswer> {
  let res: Response
  try {
    res = await fetch('/api/muse/linked-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    return { kind: 'page' }
  }
  if (res.status === 413) return { kind: 'refused', reason: 'project.siteLinkTooLarge' }
  if (!res.ok) return { kind: 'page' }
  const type = res.headers.get('content-type') || ''
  if (!/^image\/(png|jpeg|webp|gif)\b/.test(type)) return { kind: 'page' }
  try {
    return { kind: 'picture', blob: await res.blob(), name: linkName(url) }
  } catch (e) {
    if (signal?.aborted) throw e
    return { kind: 'refused', reason: 'project.siteLinkUnreadable' }
  }
}
