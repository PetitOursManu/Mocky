import type { PDFDict } from 'pdf-lib'
import type { PageFormat } from '../pageFormats'
import type { FieldBox, PageSnapshot, Rect, Rgba, TextLine } from './types'
import { safeLinkHref } from './files'
import { toWinAnsi } from './winAnsi'

/**
 * A document as a PDF: the page as a picture, the text as an invisible layer on
 * top of it, and every `<Field>` as a REAL form field.
 *
 * Why a picture and not vector text: the page is a React + Tailwind design with
 * gradients, blend modes, clipped photographs and web fonts, and the only engine
 * in the browser that draws all of that correctly is the one that drew it. The
 * picture is taken at ~250 dpi (raster.ts), which prints clean. What a picture
 * loses — selecting, searching, copying, a screen reader — is given back by the
 * invisible layer: each measured line, in Helvetica, stretched to the measured
 * width with the text-rendering mode that draws nothing (`3 Tr`). It is the same
 * trick a scanner's OCR uses, for the same reason.
 *
 * pdf-lib is imported dynamically, inside `buildPdf`, so the 400 KB it weighs
 * is paid by the person who clicks "PDF" and never by the canvas.
 */

export interface PdfPageInput {
  snapshot: PageSnapshot
  /** The page as a JPEG, drawn full-bleed. */
  jpeg: Uint8Array
}

export interface PdfMeta {
  title: string
  /** BCP 47, for the catalogue's /Lang — what a screen reader reads the text layer as. */
  lang?: string
}

/**
 * px → pt for one axis. Not a flat × 0.75: the format's px are rounded (A4 is
 * 793.7 px wide, stored as 794) and its points are exact, so each axis is scaled
 * by its own ratio and the page's edge lands on the paper's edge.
 */
export function pdfScale(format: Pick<PageFormat, 'w' | 'h' | 'widthPt' | 'heightPt'>): { sx: number; sy: number } {
  return { sx: format.widthPt / format.w, sy: format.heightPt / format.h }
}

/** A px rect (y down, from the page's top) as a PDF rect (y up, from the bottom). */
export function toPdfRect(
  r: Rect,
  format: Pick<PageFormat, 'w' | 'h' | 'widthPt' | 'heightPt'>,
): { x: number; y: number; width: number; height: number } {
  const { sx, sy } = pdfScale(format)
  return { x: r.x * sx, y: format.heightPt - (r.y + r.h) * sy, width: r.w * sx, height: r.h * sy }
}

/**
 * Where a line's baseline sits, in px from the page top. A Range rect is the
 * font's content area, ascent over descent, and for the faces a page is set in
 * the baseline is about four fifths of the way down it. The layer is invisible,
 * so this only decides where a selection highlight falls — close is enough.
 */
export function baselineY(line: Pick<TextLine, 'rect'>): number {
  return line.rect.y + line.rect.h * 0.78
}

/**
 * The horizontal scale (`Tz`, percent) that makes Helvetica cover the width the
 * page's own font covered. Bounded, because a line of one narrow glyph measured
 * against a wide box would otherwise ask for a scale no reader draws the same.
 */
export function horizontalScale(naturalWidthPt: number, targetWidthPt: number): number {
  if (!(naturalWidthPt > 0) || !(targetWidthPt > 0)) return 100
  return Math.min(500, Math.max(10, (100 * targetWidthPt) / naturalWidthPt))
}

/**
 * Field names, unique across the whole document.
 *
 * A PDF form is ONE namespace: two fields called "email" are one field shown
 * twice, so typing in one fills the other — and a page kit may well reuse a name
 * on page 2. A dot is a hierarchy separator in a PDF field name (pdf-lib splits
 * on it), so it is replaced rather than left to invent a parent field.
 */
