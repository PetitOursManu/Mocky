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
  // A social image is already in the platform's own pixels: 1× IS the file
  // Instagram or LinkedIn asks for, and 2× would be downscaled by them anyway.
  if (format.kind === 'social') return 1
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

/**
 * The attribute a raster pass tags an element with when one of its
 * pseudo-elements needs its ink pinned back (`pseudoPinCss`). A pseudo-element
 * has no inline style to pin on, so the pin is a rule, and the rule needs a
 * selector that names exactly one element. Removed with the pass.
 */
export const PIN_ATTR = 'data-mocky-pin'

/** The pseudo-elements that draw text or shapes of their own and inherit `color`. */
export const PIN_PSEUDOS = ['::before', '::after', '::marker'] as const
export type PinPseudo = (typeof PIN_PSEUDOS)[number]

export interface PseudoPin {
  /** The value written on `PIN_ATTR`. */
  id: number
  pseudo: PinPseudo
  /** [property, value] pairs, the value as computed BEFORE the pass changed anything. */
  props: ReadonlyArray<readonly [string, string]>
}

/**
 * Rules that give pseudo-elements back what a pass took from them by
 * inheritance, or resolve what they cannot be given inline.
 *
 * The .pptx pass makes every element's `color` transparent, and a list's bullet
 * (`::marker`), a `before:content-['→']` arrow or a quotation mark drawn by
 * `::after` inherit it — while none of them is a text node, so none comes back
 * as a text box. The slide lost every bullet of every list. They stay in the
 * PICTURE instead, beside the editable text they decorate, exactly like tilted
 * text does. `!important` in a rule scoped to one attribute value: the hide
 * rules never target a pseudo-element, so nothing has to be outranked but the
 * inheritance.
 */
export function pseudoPinCss(pins: readonly PseudoPin[]): string {
  return pins
    .map((p) => {
      const decl = p.props
        .filter(([k, v]) => /^-?[a-z][a-z-]*$/.test(k) && !!v && !/[{};<]/.test(v))
        .map(([k, v]) => `${k}:${v}!important`)
        .join(';')
      // `~=`: one element can be tagged by two passes at once (the hide pins and,
      // on the fallback path, the colour normaliser), so the attribute is a list.
      return decl ? `[${PIN_ATTR}~="${p.id}"]${p.pseudo}{${decl}}` : ''
    })
    .join('')
}

/**
 * Colour syntaxes html2canvas 1.4.1 cannot parse. It THROWS on them ("Attempting
 * to parse an unsupported color function"), and one `oklch()` anywhere on a page
 * lost the whole export. Only the fallback renderer needs this: the native one
 * is the browser, and the browser reads what it wrote.
 */
const UNSUPPORTED_COLOR_FN = /(?<![\w-])(oklch|oklab|lab|lch|hwb|color|color-mix|light-dark)\(/gi
/** A gradient's colour-space hint (`linear-gradient(in oklab, …)` — Tailwind 4 writes it). */
const HINT =
  String.raw`in\s+(?:srgb-linear|srgb|display-p3|a98-rgb|prophoto-rgb|rec2020|oklab|oklch|lab|lch|xyz-d50|xyz-d65|xyz|hsl|hwb)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?`
const INTERPOLATION_HINT = new RegExp(String.raw`\b${HINT}\b`, 'gi')
/** The hint FIRST in a gradient — `(in oklab, red, blue)`, `(in oklab to right, …)` — takes its comma if it has one. */
const LEADING_HINT = new RegExp(String.raw`\(\s*${HINT}\s*(?:,\s*)?`, 'gi')
/** The hint after a direction — `(to right in oklab, …)` — leaves the direction's comma. */
const TRAILING_HINT = new RegExp(String.raw`\s+${HINT}\b`, 'gi')

/** Whether a computed value would make html2canvas throw. */
export function needsColorNormalising(value: string | null | undefined): boolean {
  if (!value) return false
  UNSUPPORTED_COLOR_FN.lastIndex = 0
  INTERPOLATION_HINT.lastIndex = 0
  return UNSUPPORTED_COLOR_FN.test(value) || INTERPOLATION_HINT.test(value)
}

/**
 * Every unsupported colour function in `value` replaced by what `resolve`
 * makes of it (an `rgba()` read off a canvas, in the browser), and every
 * gradient's interpolation hint dropped — html2canvas reads `in oklab` as a
 * colour stop and fails on it. Parentheses are balanced by hand, because
 * `color-mix(in oklch, oklch(…) 40%, white)` nests, and the outermost function
 * is the colour.
 */
export function replaceColorFunctions(value: string, resolve: (fn: string) => string): string {
  let out = ''
  let i = 0
  const re = new RegExp(UNSUPPORTED_COLOR_FN.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(value))) {
    let depth = 0
    let end = -1
    for (let k = m.index + m[1].length; k < value.length; k++) {
      if (value[k] === '(') depth++
      else if (value[k] === ')' && --depth === 0) {
        end = k
        break
      }
    }
    if (end < 0) break
    out += stripHints(value.slice(i, m.index)) + resolve(value.slice(m.index, end + 1))
    i = end + 1
    re.lastIndex = i
  }
  return out + stripHints(value.slice(i))
}

/** Hints are dropped between colours only: what `resolve` returned is not ours to edit. */
function stripHints(segment: string): string {
  return segment.replace(LEADING_HINT, '(').replace(TRAILING_HINT, '')
}

/** An `rgb()`/`rgba()` from canvas pixel bytes — the one spelling every renderer reads. */
export function rgbaFromBytes(r: number, g: number, b: number, a: number): string {
  const alpha = Math.round((a / 255) * 1000) / 1000
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}
