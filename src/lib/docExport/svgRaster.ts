/**
 * The pure half of the native rasteriser (nativeRaster.ts): everything that
 * decides something about turning a page into an SVG <foreignObject> image,
 * written against the smallest interface that answers, so a test can feed it
 * plain objects. The drawing itself only exists in a browser.
 *
 * Why an SVG image at all: html2canvas re-implements CSS painting and 1.4.1
 * stops well short of what a generated flyer uses — it dropped absolutely
 * placed inline SVG shapes, cropped the text of inputs, drew no clip-path,
 * object-fit, blur or blend mode, and threw on `oklch()`. An SVG whose
 * foreignObject holds the page's own markup and CSS is painted by the browser's
 * real engine, and in Chromium a data: URL of one does not taint the canvas it
 * is drawn on. Safari does taint it, which is what `classifyNativeFailure`'s
 * `tainted` is for: html2canvas stays as the fallback.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg'
export const XHTML_NS = 'http://www.w3.org/1999/xhtml'

/**
 * The document the page is drawn from. `markup` must already be XML — the
 * serialised wrapper element, carrying its own XHTML namespace. An inline <svg>
 * in the page needs the SVG namespace declared ON it inside the foreignObject:
 * XMLSerializer writes it, a hand-built string did not, and the shapes vanished.
 */
export function svgDocument(markup: string, width: number, height: number): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return (
    `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`
  )
}

/**
 * A data: URL, not a blob: one. The probe that proved this path drew from a
 * data: URL, and Chromium's rule on tainting SVG images with a foreignObject
 * has differed between the two in the past; the one that was measured is the
 * one used.
 */
export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// ── form state ────────────────────────────────────────────────────────────

