import { FIELD_ATTR } from '../pageFormats'

/**
 * Names and hand-off: what a downloaded file is called, and how it leaves.
 */

/**
 * A file name from a screen's name — "Flyer — Fête d’été" stays readable,
 * accents and all, because a person will look for it in Downloads by that name.
 * Only what a file system refuses is taken out (Windows is the strictest:
 * `\ / : * ? " < > |`, control characters, a trailing dot or space).
 */
export function fileBaseName(name: string | null | undefined, fallback = 'document'): string {
  const cleaned = (name || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80)
    .trim()
  // A name that is only a reserved device (CON, NUL…) cannot be created on Windows.
  if (!cleaned || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned)) return fallback
  return cleaned
}

/**
 * The name of one page inside a zip of PNGs. Zero-padded, so a file manager
 * sorts page 10 after page 9, and ASCII, since the zip writer does not flag its
 * names as UTF-8.
 */
export function pageFileName(index: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return `page-${String(index + 1).padStart(width, '0')}.png`
}

/**
 * The links a PDF may carry. A link annotation in a PDF is a click that leaves
 * the document, so only the schemes a flyer has any business with pass:
 * web addresses, e-mail and phone numbers. `javascript:` and the rest are the
 * page's own affair and do not travel.
 */
export function safeLinkHref(href: unknown): string | null {
  // Typed `unknown` on purpose: an SVG <a>'s `.href` is an SVGAnimatedString,
  // and one reaching here once made the whole PDF throw on `.trim`.
  const s = typeof href === 'string' ? href.trim() : ''
  if (!s) return null
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return null
  // A PDF URI is a byte string. The URL parser percent-encodes anything beyond
  // ASCII and punycodes the host, so this holds by construction — checked
  // anyway, because a link that is dropped costs nothing and a mangled one
  // sends a reader somewhere else.
  const out = url.href
  return /^[\x21-\x7e]+$/.test(out) ? out : null
}

export const MIME = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  zip: 'application/zip',
} as const

/**
 * Hand a file to the browser as a download — directly, no print dialog.
 *
 * The object URL is revoked a little later rather than at once: revoking it in
 * the same task as the click is a race Firefox has been known to lose, and the
 * file then never starts.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/**
 * Whether the document has anything to fill in — the kit's `<Field>`, or the
 * attribute written by hand. Read off the source because the dialog renders
 * nothing: a flyer usually has no field, and a button promising "champs à
 * remplir" on it was a promise the file did not keep, while hiding that it is
 * also the plain printable PDF.
 */
export function documentHasFields(code: string): boolean {
  return /<Field\b/.test(code) || code.includes(FIELD_ATTR)
}
