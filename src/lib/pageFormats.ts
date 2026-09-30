/**
 * Page formats for DOCUMENT screens, and the contract between the page kit that
 * draws them and the exports that read them back.
 *
 * A document is not a web page at a different width. It is a stack of pages of
 * a FIXED size — a flyer is designed page by page, like in Canva, not flowed —
 * and that is what makes three things agree: what the canvas shows, what the
 * PDF contains, and where a fillable field lands in it. A CSS pixel on a page
 * is 1/96 in, so it maps linearly to PDF points (× 0.75) with no fragmentation
 * to guess at.
 *
 * This file is the single source of those numbers and of the DOM attributes the
 * kit writes (`<Doc>`, `<Page>`, `<Field>` in capabilities/snippets/Document.ts)
 * and the exports look for (lib/docExport/*). Change an attribute here and both
 * sides follow; spell one by hand anywhere else and they drift apart silently.
 */

export type PageFormatId =
  | 'a4'
  | 'a4-landscape'
  | 'a3'
  | 'letter'
  | 'letter-landscape'
  | 'slides'
  | 'social-square'
  | 'social-portrait'
  | 'social-story'
  | 'social-landscape'

export interface PageFormat {
  id: PageFormatId
  /** Size of one page in CSS px at 96 dpi — the frame the model designs in. */
  w: number
  h: number
  /** The same size in PDF points (1/72 in), exact rather than derived from the rounded px. */
  widthPt: number
  heightPt: number
  /** `@page { size: … }`, for anything that prints the page. */
  cssSize: string
  /**
   * 'print' pages are paper; 'slides' is a 16:9 presentation page; 'social' is
   * an image made to be posted — sized in the pixels the platforms ask for,
   * seen on a phone, never printed.
   */
  kind: 'print' | 'slides' | 'social'
}

/**
 * A4 is 210 × 297 mm: 793.7 × 1122.5 px, rounded to whole pixels because the
 * model writes class names, not fractions. The points are the exact ones, so a
 * PDF page is the ISO size to the hundredth of a point.
 *
 * The presentation page is 1280 × 720 px, i.e. 13.333 × 7.5 in: the size
 * PowerPoint and Google Slides call "Widescreen 16:9", so a deck exported from
 * here opens there at its own size instead of being letterboxed.
 *
 * The social formats are the sizes the platforms publish, in their own pixels,
 * so a PNG exported at 1× is the file they want as it is: 1080 × 1080 (a square
 * post, everywhere), 1080 × 1350 (4:5, the tallest a feed shows whole),
 * 1080 × 1920 (a 9:16 story or reel cover) and 1200 × 628 (1.91:1, the link and
 * LinkedIn image). Their points are the pixels × 0.75 like every other page, so
 * a carousel exported as a PDF — what LinkedIn calls a document post — keeps
 * the same proportions.
 */
export const PAGE_FORMATS: readonly PageFormat[] = [
  { id: 'a4', w: 794, h: 1123, widthPt: 595.28, heightPt: 841.89, cssSize: 'A4 portrait', kind: 'print' },
  { id: 'a4-landscape', w: 1123, h: 794, widthPt: 841.89, heightPt: 595.28, cssSize: 'A4 landscape', kind: 'print' },
  { id: 'a3', w: 1123, h: 1587, widthPt: 841.89, heightPt: 1190.55, cssSize: 'A3 portrait', kind: 'print' },
  { id: 'letter', w: 816, h: 1056, widthPt: 612, heightPt: 792, cssSize: 'letter portrait', kind: 'print' },
  { id: 'letter-landscape', w: 1056, h: 816, widthPt: 792, heightPt: 612, cssSize: 'letter landscape', kind: 'print' },
  { id: 'slides', w: 1280, h: 720, widthPt: 960, heightPt: 540, cssSize: '1280px 720px', kind: 'slides' },
  { id: 'social-square', w: 1080, h: 1080, widthPt: 810, heightPt: 810, cssSize: '1080px 1080px', kind: 'social' },
  { id: 'social-portrait', w: 1080, h: 1350, widthPt: 810, heightPt: 1012.5, cssSize: '1080px 1350px', kind: 'social' },
  { id: 'social-story', w: 1080, h: 1920, widthPt: 810, heightPt: 1440, cssSize: '1080px 1920px', kind: 'social' },
  { id: 'social-landscape', w: 1200, h: 628, widthPt: 900, heightPt: 471, cssSize: '1200px 628px', kind: 'social' },
]

