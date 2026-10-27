import { EXPORT_NO_TRANSITIONS_CSS, STILL_ANIMATIONS_CSS } from './capture'
import {
  LIVE_CSP,
  SITE_RENDER_HEIGHT,
  SITE_RENDER_MAX_HEIGHT,
  SITE_RENDER_TIMEOUT_MS,
  SITE_RENDER_WIDTH,
  STILL_CSP,
  bytesToDataUrl,
  inlineCssRefs,
  mimeOf,
  pickEntry,
  resolveRef,
  safeDataUrl,
  scrubCss,
  siteSourceKind,
} from './siteSource'
import { ZipError, openZip, type ZipArchive } from './zipRead'

/**
 * An .html or .zip site, rendered and photographed in the browser. The two
 * frames and why there are two: lib/siteSource.ts. Browser only.
 */

/** A refusal the composer can name: an i18n key. */
export class SiteSourceError extends Error {
  constructor(public readonly key: 'project.siteZipNoPage' | 'project.siteZipUnsupported' | 'project.siteSourceFailed') {
    super(key)
  }
}

const utf8 = new TextDecoder('utf-8')

/**
 * The page with every file of the archive it names put inline — stylesheets,
 * scripts, pictures, fonts — so the live frame, whose origin is opaque and
 * which can reach no archive, has the page whole. Parsed with DOMParser, which
 * runs nothing.
 */
async function bundlePage(html: string, entry: string, zip: ZipArchive | null): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : ''

  if (zip) {
    const cache = new Map<string, Promise<Uint8Array | null>>()
    const bytes = (path: string) => {
      if (!cache.has(path)) cache.set(path, zip.read(path).catch(() => null))
      return cache.get(path)!
    }
    const load = async (path: string) => {
      const b = await bytes(path)
      return b ? bytesToDataUrl(b, mimeOf(path)) : null
    }
    const loadText = async (path: string) => {
      const b = await bytes(path)
      return b ? utf8.decode(b) : null
    }
    const css = (text: string, from: string) => inlineCssRefs(text, from, root, load, loadText)

    const jobs: Promise<void>[] = []
    doc.querySelectorAll('link[href]').forEach((link) => {
      const rel = (link.getAttribute('rel') || '').toLowerCase()
      if (!/\bstylesheet\b/.test(rel)) return
      const path = resolveRef(entry, link.getAttribute('href')!, root)
      if (!path) return
      jobs.push(
        (async () => {
          const text = await loadText(path)
          if (text == null) return
          const style = doc.createElement('style')
          const media = link.getAttribute('media')
          if (media) style.setAttribute('media', media)
          style.textContent = await css(text, path)
          link.replaceWith(style)
        })(),
      )
    })
    doc.querySelectorAll('script[src]').forEach((script) => {
      const path = resolveRef(entry, script.getAttribute('src')!, root)
      if (!path) return
      // `defer` and `async` mean nothing to an inline script, which would run in
      // the <head> before the <body> it reaches for exists: it moves to the end,
      // now, so several keep their order. A module is deferred inline anyway.
      if (script.getAttribute('type') !== 'module' && (script.hasAttribute('defer') || script.hasAttribute('async'))) {
        script.removeAttribute('defer')
        script.removeAttribute('async')
        doc.body.appendChild(script)
      }
      jobs.push(
        (async () => {
          const text = await loadText(path)
          if (text == null) return
          script.removeAttribute('src')
          // A literal "</script>" in the file would close the element early.
          script.textContent = text.replace(/<\/script/gi, '<\\/script')
        })(),
      )
    })
    doc.querySelectorAll('style').forEach((style) => {
      jobs.push(css(style.textContent || '', entry).then((t) => void (style.textContent = t)))
    })
    doc.querySelectorAll('[style]').forEach((el) => {
      jobs.push(css(el.getAttribute('style')!, entry).then((t) => el.setAttribute('style', t)))
    })
    for (const attr of ['src', 'poster', 'href', 'xlink:href']) {
      doc.querySelectorAll(`img[${CSS.escape(attr)}], source[${CSS.escape(attr)}], video[${CSS.escape(attr)}], input[${CSS.escape(attr)}], image, feImage`).forEach((el) => {
        const value = el.getAttribute(attr)
        const path = value ? resolveRef(entry, value, root) : null
        if (!path) return
        jobs.push(load(path).then((url) => void (url && el.setAttribute(attr, url))))
      })
    }
    doc.querySelectorAll('[srcset]').forEach((el) => {
      // One candidate is enough for a photograph: the largest named, inlined as src.
      const first = el.getAttribute('srcset')!.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean).pop()
      const path = first ? resolveRef(entry, first, root) : null
      el.removeAttribute('srcset')
      if (!path) return
      jobs.push(load(path).then((url) => void (url && el.setAttribute('src', url))))
    })
    await Promise.all(jobs)
  }

  // A <base> would re-point every relative address, a refresh would navigate
  // the frame away, and the page's own CSP could forbid the snapshot below.
  doc.querySelectorAll('base, meta[http-equiv]').forEach((el) => el.remove())
  const head = doc.head
  const first = head.firstChild
  const meta = doc.createElement('meta')
  meta.setAttribute('http-equiv', 'Content-Security-Policy')
  meta.setAttribute('content', LIVE_CSP)
  head.insertBefore(meta, first)
  const snap = doc.createElement('script')
  snap.textContent = SNAPSHOT_SCRIPT
  head.insertBefore(snap, first)
  return '<!doctype html>' + doc.documentElement.outerHTML
}

