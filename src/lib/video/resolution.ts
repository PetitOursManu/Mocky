// How much a still is about to be ENLARGED to fill the frame of a film — and
// therefore how soft it will look — worked out before anybody spends two minutes
// rendering it.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// A film of photographs came back "mou et blockeux". Two things were wrong and
// they are independent. The first is the encoder, and it is fixed next door in
// `worker/video/encoding.js`. The second is upstream of every setting an encoder
// has: the picture arriving at the composition is SMALLER THAN THE FRAME.
//
// Mocky's image library defaults to 1024×1024 (`server/images/library.js`), a
// `16:9` export is 1920×1080 (`DIMENSIONS`), and the compositions paint with
// `object-fit: cover`. So Chromium enlarges that still by 1.875 before a single
// byte reaches the encoder, and a Ken Burns zoom asks for 12% more on top. No
// crf, no jpegQuality and no bitrate can put back detail the source never had —
// which is exactly why this is a NOTICE and not a setting.
//
// ── Why the arithmetic is here rather than on the server ─────────────────────
//
// Because "before the render" is the whole point. `/compose` and `/render` both
// answer with notices, and both are too late or too narrow: a draft built by
// hand out of the picker never composes, and by the time /render answers the job
// is queued. The panel is the only place that can say it while the choice is
// still a choice — and it can recompute on every change of ratio, composition
// and camera move, which no server round trip would.
//
// The consequence is that the two tables below are hand-copied from
// `worker/video/remotion/composition.js`, the way `server/video/timeline.js` is
// hand-copied from `timeline.ts`. Same rule applies: they are held together by a
// test (`tests/video-frame-geometry.test.js`), because a frame size raised in
// the worker alone would leave this file quietly understating the enlargement it
// exists to report.
import type { AspectRatio, KenBurns, VideoTemplate } from './timeline'

/** `auto` is not a composition — see `TemplateChoice` in draft.ts. */
export type TemplateOrAuto = VideoTemplate | 'auto'

export interface PixelSize {
  width: number
  height: number
}

/**
 * The output geometry, per aspect ratio. Mirrors `DIMENSIONS` in the worker.
 *
 * 1080 on the SHORT edge in all three cases, which is the rule the worker states
 * and the reason a portrait export is not quietly the low-quality one.
 */
export const FRAME_DIMENSIONS: Record<AspectRatio, PixelSize> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
}

/**
 * What to ASK A PROVIDER FOR when a picture is being made for a film.
 *
 * Not `FRAME_DIMENSIONS`, and the difference is the reason this table exists at
 * all. A generator is not a scaler: diffusion models are trained at a handful of
 * shapes and drift badly away from them — a self-hosted sd-webui asked for
 * 1920×1080 returns a slow, duplicated subject rather than a sharper one — so
 * asking for the frame's exact size buys artefacts, not detail.
 *
 * These are SDXL's own landscape and portrait buckets, which every provider here
 * handles natively: Pollinations and fal take them verbatim, sd-webui is at a
 * resolution it was trained on, and OpenAI's `snapSize` reads the RATIO and
 * answers 1536×1024, which is better still.
 *
 * What changes versus the old 1024×1024 default is both halves of the loss at
 * once: the shape now matches the frame, so `cover` stops throwing away 44% of a
 * square picture, and the long edge is 1344 instead of 1024, so what is left is
 * enlarged 1.43× instead of 1.88×. It does not reach 1 — nothing available here
 * does — which is why the notice below stays.
 */
export const SOURCE_DIMENSIONS: Record<AspectRatio, PixelSize> = {
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '1:1': { width: 1024, height: 1024 },
}

/**
 * How much of the frame the picture actually covers, per composition.
 *
 * Three of the five are full-bleed. `product` is not — it stands the picture
 * beside its text in landscape and above it otherwise (`productLayout` +
 * `PICTURE_SHARE` in the worker) — and that matters in the right direction: half
 * a 1920-wide frame asks a still for half as many pixels, so the same picture
 * that is coarse in a slideshow can be perfectly sharp on a product card.
 *
 * `titles` answers `null`, because it paints no picture at all.
 */
export const PICTURE_SHARE = { row: 0.5, column: 0.45 } as const

export function pictureBox(template: TemplateOrAuto, aspectRatio: AspectRatio): PixelSize | null {
  const frame = FRAME_DIMENSIONS[aspectRatio] ?? FRAME_DIMENSIONS['16:9']
  if (template === 'titles') return null
  if (template === 'product') {
    // `productLayout`: a row when the frame is wider than it is tall, a column
    // otherwise — and square lands in `column` deliberately, see the worker.
    return frame.width > frame.height
      ? { width: frame.width * PICTURE_SHARE.row, height: frame.height }
      : { width: frame.width, height: frame.height * PICTURE_SHARE.column }
  }
  return frame
}

/**
 * The largest scale the camera move ever asks for, on top of `cover`.
 *
 * Mirrors `KEN_BURNS_ZOOM`, `PAN_SCALE` and `OVERLAY_DRIFT_SCALE`. A pan holds
 * its overscale for the whole scene and a zoom reaches it at one end, but both
 * spend it — a frame enlarged 12% past `cover` is a frame that samples the
 * source at 1.12 times the rate, whichever second of the scene it happens in.
 */
export const KEN_BURNS_PEAK = 1.12
export const OVERLAY_DRIFT_PEAK = 1.03

