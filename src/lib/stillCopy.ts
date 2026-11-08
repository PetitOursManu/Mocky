import { safeDataUrl, scrubCss } from './siteSource'

/**
 * The second of the two frames: a page that has finished running, as a document
 * in which nothing can run.
 *
 * Two callers, one rule. A website attached as source (siteSourceRender.ts) and
 * Mocky's own screens (capture.ts) both need html2canvas, which has to read the
 * document it photographs and therefore needs an origin it can reach. So the
 * code runs in a frame with `allow-scripts` and NO `allow-same-origin`, and what
 * is read is this copy of its DOM, in a frame with `allow-same-origin` and NO
 * `allow-scripts`. The code that runs never shares the origin; the frame that
 * shares the origin never runs code.
 *
 * What the live frame sends is the page's own word: it can forge any of it, so
 * nothing here takes it as anything but hostile markup.
 */

/** What a live frame hands back: its DOM, and every rule of its CSSOM. */
export interface LiveSnapshot {
  html: string
  css: string
}

export type Html2Canvas = (el: Element, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>

/**
 * Source of `mockySerialise()`, for a live frame to paste into itself.
 *
 * The CSSOM and not the <style> elements: Tailwind's runtime and any CSS-in-JS
 * write rules no element's text contains. State that lives in properties is
 * written down first, or a ticked box comes back empty — the PDF export reads
 * `.checked`, `.value` and `.selected` off the copy. A canvas is kept as its
 * picture; one drawn from another origin's image cannot be read and is lost.
 */
export const SERIALISE_SOURCE = `function mockySerialise(){
    var css = [], sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules, text = [];
        for (var j = 0; j < rules.length; j++) text.push(rules[j].cssText);
        var media = sheets[i].media && sheets[i].media.mediaText;
        css.push(media && media !== 'all' ? '@media ' + media + '{' + text.join('\\n') + '}' : text.join('\\n'));
      } catch (e) {}
    }
    var fields = document.querySelectorAll('input,textarea,option');
    for (var f = 0; f < fields.length; f++) {
      var el = fields[f], tag = el.tagName;
      if (tag === 'OPTION') { if (el.selected) el.setAttribute('selected', ''); else el.removeAttribute('selected'); }
      else if (tag === 'TEXTAREA') el.textContent = el.value;
      else if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) el.setAttribute('checked', ''); else el.removeAttribute('checked'); }
      else if (el.type !== 'file' && el.type !== 'password') el.setAttribute('value', el.value);
    }
    var imgs = document.images;
    for (var m = 0; m < imgs.length; m++) { if (imgs[m].currentSrc && imgs[m].hasAttribute('srcset')) imgs[m].setAttribute('src', imgs[m].currentSrc); }
    var canvases = document.getElementsByTagName('canvas');
    for (var k = 0; k < canvases.length; k++) { try { canvases[k].setAttribute('data-mocky-still', canvases[k].toDataURL('image/png')); } catch (e) {} }
    return { html: document.documentElement.outerHTML, css: css.join('\\n') };
  }`

/** Attributes that hold an address. Only what the policy keeps survives them. */
const URL_ATTRS = ['src', 'href', 'xlink:href', 'poster', 'background', 'action', 'formaction', 'data', 'lowsrc', 'ping', 'longdesc', 'cite', 'manifest', 'icon', 'srcset', 'srcdoc', 'imagesrcset']

/** Elements that run, embed, navigate or fetch — or, `noscript`, render only once scripts are off. */
const DROPPED = 'script, noscript, iframe, frame, frameset, object, embed, applet, portal, base, meta, link, style, template'

export interface StillPolicy {
  /** The copy's own Content-Security-Policy. */
  csp: string
  /** Appended after the page's rules. */
  css: string
  /** An address worth keeping beyond a picture as data: or an in-page fragment. */
  keepAddress?: (value: string, tag: string, attr: string) => boolean
  /** The same question, for a `url()` in a stylesheet. */
  keepCssUrl?: (ref: string) => boolean
}

/** The live frame's DOM made inert. Every rule here is a channel closed. */
export function stillDocument(snapshot: LiveSnapshot, policy: StillPolicy): string {
  const doc = new DOMParser().parseFromString(snapshot.html, 'text/html')
  doc.querySelectorAll('canvas[data-mocky-still]').forEach((canvas) => {
    const url = canvas.getAttribute('data-mocky-still') || ''
    if (!safeDataUrl(url)) return
    const img = doc.createElement('img')
    for (const a of ['class', 'style', 'width', 'height', 'id']) {
      const v = canvas.getAttribute(a)
      if (v != null) img.setAttribute(a, v)
    }
    img.setAttribute('src', url)
    canvas.replaceWith(img)
  })
  doc.querySelectorAll(DROPPED).forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const { name, value } of Array.from(el.attributes)) {
      const n = name.toLowerCase()
      if (n.startsWith('on')) el.removeAttribute(name)
      else if (n === 'style') el.setAttribute(name, scrubCss(value, policy.keepCssUrl))
      else if (URL_ATTRS.includes(n)) {
        // A picture as data:, or an in-page fragment (an SVG <use href="#icon">).
        const picture = n === 'src' || n === 'poster' || n.endsWith('href')
        const keep =
          picture &&
          (safeDataUrl(value) ||
            (n.endsWith('href') && value.trim().startsWith('#')) ||
            !!policy.keepAddress?.(value, el.localName.toLowerCase(), n))
        if (!keep) el.removeAttribute(name)
      }
    }
  })
  // The copy is parked off screen, where a lazy picture is never near the
  // viewport and so never loads. A film has no script left to start it.
  doc.querySelectorAll('img[loading]').forEach((el) => el.removeAttribute('loading'))
  doc.querySelectorAll('video').forEach((el) => el.setAttribute('preload', 'auto'))
  const head = doc.head
  const style = (css: string) => {
    const s = doc.createElement('style')
    s.textContent = css
    head.appendChild(s)
  }
  const meta = doc.createElement('meta')
  meta.setAttribute('http-equiv', 'Content-Security-Policy')
  meta.setAttribute('content', policy.csp)
  head.insertBefore(meta, head.firstChild)
  style(scrubCss(snapshot.css, policy.keepCssUrl))
  style(policy.css)
  return '<!doctype html>' + doc.documentElement.outerHTML
}

