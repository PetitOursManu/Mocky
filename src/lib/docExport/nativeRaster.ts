import {
  INHERITED_PROPS,
  absolutiseCssUrls,
  XHTML_NS,
  carryFormState,
  collectCss,
  cssUrls,
  inlinePolicy,
  raceAbort,
  replaceCssUrls,
  svgDataUrl,
  svgDocument,
  viewportProps,
  withTimeout,
  type CloneControlLike,
  type ControlLike,
  type DeclarationLike,
  type SheetLike,
} from './svgRaster'

/**
 * The PRIMARY rasteriser: one page of the export frame, drawn by the browser's
 * own engine through an SVG <foreignObject> image (svgRaster.ts says why).
 *
 * Runs in the parent on the same-origin frame, like measure.ts, and for the
 * same reason tests elements by tag name and never by `instanceof`.
 *
 * An SVG image is a sealed world: it fetches nothing, runs no script, and sees
 * none of the document it came from. So everything the page needs goes INTO
 * it — the CSS text of every sheet, every picture as a data: URL, every canvas
 * as the picture it currently shows, the live state of every form control —
 * and what the frame's layout decided that the image would decide differently
 * (viewport units, inheritance from <html> and <body>) is pinned.
 *
 * Nothing here recovers from a failure: it throws, and render.ts decides
 * (`classifyNativeFailure`) whether html2canvas draws the page instead.
 */

export interface NativeRasterOptions {
  width: number
  height: number
  scale: number
  signal?: AbortSignal
  /** How long the image may take to decode before the page falls back. */
  timeoutMs?: number
}

export interface NativeRasterResult {
  canvas: HTMLCanvasElement
  /** Pictures, fonts or stylesheets that could not be put inside the image. */
  missing: number
}

export const NATIVE_TIMEOUT_MS = 20_000

/** A 1 × 1 transparent GIF: what a picture that cannot travel becomes, its box kept. */
const EMPTY_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('read failed'))
    r.readAsDataURL(blob)
  })
}

/**
 * Fetches each URL the page needs, once, as a data: URL. Only what
 * `inlinePolicy` allows: this origin and the frame's own blobs.
 */
function makeInliner(origin: string, signal?: AbortSignal) {
  const cache = new Map<string, Promise<string | null>>()
  return (url: string): Promise<string | null> => {
    const policy = inlinePolicy(url, origin)
    if (policy === 'keep') return Promise.resolve(url)
    if (policy === 'refuse') return Promise.resolve(null)
    let p = cache.get(url)
    if (!p) {
      p = fetch(url, { credentials: 'same-origin', signal })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => (blob ? blobToDataUrl(blob) : null))
        .catch(() => null)
      cache.set(url, p)
    }
    return p
  }
}

/** A loaded picture read back through a canvas — for a source `fetch` cannot reach again. */
function drawnDataUrl(source: CanvasImageSource, w: number, h: number): string | null {
  if (!(w > 0 && h > 0)) return null
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(source, 0, 0, w, h)
    const url = c.toDataURL('image/png')
    c.width = 0
    c.height = 0
    return url.length > 32 ? url : null
  } catch {
    return null
  }
}

/** Copies every attribute of `from` onto `to`, skipping `skip`. */
function copyAttributes(from: Element, to: Element, skip: readonly string[] = []) {
  for (const a of Array.from(from.attributes)) {
    if (!skip.includes(a.name)) to.setAttribute(a.name, a.value)
  }
}

/**
 * What the frame's layout decided in viewport units, pinned inline on the
 * clone (svgRaster.ts's `viewportProps` says why). Found through the sheets'
 * own rules — which properties are written in `vh` is only knowable there —
 * and through inline styles.
 */
