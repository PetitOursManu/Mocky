import { detectComponentName, toPreviewModule } from './generate'
import { buildPrelude } from './capabilities/prelude'
import type { Capability } from './capabilities/types'
import { compileJsx } from './compile'
import { legibilityVerdict, type LegibilityFinding } from './legibility'
import { fontFaceCssFor } from './fonts'
import {
  SERIALISE_SOURCE,
  keepScreenAddress,
  keepScreenCssUrl,
  loadHtml2canvas,
  screenStillCsp,
  stillDocument,
  type Html2Canvas,
  type LiveSnapshot,
} from './stillCopy'

/**
 * Pictures of a generated component, and the documents the exports read.
 *
 * html2canvas cannot read a sandboxed preview, and it cannot run inside one: it
 * clones the document into an iframe of its own, and a sandbox without
 * allow-same-origin gives every descendant a FRESH opaque origin, so the frame
 * cannot read its own clone. For a long time that meant the capture frame had
 * `allow-scripts allow-same-origin`, and model-written code ran with Mocky's
 * origin for as long as a capture lasted. On every generated screen, since
 * thumbnails are automatic — with the provider key in localStorage and a Muse
 * inspiration URL enough to put a payload in the code.
 *
 * So the two things html2canvas seemed to need together are in two frames:
 *
 * 1. LIVE (`allow-scripts`, as a preview, I2). The model's code runs here, under
 *    the CSP below, with an opaque origin: no localStorage, no cookies, no
 *    parent. Once settled it hands back its DOM and CSSOM, and is destroyed.
 * 2. STILL (`allow-same-origin`, no scripts, lib/stillCopy.ts). That serialised
 *    page, scrubbed. html2canvas runs from Mocky's realm over it, and the exports
 *    walk it page by page.
 *
 * No second origin, port or hostname is involved: a deployment needs nothing for
 * this. A second port was the plan written here before and it would have been
 * worse: cookies are not scoped by port, so `document.cookie` on :8788 reads what
 * :8787 set. And the exports must reach the frame's DOM from the parent, which
 * any cross-origin frame forbids.
 */

/**
 * The runs of text laid over a picture that cannot be read on it.
 *
 * Find every run of text over a picture (an <img>, a <video>, a canvas, a Motion
 * Ultra <Backdrop>, a background image), rasterise the page once with the ink
 * taken out, and hand each run's pixels to `legibilityVerdict`. See
 * src/lib/legibility.ts for why.
 */
