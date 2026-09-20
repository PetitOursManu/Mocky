import { detectComponentName, toPreviewModule } from './generate'
import { buildPrelude } from './capabilities/prelude'
import type { Capability } from './capabilities/types'
import { compileJsx } from './compile'

/**
 * Screenshots a region of a generated component.
 *
 * The live previews stay sandboxed with an opaque origin, but html2canvas cannot
 * read a cross-origin iframe. So we spin up a short-lived, offscreen capture
 * iframe, render the component fresh, snapshot the region, and destroy it.
 * `rect` is normalized (0..1) to the screen viewport.
 *
 * First we compile the JSX in the parent and inject the compiled JS; if that
 * fails at runtime inside the iframe, we fall back to compiling with the
 * vendored Babel there. Every bundle comes from public/vendor (hash-pinned, see
 * VENDOR.md) — Babel in particular used to be fetched from an *unversioned*
 * unpkg URL directly into this privileged frame.
 *
 * ── KNOWN LIMITATION: this frame is same-origin ──────────────────────────────
 *
 * `allow-same-origin` is still granted, so for the ~1 s of a capture the
 * model-generated component runs with Mocky's origin: it can read
 * localStorage['mocky.settings.v1'] (the provider API key, in clear) and reach
 * `parent`.
 *
 * Triggering it is not even a deliberate action. Besides the drag in Annotate
 * mode, `thumbnails.ts` (captureThumb → queueThumbs) mounts this same shell
 * automatically for EVERY generated screen, so the window opens on its own on
 * the normal path. And the code inside it comes from the model, which means an
 * indirect prompt injection through a Muse inspiration URL — or a hostile
 * provider endpoint — is enough to put a payload here.
 *
 * Removing the flag was tried and measured, and it does not work: html2canvas
 * clones the document into an iframe of its own, and a sandbox without
 * allow-same-origin gives every descendant a FRESH opaque origin — so the frame
 * cannot read its own clone. It fails with "Blocked a frame with origin null
 * from accessing a cross-origin frame", both on the default path and with
 * `foreignObjectRendering: true`. Hand-rolling an SVG <foreignObject> snapshot
 * does work in an opaque origin, but carries neither the Tailwind stylesheet nor
 * the images, i.e. it means reimplementing html2canvas.
 *
 * The CSP below denies connect-src, form-action, frame-src, object-src and
 * base-uri and limits img-src to this origin — but do NOT read that as "the
 * component has no network channel", which is what this comment used to claim.
 * A CSP binds a DOCUMENT, not an origin. Same-origin code reaches
 * `window.parent` and can run in the parent's realm, and the parent has no CSP
 * at all: index.html declares none and the server sends only nosniff / XFO /
 * Referrer-Policy / COOP. One line in the parent's realm — appending an <img>
 * whose src carries localStorage — leaves under the PARENT's policy, so none of
 * the directives below apply to it. The CSP raises the effort; it does not close
 * the hole.
 *
 * The real fix is ORIGIN SEPARATION: serve the capture shell from a distinct
 * origin (a second port, or a sibling hostname) and keep allow-same-origin.
 * html2canvas then works, while the frame is cross-origin to the app and can
 * touch neither its storage nor its DOM. That needs a server route plus a
 * configurable capture origin, which is why it is not in this change.
 *
 * Keeping the provider key out of localStorage entirely — server-side only —
 * would close it from the other end, and is the cheaper of the two.
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
  return new Promise((resolve, reject) => {
    const id = 'cap' + Math.random().toString(36).slice(2)
    const previewCode = toPreviewModule(code)
    const componentName = detectComponentName(code)
    compileJsx(previewCode)
      .then((compiled) => {
        mountCaptureIframe(
          buildCompiledCaptureSrcDoc(compiled, componentName, id, rect, caps, scale),
          id,
          width,
          height,
          resolve,
          () => {
            // Fallback: compile JSX inside the iframe with Babel from CDN.
            mountCaptureIframe(
              buildBabelCaptureSrcDoc(previewCode, componentName, id, rect, caps, scale),
              id + 'b',
              width,
              height,
              resolve,
              reject,
            )
          },
        )
      })
      .catch(() => {
        // Parent-side compile failed entirely: still try Babel in the iframe.
        mountCaptureIframe(
          buildBabelCaptureSrcDoc(previewCode, componentName, id, rect, caps, scale),
          id,
          width,
          height,
          resolve,
          reject,
        )
      })
  })
}

function utf8ToBase64(str: string): string {
  return window.btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  )
}

function buildCompiledCaptureSrcDoc(
  compiled: string,
  componentName: string,
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  caps: Capability[] = [],
  scale = 2,
): string {
  const b64 = utf8ToBase64(compiled)
  return buildCaptureShell(id, rect, false, b64, componentName, caps, scale)
}

function buildBabelCaptureSrcDoc(
  sourceCode: string,
  componentName: string,
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  caps: Capability[] = [],
  scale = 2,
): string {
  const b64 = utf8ToBase64(sourceCode)
  return buildCaptureShell(id, rect, true, b64, componentName, caps, scale)
}

function buildCaptureShell(
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  useBabel: boolean,
  b64: string,
  componentName: string,
  caps: Capability[] = [],
  scale = 2,
): string {
  // Local, pinned copy — see public/vendor/VENDOR.md. This used to point at an
  // UNVERSIONED unpkg URL, loaded into an iframe that ran with Mocky's own
  // origin: whatever unpkg served could read localStorage (the provider API key)
  // and call the API with the session cookie.
  const babelScript = useBabel ? '<script src="/vendor/babel.min.js"></script>' : ''
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

  // This frame is same-origin (see the note at the top of the file), so denying
  // it a network channel is what keeps a component from posting anything it
  // manages to read. img-src is limited to this origin because the capture only
  // ever needs Mocky's own images — a remote <img> would double as a beacon.
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
<script crossorigin src="/vendor/react.production.min.js"></script>
<script crossorigin src="/vendor/react-dom.production.min.js"></script>
<script src="/vendor/tailwind.min.js"></script>
<script>
  /* Same pin as the preview: without it Play CDN defaults to darkMode 'media',
     so a thumbnail was captured light or dark according to the OS setting of
     whoever happened to generate it — and the home page then showed a mixed
     set of cards for one project. */
  try { tailwind.config = { darkMode: 'class' } } catch (e) {}