export const PAGE_FORMAT_IDS = PAGE_FORMATS.map((f) => f.id)

export const DEFAULT_PAGE_FORMAT: PageFormatId = 'a4'

export function isPageFormat(id: unknown): id is PageFormatId {
  return typeof id === 'string' && (PAGE_FORMAT_IDS as string[]).includes(id)
}

export function getPageFormat(id: PageFormatId): PageFormat {
  return PAGE_FORMATS.find((f) => f.id === id) ?? PAGE_FORMATS[0]
}

/**
 * The formats a document may move between: paper and slides on one side, the
 * social sizes on the other. A report can become a deck and a flyer a poster,
 * but a post laid out in 1080 px for a phone is not the same piece at A4, so
 * the composer never offers the jump (`composerPageFormat`).
 */
export function formatFamily(id: PageFormatId): 'paper' | 'social' {
  return getPageFormat(id).kind === 'social' ? 'social' : 'paper'
}

export function formatsLike(id: PageFormatId): PageFormat[] {
  const family = formatFamily(id)
  return PAGE_FORMATS.filter((f) => formatFamily(f.id) === family)
}

/**
 * A stored value read back from a project: an id this build knows, or nothing.
 * An unknown id (a format removed later) reads as "not a document" rather than
 * as a guess, the same rule `Screen.theme` follows.
 */
export function normalizePageFormat(v: unknown): PageFormatId | undefined {
  return isPageFormat(v) ? v : undefined
}

/** CSS px → PDF points. 96 px per inch against 72 points per inch. */
export const PX_TO_PT = 0.75
export const pxToPt = (px: number) => px * PX_TO_PT

// ---- the DOM contract --------------------------------------------------------

/** On the root that holds the pages. */
export const DOC_ATTR = 'data-mocky-doc'
/** On each page box; the value is the page's 0-based index. */
export const PAGE_ATTR = 'data-mocky-page'
/** On a fillable element (input, textarea, select, or a placeholder box); the value is the field NAME. */
export const FIELD_ATTR = 'data-mocky-field'
/** Beside FIELD_ATTR: what kind of field the export should create. */
export const FIELD_TYPE_ATTR = 'data-field-type'

export type FieldType = 'text' | 'multiline' | 'checkbox' | 'date' | 'email' | 'number' | 'select'
export const FIELD_TYPES: readonly FieldType[] = ['text', 'multiline', 'checkbox', 'date', 'email', 'number', 'select']

export function isFieldType(v: unknown): v is FieldType {
  return typeof v === 'string' && (FIELD_TYPES as readonly string[]).includes(v)
}

/**
 * Vertical space between two pages ON THE CANVAS only. Exports render each page
 * on its own, so this never reaches a PDF or a slide.
 */
export const PAGE_GAP_PX = 32

/** Height of a document frame on the canvas: its pages stacked with the gap between them. */
export function docFrameHeight(format: PageFormat, pages: number): number {
  const n = Math.max(1, Math.floor(pages))
  return n * format.h + (n - 1) * PAGE_GAP_PX
}

/**
 * What the page kit posts from inside the preview frame once laid out:
 * `{ __mocky: true, frameId, type: DOC_PAGES_MESSAGE, count, overflow }` — the
 * number of pages, and the 0-based indices of the pages whose content is taller
 * than the page (clipped on paper, so worth a notice).
 */
export const DOC_PAGES_MESSAGE = 'docPages'
