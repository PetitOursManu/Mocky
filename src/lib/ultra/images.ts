/**
 * Generating a storyboard's pictures as ONE series.
 *
 * Three things make a set of generated pictures read as one shoot rather than
 * as three stock photos: the same style sentence on every prompt, a shape that
 * suits what each picture is FOR, and a negative list that keeps type and
 * interface out of all of them (a picture with fake lettering in it is the
 * fastest way for a page to look generated).
 *
 * Failure is per picture and never fatal (Q1). A picture that could not be
 * made leaves its slot EMPTY, the generation prompt is told which ones exist,
 * and the recipes that wanted it fall back on `<Backdrop>`, which draws in CSS
 * and needs no picture at all. The caller reports the failures; a run where
 * every picture failed still produces an Ultra screen.
 */
import { generateImage } from '../imageLibrary'
import { absoluteUrl } from '../muse'
import type { ImageSource, StockFinder, StockOrientation } from '../stockImages'
import type { UltraImageRole } from './recipes'
import type { UltraImagePlan, UltraStoryboard } from './storyboard'

export interface UltraImage extends UltraImagePlan {
  /** Library hash. */
  hash: string
  /** Absolute URL — the preview iframe has an opaque origin (M6). */
  url: string
}

/** Shape per role: a ground is wide, an object is square, a scene is a still from a film. */
export const ROLE_SIZE: Record<UltraImageRole, { width: number; height: number }> = {
  backdrop: { width: 1024, height: 576 },
  subject: { width: 1024, height: 1024 },
  scene: { width: 1024, height: 640 },
  texture: { width: 1024, height: 1024 },
}

const ROLE_FRAMING: Record<UltraImageRole, string> = {
  backdrop: 'wide atmospheric background plate, no subject, soft gradients of light, generous empty space for text',
  subject: 'a single isolated object centred on a plain seamless background, product render, crisp edges, nothing else in frame',
  scene: 'cinematic photograph, wide shot, natural composition, room at the top for a headline',
  texture: 'abstract close-up of a material, seamless, rich surface detail, no object',
}

/**
 * The shape to ask a stock library for, per role — the same intent as
 * ROLE_SIZE, in the only vocabulary a search understands.
 */
export const ROLE_ORIENTATION: Record<UltraImageRole, StockOrientation> = {
  backdrop: 'landscape',
  subject: 'square',
  scene: 'landscape',
  texture: 'square',
}

const NEGATIVE = 'no text, no letters, no words, no logo, no watermark, no user interface, no screenshot, no frame, no border'

/** The full prompt for one picture of the series. */
export function buildUltraImagePrompt(image: UltraImagePlan, style: string): string {
  return [image.subject.replace(/[.\s]+$/, ''), style.replace(/[.\s]+$/, ''), ROLE_FRAMING[image.role], NEGATIVE].join('. ') + '.'
}

/**
 * How many pictures run at once.
 *
 * Two, not all six: the default provider is rate-limited (see
 * `generateSlotImages`), and the server's queue serialises per provider anyway —
 * six requests in flight would only move the waiting from here to there while
 * making a cancel slower to take effect.
 */
const CONCURRENCY = 2

export async function generateUltraImages(
  board: UltraStoryboard,
  project: string,
  opts: {
    signal?: AbortSignal
    /** Called as each picture lands, in completion order. */
    onImage?: (img: UltraImage, done: number, total: number) => void
    /** Called with the provider's reason when one picture fails. */
    onError?: (message: string) => void
    /** The series size the user chose, ×3 or ×6 — sent so the server can check it. */
    series?: number
    /**
     * 'stock' FINDS each picture in the free libraries instead of generating
     * it. What is lost is the one shared style sentence that makes a generated
     * series read as one shoot — a search matches the subject, not the light —
     * and the role's shape survives as an orientation. Nothing else changes:
     * the result is the same list of library hashes, in storyboard order.
     */
    source?: ImageSource
    /**
     * For 'stock': the finder that searches, lets a vision model choose among
     * the thumbnails, and remembers the series (src/lib/stockImages.ts). What
     * holds a found series together is that the judge SEES the photos already
     * chosen — a generated one gets the same from its shared style sentence.
     */
    finder?: StockFinder
  } = {},
): Promise<UltraImage[]> {
  const total = board.images.length
  const results: Array<UltraImage | null> = new Array(total).fill(null)
  let next = 0
  let done = 0

  async function findStock(plan: UltraImagePlan): Promise<{ hash: string } | null> {
    const finder = opts.finder
    if (!finder) return null
    const got = await finder.find({
      subject: plan.subject,
      query: plan.query,
      orientation: ROLE_ORIENTATION[plan.role],
      role: plan.role,
      tags: ['ultra', plan.role],
    })
    if (!got) opts.onError?.(finder.lastMiss)
    return got
  }

  async function worker(): Promise<void> {
    while (next < total) {
      const i = next++
      const plan = board.images[i]
      try {
        const got =
          opts.source === 'stock'
            ? await findStock(plan)
            : await generateImage(buildUltraImagePrompt(plan, board.style), {
                project,
                signal: opts.signal,
                tags: ['ultra', plan.role],
                ultra: opts.series,
                ...ROLE_SIZE[plan.role],
              })
        if (got) {
          results[i] = { ...plan, hash: got.hash, url: absoluteUrl(`/api/images/${got.hash}`) }
          done++
          opts.onImage?.(results[i]!, done, total)
        } else {
          done++
        }
      } catch (err) {
        if (opts.signal?.aborted) throw err
        done++
        opts.onError?.(err instanceof Error ? err.message : String(err))
      }
    }
  }

  // Found photos one at a time: a pick takes a second, and two in flight would
  // each exclude only what was used BEFORE them — the same photo twice.
  const concurrency = opts.source === 'stock' ? 1 : CONCURRENCY
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
  // Storyboard order, not completion order: the prompt lists them page-first.
  return results.filter((r): r is UltraImage => r !== null)
}