async function probeLegibility(win: Window, doc: Document, html2canvas: Html2Canvas): Promise<LegibilityFinding[]> {
  const H = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)
  const W = doc.documentElement.scrollWidth
  const grounds: { el: Element; r: DOMRect }[] = []
  for (const el of Array.from(doc.body.getElementsByTagName('*'))) {
    const tag = el.tagName
    let isPic = tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || el.classList.contains('u-backdrop')
    if (!isPic) {
      const bi = win.getComputedStyle(el).backgroundImage
      isPic = !!bi && bi !== 'none' && bi.includes('url(')
    }
    if (!isPic) continue
    const r = el.getBoundingClientRect()
    if (r.width >= 60 && r.height >= 40) grounds.push({ el, r })
  }
  if (!grounds.length) return []

  const runs: { text: string; r: DOMRect; rgb: [number, number, number]; large: boolean }[] = []
  const seen = new Set<Element>()
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n && runs.length < 60; n = walker.nextNode()) {
    const txt = (n.textContent || '').replace(/\s+/g, ' ').trim()
    if (txt.length < 2) continue
    const host = n.parentElement
    if (!host || seen.has(host)) continue
    // Gradient, shining or hollow type has no single colour to measure against.
    if (host.closest('.u-text-gradient,.u-text-shine,.u-text-outline,[class*="bg-clip-text"]')) continue
    const cs = win.getComputedStyle(host)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue
    const range = doc.createRange()
    range.selectNodeContents(n)
    const rr = range.getBoundingClientRect()
    if (rr.width < 4 || rr.height < 4) continue
    const over = grounds.some(
      ({ el, r }) => !el.contains(host) && rr.left < r.right && rr.right > r.left && rr.top < r.bottom && rr.bottom > r.top,
    )
    if (!over) continue
    const m = /rgba?\(([^)]+)\)/.exec(cs.color)
    if (!m) continue
    const parts = m[1].split(',').map((x) => parseFloat(x))
    if (parts.length > 3 && parts[3] < 0.05) continue
    const size = parseFloat(cs.fontSize) || 16
    const weight = parseInt(cs.fontWeight, 10) || 400
    seen.add(host)
    runs.push({ text: txt.slice(0, 60), r: rr, rgb: [parts[0], parts[1], parts[2]], large: size >= 24 || (size >= 18.66 && weight >= 700) })
  }
  if (!runs.length) return []

  /* The ink goes, the layout stays: every glyph and icon is made transparent, so
     the raster below is the GROUND alone — exactly what each run of text is set
     on. The boxes were measured above, and colour does not move a box. */
  const hide = doc.createElement('style')
  hide.textContent =
    '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}svg{visibility:hidden!important}'
  doc.head.appendChild(hide)
  /* No windowWidth/windowHeight: html2canvas lays the clone out in a window of
     that size, and a page with `min-h-screen` or a 90vh hero then stretches —
     every box measured above is somewhere else in the picture. */
  const canvas = await html2canvas(doc.body, { x: 0, y: 0, width: W, height: H, scale: 1, backgroundColor: '#ffffff', logging: false, useCORS: false, allowTaint: false })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  const out: LegibilityFinding[] = []
  for (const run of runs) {
    const x = Math.max(0, Math.floor(run.r.left))
    const y = Math.max(0, Math.floor(run.r.top))
    const w = Math.min(canvas.width - x, Math.ceil(run.r.width))
    const h = Math.min(canvas.height - y, Math.ceil(run.r.height))
    if (w < 2 || h < 2) continue
    const v = legibilityVerdict(ctx.getImageData(x, y, w, h).data, run.rgb, run.large)
    if (v && v.ratio < v.need) out.push({ text: run.text, ratio: v.ratio, need: v.need })
  }
  return out.sort((a, b) => a.ratio - b.ratio).slice(0, 8)
}

/**
 * Screenshots a region of a generated component. `rect` is normalized (0..1) to
 * the screen viewport.
 *
 * The JSX is compiled in the parent and injected; if that fails at runtime in
 * the frame, it is compiled there with the vendored Babel instead. Every bundle
 * comes from public/vendor (hash-pinned, see VENDOR.md).
 */
export function captureRegion(
  code: string,
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
  /**
   * The capabilities the screen was generated with.
   *
   * Without them the shell has no "Icon" global — and the system prompt tells
   * the model that "Icon" is predefined, so nearly every generated screen uses
   * it. The component then threw on render, the capture failed, and the caller's
   * catch turned that into a silent null: thumbnails were never produced for
   * real screens, while a test component that used no icons worked perfectly.
   */
  caps: Capability[] = [],
  /**
   * Device-pixel ratio html2canvas renders at.
   *
   * 2 is right for an annotation snip, which is read at full size. It is badly
   * wrong for a thumbnail: a 1440×495 region at scale 2 is a 2880×990 canvas,
   * ~36× the pixels of the 480 px JPEG it gets shrunk to — enough, on a screen
   * with a full-bleed background image, to blow the 15 s budget and report
   * "capture timed out".
   */
  scale = 2,
): Promise<string> {
  return renderLive(code, caps, width, height, 'picture').then((snapshot) =>
    onStillFrame(snapshot, width, height, async (win, doc, html2canvas) => {
      const vw = win.innerWidth || 1
      const vh = win.innerHeight || 1
      const canvas = await html2canvas(doc.body, {
        x: rect.x * vw,
        y: rect.y * vh,
        width: Math.max(1, Math.round(rect.w * vw)),
        height: Math.max(1, Math.round(rect.h * vh)),
        scale,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: false,
        allowTaint: false,
      })
      return canvas.toDataURL('image/png')
    }),
  )
}