export function uniqueFieldNames(names: readonly string[]): string[] {
  const used = new Set<string>()
  return names.map((raw) => {
    const base = toWinAnsi(raw).replace(/\./g, '_').replace(/\s+/g, ' ').trim() || 'field'
    let name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}_${n}`
    used.add(name.toLowerCase())
    return name
  })
}

/**
 * A readable size for the text typed into a field: the page's own size when it
 * fits the box, never so large that a single line overflows it, never under 6 pt.
 * A multiline box gets the body size of a form (at most 14 pt) — the design's
 * placeholder might be a 32 px display face, and a paragraph typed at that size
 * fills the box in four words.
 */
export function fieldFontSize(field: Pick<FieldBox, 'type' | 'fontSize'>, heightPt: number, sy: number): number {
  const own = field.fontSize > 0 ? field.fontSize * sy : 11
  if (field.type === 'multiline') return round1(Math.min(14, Math.max(6, own)))
  return round1(Math.max(6, Math.min(own, heightPt * 0.7, 24)))
}

const round1 = (n: number) => Math.round(n * 10) / 10

function inkOf(c: Rgba): { r: number; g: number; b: number } {
  // A field whose text was transparent (or faint) still needs an ink someone
  // can read what they typed in.
  if (c.a < 0.3) return { r: 0, g: 0, b: 0 }
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255 }
}

/** The tooltip a reader shows over a field, and what a screen reader announces. */
function fieldTooltip(f: FieldBox): string {
  return toWinAnsi(f.placeholder || f.name).trim()
}

export async function buildPdf(pages: readonly PdfPageInput[], format: PageFormat, meta: PdfMeta): Promise<Uint8Array> {
  const lib = await import('pdf-lib')
  const {
    PDFDocument,
    StandardFonts,
    rgb,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    pushGraphicsState,
    popGraphicsState,
    beginText,
    endText,
    setFontAndSize,
    setTextRenderingMode,
    TextRenderingMode,
    setCharacterSqueeze,
    rotateAndSkewTextDegreesAndTranslate,
    showText,
  } = lib

  const doc = await PDFDocument.create()
  // The info dictionary is UTF-16, so the title keeps its accents and emoji.
  doc.setTitle(meta.title.trim() || 'Document', { showInWindowTitleBar: true })
  doc.setProducer('Mocky')
  doc.setCreator('Mocky')
  if (meta.lang) doc.catalog.set(PDFName.of('Lang'), PDFString.of(meta.lang))

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const form = doc.getForm()
  const { sx, sy } = pdfScale(format)

  const allFields = pages.flatMap((p) => p.snapshot.fields)
  const names = uniqueFieldNames(allFields.map((f) => f.name))
  let fieldIndex = 0

  for (const input of pages) {
    const page = doc.addPage([format.widthPt, format.heightPt])
    const image = await doc.embedJpg(input.jpeg)
    page.drawImage(image, { x: 0, y: 0, width: format.widthPt, height: format.heightPt })

    // ── the invisible text layer ──────────────────────────────────────────
    const fontKey = page.node.newFontDictionary(font.name, font.ref)
    const ops = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)]
    let drawn = 0
    for (const line of input.snapshot.lines) {
      const text = toWinAnsi(line.text).trim()
      if (!text || line.rect.w <= 0) continue
      const size = Math.max(1, line.fontSize * sy)
      const natural = font.widthOfTextAtSize(text, size)
      ops.push(
        setFontAndSize(fontKey, size),
        setCharacterSqueeze(horizontalScale(natural, line.rect.w * sx)),
        rotateAndSkewTextDegreesAndTranslate(0, 0, 0, line.rect.x * sx, format.heightPt - baselineY(line) * sy),
        showText(font.encodeText(text)),
      )
      drawn++
    }
    ops.push(endText(), popGraphicsState())
    if (drawn > 0) page.pushOperators(...ops)

    // ── fillable fields ───────────────────────────────────────────────────
    for (const f of input.snapshot.fields) {
      const name = names[fieldIndex++]
      const box = toPdfRect(f.rect, format)
      if (box.width < 2 || box.height < 2) continue
      const ink = inkOf(f.color)
      const textColor = rgb(ink.r, ink.g, ink.b)
      // The design's own box shows through: no fill, no border. pdf-lib paints
      // white with a black rule unless the keys are PRESENT and undefined —
      // omitting them is not the same as passing nothing.
      const look = { ...box, font, textColor, backgroundColor: undefined, borderColor: undefined, borderWidth: 0 }
      const tooltip = fieldTooltip(f)
      let acroDict: PDFDict | null = null
      if (f.type === 'checkbox') {
        const cb = form.createCheckBox(name)
        cb.addToPage(page, look)
        if (f.checked) cb.check()
        acroDict = cb.acroField.dict
      } else if (f.type === 'select' && f.options.length > 0) {
        const options = [...new Set(f.options.map((o) => toWinAnsi(o).trim()).filter(Boolean))]
        const dd = form.createDropdown(name)
        dd.addOptions(options)
        const value = toWinAnsi(f.value).trim()
        if (value && options.includes(value)) dd.select(value)
        dd.addToPage(page, look)
        dd.setFontSize(fieldFontSize(f, box.height, sy))
        acroDict = dd.acroField.dict
      } else {
        const tf = form.createTextField(name)
        const multiline = f.type === 'multiline'
        if (multiline) tf.enableMultiline()
        tf.addToPage(page, look)
        tf.setFontSize(fieldFontSize(f, box.height, sy))
        if (f.align === 'center') tf.setAlignment(TextAlignment.Center)
        else if (f.align === 'right') tf.setAlignment(TextAlignment.Right)
        const value = toWinAnsi(f.value, multiline)
        if (value.trim()) tf.setText(value)
        acroDict = tf.acroField.dict
      }
      if (tooltip && acroDict) acroDict.set(PDFName.of('TU'), PDFHexString.fromText(tooltip))
    }

    // ── links ─────────────────────────────────────────────────────────────
    for (const link of input.snapshot.links) {
      const href = safeLinkHref(link.href)
      const r = toPdfRect(link.rect, format)
      if (!href || r.width < 1 || r.height < 1) continue
      const annot = doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [r.x, r.y, r.x + r.width, r.y + r.height],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(href) },
      })
      page.node.addAnnot(doc.context.register(annot))
    }
  }

  // Appearances are written for every field (pdf-lib's default on save), so a
  // viewer that ignores /NeedAppearances — Preview on a Mac, most phones —
  // still draws a checked box and a filled-in value.
  if (allFields.length > 0) form.updateFieldAppearances(font)
  return doc.save()
}
