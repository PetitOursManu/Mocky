// Frontend client for the global Image Library (Phase 2 backend). Powers the
// Bibliothèque browser: list/search/filter, favorite, delete, per-image download,
// "Tout télécharger" ZIP, and pin-to-run. Images are same-origin, so plain
// relative "/api/images/:hash" URLs work in the app DOM (the absolute-URL form is
// only needed when injecting into the null-origin preview iframe — see muse.ts).

export interface LibraryImage {
  hash: string
  prompt: string
  negative?: string | null
  provider: string
  seed?: number | null
  width: number
  height: number
  createdAt: number
  tags: string[]
  projects: string[]
  favorite: boolean
  /**
   * Set — and only ever set to `true` — while the multi-step flow is waiting for
   * a human to look at this picture. Optional because its ABSENCE is the normal
   * state: every image made before this field existed carries no flag and is
   * eligible, which is what made the upgrade a non-event (see the block comment
   * above `confirm()` in server/images/library.js).
   */
  pending?: boolean
}

export interface LibraryFilters {
  q?: string
  project?: string
  favorites?: boolean
  slot?: string
}

/** A library image chosen for the next generation. */
export interface PinnedImage {
  hash: string
  url: string
  label: string
}

function queryString(f: LibraryFilters): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.project) p.set('project', f.project)
  if (f.favorites) p.set('favorites', '1')
  if (f.slot) p.set('slot', f.slot)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function imageUrl(hash: string): string {
  return `/api/images/${hash}`
}
export function imageDownloadUrl(hash: string): string {
  return `/api/images/${hash}?download=1`
}
export function libraryZipUrl(f: LibraryFilters = {}): string {
  return `/api/images/library.zip${queryString(f)}`
}

export async function listLibrary(f: LibraryFilters = {}, signal?: AbortSignal): Promise<LibraryImage[]> {
  const res = await fetch(`/api/images/library${queryString(f)}`, { signal })
  if (!res.ok) throw new Error(`Library HTTP ${res.status}`)
  const data = (await res.json()) as { images?: LibraryImage[] }
  return data.images || []
}

/** Formats the server accepts. SVG is deliberately absent — it can carry script. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

/** Reads a file's real pixel dimensions, or zeros if it cannot be decoded. */
function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ w: 0, h: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/**
 * Import one of the user's own images into the library.
 *
 * The File is sent as the request body verbatim — no FormData, no multipart.
 * The dimensions ride along in the query string because the browser has just
 * decoded the file to measure them and the server would otherwise have to parse
 * three image formats to learn what is already known here.
 */
export async function uploadImage(
  file: File,
  opts: { project?: string; signal?: AbortSignal } = {},
): Promise<LibraryImage> {
  const { w, h } = await imageSize(file)
  const p = new URLSearchParams({ name: file.name, w: String(w), h: String(h) })
  if (opts.project) p.set('project', opts.project)
  const res = await fetch(`/api/images/upload?${p}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
    signal: opts.signal,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ? String(j.error) : `Upload HTTP ${res.status}`)
  return j.meta as LibraryImage
}

/**
 * Make one image on demand, outside the Muse imagery plan.
 *
 * `generateSlotImages` in muse.ts covers the generation path — a whole plan of
 * slots, produced before a screen exists and capped because the default
 * provider is rate-limited. This is the other case: one picture, asked for by
 * name, to replace one that is already in a screen. Same endpoint, same
 * library, no plan.
 *
 * Returns the hash rather than a URL: the caller decides whether the URL it
 * writes needs an origin (the preview iframe does — I2 — while the app DOM does
 * not), and handing out a relative URL here is how that decision gets made by
 * accident.
 */
export async function generateImage(
  prompt: string,
  opts: {
    project?: string
    signal?: AbortSignal
    /**
     * Arrive unconfirmed, awaiting a human.
     *
     * Only the multi-step video flow asks for this, and only because the whole
     * point of that step is that nobody has seen the picture yet: an image made
     * this way is kept out of every listing and refused by the montage until
     * POST /api/images/:hash/confirm clears the flag.
     */
    pending?: boolean
    /**
     * A seed, when the caller needs a DIFFERENT picture rather than the same one.
     *
     * The library caches on provider+prompt+seed+size (M8), so "regenerate" with
     * an unchanged prompt and no seed is served the previous image out of the
     * cache — instantly, for free, and identically. That is exactly right for
     * every other caller and exactly wrong for a button whose only job is to
     * offer another take.
     */
    seed?: number
    tags?: string[]
  } = {},
): Promise<{ hash: string } | null> {
  const res = await fetch('/api/images/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      project: opts.project,
      profile: 'content',
      tags: opts.tags ?? ['replacement'],
      seed: opts.seed,
      pending: opts.pending === true,
    }),
    signal: opts.signal,
  })
  const j = await res.json().catch(() => ({}))
  // The backend puts the provider's real reason in `error`; an opaque 502 in
  // the console is not something a user can act on.
  if (!res.ok) throw new Error(j?.error ? String(j.error) : `HTTP ${res.status}`)
  // A provider that answered but produced nothing. Not an error, but not an
  // image either — the caller has to tell the difference.
  if (j.skipped || !j.hash) return null
  return { hash: String(j.hash) }
}

/**
 * "I have looked at this one, keep it." One way, on purpose.
 *
 * There is no matching un-confirm anywhere, here or on the server: the flag says
 * nobody has seen the picture yet, and that is a fact about the past which a
 * later call cannot make untrue. What the interface offers instead is to leave
 * an image alone — an unconfirmed one stays in the store, undeleted (M8), simply
 * unlisted and unmountable.
 */
export async function confirmImage(hash: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`/api/images/${hash}/confirm`, { method: 'POST', signal })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error ? String(j.error) : `Confirm HTTP ${res.status}`)
  }
}

export async function toggleFavoriteImage(hash: string): Promise<boolean> {
  const res = await fetch(`/api/images/${hash}/favorite`, { method: 'POST' })
  if (!res.ok) throw new Error(`Favorite HTTP ${res.status}`)
  const data = (await res.json()) as { favorite: boolean }
  return data.favorite
}

export async function deleteImage(hash: string): Promise<{ removed: boolean; wasUsedBy: string[] }> {
  const res = await fetch(`/api/images/${hash}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete HTTP ${res.status}`)
  return (await res.json()) as { removed: boolean; wasUsedBy: string[] }
}
