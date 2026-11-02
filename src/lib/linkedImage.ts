/**
 * A link given to Muse that is a PICTURE, not a page.
 *
 * Muse's `Inspiration` field takes addresses, and Muse's page fetcher reads
 * PAGES: a direct link to a flyer (`…/carte-remerciement-flyer.jpg`) came back
 * with no text, the dossier was written from the request alone, and the screen
 * followed nothing the person had pointed at. What they gave was an
 * inspiration — the role a library picture ticked "Inspiration" already has —
 * so it is read as one: its measured palette, and the picture itself for a model
 * that can see, go to the dossier as the look to be inspired by
 * (`buildReferenceSection` on the server), and the generation is shown it as a
 * mood reference it must not embed.
 *
 * It is NOT a site capture. That was tried first and refused by the person it
 * was for: it switched the composer to Reproduce / Redesign and took the screen
 * type away, when they wanted a business card inspired by a flyer.
 *
 * Only the ADDRESS goes up (POST /api/muse/linked-image, SSRF-guarded, nothing
 * kept); the bytes come down once and live in this run's memory (M2).
 */

/** Why a picture link could not serve — an i18n key. */
export type LinkedImageRefusal = 'project.museLinkTooLarge' | 'project.museLinkUnreadable'

export type LinkedImageAnswer =
  /** A picture, by its bytes. */
  | { kind: 'picture'; blob: Blob }
  /** A page, or an address the server could not read: Muse's page fetcher tries it, as before. */
  | { kind: 'page' }
  /** A picture that cannot be used: the person is told why. */
  | { kind: 'refused'; reason: LinkedImageRefusal }

/**
 * Ask the server what `url` is. Throws only when `signal` aborts: every other
 * failure is an answer, because a link the browser could not read is still a
 * link Muse's page fetcher may read (M3).
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
  if (res.status === 413) return { kind: 'refused', reason: 'project.museLinkTooLarge' }
  if (!res.ok) return { kind: 'page' }
  const type = res.headers.get('content-type') || ''
  if (!/^image\/(png|jpeg|webp|gif)\b/.test(type)) return { kind: 'page' }
  try {
    return { kind: 'picture', blob: await res.blob() }
  } catch (e) {
    if (signal?.aborted) throw e
    return { kind: 'refused', reason: 'project.museLinkUnreadable' }
  }
}

/** The long edge a reference is sent at — what a dossier call needs to read type and composition. */
export const REFERENCE_EDGE = 1024

/**
 * A picture as a JPEG data URL no larger than `REFERENCE_EDGE`. The server
 * keeps a reference only under ~1.5 MB of base64 (`sanitizeUserMedia`), and a
 * full-size photograph is several times that. Browser only.
 */
export async function referenceDataUrl(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, REFERENCE_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    // A transparent PNG would turn black in a JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}

export interface LinkedReferences {
  /** The first picture link, ready to be described: a data URL, in memory only. */
  picture: { url: string; dataUrl: string } | null
  /** The links that are not pictures: Muse's page fetcher reads these. */
  pages: string[]
  /** What the person must be told: a refusal, or that only the first picture is used. */
  notices: Array<LinkedImageRefusal | 'project.museLinkOnlyFirst'>
}

/**
 * Sort the field's links into ONE reference picture and the pages. One, because
 * the dossier and the generation each look at one reference; a second picture
 * link is said to be unused rather than silently dropped.
 */
export async function readLinkedReferences(
  urls: string[],
  opts: { signal?: AbortSignal; probe?: typeof probeLinkedImage; toDataUrl?: (blob: Blob) => Promise<string> } = {},
): Promise<LinkedReferences> {
  const probe = opts.probe ?? probeLinkedImage
  const toDataUrl = opts.toDataUrl ?? referenceDataUrl
  const out: LinkedReferences = { picture: null, pages: [], notices: [] }
  for (const url of urls) {
    const answer = await probe(url, opts.signal)
    if (answer.kind === 'page') {
      out.pages.push(url)
      continue
    }
    if (answer.kind === 'refused') {
      out.notices.push(answer.reason)
      continue
    }
    if (out.picture) {
      if (!out.notices.includes('project.museLinkOnlyFirst')) out.notices.push('project.museLinkOnlyFirst')
      continue
    }
    try {
      out.picture = { url, dataUrl: await toDataUrl(answer.blob) }
    } catch {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      out.notices.push('project.museLinkUnreadable')
    }
  }
  return out
}