/**
 * "Sans animation" as a stylesheet: every CSS animation and transition run to
 * its end at once, never removed — `animation: none` on a fade-in whose resting
 * state is `opacity: 0` leaves the content invisible for good.
 *
 * The same rule Preview writes when the switch is off (its `stillCss`; the two
 * are held together by `capture.test.ts`, since Preview builds its copy inline).
 * A document export wants it for a stronger reason than a mockup: a PDF is one
 * instant of the page, and the instant html2canvas or the SVG image happened to
 * catch was often the FIRST frame of an entrance — a flyer whose headline
 * `animate-fade-in` exported at opacity 0.
 */
export const STILL_ANIMATIONS_CSS =
  '*,*::before,*::after{animation-duration:0.01ms !important;animation-delay:0ms !important;' +
  'animation-iteration-count:1 !important;animation-fill-mode:forwards !important;' +
  'transition-duration:0.01ms !important;transition-delay:0ms !important;' +
  'scroll-behavior:auto !important}'

/**
 * No transition at all in the EXPORT frame — not a short one.
 *
 * The still stylesheet gives every element a 0.01 ms transition, which is right
 * for a preview (transitions end at once, and their events still fire) and
 * wrong here: `transition-property` defaults to `all`, so every style the export
 * pins — a gradient headline flattened to its ink before it is measured —
 * started a transition, and a computed style read in the same task returns the
 * transition's START value. The headline was measured transparent, dropped from
 * the .pptx as invisible, and erased from its background: gone from the slide.
 * Kept apart from STILL_ANIMATIONS_CSS, which must stay identical to Preview's.
 */
export const EXPORT_NO_TRANSITIONS_CSS = '*,*::before,*::after{transition:none !important}'

/** The inverse of utf8ToBase64, for reading back the source a shell was handed. */
function base64ToUtf8(b64: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(window.atob(b64), (c) => c.charCodeAt(0)))
  } catch {
    return ''
  }
}

function utf8ToBase64(str: string): string {
  return window.btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  )
}

