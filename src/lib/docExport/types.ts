import type { FrameBox } from '../frameGeometry'
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
  /**
   * The text element this block is a line of, when it is one — the `<h1>` of
   * `<h1><span class="block">Fête</span><span class="block">d’été</span></h1>`.
   * Blocks sharing it are one piece of text set on several lines
   * (`mergeBlocks`). Absent when the block stands alone.
   */
  group?: number
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

/** A paragraph of a text box: from `start` (an index into the block's `lines`) to the next one. */
export interface TextPara {
  start: number
  /** Its own line pitch, px: a headline over a subtitle keeps each one's. */
  pitch: number
}

/** The lines of one block element, in order — one text box in a slide. */
export interface TextBlock {
  rect: Rect
  lines: TextLine[]
  align: TextAlign
  /** Distance between two consecutive lines' tops, px — measured when there are several. */
  pitch: number
  /**
   * Set when blocks that belong together were made one box (`mergeBlocks`):
   * each keeps its own paragraph, so its own size, ink and pitch. Absent = one
   * paragraph at `pitch`.
   */
  paras?: TextPara[]
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
  /**
   * The page's own background colour, when it paints an opaque one. The .pptx
   * of a page with no frame grounds the slide in it (pptx.ts, `slideXml`).
   * Optional for the same reason.
   */
  ground?: Rgba
  /**
   * What sits between lines without being text — a picture, an icon, a rule —
   * so two blocks on either side of it are never made one box. Optional for
   * the same reason.
   */
  obstacles?: Rect[]
}

// ── a page taken apart (the .pptx for Canva, decompose.ts) ────────────────

export interface GradientStop {
  /** 0–1 along the gradient line. */
  pos: number
  color: Rgba
}

export type ShapeFill =
  | { kind: 'solid'; color: Rgba }
  /** `angle` in CSS degrees: 0 is towards the top, 90 towards the right. */
  | { kind: 'linear'; angle: number; stops: GradientStop[] }

export interface ShapeLine {
  /** px */
  width: number
  color: Rgba
  dash: 'solid' | 'dash' | 'dot'
}

export interface ShapeShadow {
  dx: number
  dy: number
  blur: number
  color: Rgba
}

export type ShapeGeom =
  | { prst: 'rect' }
  /** `radius` in px. */
  | { prst: 'roundRect'; radius: number }
  /** Two corners on one side rounded: the top ones, or the bottom ones when `flip`. */
  | { prst: 'round2SameRect'; radius: number; flip: boolean }
  | { prst: 'ellipse' }

/** An element's own paint, as a native shape: a fill, an outline, a shadow. */
export interface ShapeItem {
  kind: 'shape'
  rect: Rect
  geom: ShapeGeom
  fill: ShapeFill | null
  line: ShapeLine | null
  shadow: ShapeShadow | null
}

/** What no shape can say, as a picture of just that element. */
export interface PictureItem {
  kind: 'picture'
  rect: Rect
  /** For its name in the editor's layers. */
  role: 'picture' | 'icon' | 'decor'
  image: { bytes: Uint8Array; type: 'png' }
}

/** Where a carried frame (`RenderedPage.frames[index]`) goes in the paint order. */
export interface FrameRef {
  kind: 'frame'
  index: number
}

export type SlideItem = ShapeItem | PictureItem | FrameRef

/** One page, rasterised and measured. */
/**
 * A layer a frame draws OVER its picture — its outline, a scrapbook frame's
 * tape — as the .pptx redraws it: a path in the shape's 0–100 box, resolved
 * colours, the outline's width in page px.
 */
export interface FrameOverlay {
  role: 'stroke' | 'over'
  d: string
  fill: Rgba | null
  stroke: Rgba | null
  strokeWidth: number
  opacity: number
}

/**
 * A `<ShapeFrame>` as the .pptx carries it: a shape filled with its picture,
 * which Canva imports as one of its frames (frames.ts says how that was found).
 */
export interface CarriedFrame {
  box: FrameBox
  /** The picture already cut to the box; null for a frame waiting for one (the placeholder goes in). */
  picture: { bytes: Uint8Array; type: 'png' | 'jpeg' } | null
  overlays: FrameOverlay[]
  /** The frame casts a shadow that went with its picture. */
  shadow: boolean
}

export interface RenderedPage {
  snapshot: PageSnapshot
  /** The frames the .pptx, the SVG and the PSD carry on their own; the picture no longer has them. */
  frames?: CarriedFrame[]
  /**
   * Encoded picture (JPEG or PNG, per the request). Taken apart (`items`), only
   * the page's own paint when no colour can say it — and empty when one can.
   */
  image: Uint8Array
  /** Set when the page was taken apart: its paint, element by element, in paint order. */
  items?: SlideItem[]
  /** Size of the picture in pixels. */
  pixelWidth: number
  pixelHeight: number
}
