/**
 * A PDF as the SOURCE of a campaign: its words become the brief, its pictures
 * the campaign's pictures — after the person has checked both.
 *
 * The weekly menu arrives as a PDF exported from a word processor, and making
 * the post meant retyping it. pdf.js (Mozilla, Apache-2.0) reads it here, in
 * the browser: the file never reaches the server, and nothing is sent to a
 * model until the person has looked at what was read and pressed the button —
 * the brief is then read for its key facts like a typed one.
 *
 * Three readings, and why each is kept apart:
 * - the TEXT, page by page, rebuilt into lines (`pageText`): what the brief is;
 * - the PICTURES embedded in the pages (photos, a logo), at their own
 *   resolution: what can go IN a piece;
 * - each PAGE as a picture: what the document LOOKED like, offered as a style
 *   reference only — a page is a layout, never a photo to place.
 *
 * pdf.js is loaded on the first import (`import()`), like pdf-lib on the first
 * export: a megabyte nobody pays for until they use it. Scripts in a PDF never
 * run (`isEvalSupported: false`, no XFA, no scripting).
 */

export const PDF_MAX_BYTES = 25 * 1024 * 1024
/** Read past this and the brief would be cut anyway (BRIEF_MAX). */
export const PDF_MAX_PAGES = 20
/** A picture smaller than this on its short side is an icon or a bullet. */
export const PDF_PICTURE_MIN_SIDE = 150
export const PDF_PICTURES_MAX = 12
/** The longest side a picture is kept at. */
export const PDF_PICTURE_MAX_SIDE = 2000
/** Width a page is drawn at, for the review and as a reference. */
export const PDF_PAGE_SHOT_W = 1000

export type PdfImportErrorCode = 'not-pdf' | 'too-big' | 'password' | 'unreadable'

export class PdfImportError extends Error {
  constructor(public code: PdfImportErrorCode) {
    super(code)
    this.name = 'PdfImportError'
  }
}

/** One text item as pdf.js gives it: the string, a line end, and its position matrix. */
export interface PdfTextItem {
  str: string
  hasEOL?: boolean
  transform?: number[]
}

/**
 * A page's text as lines and paragraphs.
 *
 * pdf.js hands back runs in reading order with a flag at a line's end; a run
 * that starts lower than the last one is a new line too, because not every
 * producer sets the flag (a table cell, a menu's second column). A PDF has no
 * blank lines — a paragraph is a GAP — so a blank line is put where the drop to
 * the next line is more than 1.8 times the size of the text above it. The
 * first version trusted the flag alone: pdf.js closes every line with an empty
 * flagged run, and the menu came back with a blank line between every dish.
 */
export function pageText(items: PdfTextItem[]): string {
  const lines: string[] = []
  let line = ''
  /** Where the last run with text sat, and its size. */
  let lineY: number | null = null
  let lineSize = 0
  const close = () => {
    if (line.trim()) lines.push(line)
    line = ''
  }
  for (const it of items) {
    if (typeof it?.str !== 'string') continue
    const t = Array.isArray(it.transform) ? it.transform : null
    const y = t && typeof t[5] === 'number' ? t[5] : null
    const size = t && typeof t[3] === 'number' ? Math.abs(t[3]) : 0
    const moved = y !== null && lineY !== null && Math.abs(y - lineY) > 2
    if (it.str && moved) {
      close()
      if (lineSize && lineY! - y! > 1.8 * lineSize && lines.length && lines[lines.length - 1] !== '') lines.push('')
    }
    if (it.str) {
      // Two runs on one line with no space between them and no space inside:
      // most producers emit the space; the ones that do not glue words.
      if (line && !moved && !/\s$/.test(line) && !/^\s/.test(it.str)) {
        const prev = line.slice(-1)
        if (/[\p{L}\p{N}]/u.test(prev) && /^[\p{L}\p{N}]/u.test(it.str) && it.str.length > 1) line += ' '
      }
      line += it.str
      if (y !== null) {
        lineY = y
        if (size) lineSize = size
      }
    }
    if (it.hasEOL) close()
  }
  close()
  return cleanText(lines.join('\n'))
}

/** Spaces folded, lines trimmed, at most one blank line in a row. */
export function cleanText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The pages' text as one brief, a blank line between pages. */
export function joinPages(pages: string[]): string {
  return cleanText(pages.filter((p) => p.trim()).join('\n\n'))
}

/** Whether a picture of this size is worth offering. */
export function keepPicture(w: number, h: number): boolean {
  return Math.min(w, h) >= PDF_PICTURE_MIN_SIDE
}

/** The size a picture is kept at: never larger, the longest side at most `max`. */
export function fitWithin(w: number, h: number, max = PDF_PICTURE_MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h, 1))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

export interface PdfPicture {
  /** 1-based. */
  page: number
  w: number
  h: number
  blob: Blob
  /** An object URL for the review; the caller revokes it (`releasePdfReading`). */
  url: string
}

export interface PdfReading {
  name: string
  pages: number
  /** Pages actually read (at most PDF_MAX_PAGES). */
  read: number
  text: string
  pictures: PdfPicture[]
  /** Every page read, drawn whole. */
  pageShots: PdfPicture[]
  /** No text to speak of: a scan, which this does not read (no OCR). */
  scanned: boolean
}