function buildCaptureShell(
  id: string,
  useBabel: boolean,
  b64: string,
  componentName: string,
  caps: Capability[] = [],
  /**
   * A document export wants the page at rest (`STILL_ANIMATIONS_CSS`, and
   * `<Animated>` told so before it mounts); a picture takes what is there.
   */
  mode: 'picture' | 'document' = 'picture',
): string {
  // Local, pinned copy — see public/vendor/VENDOR.md. This used to point at an
  // UNVERSIONED unpkg URL, when this frame still ran with Mocky's own origin.
  const babelScript = useBabel ? '<script src="/vendor/babel.min.js"></script>' : ''
  /*
   * The typefaces the screen names, as in the preview (lib/fonts) — a thumbnail
   * or an exported flyer set in the fallback face is a picture of a different
   * design. Read off the same source the frame runs, compiled or not: a class
   * name or a style is a string either way, and survives Babel untouched.
   */
  const fontCss = fontFaceCssFor(base64ToUtf8(b64), location.origin)
  const runner = useBabel
    ? `var raw = window.atob(document.getElementById('mocky-b64').textContent);
    var src = decodeURIComponent(Array.prototype.map.call(raw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var out = Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
    var scr = document.createElement('script');
    scr.textContent = out + ';ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ${JSON.stringify(componentName)} + '));';
    document.body.appendChild(scr);`
    : `var raw = window.atob(document.getElementById('mocky-b64').textContent);
    var src = decodeURIComponent(Array.prototype.map.call(raw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var scr = document.createElement('script');
    scr.textContent = src + ';ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ${JSON.stringify(componentName)} + '));';
    document.body.appendChild(scr);`

  // Capability prelude — the same one Preview injects. Its globals (Icon,
  // Charts, Motion…) are what a generated screen expects to exist: the system
  // prompt tells the model "Icon is a PRE-DEFINED global namespace", so almost
  // every screen uses it. Without the prelude the component threw before
  // html2canvas ever ran, and the caller turned that into a silent null.
  const prelude = buildPrelude(caps)
  const preludeB64 = prelude ? utf8ToBase64(prelude) : ''
  const preludeTag = preludeB64
    ? `<script type="text/plain" id="mocky-prelude">${preludeB64}</script>`
    : ''
  const preludeRunner = preludeB64
    ? `var praw = window.atob(document.getElementById('mocky-prelude').textContent);
    var psrc = decodeURIComponent(Array.prototype.map.call(praw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var pscr = document.createElement('script'); pscr.textContent = psrc; document.body.appendChild(pscr);`
    : ''
  /*
   * Stylesheet capabilities are deliberately NOT loaded here.
   *
   * The only one is daisyUI, and it is a 2.9 MB stylesheet. html2canvas resolves
   * the computed style of every element against every rule, so its cost is
   * quadratic in exactly the wrong way. Measured on the same screen, same scale:
   *
   *   without daisyUI    554 ms
   *   with daisyUI       times out (>25 s)
   *
   * This is not a regression from the thumbnail work — an annotation snip of a
   * daisyUI screen could never have completed either. Skipping it means a
   * picture that misses daisy's component skin, which is a far better outcome
   * than no picture and a 25-second stall.
   *
   * Tailwind (vendored, JIT, and the source of nearly all the styling) is still
   * loaded, so the capture is faithful for everything else.
   */
  const capLinks = ''

  /*
   * Script capabilities, and why only some of them.
   *
   * This shell loaded none, which was right while the only one was Motion: a
   * still of an animated element is the element, and a bundle that only moves
   * things costs 130 KB for nothing. three.js is the other case — the screen's
   * picture is what it draws — so a `<Scene3D>` captured as an empty gradient,
   * on the home page and in an annotation snip alike. `drawsContent` is that
   * distinction, declared by the capability rather than guessed here.
   *
   * `__mockyStill` is the other half. html2canvas clones the document and copies
   * each canvas, and a live WebGL canvas copies BLANK — its drawing buffer is
   * gone by then, and keeping one alive for every scene is memory the canvas
   * refused to spend. So the flag asks a scene for one frame, a still, and its
   * context back; html2canvas then copies an <img>, which it does perfectly.
   */
  const capScripts = caps
    .filter((c) => c.kind === 'cdn-script' && c.drawsContent && c.cdn)
    .map((c) => `<script src="${c.cdn!.url}"></script>`)
    .join('\n')

  // Named, never 'self': the origin here is opaque (I2). The capture only ever
  // needs Mocky's own images, and a remote <img> would double as a beacon.
  const csp = [
    "default-src 'none'",
    `script-src ${location.origin} 'unsafe-inline' 'unsafe-eval' blob:`,
    `style-src ${location.origin} 'unsafe-inline'`,
    `img-src ${location.origin} data: blob:`,
    /*
     * Motion films, same origin only — and this line is why it was missing.
     *
     * The preview grew `media-src` when a film first had to play inside a
     * mockup; this document builds its OWN policy and was not touched, so the
     * capture kept falling back to `default-src 'none'` and refused the video
     * outright. The console said so on every thumbnail:
     *   "Loading media from … violates … default-src 'none'. Note that
     *    'media-src' was not explicitly set, so 'default-src' is used."
     * The visible cost was a screen whose hero is a film capturing as a hole.
     *
     * Two CSPs for two documents is not the accident here — they genuinely
     * differ, `img-src` above being the clearest case — but a directive added
     * to one and not the other is, and this is the second time that has bitten.
     */
    `media-src ${location.origin}`,
    'font-src * data:',
    "connect-src 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="/vendor/tailwind.min.js"></script>
<script>
  /* Same pin as the preview: without it Play CDN defaults to darkMode 'media',
     so a thumbnail was captured light or dark according to the OS setting of
     whoever happened to generate it — and the home page then showed a mixed
     set of cards for one project. */
  try { tailwind.config = { darkMode: 'class' } } catch (e) {}
</script>
${capLinks}
${capScripts}
${babelScript}
<style>html,body{margin:0;padding:0}#root{min-height:100vh} *{scrollbar-width:none} *::-webkit-scrollbar{display:none}</style>
${fontCss ? `<style data-mocky-fonts>${fontCss}</style>` : ''}
${mode === 'document' ? `<style>${STILL_ANIMATIONS_CSS}${EXPORT_NO_TRANSITIONS_CSS}</style>` : ''}
</head><body><div id="root"></div>
<script type="text/plain" id="mocky-b64">${b64}</script>
${preludeTag}
<script>(function(){
  /* One frame and the context back, for every <Scene3D> on this screen — see
     the note by capScripts. Set before the prelude runs, because the component
     reads it when its effect first fires. */
  window.__mockyStill = true;${mode === 'document' ? `
  /* A document is exported at rest: <Animated> reads this at mount and renders
     its resting state instead of an entrance the export would catch at its
     first frame (see STILL_ANIMATIONS_CSS for the CSS half). */
  window.__mockyAnimations = false;` : ''}
  function post(m){ var o={__mockyCap:true,id:${JSON.stringify(id)}}; for(var k in m) o[k]=m[k]; parent.postMessage(o,'*'); }
  // createRoot().render() commits asynchronously, so a render error is thrown
  // AFTER the synchronous try/catch below has already returned. Without this the
  // page simply stayed blank and html2canvas dutifully captured white — a
  // "successful" capture of nothing, with no error anywhere to explain it.
  window.onerror = function (msg, src, line, col) { post({ error: String(msg) + (line ? ' (line ' + line + ')' : '') }); return false; };
  window.addEventListener('unhandledrejection', function (e) { post({ error: 'Unhandled rejection: ' + String(e.reason && e.reason.message || e.reason) }); });
  ['useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','useLayoutEffect','useImperativeHandle','useId','useTransition','createContext','memo','forwardRef','Fragment'].forEach(function(k){ if(React[k]) window[k]=React[k]; });
  try {
    ${preludeRunner}
  } catch(e){ post({ error: 'prelude failed: ' + String((e&&e.message)||e) }); return; }
  try {
    ${runner}
  } catch(e){ post({ error: String((e&&e.message)||e) }); return; }
  ${SERIALISE_SOURCE}
  function done(){
    try { var page = mockySerialise(); post({ html: page.html, css: page.css }); }
    catch(e){ post({ error: String((e&&e.message)||e) }); }
  }
  /* The 400 ms is what the styling needs. A scene needs one thing more: a real
     BOX, which it only has once Tailwind's runtime has applied its classes —
     measured without it, the still came back a 1x1 canvas and was refused, and
     the screen was captured with its fallback gradient. So a scene that still
     owes its frame is waited for, briefly, and then the picture is taken
     anyway: a capture that degrades is this file's contract, a capture that
     never arrives is not. window.__mockyStillPending is that count. */
  var owed = 0, fontsOwed = 0;
  setTimeout(function wait(){
    /* The faces too (lib/fonts): html2canvas sets each run of text with the
       font the document has NOW, so a face still on its way is drawn as the
       fallback. Local files, so this is usually nothing; bounded, because a
       face that never arrives must cost the picture its typeface, not the
       picture. The face is loaded again in the still frame; what matters here
       is that a script measuring text measured the real one. */
    if (document.fonts && document.fonts.status === 'loading' && fontsOwed < 3000) {
      fontsOwed += 60;
      return setTimeout(wait, 60);
    }
    if (!window.__mockyStillPending || owed >= 600) return done();
    owed += 60;
    setTimeout(wait, 60);
  }, 400);
})();
</script></body></html>`
}

const CAPTURE_TIMEOUT_MS = 25_000

function parkOffscreen(iframe: HTMLIFrameElement, width: number, height: number): void {
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.round(width)}px;height:${Math.round(height)}px;border:0;`
}

/**
 * Runs the screen in the live frame and answers with what it drew.
 *
 * The parent-compiled build first, the in-frame Babel build second. Rejects when
 * the screen could not be rendered at all, or when `signal` aborts.
 */
function renderLive(
  code: string,
  caps: Capability[],
  width: number,
  height: number,
  mode: 'picture' | 'document',
  signal?: AbortSignal,
): Promise<LiveSnapshot> {
  const id = 'cap' + Math.random().toString(36).slice(2)
  const previewCode = toPreviewModule(code)
  const componentName = detectComponentName(code)
  const viaBabel = () =>
    runLiveFrame(buildCaptureShell(id + 'b', true, utf8ToBase64(previewCode), componentName, caps, mode), id + 'b', width, height, signal)
  return compileJsx(previewCode).then(
    (compiled) =>
      runLiveFrame(buildCaptureShell(id, false, utf8ToBase64(compiled), componentName, caps, mode), id, width, height, signal).catch((err) => {
        if (signal?.aborted) throw err
        return viaBabel()
      }),
    () => viaBabel(),
  )
}

function runLiveFrame(srcdoc: string, id: string, width: number, height: number, signal?: AbortSignal): Promise<LiveSnapshot> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    // Exactly what a preview gets (I2). This is the frame the model's code runs
    // in, and the one flag it must never be given is allow-same-origin.
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    parkOffscreen(iframe, width, height)
    // Under the app rather than off to the side, unlike the copy. Parked 99,999 px
    // away, a frame with an opaque origin gets no rendering frames: a <Scene3D>
    // never took its still, and the thumbnail showed its fallback gradient, where
    // the same page in a same-origin frame drew the object. Measured, in Edge.
    iframe.style.left = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.zIndex = '-1'
    iframe.srcdoc = srcdoc
    const cleanup = () => {
      window.removeEventListener('message', onMsg)
      signal?.removeEventListener('abort', onAbort)
      clearTimeout(timer)
      iframe.remove()
    }
    function onAbort() {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    function onMsg(e: MessageEvent) {
      // The capture iframe is the only legitimate sender; a live preview must not
      // be able to resolve someone else's capture with a page of its choosing.
      if (e.source !== iframe.contentWindow) return
      const d = e.data
      if (!d || !d.__mockyCap || d.id !== id) return
      cleanup()
      if (typeof d.html === 'string') resolve({ html: d.html, css: typeof d.css === 'string' ? d.css : '' })
      else reject(new Error(d.error || 'capture failed'))
    }
    // 25 s, not 15. A capture is background work for a thumbnail, and a screen
    // with a full-bleed image genuinely takes a while; giving up early just
    // means no thumbnail at all.
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('capture timed out — the screen may be unusually heavy (large background image, very long page)'))
    }, CAPTURE_TIMEOUT_MS)
    window.addEventListener('message', onMsg)
    signal?.addEventListener('abort', onAbort)
    document.body.appendChild(iframe)
  })
}

