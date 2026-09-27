/**
 * Replacements for a site's own pictures — found in the free libraries or
 * generated, one per picture the reading listed (lib/siteReference.ts).
 *
 * The same two sources as Muse and Motion Ultra, through the same doors: the
 * stock finder (a search, then a vision model choosing among thumbnails or
 * refusing them all) and `generateImage`. Nothing new is stored: a found photo
 * is an import under its licence like any other, a generated one is Mocky's
 * own — never the site's picture, which stays in the screenshot (M2).
 *
 * Per picture and never fatal: one that cannot be found or made is counted and
 * the page keeps a stand-in for it. Only a cancel throws.
 */
import { generateImage } from './imageLibrary'
import { absoluteUrl } from './muse'
import type { ImageSource, StockFinder } from './stockImages'
import {
  SITE_PICTURE_ORIENTATION,
  SITE_PICTURE_SIZE,
  sitePicturePrompt,
  type SitePicture,
} from './siteReference'

export interface SitePictureFound extends SitePicture {
  /** Library hash. */
  hash: string
  /** Absolute URL — the preview iframe has an opaque origin (M6). */
  url: string
}

/** Two generations at a time, like Motion Ultra's series; found photos one by one so a pick sees the last. */
const CONCURRENCY = 2

export async function findSitePictures(
  pictures: SitePicture[],
  opts: {
    source: ImageSource
    project: string
    /** For 'stock'. Absent, a 'stock' run finds nothing and says so. */
    finder?: StockFinder
    signal?: AbortSignal
    onProgress?: (done: number, total: number) => void
    onError?: (message: string) => void
  },
): Promise<{ found: SitePictureFound[]; missing: number }> {
  const total = pictures.length
  const results: Array<SitePictureFound | null> = new Array(total).fill(null)
  let next = 0
  let done = 0

  async function one(picture: SitePicture): Promise<{ hash: string } | null> {
    if (opts.source === 'stock') {
      if (!opts.finder) return null
      const got = await opts.finder.find({
        subject: picture.subject,
        orientation: SITE_PICTURE_ORIENTATION[picture.shape],
        role: `a picture in the "${picture.section}" section of a website`,
        tags: ['site'],
      })
      if (!got) opts.onError?.(opts.finder.lastMiss)
      return got
    }
    return generateImage(sitePicturePrompt(picture), {
      project: opts.project,
      signal: opts.signal,
      tags: ['site', picture.shape],
      ...SITE_PICTURE_SIZE[picture.shape],
    })
  }

  async function worker(): Promise<void> {
    while (next < total) {
      const i = next++
      try {
        const got = await one(pictures[i])
        if (got) results[i] = { ...pictures[i], hash: got.hash, url: absoluteUrl(`/api/images/${got.hash}`) }
      } catch (err) {
        if (opts.signal?.aborted) throw err
        opts.onError?.(err instanceof Error ? err.message : String(err))
      }
      done++
      opts.onProgress?.(done, total)
    }
  }

  const concurrency = opts.source === 'stock' ? 1 : CONCURRENCY
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
  // Page order, not completion order: the prompt lists them top to bottom.
  const found = results.filter((r): r is SitePictureFound => r !== null)
  return { found, missing: total - found.length }
}
