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
export const videoPosterUrl = (hash: string) => `/api/videos/${hash}/poster.jpg`
export const videoFrameUrl = (hash: string, index: number) => `/api/videos/${hash}/f/${index}.jpg`

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