function settledWithin(p: Promise<unknown> | undefined, ms: number): Promise<unknown> {
  return Promise.race([Promise.resolve(p).catch(() => undefined), new Promise((r) => setTimeout(r, ms))])
}

/** Opens the inert copy of a page and waits for what it shows to have arrived. */
async function openStillFrame(snapshot: LiveSnapshot, width: number, height: number, signal?: AbortSignal): Promise<HTMLIFrameElement> {
  const origin = location.origin
  const html = stillDocument(snapshot, {
    csp: screenStillCsp(origin),
    // Animations run to their end: html2canvas clones the document, and the
    // clone's animations start again from their FIRST frame — a fade-in at 0.
    css: STILL_ANIMATIONS_CSS + EXPORT_NO_TRANSITIONS_CSS,
    keepAddress: keepScreenAddress(origin),
    keepCssUrl: keepScreenCssUrl(origin),
  })
  // No allow-scripts, ever: Mocky reaches into this frame, so nothing may run in it.
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  parkOffscreen(iframe, width, height)
  // Bounded: a picture that never answers costs the picture, not the capture.
  await settledWithin(
    new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
      iframe.srcdoc = html
      document.body.appendChild(iframe)
    }),
    8000,
  )
  const doc = iframe.contentDocument
  if (!doc || !doc.body || signal?.aborted) {
    iframe.remove()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new Error('capture failed')
  }
  await settledWithin((doc as Document & { fonts?: FontFaceSet }).fonts?.ready, 3000)
  // A film has no first frame until it has data: html2canvas and the native
  // rasteriser draw what the <video> holds now, and an empty one is a hole.
  const films = Array.from(doc.querySelectorAll('video')).filter((v) => v.readyState < 2 && !v.error)
  if (films.length) {
    await settledWithin(
      Promise.all(
        films.map(
          (v) =>
            new Promise<void>((resolve) => {
              v.addEventListener('loadeddata', () => resolve(), { once: true })
              v.addEventListener('error', () => resolve(), { once: true })
            }),
        ),
      ),
      1500,
    )
  }
  return iframe
}