function pinViewportUnits(
  win: Window,
  page: Element,
  sheets: ArrayLike<SheetLike>,
  cloneOf: (el: Element) => Element | undefined,
) {
  const pins = new Map<Element, Set<string>>()
  const add = (el: Element, props: string[]) => {
    if (!props.length) return
    const set = pins.get(el) ?? new Set<string>()
    props.forEach((p) => set.add(p))
    pins.set(el, set)
  }
  const visit = (rules: ArrayLike<CSSRule>) => {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as CSSRule & { selectorText?: string; style?: DeclarationLike; cssRules?: ArrayLike<CSSRule> }
      if (rule.cssRules && !rule.selectorText) visit(rule.cssRules)
      if (!rule.selectorText || !rule.style) continue
      const props = viewportProps(rule.style)
      if (!props.length) continue
      try {
        if (page.matches(rule.selectorText)) add(page, props)
        page.querySelectorAll(rule.selectorText).forEach((el) => add(el, props))
      } catch {
        // A selector with a pseudo-element names no element; nothing to pin.
      }
    }
  }
  for (let i = 0; i < sheets.length; i++) {
    try {
      visit((sheets[i] as unknown as CSSStyleSheet).cssRules)
    } catch {
      /* cross-origin: counted by collectCss */
    }
  }
  for (const el of [page, ...Array.from(page.querySelectorAll('[style]'))]) {
    const st = (el as HTMLElement).style as unknown as DeclarationLike | undefined
    if (st) add(el, viewportProps(st))
  }
  pins.forEach((props, el) => {
    const clone = cloneOf(el) as HTMLElement | undefined
    if (!clone?.style) return
    const cs = win.getComputedStyle(el)
    props.forEach((p) => clone.style.setProperty(p, cs.getPropertyValue(p), 'important'))
  })
}

const WRAPPER_RESET: Record<string, string> = {
  display: 'block',
  position: 'static',
  margin: '0',
  padding: '0',
  border: '0',
  'min-width': '0',
  'max-width': 'none',
  'min-height': '0',
  'max-height': 'none',
  overflow: 'hidden',
  background: 'none',
  'box-shadow': 'none',
  transform: 'none',
  filter: 'none',
  opacity: '1',
  gap: '0',
}

/**
 * The page's ancestors, rebuilt as bare <div>s that keep only what a SELECTOR
 * can see — class, id, dir, lang, data-* — so `.dark .card`, `#root > div` and
 * `[data-mocky-doc] [data-mocky-page]` still match, while none of their boxes
 * survive: each is exactly the page's size, at 0,0, with no padding, shadow or
 * backdrop. The innermost also carries what the page inherits.
 */
function buildWrappers(win: Window, doc: Document, page: Element, width: number, height: number) {
  const chain: Element[] = []
  for (let a = page.parentElement; a; a = a.parentElement) chain.unshift(a)
  let outer: HTMLElement | null = null
  let inner: HTMLElement | null = null
  for (const anc of chain) {
    const div = doc.createElementNS(XHTML_NS, 'div') as HTMLElement
    for (const a of Array.from(anc.attributes)) {
      if (a.name === 'class' || a.name === 'id' || a.name === 'dir' || a.name === 'lang' || a.name.startsWith('data-')) {
        div.setAttribute(a.name, a.value)
      }
    }
    for (const [k, v] of Object.entries(WRAPPER_RESET)) div.style.setProperty(k, v, 'important')
    div.style.setProperty('width', `${width}px`, 'important')
    div.style.setProperty('height', `${height}px`, 'important')
    if (inner) inner.appendChild(div)
    else outer = div
    inner = div
  }
  if (!outer || !inner) {
    outer = inner = doc.createElementNS(XHTML_NS, 'div') as HTMLElement
    for (const [k, v] of Object.entries(WRAPPER_RESET)) inner.style.setProperty(k, v, 'important')
  }
  const parent = page.parentElement
  if (parent) {
    const cs = win.getComputedStyle(parent)
    for (const p of INHERITED_PROPS) {
      const v = cs.getPropertyValue(p)
      if (v) inner.style.setProperty(p, v)
    }
    // Custom properties inherit too, and a `:root { --brand }` has no :root to
    // match in the image but the <svg>, which is fine — a `.theme-x { --brand }`
    // on <body> has nothing to match at all.
    for (let i = 0; i < cs.length; i++) {
      const p = cs.item(i)
      if (p.startsWith('--')) inner.style.setProperty(p, cs.getPropertyValue(p))
    }
  }
  return { outer, inner }
}

/**
 * One inliner per export frame, not per page.
 *
 * Every page's CSS names every url() of the document, and a fresh inliner per
 * page fetched and base64-encoded all of them again for each page: a ten-page
 * brochure with a large background per page moved every picture ten times.
 * Keyed on the frame's document, so the cache dies with the frame.
 */