export function releasePdfReading(r: PdfReading | null): void {
  if (!r) return
  for (const p of [...r.pictures, ...r.pageShots]) URL.revokeObjectURL(p.url)
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function toBlob(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, 0.9))
}

/** A decoded pdf.js image (an ImageBitmap, or raw pixels by kind) as a canvas at most PDF_PICTURE_MAX_SIDE. */
function drawImageObject(img: any): HTMLCanvasElement | null {
  const w = img?.width
  const h = img?.height
  if (!(w > 0 && h > 0)) return null
  let source: CanvasImageSource | null = null
  if (img.bitmap) source = img.bitmap
  else if (img.data) {
    const full = canvasOf(w, h)
    const ctx = full.getContext('2d')
    if (!ctx) return null
    const data = img.data as Uint8ClampedArray
    const out = ctx.createImageData(w, h)
    // pdf.js ImageKind: 1 = 1 bit grey, 2 = RGB, 3 = RGBA.
    if (img.kind === 3 && data.length >= w * h * 4) out.data.set(data.subarray(0, w * h * 4))
    else if (img.kind === 2 && data.length >= w * h * 3) {
      for (let i = 0, j = 0; i < w * h; i++, j += 3) {
        out.data[i * 4] = data[j]
        out.data[i * 4 + 1] = data[j + 1]
        out.data[i * 4 + 2] = data[j + 2]
        out.data[i * 4 + 3] = 255
      }
    } else return null
    ctx.putImageData(out, 0, 0)
    source = full
  }
  if (!source) return null
  const size = fitWithin(w, h)
  const c = canvasOf(size.w, size.h)
  c.getContext('2d')?.drawImage(source, 0, 0, size.w, size.h)
  return c
}

/** An object pdf.js resolves asynchronously, or null when it never arrives. */
function objectOf(page: any, name: string): Promise<any> {
  return new Promise((resolve) => {
    const store = name.startsWith('g_') ? page.commonObjs : page.objs
    const timer = setTimeout(() => resolve(null), 4000)
    try {
      store.get(name, (o: any) => {
        clearTimeout(timer)
        resolve(o)
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

const abortIf = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export async function readPdf(
  file: File,
  opts: { signal?: AbortSignal; onProgress?: (page: number, pages: number) => void } = {},
): Promise<PdfReading> {
  if (file.size > PDF_MAX_BYTES) throw new PdfImportError('too-big')
  const bytes = new Uint8Array(await file.arrayBuffer())
  // `%PDF-` within the first kilobyte, as readers accept.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  if (!head.includes('%PDF-')) throw new PdfImportError('not-pdf')

  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, enableXfa: false, disableFontFace: false })
  let doc: any
  try {
    doc = await task.promise
  } catch (err) {
    if ((err as { name?: string })?.name === 'PasswordException') throw new PdfImportError('password')
    throw new PdfImportError('unreadable')
  }

  const pictures: PdfPicture[] = []
  const pageShots: PdfPicture[] = []
  const texts: string[] = []
  const seen = new Set<string>()
  const read = Math.min(doc.numPages, PDF_MAX_PAGES)
  try {
    for (let n = 1; n <= read; n++) {
      abortIf(opts.signal)
      opts.onProgress?.(n, read)
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      texts.push(pageText(content.items as PdfTextItem[]))

      // The page, drawn whole: the review's thumbnail and a possible reference.
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: PDF_PAGE_SHOT_W / base.width })
      const shot = canvasOf(Math.round(viewport.width), Math.round(viewport.height))
      const ctx = shot.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, shot.width, shot.height)
        await page.render({ canvasContext: ctx, canvas: shot, viewport }).promise
        const blob = await toBlob(shot, 'image/jpeg')
        pageShots.push({ page: n, w: shot.width, h: shot.height, blob, url: URL.createObjectURL(blob) })
      }

      // The pictures it paints. Rendering above has decoded them, so they are
      // in the page's object store by now.
      if (pictures.length < PDF_PICTURES_MAX) {
        const ops = await page.getOperatorList()
        for (let i = 0; i < ops.fnArray.length && pictures.length < PDF_PICTURES_MAX; i++) {
          const fn = ops.fnArray[i]
          let img: any = null
          if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintImageXObjectRepeat) {
            const name = ops.argsArray[i]?.[0]
            if (typeof name !== 'string' || seen.has(name)) continue
            seen.add(name)
            img = await objectOf(page, name)
          } else if (fn === pdfjs.OPS.paintInlineImageXObject) {
            img = ops.argsArray[i]?.[0]
          } else continue
          if (!img || !keepPicture(img.width, img.height)) continue
          const canvas = drawImageObject(img)
          if (!canvas) continue
          const blob = await toBlob(canvas, 'image/jpeg')
          pictures.push({ page: n, w: canvas.width, h: canvas.height, blob, url: URL.createObjectURL(blob) })
        }
      }
      page.cleanup()
    }
  } catch (err) {
    releasePdfReading({ name: '', pages: 0, read: 0, text: '', pictures, pageShots, scanned: false })
    throw err
  } finally {
    void doc.destroy()
  }
  const text = joinPages(texts)
  return { name: file.name, pages: doc.numPages, read, text, pictures, pageShots, scanned: text.replace(/\s/g, '').length < 20 }
}