export function motionOverscale(template: TemplateOrAuto, kenBurns: KenBurns): number {
  switch (template) {
    // The document does not get to choose here: the band drifts, always, and the
    // card zooms, always. Both are hard-coded in their compositions.
    case 'overlay':
      return OVERLAY_DRIFT_PEAK
    case 'product':
      return KEN_BURNS_PEAK
    case 'titles':
      return 1
    case 'slideshow':
    case 'vertical':
      // `vertical` also lands each cut with a 4.5% push-in (`punchTransform`),
      // and it is deliberately NOT counted: it is gone in twelve frames, so
      // folding it in would report every scene of a feed as worse than the four
      // seconds anybody actually watches.
      return kenBurns === 'static' ? 1 : KEN_BURNS_PEAK
    default:
      // `auto`. The composition is not decided yet — the model picks it — so
      // this reports the FLOOR rather than a guess: a picture flagged under
      // `auto` is certainly at least this enlarged, whichever of the five comes
      // back. Under-reporting is the safe direction for a warning; crying wolf
      // is what gets a warning ignored the time it was right.
      return 1
  }
}

/**
 * How many times bigger than its source the picture is painted.
 *
 * `cover` scales until BOTH edges are filled, so it is the larger of the two
 * ratios — which is also why a square still in a 16:9 frame is enlarged by the
 * width and then cropped top and bottom.
 *
 * Answers 0 for a source with no readable size rather than Infinity or NaN:
 * "we could not measure this one" is a different statement from "this one is
 * fine", and the caller filters on a floor above 1.
 */
export function magnification(source: PixelSize | null, box: PixelSize | null, overscale = 1): number {
  const sw = Number(source?.width) || 0
  const sh = Number(source?.height) || 0
  const bw = Number(box?.width) || 0
  const bh = Number(box?.height) || 0
  if (sw <= 0 || sh <= 0 || bw <= 0 || bh <= 0) return 0
  const factor = Number(overscale)
  return Math.max(bw / sw, bh / sh) * (Number.isFinite(factor) && factor > 0 ? factor : 1)
}

/**
 * Past this, the enlargement is worth saying out loud.
 *
 * A quarter more pixels than the picture has. Below it the softening is real and
 * nobody would name it; at 1.88 — a 1024 still in a 1920 frame, which is what
 * the library's own default produces — "pixelisé" is the word the report used.
 *
 * Strictly greater, so a source that exactly meets the bar passes: 1536×1024 is
 * the best OpenAI's image models can do for a landscape film, and flagging their
 * best answer teaches people to ignore the banner.
 */
export const MAGNIFICATION_FLOOR = 1.25

export interface UndersizedScene {
  /** 0-based position in the draft, so the panel can say "scene 3". */
  index: number
  imageId: string
  source: PixelSize
  /** How many times bigger than its source the still will be painted. */
  magnification: number
}

/**
 * The scenes whose picture will be enlarged past the floor.
 *
 * `sizeOf` is a lookup rather than a field on the scene, and it is deliberately
 * the picture's INTRINSIC size — what the browser measured when it decoded the
 * file — not the `width`/`height` the library recorded. Those two are not the
 * same fact: the library stores what was ASKED of a provider, and a provider
 * that snapped the request to its own nearest bucket, an upload whose dimensions
 * failed to decode, or an entry from before the field existed all leave it
 * saying something the file does not. The panel already loads every one of these
 * pictures to draw its rows, so the true number costs nothing.
 *
 * A picture that could not be measured is skipped rather than reported. There is
 * no honest sentence to write about it, and inventing a worst case would put a
 * warning on a film that may be perfectly sharp (Q1: degrade, never guess).
 */
export function undersizedScenes(
  scenes: ReadonlyArray<{ imageId: string; kenBurns: KenBurns }>,
  options: { template: TemplateOrAuto; aspectRatio: AspectRatio },
  sizeOf: (imageId: string) => PixelSize | null | undefined,
): UndersizedScene[] {
  const box = pictureBox(options.template, options.aspectRatio)
  if (!box) return []

  const out: UndersizedScene[] = []
  scenes.forEach((scene, index) => {
    if (!scene.imageId) return
    const source = sizeOf(scene.imageId)
    if (!source || !(Number(source.width) > 0) || !(Number(source.height) > 0)) return
    const factor = magnification(source, box, motionOverscale(options.template, scene.kenBurns))
    if (factor > MAGNIFICATION_FLOOR) {
      out.push({ index, imageId: scene.imageId, source: { width: source.width, height: source.height }, magnification: factor })
    }
  })
  return out
}

/**
 * The worst of them, which is what a one-line summary should quote.
 *
 * The panel names every affected scene, but the headline number has to be the
 * one that decides how the film looks: a montage in which nineteen stills are
 * sharp and one is doubled reads as a bad film, not as a 5% problem.
 */
export function worstMagnification(found: ReadonlyArray<UndersizedScene>): number {
  return found.reduce((worst, item) => Math.max(worst, item.magnification), 0)
}

/**
 * `×1,9` — one decimal, and the locale's own separator.
 *
 * One decimal because the second one is noise on a number whose job is to say
 * "this is nearly twice its size"; `toLocaleString` because the panel is French
 * by default and `1.9` reads as a different number to a French reader.
 */
export function formatMagnification(value: number, lang: string): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}