const inliners = new WeakMap<Document, ReturnType<typeof makeInliner>>()

/**
 * Every animation at its END before the picture is taken.
 *
 * The frame's still stylesheet has already run each animation to its last
 * frame there, but an SVG used as an image starts its own timeline at zero: a
 * model-written entrance (`@keyframes fadeIn{from{opacity:0}}`) was drawn at its
 * FIRST keyframe, i.e. invisible. A negative delay longer than the (already
 * near-zero) duration puts every animation in its after phase at t = 0, and the
 * forwards fill holds the end state.
 */
const ANIMATIONS_AT_REST_CSS =
  '*,*::before,*::after{animation-delay:-1s!important;animation-duration:0.01ms!important;' +
  'animation-iteration-count:1!important;animation-fill-mode:both!important;transition:none!important}'

export async function rasterizeNative(win: Window, page: Element, opts: NativeRasterOptions): Promise<NativeRasterResult> {
  const { width, height, scale, signal } = opts
  const doc = page.ownerDocument
  let inline = inliners.get(doc)
  if (!inline) {
    inline = makeInliner(location.origin, signal)
    inliners.set(doc, inline)
  }
  let missing = 0

  // ── the clone, paired element by element with what it was cloned from ─────
  const clone = page.cloneNode(true) as Element
  const src = [page, ...Array.from(page.querySelectorAll('*'))]
  const dst = [clone, ...Array.from(clone.querySelectorAll('*'))]
  if (src.length !== dst.length) throw new Error('clone mismatch')
  const index = new Map<Element, number>()
  src.forEach((el, i) => index.set(el, i))
  const cloneOf = (el: Element) => {
    const i = index.get(el)
    return i === undefined ? undefined : dst[i]
  }

  const sheets = doc.styleSheets as unknown as ArrayLike<SheetLike>
  pinViewportUnits(win, page, sheets, cloneOf)

  const jobs: Promise<void>[] = []
  const removals: Element[] = []
  for (let i = 0; i < src.length; i++) {
    const o = src[i]
    const c = dst[i]
    const tag = o.tagName.toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      carryFormState(o as unknown as ControlLike, c as unknown as CloneControlLike, c.querySelectorAll('option'))
    } else if (tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED' || tag === 'SOURCE') {
      removals.push(c)
    } else if (tag === 'IMG') {
      const img = o as HTMLImageElement
      const target = c as HTMLImageElement
      for (const a of ['srcset', 'sizes', 'loading', 'decoding', 'crossorigin']) target.removeAttribute(a)
      const url = img.currentSrc || img.getAttribute('src') || ''
      if (!url) continue
      jobs.push(
        (async () => {
          let data = await inline(url)
          if (!data && img.complete) data = drawnDataUrl(img, img.naturalWidth, img.naturalHeight)
          if (!data) {
            missing++
            // The box stays where the layout put it: an unsized <img> with no
            // picture collapses, and everything below it would move.
            const r = img.getBoundingClientRect()
            target.style.setProperty('width', `${r.width}px`, 'important')
            target.style.setProperty('height', `${r.height}px`, 'important')
            data = EMPTY_PIXEL
          }
          target.setAttribute('src', data)
        })(),
      )
    } else if (tag === 'CANVAS' || tag === 'VIDEO') {
      // A canvas's pixels and a video's frame are not in the markup. The
      // picture they show NOW is: an <img> of the same box. (A `<Scene3D>` in
      // this frame is already an <img>, see `__mockyStill`.)
      const media = o as HTMLCanvasElement & HTMLVideoElement
      const w = tag === 'CANVAS' ? media.width : media.videoWidth
      const h = tag === 'CANVAS' ? media.height : media.videoHeight
      let data = drawnDataUrl(media, w, h)
      const poster = tag === 'VIDEO' ? media.getAttribute('poster') : null
      const img = doc.createElementNS(XHTML_NS, 'img') as HTMLImageElement
      copyAttributes(c, img, ['src', 'poster', 'autoplay', 'controls', 'loop', 'muted', 'playsinline'])
      const r = o.getBoundingClientRect()
      img.style.setProperty('width', `${r.width}px`, 'important')
      img.style.setProperty('height', `${r.height}px`, 'important')
      if (tag === 'VIDEO') img.style.setProperty('object-fit', win.getComputedStyle(o).objectFit || 'contain')
      c.replaceWith(img)
      dst[i] = img
      jobs.push(
        (async () => {
          if (!data && poster) data = await inline(new URL(poster, doc.baseURI).href)
          if (!data) {
            missing++
            data = EMPTY_PIXEL
          }
          img.setAttribute('src', data)
        })(),
      )
    } else if (o.namespaceURI === 'http://www.w3.org/2000/svg' && tag === 'IMAGE') {
      const href = o.getAttribute('href') || o.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
      if (!href || href.startsWith('#')) continue
      jobs.push(
        (async () => {
          const data = await inline(new URL(href, doc.baseURI).href)
          if (!data) missing++
          c.setAttribute('href', data || EMPTY_PIXEL)
          c.removeAttributeNS('http://www.w3.org/1999/xlink', 'href')
        })(),
      )
    }
  }

  // Inline `style` attributes can carry a background picture of their own.
  for (const c of dst) {
    const style = c.getAttribute('style')
    if (!style || !/url\(/i.test(style)) continue
    jobs.push(
      (async () => {
        const map = new Map<string, string>()
        for (const u of cssUrls(absolutiseCssUrls(style, doc.baseURI))) {
          const data = await inline(u)
          if (data) map.set(u, data)
          else missing++
        }
        // Read again: another job may have pinned a size on this element meanwhile.
        c.setAttribute('style', replaceCssUrls(absolutiseCssUrls(c.getAttribute('style') || '', doc.baseURI), map))
      })(),
    )
  }

  // ── the CSS, every sheet of the frame, its pictures and fonts inside it ───
  // Includes the pass's hide rules and pseudo pins: they are sheets of this
  // document for as long as the pass lasts, which is while this runs.
  const collected = collectCss(sheets, doc.baseURI)
  missing += collected.unreadable
  const cssMap = new Map<string, string>()
  jobs.push(
    ...cssUrls(collected.css).map(async (u) => {
      const data = await inline(u)
      if (data) cssMap.set(u, data)
      else missing++
    }),
  )
  // Bounded like the decode below: a fetch that never answers falls back to
  // html2canvas rather than holding the export.
  await raceAbort(withTimeout(Promise.all(jobs), opts.timeoutMs ?? NATIVE_TIMEOUT_MS), signal)
  removals.forEach((el) => el.remove())

  // ── what belongs to the canvas, not the page ──────────────────────────────
  // The shadow the canvas draws around a sheet of paper, and anything placing
  // the page in the stack: in the image it is the only thing, at 0,0.
  const root = clone as HTMLElement
  root.style.setProperty('margin', '0', 'important')
  root.style.setProperty('box-shadow', 'none', 'important')
  root.style.setProperty('width', `${width}px`, 'important')
  root.style.setProperty('flex', 'none', 'important')
  if (win.getComputedStyle(page).position !== 'static') {
    root.style.setProperty('left', 'auto', 'important')
    root.style.setProperty('top', 'auto', 'important')
    if (win.getComputedStyle(page).position !== 'relative') root.style.setProperty('position', 'relative', 'important')
  }

  const { outer, inner } = buildWrappers(win, doc, page, width, height)
  const style = doc.createElementNS(XHTML_NS, 'style')
  style.textContent = replaceCssUrls(collected.css, cssMap) + ANIMATIONS_AT_REST_CSS
  outer.insertBefore(style, outer.firstChild)
  inner.appendChild(clone)

  const markup = new XMLSerializer().serializeToString(outer)
  const url = svgDataUrl(svgDocument(markup, width, height))

  // ── the drawing ───────────────────────────────────────────────────────────
  const image = new Image()
  image.decoding = 'sync'
  image.src = url
  await raceAbort(withTimeout(image.decode(), opts.timeoutMs ?? NATIVE_TIMEOUT_MS), signal)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  // White under everything, as html2canvas's `backgroundColor` did: a JPEG has
  // no alpha, and a page with a transparent background would come out black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, missing }
}
