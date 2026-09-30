import type { FieldType } from '../pageFormats'

/**
 * What a rendered document page is, once it has left the browser's layout.
 *
 * Every export reads the same snapshot: the PDF puts an invisible text layer on
 * `lines` and fillable fields on `fields`, the .pptx turns `blocks` into text
 * boxes. Coordinates are CSS px relative to the PAGE box's top-left corner,
 * never to the frame — a page is a sheet of paper, and where the frame happened
 * to stack it is none of a PDF's business.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 0–255 channels, alpha 0–1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

/** The look of a run of text, read from computed style. */
export interface RunStyle {
  /** px */
  fontSize: number
  fontWeight: number
  italic: boolean
  underline: boolean
  color: Rgba
  /** The computed `font-family` list, as written. */
  fontFamily: string
  /** px; 0 for `normal`. */
  letterSpacing: number
}

/** One word as the layout drew it — the unit `groupLines` starts from. */
export interface Word {
  text: string
  rect: Rect
  /** Whitespace precedes this word in the text flow (so "Hello<b>World</b>" stays one word). */
  space: boolean
  /** Index of the block element the word belongs to (see `BlockInfo`). */
  block: number
  style: RunStyle
}

/** The block-level element a run of text is laid out in. */
export interface BlockInfo {
  align: TextAlign
  /** Computed `line-height` in px, or null for `normal`. */
  lineHeight: number | null
}

export interface TextRun {
  text: string
  style: RunStyle
}

/** One visual line: words that share a baseline inside one block. */
export interface TextLine {
  text: string
  rect: Rect
  runs: TextRun[]
  block: number
  /** The largest run's size, px. */
  fontSize: number
}

/** The lines of one block element, in order — one text box in a slide. */
export interface TextBlock {
  rect: Rect
  lines: TextLine[]
  align: TextAlign
  /** Distance between two consecutive lines' tops, px — measured when there are several. */
  pitch: number
}

export interface FieldBox {
  /** The name as written by the page (FIELD_ATTR). Not yet unique — the PDF dedupes. */
  name: string
  type: FieldType
  rect: Rect
  value: string
  placeholder: string
  checked: boolean
  options: string[]
  fontSize: number
  color: Rgba
  align: TextAlign
  /** px, so a slide's text box starts where the field's text does. */
  paddingLeft: number
}

export interface LinkBox {
  href: string
  rect: Rect
}

/** Per edge, in page px, never negative. */
export interface PageExcess {
  top: number
  right: number
  bottom: number
  left: number
}

/** A run of text (its crossing words, as drawn) or a field (its name) found past the edge. */
export interface OutsideItem {
  text: string
  field?: boolean
}

export interface PageSnapshot {
  index: number
  /** The page's size in px (the format's). */
  width: number
  height: number
  lines: TextLine[]
  blocks: TextBlock[]
  fields: FieldBox[]
  links: LinkBox[]
  /**
   * Text or a field crosses the page's edge, by the page kit's own definition
   * (`mockyPageOverflows`): glyphs and fields count, shapes do not. Optional so
   * a hand-built snapshot (fixtures, tests) need not say.
   */
  overflow?: boolean
  /**
   * How far that text or field runs past each edge, in page px, and WHAT runs
   * past — present only when `overflow` is. "Content is cut" is a notice; a
   * correction needs the number and the words, or the model is guessing at a
   * page it cannot see (lib/docExport/fit.ts).
   */
  excess?: PageExcess
  outside?: OutsideItem[]
  /**
   * Words drawn under a rotation or a scale, left in the picture rather than
   * turned into text (see `makeTiltTest`). Optional for the same reason.
   */
  tilted?: number
}

/** One page, rasterised and measured. */
export interface RenderedPage {
  snapshot: PageSnapshot
  /** Encoded picture (JPEG or PNG, per the request). */
  image: Uint8Array
  /** Size of the picture in pixels. */
  pixelWidth: number
  pixelHeight: number
}