/**
 * Runs in the LIVE frame, before the page's own scripts. Once the page has
 * loaded it scrolls to the bottom and back — a template that reveals its
 * sections as they enter the viewport would otherwise be photographed as a
 * header over white — then hands back its DOM and every rule of its CSSOM:
 * runtime styling (a CSS-in-JS library, the CDN Tailwind) lives in rules that
 * no <style> element's text contains. A canvas is kept as its picture. A
 * stylesheet from another origin cannot be read and is lost; the page then
 * falls back on what it had locally.
 */
const SNAPSHOT_SCRIPT = `(function(){
  var sent = false, started = false;
  function send(m){ if (sent) return; sent = true; m.__mockySite = 1; try { parent.postMessage(m, '*'); } catch (e) {} }
  function snap(){
    try {
      var css = [], sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        try {
          var rules = sheets[i].cssRules, text = [];
          for (var j = 0; j < rules.length; j++) text.push(rules[j].cssText);
          var media = sheets[i].media && sheets[i].media.mediaText;
          css.push(media && media !== 'all' ? '@media ' + media + '{' + text.join('\\n') + '}' : text.join('\\n'));
        } catch (e) {}
      }
      /* The sweep is not always enough: a frame the browser does not paint (the
         tab in the background) fires no IntersectionObserver at all. So what is
         still transparent under a NAME that says it is waiting for the scroll
         is shown as it would end — a modal at opacity 0 is named otherwise. */
      var waiting = document.querySelectorAll('[data-aos],[data-sal],[data-scroll],[class*="reveal"],[class*="fade"],[class*="aos"],[class*="wow"],[class*="animate"],[class*="appear"],[class*="inview"],[class*="in-view"]');
      for (var w = 0; w < waiting.length; w++) {
        var cs = getComputedStyle(waiting[w]);
        if (parseFloat(cs.opacity) < 0.05 || cs.visibility === 'hidden') {
          waiting[w].style.setProperty('opacity', '1', 'important');
          waiting[w].style.setProperty('visibility', 'visible', 'important');
          waiting[w].style.setProperty('transform', 'none', 'important');
        }
      }
      var canvases = document.getElementsByTagName('canvas');
      for (var k = 0; k < canvases.length; k++) { try { canvases[k].setAttribute('data-mocky-still', canvases[k].toDataURL('image/png')); } catch (e) {} }
      send({ html: document.documentElement.outerHTML, css: css.join('\\n') });
    } catch (e) { send({ error: String((e && e.message) || e) }); }
  }
  function sweep(){
    if (started) return; started = true;
    var y = 0, steps = 0;
    (function step(){
      var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
      window.scrollTo(0, y);
      y += Math.max(200, Math.round(window.innerHeight * 0.8));
      if (y < h && ++steps < 40) return setTimeout(step, 90);
      window.scrollTo(0, 0);
      setTimeout(snap, 800);
    })();
  }
  addEventListener('load', function(){ setTimeout(sweep, 400); });
  /* A page whose load never comes — a resource that hangs — is taken as it is. */
  setTimeout(sweep, 7000);
})();`

/**
 * A frame Mocky's user cannot see but the browser renders: off screen, a frame
 * is throttled, and an IntersectionObserver in it never fires — the reveal the
 * sweep exists for would not happen.
 */
function hiddenFrame(sandbox: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', sandbox)
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.cssText = `position:fixed;left:0;top:0;width:${SITE_RENDER_WIDTH}px;height:${SITE_RENDER_HEIGHT}px;border:0;opacity:0;pointer-events:none;z-index:-1;`
  return iframe
}

function runLive(html: string, signal?: AbortSignal): Promise<{ html: string; css: string }> {
  return new Promise((resolve, reject) => {
    const iframe = hiddenFrame('allow-scripts')
    let timer = 0
    const done = () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMsg)
      signal?.removeEventListener('abort', onAbort)
      iframe.remove()
    }
    function onMsg(e: MessageEvent) {
      // Only this frame, and only its first answer. What it sends is still the
      // page's own word — it is scrubbed before anything uses it.
      if (e.source !== iframe.contentWindow || !e.data || e.data.__mockySite !== 1) return
      done()
      if (typeof e.data.html === 'string') resolve({ html: e.data.html, css: typeof e.data.css === 'string' ? e.data.css : '' })
      else reject(new SiteSourceError('project.siteSourceFailed'))
    }
    function onAbort() {
      done()
      reject(new DOMException('aborted', 'AbortError'))
    }
    window.addEventListener('message', onMsg)
    signal?.addEventListener('abort', onAbort)
    timer = window.setTimeout(() => {
      done()
      reject(new SiteSourceError('project.siteSourceFailed'))
    }, SITE_RENDER_TIMEOUT_MS)
    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}