/**
 * Mocky's own files, the only same-origin addresses a copy of a screen may name.
 *
 * html2canvas loads what it finds from MOCKY's realm, with the session cookie
 * and no CSP, so "same origin" is not a good enough answer: `<img src="/api/…">`
 * would be a credentialed GET on any route a model cares to name. These prefixes
 * are the ones that answer with a picture, a film or a typeface.
 */
const MOCKY_ASSET = /^\/(?:api\/(?:images|videos|video)|fonts)\//

export function isMockyAsset(ref: string, origin: string): boolean {
  try {
    const url = new URL(ref, origin)
    return url.origin === origin && MOCKY_ASSET.test(url.pathname)
  } catch {
    return false
  }
}

/** An http(s) address on another origin. A route of Mocky's own is not "elsewhere". */
function isElsewhere(ref: string, origin: string): boolean {
  try {
    const url = new URL(ref, origin)
    return /^https?:$/.test(url.protocol) && url.origin !== origin
  } catch {
    return false
  }
}

/**
 * What a copy of a Mocky screen keeps, beyond pictures as data: and fragments.
 *
 * - Links stay: the PDF carries them, read off the attribute (measure.ts). The
 *   copy cannot be clicked and may not navigate, so they are text here.
 * - A picture from another site stays NAMED, because the export reports it by
 *   host (`externalPictures`) and tells the person to put it in the library. It
 *   does not load: the copy's CSP refuses it, html2canvas is called with
 *   `useCORS: false, allowTaint: false` and skips it, and the native rasteriser
 *   refuses to fetch it (`inlinePolicy`).
 * - Anything else that fetches must be one of Mocky's own files.
 */
export function keepScreenAddress(origin: string): NonNullable<StillPolicy['keepAddress']> {
  return (value, tag, attr) => {
    const v = value.trim()
    if (attr === 'href' && (tag === 'a' || tag === 'area')) return /^(?:https?:|mailto:|tel:|\/)/i.test(v)
    if (isMockyAsset(v, origin)) return tag === 'img' || tag === 'image' || tag === 'video' || tag === 'audio' || tag === 'source'
    return ((tag === 'img' && attr === 'src') || (tag === 'image' && attr.endsWith('href'))) && isElsewhere(v, origin)
  }
}

/** The stylesheet's half: Mocky's files and in-page references (`fill: url(#grad)`). */
export function keepScreenCssUrl(origin: string): NonNullable<StillPolicy['keepCssUrl']> {
  return (ref) => ref.startsWith('#') || isMockyAsset(ref, origin)
}

/** The copy of a Mocky screen: its own pictures, typefaces and films, and nothing that runs. */
export function screenStillCsp(origin: string): string {
  return [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src ${origin} data:`,
    `font-src ${origin} data:`,
    `media-src ${origin}`,
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
}

let html2canvasLoad: Promise<Html2Canvas> | null = null

/** The vendored, hash-pinned html2canvas (public/vendor), in Mocky's own window. */
export function loadHtml2canvas(): Promise<Html2Canvas> {
  const ready = (window as Window & { html2canvas?: Html2Canvas }).html2canvas
  if (ready) return Promise.resolve(ready)
  html2canvasLoad ??= new Promise<Html2Canvas>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/vendor/html2canvas.min.js'
    s.onload = () => resolve((window as Window & { html2canvas?: Html2Canvas }).html2canvas!)
    s.onerror = () => {
      html2canvasLoad = null
      reject(new Error('html2canvas failed to load'))
    }
    document.head.appendChild(s)
  })
  return html2canvasLoad
}