interface AttrTarget {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

export interface ControlLike {
  tagName: string
  getAttribute(name: string): string | null
  value?: string
  checked?: boolean
  options?: ArrayLike<{ selected: boolean }>
}

export interface CloneControlLike extends AttrTarget {
  textContent: string | null
}

/**
 * What a user (or the page's own React state) put in a control is a PROPERTY,
 * and `cloneNode` copies attributes. A clone of a filled form is an empty
 * form, and a clone of an unticked box that started ticked is ticked again —
 * which in the PDF pass is exactly the tick `uncheckFields` took out. So the
 * live state is written back as the attributes a parser reads it from.
 */
export function carryFormState(orig: ControlLike, clone: CloneControlLike, cloneOptions: ArrayLike<AttrTarget> = []): void {
  const tag = orig.tagName.toUpperCase()
  if (tag === 'INPUT') {
    const type = (orig.getAttribute('type') || 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') {
      if (orig.checked) clone.setAttribute('checked', '')
      else clone.removeAttribute('checked')
    } else if (type !== 'file' && typeof orig.value === 'string') {
      clone.setAttribute('value', orig.value)
    }
  } else if (tag === 'TEXTAREA') {
    if (typeof orig.value === 'string') clone.textContent = orig.value
  } else if (tag === 'SELECT' && orig.options) {
    for (let i = 0; i < orig.options.length && i < cloneOptions.length; i++) {
      if (orig.options[i].selected) cloneOptions[i].setAttribute('selected', '')
      else cloneOptions[i].removeAttribute('selected')
    }
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────

export interface RuleLike {
  cssText: string
  /** Set on an @import rule: the sheet it pulled in. */
  styleSheet?: SheetLike | null
}

export interface SheetLike {
  href: string | null
  /** Reading this throws a SecurityError on a cross-origin sheet. */
  readonly cssRules: ArrayLike<RuleLike>
}

const URL_RE = /url\(\s*(['"]?)([^'")]*?)\1\s*\)/gi

function resolveUrl(u: string, base: string): string {
  if (!u || u.startsWith('#') || /^data:/i.test(u)) return u
  try {
    return new URL(u, base).href
  } catch {
    return u
  }
}

/**
 * Every `url()` made absolute against the sheet it came from. An SVG image
 * resolves relative URLs against ITS OWN address, a data: URL with no path,
 * so a relative background would load nothing even if loading were allowed. A
 * fragment (`url(#grad)`, an SVG paint server) stays as it is: it names an
 * element of the page, which travels with the page.
 */
export function absolutiseCssUrls(css: string, base: string): string {
  return css.replace(URL_RE, (all, _q: string, u: string) => {
    const raw = u.trim()
    const abs = resolveUrl(raw, base)
    return abs === raw ? all : `url("${abs}")`
  })
}

/**
 * The text of every rule the frame's sheets hold, in order, `@import`s
 * followed into rather than written out (an SVG image fetches nothing). A sheet
 * whose rules cannot be read — cross-origin — is counted and skipped: what it
 * styled is drawn unstyled, which `unreadable` lets the caller say.
 */
export function collectCss(sheets: ArrayLike<SheetLike>, baseURI: string): { css: string; unreadable: number } {
  const parts: string[] = []
  let unreadable = 0
  const seen = new Set<SheetLike>()
  const walk = (sheet: SheetLike) => {
    if (seen.has(sheet)) return
    seen.add(sheet)
    let rules: ArrayLike<RuleLike>
    try {
      rules = sheet.cssRules
    } catch {
      unreadable++
      return
    }
    if (!rules) return
    const base = sheet.href || baseURI
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]
      if (/^@import\b/i.test(rule.cssText)) {
        if (rule.styleSheet) walk(rule.styleSheet)
        continue
      }
      parts.push(absolutiseCssUrls(rule.cssText, base))
    }
  }
  for (let i = 0; i < sheets.length; i++) walk(sheets[i])
  return { css: parts.join('\n'), unreadable }
}

/** The URLs a CSS text (or an inline `style`) would have to fetch. */
export function cssUrls(css: string): string[] {
  const out = new Set<string>()
  for (const m of css.matchAll(URL_RE)) {
    const u = m[2].trim()
    if (u && !u.startsWith('#') && !/^data:/i.test(u)) out.add(u)
  }
  return [...out]
}

/** Each fetched URL swapped for its data: URL. Unknown ones are left: an SVG image will not load them, and says nothing. */
export function replaceCssUrls(css: string, inlined: ReadonlyMap<string, string>): string {
  return css.replace(URL_RE, (all, _q: string, u: string) => {
    const data = inlined.get(u.trim())
    return data ? `url("${data}")` : all
  })
}

/**
 * Which URLs the parent may fetch to inline them.
 *
 * `keep` — already a data: URL. `fetch` — this origin, or a blob: the frame
 * made (same-origin, see capture.ts). `refuse` — anything else. The capture
 * frame's CSP denies it a network channel on purpose (connect-src 'none'), and
 * the parent fetching a URL the MODEL wrote would hand that channel back; a
 * remote picture is also something the frame's img-src never let in.
 */
export function inlinePolicy(url: string, origin: string): 'keep' | 'fetch' | 'refuse' {
  if (/^data:/i.test(url)) return 'keep'
  if (/^blob:/i.test(url)) return url.startsWith(`blob:${origin}/`) ? 'fetch' : 'refuse'
  try {
    return new URL(url).origin === origin ? 'fetch' : 'refuse'
  } catch {
    return 'refuse'
  }
}

// ── viewport units ────────────────────────────────────────────────────────

const VIEWPORT_UNIT = /\d(?:vh|vw|vmin|vmax|svh|lvh|dvh|svw|lvw|dvw|vi|vb)\b/i

export interface DeclarationLike {
  readonly length: number
  item(index: number): string
  getPropertyValue(property: string): string
}

/**
 * The properties of a declaration block whose value is written in viewport
 * units. Inside an SVG image, `100vh` is the IMAGE's height — one page — while
 * the export frame is as tall as every page stacked, and the text was measured
 * there. A `min-h-screen` block inside a page would be drawn one page tall and
 * measured ten, and every PDF field below it would sit over the wrong line. So
 * these properties are pinned to what the frame computed.
 */
export function viewportProps(decl: DeclarationLike): string[] {
  const out: string[] = []
  for (let i = 0; i < decl.length; i++) {
    const p = decl.item(i)
    if (VIEWPORT_UNIT.test(decl.getPropertyValue(p))) out.push(p)
  }
  return out
}

// ── inheritance across the cut ────────────────────────────────────────────

/**
 * Inherited properties read off the page's PARENT and pinned on the innermost
 * wrapper. `html { font-family }` (Tailwind's preflight) and `body { … }` rules
 * match nothing inside a foreignObject, whose root is an <svg>, so without this
 * the page lost its typeface and line height the moment it left the document.
 */
export const INHERITED_PROPS = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-stretch',
  'font-variant',
  'font-feature-settings',
  'font-variation-settings',
  'font-kerning',
  'font-optical-sizing',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-indent',
  'text-transform',
  'text-rendering',
  'white-space',
  'word-break',
  'overflow-wrap',
  'hyphens',
  'tab-size',
  'direction',
  'writing-mode',
  'visibility',
  'list-style-type',
  'list-style-position',
  '-webkit-font-smoothing',
  'color-scheme',
] as const

// ── the fallback decision ─────────────────────────────────────────────────

/**
 * What a failure of the native path means.
 *
 * - `abort`   — the person cancelled: nothing falls back, the export stops.
 * - `tainted` — the browser refused to read the canvas back (Safari taints any
 *   canvas an SVG with a foreignObject was drawn on). That is a property of the
 *   browser, not of the page, so every later page goes straight to the
 *   fallback instead of paying for a picture it cannot keep.
 * - `failed`  — this page only (a decode error, a timeout, markup the XML
 *   parser refused): html2canvas draws it, the next page tries natively again.
 */
export function classifyNativeFailure(err: unknown, aborted: boolean): 'abort' | 'tainted' | 'failed' {
  const name = (err as { name?: unknown } | null)?.name
  if (aborted || name === 'AbortError') return 'abort'
  if (name === 'SecurityError') return 'tainted'
  return 'failed'
}

/** Rejects with an AbortError the moment `signal` aborts, whatever `p` is still doing. */
export function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p
  if (signal.aborted) {
    // The abandoned promise may still reject later; nobody is listening for it.
    p.catch(() => undefined)
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

/** Rejects with a TimeoutError after `ms`: a picture that never decodes must not hold an export. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException('Timed out', 'TimeoutError')), ms)
  })
  return Promise.race([p, late]).finally(() => clearTimeout(timer))
}