/** The inert copy, for as long as `use` needs it. */
async function onStillFrame<T>(
  snapshot: LiveSnapshot,
  width: number,
  height: number,
  use: (win: Window, doc: Document, html2canvas: Html2Canvas) => Promise<T>,
): Promise<T> {
  const html2canvas = await loadHtml2canvas()
  const iframe = await openStillFrame(snapshot, width, height)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      use(iframe.contentWindow!, iframe.contentDocument!, html2canvas),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('capture timed out — the screen may be unusually heavy (large background image, very long page)')),
          CAPTURE_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
    iframe.remove()
  }
}

/**
 * The runs of text laid over a picture that cannot be read on it.
 *
 * Renders the screen as a thumbnail is rendered, and measures, rather than
 * infers, the pixels behind each run. No model call. Resolves to an empty list
 * when nothing is laid over a picture; rejects only when the screen could not be
 * rendered at all, which the caller treats as "not checked".
 */
export function checkLegibility(
  code: string,
  width: number,
  height: number,
  caps: Capability[] = [],
): Promise<LegibilityFinding[]> {
  return renderLive(code, caps, width, height, 'picture').then((snapshot) =>
    onStillFrame(snapshot, width, height, probeLegibility),
  )
}

/** A document rendered, then left standing as an inert copy for the export to read. */
export interface DocumentFrame {
  /** The copy's window: same-origin and script-free, so its DOM is reachable and nothing in it runs. */
  win: Window
  doc: Document
  /** Mocky's own copy, to rasterise this frame. Absent if the bundle failed to load. */
  html2canvas?: Html2Canvas
  /** Resize the frame: the pages stack below the first viewport. */
  resize(height: number): void
  dispose(): void
}

/**
 * Renders a DOCUMENT screen offscreen and hands the copy of it back.
 *
 * A thumbnail is one picture; an export is a page-by-page walk (measure the
 * text, hide it, rasterise, next page) that the parent performs on the frame's
 * DOM. That walk is why the copy exists at all rather than html2canvas moving to
 * some other origin. The model's code is gone by the time the walk starts.
 *
 * Rejects when the screen could not be rendered at all, or when `signal` aborts.
 */
export async function openDocumentFrame(
  code: string,
  caps: Capability[],
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<DocumentFrame> {
  const snapshot = await renderLive(code, caps, width, height, 'document', signal)
  // The fallback rasteriser only: an export can do without it.
  const html2canvas = await loadHtml2canvas().catch(() => undefined)
  const iframe = await openStillFrame(snapshot, width, height, signal)
  return {
    win: iframe.contentWindow!,
    doc: iframe.contentDocument!,
    html2canvas,
    resize: (h) => {
      iframe.style.height = `${Math.round(h)}px`
    },
    dispose: () => iframe.remove(),
  }
}