/** Attributes that hold an address. Only a fragment or a picture as data: survives them. */
const URL_ATTRS = ['src', 'href', 'xlink:href', 'poster', 'background', 'action', 'formaction', 'data', 'lowsrc', 'ping', 'longdesc', 'cite', 'manifest', 'icon', 'srcset', 'srcdoc', 'imagesrcset']

/** Elements that run, embed, navigate or fetch — or, `noscript`, render only once scripts are off. */
const DROPPED = 'script, noscript, iframe, frame, frameset, object, embed, applet, portal, base, meta, link, style, template'

/**
 * The live frame's DOM made inert: what the still frame shows and html2canvas
 * reads from Mocky's own realm. Every rule here is a channel closed — see
 * siteSource.ts for which ones and why.
 */
function stillDocument(snapshot: { html: string; css: string }): string {
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
      else if (n === 'style') el.setAttribute(name, scrubCss(value))
      else if (URL_ATTRS.includes(n)) {
        // A picture as data:, or an in-page fragment (an SVG <use href="#icon">).
        const picture = n === 'src' || n === 'poster' || n.endsWith('href')
        const keep = picture && (safeDataUrl(value) || (n.endsWith('href') && value.trim().startsWith('#')))
        if (!keep) el.removeAttribute(name)
      }
    }
  })
  const head = doc.head
  const style = (css: string) => {
    const s = doc.createElement('style')
    s.textContent = css
    head.appendChild(s)
  }
  const meta = doc.createElement('meta')
  meta.setAttribute('http-equiv', 'Content-Security-Policy')
  meta.setAttribute('content', STILL_CSP)
  head.insertBefore(meta, head.firstChild)
  style(scrubCss(snapshot.css))
  // The animations run to their end: html2canvas clones the document, and the
  // clone's animations start again from their FIRST frame — a fade-in at 0.
  style(STILL_ANIMATIONS_CSS + EXPORT_NO_TRANSITIONS_CSS + '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}')
  return '<!doctype html>' + doc.documentElement.outerHTML
}

let html2canvasLoad: Promise<void> | null = null

/** The vendored, hash-pinned html2canvas (public/vendor), in Mocky's own window. */
function loadHtml2canvas(): Promise<void> {
  if ((window as any).html2canvas) return Promise.resolve()
  html2canvasLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/vendor/html2canvas.min.js'
    s.onload = () => resolve()
    s.onerror = () => {
      html2canvasLoad = null
      reject(new SiteSourceError('project.siteSourceFailed'))
    }
    document.head.appendChild(s)
  })
  return html2canvasLoad
}

async function shootStill(html: string): Promise<HTMLCanvasElement> {
  await loadHtml2canvas()
  const iframe = hiddenFrame('allow-same-origin')
  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
      iframe.srcdoc = html
      document.body.appendChild(iframe)
    })
    const doc = iframe.contentDocument
    if (!doc) throw new SiteSourceError('project.siteSourceFailed')
    // Faces are data: URLs, so this is usually immediate; bounded all the same.
    await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 3000))])
    const height = Math.min(
      SITE_RENDER_MAX_HEIGHT,
      Math.max(SITE_RENDER_HEIGHT, doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0),
    )
    return await (window as any).html2canvas(doc.documentElement, {
      windowWidth: SITE_RENDER_WIDTH,
      windowHeight: SITE_RENDER_HEIGHT,
      width: SITE_RENDER_WIDTH,
      height,
      x: 0,
      y: 0,
      scale: 1,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: false,
      allowTaint: false,
    })
  } finally {
    iframe.remove()
  }
}

/** An .html or .zip file, as one full-page picture of the site it holds. */
export async function renderSiteSource(file: File, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  const kind = siteSourceKind(file)
  let html: string
  let entry: string
  let zip: ZipArchive | null = null
  if (kind === 'zip') {
    try {
      zip = openZip(new Uint8Array(await file.arrayBuffer()))
      const found = pickEntry(zip.paths)
      if (!found) throw new SiteSourceError('project.siteZipNoPage')
      entry = found
      html = utf8.decode((await zip.read(entry))!)
    } catch (e) {
      if (e instanceof ZipError) throw new SiteSourceError(e.reason === 'not-zip' || e.reason === 'corrupt' ? 'project.siteSourceFailed' : 'project.siteZipUnsupported')
      throw e
    }
  } else {
    html = await file.text()
    entry = file.name || 'index.html'
  }
  const page = await bundlePage(html, entry, zip)
  const snapshot = await runLive(page, signal)
  signal?.throwIfAborted()
  return shootStill(stillDocument(snapshot))
}
