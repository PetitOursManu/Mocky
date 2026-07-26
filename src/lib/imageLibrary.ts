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
