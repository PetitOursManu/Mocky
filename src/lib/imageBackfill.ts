// Backfill `Screen.imageHash` for screens generated before the canvas image
// card existed (and for any run that stored the image but not the link).
//
// The link is recoverable because the Image Library records which PROJECT each
// image belongs to and when it was created, and Muse generates a screen's image
// immediately before adding the screen — in practice a few dozen milliseconds.
// So: within a project, match each image to the screen created just after it.
//
// Deliberately conservative. It only ever FILLS an empty imageHash, never
// overwrites one, and refuses a match outside a tight time window rather than
// guessing.
import type { LibraryImage } from './imageLibrary'
import type { Screen } from './project'

/** Widest plausible gap between "image stored" and "screen added" in one run. */
export const MATCH_WINDOW_MS = 5 * 60 * 1000

export interface ImageMatch {
  screenId: string
  hash: string
}

/**
 * Pair a project's library images with its screens.
 *
 * @param screens  the project's screens (only those without an imageHash are considered)
 * @param images   library images (filtered to this project, or not — `projectId` filters)
 * @param projectId  only images belonging to this project are eligible
 */
export function matchImagesToScreens(
  screens: Pick<Screen, 'id' | 'createdAt' | 'imageHash'>[],
  images: LibraryImage[],
  projectId: string,
  windowMs: number = MATCH_WINDOW_MS,
): ImageMatch[] {
  const candidates = (images || [])
    .filter((im) => im && Array.isArray(im.projects) && im.projects.includes(projectId))
    .sort((a, b) => a.createdAt - b.createdAt)
  if (!candidates.length) return []

  // Oldest first, so the earliest screen claims the earliest image.
  const open = (screens || [])
    .filter((s) => s && !s.imageHash)
    .sort((a, b) => a.createdAt - b.createdAt)
  if (!open.length) return []

  const out: ImageMatch[] = []
  const takenScreens = new Set<string>()
  const takenHashes = new Set<string>()

  for (const img of candidates) {
    let best: { id: string; delta: number } | null = null
    for (const s of open) {
      if (takenScreens.has(s.id)) continue
      // The screen is added AFTER its image exists. A screen created before the
      // image cannot be the one it was generated for.
      const delta = s.createdAt - img.createdAt
      if (delta < 0 || delta > windowMs) continue
      if (!best || delta < best.delta) best = { id: s.id, delta }
    }
    if (!best || takenHashes.has(img.hash)) continue
    takenScreens.add(best.id)
    takenHashes.add(img.hash)
    out.push({ screenId: best.id, hash: img.hash })
  }
  return out
}
