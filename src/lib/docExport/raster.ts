import { FIELD_ATTR, PAGE_ATTR, type PageFormat } from '../pageFormats'
import { parseCssColor } from './lines'
import type { Rgba } from './types'

/**
 * How a page becomes a picture: at what scale, and with which ink removed.
 */

/** What the picture is for. Each wants a different trade between weight and sharpness. */
export type RasterPurpose = 'pdf' | 'pptx' | 'png'

/**
 * ~250 dpi for paper. A CSS pixel is 1/96 in, so that is a scale of 2.6: an A4
 * page becomes 2067 × 2924, enough for a flyer printed at home or at a copy shop
 * without the type going soft, and about 6 MP — well inside what a browser will
 * allocate for one canvas.
 */
export const PRINT_DPI = 250
/**
 * A slide is read on a screen. 1.5 × 1280 is 1920, the width it is projected at;
 * more would only make the .pptx heavier for Google Slides to downsample.
 */
export const SLIDES_SCALE = 1.5
/**
 * The ceiling on one canvas, in pixels. iOS Safari refuses a canvas above
 * 16.7 MP and returns a blank one rather than an error, so the ceiling sits well
 * under it. A page larger than any format here would be scaled down to fit it,
 * never refused.
 */
export const MAX_RASTER_PIXELS = 12_000_000

/**
 * The html2canvas scale for one page of `format`.
 *
 * The .pptx background is only a backdrop behind editable text, and Google
 * Slides recompresses anything large, so it gets 2× on paper rather than 2.6×:
 * a flyer that uploads to Drive in seconds rather than a minute.
 */
export function rasterScale(format: Pick<PageFormat, 'w' | 'h' | 'kind'>, purpose: RasterPurpose): number {
  const wanted = format.kind === 'slides' ? SLIDES_SCALE : purpose === 'pptx' ? 2 : PRINT_DPI / 96
  const cap = Math.sqrt(MAX_RASTER_PIXELS / Math.max(1, format.w * format.h))
  return Math.max(0.25, Math.min(wanted, cap))
}

/** JPEG quality for the PDF and the slide backgrounds. */
export const JPEG_QUALITY = 0.92

/**
 * What is taken out of a page before it is rasterised.
 *
 * - `none`   — the PNG export: the page exactly as designed.
 * - `fields` — the PDF: the ink INSIDE each fillable field goes (its value, its
 *   placeholder), because a real form field is laid over that spot and whatever
 *   someone types would otherwise be printed on top of a picture of "Votre nom".
 *   The field's box — its border, its fill — stays: that is the design, and the
 *   PDF field is transparent so it shows through.
 * - `text`   — the .pptx: every glyph goes, because every run of text comes back
 *   as an editable text box above the picture.
 *
 * The rules are scoped to the pages, and they make ink transparent rather than
 * `visibility: hidden`, so nothing moves: the geometry was measured with the
 * text in place, and colour does not move a box.
 *
 * `color` is also what `currentColor` reads, so these rules alone erase every
 * icon (Mocky's are all `stroke="currentColor"`, and html2canvas copies the
 * computed style onto a cloned SVG) and every `border-current` shape. That is
 * put back by render.ts, which pins what changed — see `PAINT_PROPS`.
 */
export function hideCss(mode: 'none' | 'fields' | 'text'): string {
  const ink =
    'color:transparent!important;-webkit-text-fill-color:transparent!important;' +
    'text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important'
  const page = `[${PAGE_ATTR}]`
  const field = `[${FIELD_ATTR}]`
  if (mode === 'none') return ''
  if (mode === 'fields') {
    return (
      `${page} ${field},${page} ${field} *{${ink}}` +
      `${page} ${field}::placeholder,${page} ${field} *::placeholder{color:transparent!important}`
    )
  }
  return `${page},${page} *{${ink}}` + `${page} *::placeholder{color:transparent!important}`
}

/**
 * The paint that is NOT text but follows `color` through `currentColor`. After
 * the hide rules are in, any of these whose computed value changed is pinned
 * back to what it was, inline and `!important` (which outranks a sheet's
 * `!important`). Compared rather than guessed: which borders are `currentColor`
 * is written in a class nobody here can read.
 */
export const PAINT_PROPS = [
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'background-color',
  'box-shadow',
  'fill',
  'stroke',
  'stop-color',
] as const

/**
 * The ink itself, pinned back only on what must keep it: an SVG (whose
 * `currentColor` may compute to the keyword rather than a colour, so comparing
 * `fill` would see no change), and text drawn under a rotation or a scale, which
 * stays in the picture because a text box could only draw it straight.
 */
export const INK_PROPS = ['color', '-webkit-text-fill-color', 'text-shadow', 'text-decoration-color'] as const

/**
 * The ink for text painted with `background-clip: text`.
 *
 * html2canvas cannot clip a background to glyphs: `bg-clip-text
 * text-transparent` — what a model writes on a colourful flyer's headline —
 * came out of every export as a filled gradient rectangle with no letters, and
 * the .pptx dropped the run as invisible. The degradation is the one Ultra's
 * `u-capture` rules make: the gradient's first opaque stop as a solid ink, or,
 * when the gradient offers none, the colour the text would have inherited.
 */
export function clipTextInk(backgroundImage: string | null | undefined, inherited: Rgba): Rgba {
  const tokens = (backgroundImage || '').match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) || []
  for (const tok of tokens) {
    const c = parseCssColor(tok)
    if (c.a >= 0.5) return { ...c, a: 1 }
  }
  return inherited.a >= 0.5 ? { ...inherited, a: 1 } : { r: 0, g: 0, b: 0, a: 1 }
}