</script>
${capLinks}
${babelScript}
<script src="/vendor/html2canvas.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh} *{scrollbar-width:none} *::-webkit-scrollbar{display:none}</style>
</head><body><div id="root"></div>
<script type="text/plain" id="mocky-b64">${b64}</script>
${preludeTag}
<script>(function(){
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
  setTimeout(function(){
    var vw = window.innerWidth||1, vh = window.innerHeight||1, r = ${JSON.stringify(rect)};
    try {
      html2canvas(document.body, { x: r.x*vw, y: r.y*vh, width: Math.max(1,Math.round(r.w*vw)), height: Math.max(1,Math.round(r.h*vh)), scale: ${scale}, backgroundColor:'#ffffff', logging:false })
        .then(function(canvas){ post({ dataUrl: canvas.toDataURL('image/png') }); })
        .catch(function(e){ post({ error: String((e&&e.message)||e) }); });
    } catch(e){ post({ error: String((e&&e.message)||e) }); }
  }, 400);
})();
</script></body></html>`
}
function mountCaptureIframe(
  srcdoc: string,
  id: string,
  width: number,
  height: number,
  resolve: (dataUrl: string) => void,
  reject: (err: Error) => void,
): void {
  const iframe = document.createElement('iframe')
  // KNOWN LIMITATION — this frame runs model-generated code with Mocky's own
  // origin, and that cannot currently be removed. See the block comment at the
  // top of this file for the full reasoning, the measurement behind it, and the
  // design that would fix it properly.
  //
  // What IS closed: the shell now loads only vendored, hash-pinned bundles (it
  // used to pull Babel from an unversioned unpkg URL straight into this
  // privileged frame), and its CSP denies every outbound network verb.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.round(width)}px;height:${Math.round(height)}px;border:0;`
  iframe.srcdoc = srcdoc

  let done = false
  const cleanup = () => {
    window.removeEventListener('message', onMsg)
    iframe.remove()
  }
  function onMsg(e: MessageEvent) {
    // The capture iframe is the only legitimate sender; a live preview must not
    // be able to resolve someone else's capture with a picture of its choosing.
    if (e.source !== iframe.contentWindow) return
    const d = e.data
    if (!d || !d.__mockyCap || d.id !== id) return
    done = true
    cleanup()
    if (d.dataUrl) resolve(d.dataUrl)
    else reject(new Error(d.error || 'capture failed'))
  }
  window.addEventListener('message', onMsg)
  document.body.appendChild(iframe)
  setTimeout(() => {
    if (!done) {
      cleanup()
      reject(
        new Error(
          'capture timed out — the screen may be unusually heavy (large background image, very long page)',
        ),
      )
    }
    // 25 s, not 15. A capture is background work for a thumbnail, and a screen
    // with a full-bleed image genuinely takes a while to rasterise; giving up
    // early just means no thumbnail at all.
  }, 25000)
}
