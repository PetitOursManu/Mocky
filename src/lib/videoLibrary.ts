// Frontend client for the scroll-sequence library.
//
// A sibling of imageLibrary.ts, not a branch inside it: a sequence is a
// directory (a source clip, a poster and up to 150 frames) rather than a file,
// so nothing that library exposes — one URL per hash, a ZIP of files, a
// favourite flag — carries over unchanged.

export interface LibraryVideo {
  hash: string
  frames: number
  width: number
  fps: number
  bytes: number
  prompt: string
  provider: string
  model: string
  project: string
  slot: string
  createdAt: number
  /** Set by a re-cut. Feeds the cache-buster above. */
  recutAt?: number
}

/** A sequence chosen for the next generation, instead of paying for a new one. */
export interface PinnedVideo {
  hash: string
  frames: number
  poster: string
  label: string
}

/** Containers the server hands to ffmpeg. */
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']

export const videoBase = (hash: string) => `/api/videos/${hash}`
/*
 * `v` is the cache-buster, and it is not optional in spirit.
 *
 * Frame bytes are served `Cache-Control: immutable, max-age=31536000`, which is
 * correct for a content-addressed URL and becomes a lie the moment a clip is
 * re-cut: the hash is taken from the SOURCE, so `/f/1.jpg` keeps its name while
 * its content changes underneath. Without a version the browser would go on
 * showing the old sequence for a year, and the re-cut button would look like it
 * did nothing at all — no error, no clue.
 *
 * A query string is enough: the route reads only `params`, so the server never
 * sees it, while the cache treats it as a different resource.
 */
export const videoPosterUrl = (hash: string, v?: number) =>
  `/api/videos/${hash}/poster.jpg${v ? `?v=${v}` : ''}`
export const videoFrameUrl = (hash: string, index: number, v?: number) =>
  `/api/videos/${hash}/f/${index}.jpg${v ? `?v=${v}` : ''}`

export async function listVideos(project?: string, signal?: AbortSignal): Promise<LibraryVideo[]> {
  const q = project ? `?project=${encodeURIComponent(project)}` : ''
  const res = await fetch(`/api/videos/library${q}`, { signal })
  if (!res.ok) throw new Error(`Video library HTTP ${res.status}`)
  const data = (await res.json()) as { videos?: LibraryVideo[] }
  return data.videos || []
}

export async function deleteVideo(hash: string): Promise<void> {
  const res = await fetch(`/api/videos/${hash}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete HTTP ${res.status}`)
}

/**
 * Cut an existing clip again at the instance's current settings.
 *
 * Free: the original is kept on disk from the moment it was ingested, so this
 * runs ffmpeg and calls no provider. The hash is unchanged — it is taken from
 * the source bytes — so every URL already in a screen keeps working.
 */
export async function recutVideo(hash: string): Promise<Pick<LibraryVideo, 'frames' | 'width' | 'fps' | 'recutAt'>> {
  const res = await fetch(`/api/videos/${hash}/recut`, { method: 'POST' })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Recut HTTP ${res.status}`)
  }
  return (await res.json()) as Pick<LibraryVideo, 'frames' | 'width' | 'fps' | 'recutAt'>
}

/**
 * Import one of the user's own clips and have it cut into a sequence.
 *
 * Needs ffmpeg on the server but no provider and no key: nothing is generated,
 * so this path works on an instance that has never configured fal. It is also
 * the only way to get a sequence out of footage the user already owns.
 */
export async function uploadVideo(
  file: File,
  opts: { project?: string; signal?: AbortSignal } = {},
): Promise<{ hash: string; frames: number; poster: string }> {
  const p = new URLSearchParams({ name: file.name })
  if (opts.project) p.set('project', opts.project)
  const res = await fetch(`/api/videos/upload?${p}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
    signal: opts.signal,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ? String(j.error) : `Upload HTTP ${res.status}`)
  return { hash: String(j.hash), frames: Number(j.frames) || 0, poster: String(j.poster) }
}
