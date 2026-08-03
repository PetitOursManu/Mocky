import { detectComponentName, toPreviewModule } from './generate'
import { buildPrelude } from './capabilities/prelude'
import type { Capability } from './capabilities/types'
import { compileJsx } from './compile'

/**
 * Screenshots a region of a generated component.
 *
 * We spin up a short-lived, offscreen capture iframe, render the component
 * fresh, snapshot the region, and destroy it. `rect` is normalized (0..1) to the
 * screen viewport.
 *
 * First we compile the JSX in the parent and inject the compiled JS; if that
 * fails at runtime inside the iframe, we fall back to compiling with the
 * vendored Babel there. Every bundle comes from public/vendor (hash-pinned, see
 * VENDOR.md) — Babel in particular used to be fetched from an *unversioned*
 * unpkg URL directly into this privileged frame.
 *
 * ── WHY THIS FRAME IS NO LONGER PRIVILEGED ──────────────────────────────────
 *
 * It used to carry `allow-same-origin`, which meant that for the ~1 s of every
 * capture the model-generated component ran with Mocky's own origin: it could
 * read localStorage['mocky.settings.v1'] — the provider API key, in clear — and
 * reach `window.parent`, whose realm has no CSP at all. And nothing about that
 * was deliberate on the user's part: `thumbnails.ts` mounts this shell
 * automatically for EVERY generated screen, so the window opened by itself on
 * the normal path, running code that an indirect prompt injection through a Muse
 * inspiration URL could have chosen.
 *
 * The flag was there because html2canvas needs to read the document it is
 * photographing. It clones that document into an iframe of its own, and a
 * sandbox without allow-same-origin gives every descendant a FRESH opaque
 * origin, so the frame could not read its own clone — measured, and it failed
 * identically with `foreignObjectRendering: true`.
 *
 * snapdom does not clone into a frame. It serializes the subtree into an SVG
 * <foreignObject> with the computed style of every node inlined, then rasterizes
 * that SVG through a data: URL. Nothing in that path crosses an origin boundary,
 * so it works with the sandbox fully closed. Measured in an opaque origin, at
 * scale 2 on a 1200×537 screen: capture succeeds, `toDataURL` does NOT throw
 * (the canvas is not tainted), Tailwind's injected utilities are honoured, and
 * `rgb(var(--token) / 0.5)` composites to the exact pixel. 113 ms by default and
 * 70 ms with `fast: true`, against 111 ms for html2canvas with the origin open.
 *
 * What the component can still do, and why it no longer matters: it has an
 * opaque origin, so `localStorage` is a different, empty store and `parent` is
 * cross-origin and unreachable. The CSP below is now a second line rather than
 * the only one.
 *
 * `connect-src` is the one directive that had to be loosened, from `'none'` to
 * this origin. snapdom inlines an <img> by fetching its bytes, and under
 * `connect-src 'none'` every fetch is blocked — measured: two CSP violations per
 * capture and every picture replaced by snapdom's grey placeholder. Allowing
 * Mocky's own origin restores them and grants nothing: the frame's requests are
 * cross-site and the session cookie is `SameSite=Lax`, so they carry no
 * credentials, and the only image bytes they can reach are the ones
 * `/api/images/:hash` already serves unauthenticated by design (see the note at
 * server/index.js). There is still no route to any *other* origin — img-src,
 * form-action, frame-src and base-uri all remain closed — so there is nowhere to
 * send anything.
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
   * Device-pixel ratio the snapshot is rasterized at.
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
            // Fallback: compile the JSX inside the iframe with the vendored Babel.
            //
            // The id passed here used to be `id + 'b'` while the shell was still
            // built with `id`, so the listener's `d.id !== id` guard rejected
            // every message the fallback frame sent and the path could only ever
            // end in the watchdog — reported as "capture timed out", whatever had
            // actually gone wrong. Both sides now use the same id.
            const fallbackId = id + 'b'
            mountCaptureIframe(
              buildBabelCaptureSrcDoc(previewCode, componentName, fallbackId, rect, caps, scale),
              fallbackId,
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

  /*
   * The component is evaluated inside an IIFE so its top-level declarations stay
   * in a function scope instead of landing on `window`.
   *
   * html2canvas was a well-behaved UMD and put exactly one name on the global
   * object. snapdom's browser build puts 364 there, nine of them a single
   * character — `E J L U _ j q x z` — and the rest two. A generated screen that
   * declares any of those at top level would either clobber snapdom's internals
   * (`var x`) or refuse to parse at all (`const x`, which collides across
   * scripts). Neither failure would say what happened: the capture would just
   * break, inside a sandboxed frame, which is the worst place in the app to
   * debug. Wrapping costs nothing and removes the whole class.
   */
  // The component name goes in BARE. Quoting it would make it a tag name, and
  // React renders an unknown tag as an empty custom element: no error anywhere,
  // and a capture that succeeds with a blank white picture.
  const mount = `;ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(${componentName}));`
  const runner = useBabel
    ? `var raw = window.atob(document.getElementById('mocky-b64').textContent);
    var src = decodeURIComponent(Array.prototype.map.call(raw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var out = Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
    var scr = document.createElement('script');
    scr.textContent = '(function(){' + out + ${JSON.stringify(mount)} + '})();';
    document.body.appendChild(scr);`
    : `var raw = window.atob(document.getElementById('mocky-b64').textContent);
    var src = decodeURIComponent(Array.prototype.map.call(raw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var scr = document.createElement('script');
    scr.textContent = '(function(){' + src + ${JSON.stringify(mount)} + '})();';
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
   * The only one is daisyUI, and it is a 2.9 MB stylesheet. html2canvas resolved
   * the computed style of every element against every rule, so its cost was
   * quadratic in exactly the wrong way. Measured on the same screen, same scale:
   *
   *   without daisyUI    554 ms
   *   with daisyUI       times out (>25 s)
   *
   * Skipping it means a picture that misses daisy's component skin, which is a
   * far better outcome than no picture and a 25-second stall.
   *
   * That measurement was taken against html2canvas and has NOT been retaken
   * against snapdom, which reads each node's computed style directly instead of
   * matching rules itself and may not suffer the same way. Worth re-measuring;
   * until someone does, the conservative choice stays.
   *
   * Tailwind (vendored, JIT, and the source of nearly all the styling) is still
   * loaded, so the capture is faithful for everything else.
   */
  const capLinks = ''

  // Second line of defence now that the frame is opaque-origin (see the note at
  // the top of the file). img-src stays pinned to this origin because a remote
  // <img> doubles as a beacon; connect-src is open to this origin ONLY, because
  // snapdom inlines pictures by fetching their bytes and `'none'` turned every
  // one of them into a grey placeholder. Neither directive lets anything reach a
  // third party, which is the property that matters.
  const csp = [
    "default-src 'none'",
    `script-src ${location.origin} 'unsafe-inline' 'unsafe-eval' blob:`,
    `style-src ${location.origin} 'unsafe-inline'`,
    `img-src ${location.origin} data: blob:`,
    'font-src * data:',
    `connect-src ${location.origin}`,
    "form-action 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<!-- NO crossorigin attribute, for the same reason Preview.tsx:161 gives: this
     frame's origin is now null, and crossorigin turns a script tag into a CORS
     request, which a null origin can only satisfy with an
     Access-Control-Allow-Origin header the static route does not send. It was
     harmless while the frame was same-origin; the moment the flag came off,
     React stopped loading and every capture failed with "React is not defined". -->
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
${babelScript}
<script src="/vendor/snapdom.js"></script>
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
  /* Wait until the page is actually being composited.
     snapdom rasterizes by loading its SVG into an <img> and awaiting decode(),
     and a hidden document never decodes: measured on the same screen, in a
     backgrounded tab, html2canvas returned in 1064 ms while snapdom took 39 s
     and on a second run blew a 90 s deadline. Visible, both are ~110 ms. So the
     figure is not a cost, it is a stall, and starting the capture while hidden
     only burns the watchdog below. Thumbnails are queued right after a screen is
     generated, which is exactly when someone might switch tabs. */
  function whenVisible(fn){
    if (document.visibilityState !== 'hidden') return fn();
    document.addEventListener('visibilitychange', function once(){
      if (document.visibilityState === 'hidden') return;
      document.removeEventListener('visibilitychange', once);
      fn();
    });
  }
  setTimeout(function(){ whenVisible(function(){
    var vw = window.innerWidth||1, vh = window.innerHeight||1, r = ${JSON.stringify(rect)};
    try {
      /* snapdom's \`clip\` is html2canvas's x/y/width/height under another name:
         a page-coordinate rect, applied before scaling. Verified against a
         four-quadrant target — a top-half clip returns only the top half, an
         offset clip returns only that corner, and \`scale\` still multiplies on
         top of it.

         \`dpr\` is pinned because it does NOT replace \`scale\`, it multiplies
         with it, and it defaults to the display's devicePixelRatio. Left alone,
         the same screen captured on a HiDPI laptop came back 1600x1600 where a
         normal display gave 800x800 — four times the pixels, on the machine of
         whoever happened to generate it, which is how you blow the watchdog
         below and get "capture timed out" from a screen that is not heavy. */
      snapdom.toCanvas(document.body, {
        clip: { x: r.x*vw, y: r.y*vh, width: Math.max(1,Math.round(r.w*vw)), height: Math.max(1,Math.round(r.h*vh)) },
        scale: ${scale},
        dpr: 1,
        backgroundColor: '#ffffff'
      })
        .then(function(canvas){ post({ dataUrl: canvas.toDataURL('image/png') }); })
        .catch(function(e){ post({ error: String((e&&e.message)||e) }); });
    } catch(e){ post({ error: String((e&&e.message)||e) }); }
  }); }, 400);
})();
</script></body></html>`
}
/**
 * Teardowns for every capture frame currently mounted.
 *
 * A capture is not a background task. snapdom serialises the computed style of
 * every node, and it does that in a frame that shares this thread — so while a
 * heavy screen is being photographed, nothing else in the tab runs. Messages sit
 * in the queue, timers fire late, and anything with a watchdog accuses itself of
 * a timeout it did not have. That is precisely what demo mode did: its iframe
 * rendered and posted "ok", the parent could not answer for twenty-odd seconds,
 * and the render watchdog — armed earlier, therefore due earlier — won the race.
 *
 * Removing the frame stops its script dead, which is the only way to give the
 * thread back. Hence this registry.
 */
const liveCaptures = new Set<() => void>()

/**
 * Abandon every capture in flight.
 *
 * Called when something the user is actually looking at needs the thread. The
 * abandoned captures reject, and their callers treat a failed thumbnail as no
 * thumbnail — which is what they already do, and what makes this safe.
 */
export function cancelCaptures(): void {
  for (const stop of [...liveCaptures]) stop()
  liveCaptures.clear()
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
  // No allow-same-origin. The component gets an opaque origin, which is a
  // different, empty localStorage and a `parent` it cannot touch — so the
  // provider API key is out of its reach even though the code inside comes from
  // a model. This carried `allow-same-origin` for as long as html2canvas did the
  // snapshotting, because html2canvas has to read the document it photographs;
  // snapdom serializes it instead and needs no such access. See the block
  // comment at the top of this file for the measurement.
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.round(width)}px;height:${Math.round(height)}px;border:0;`
  iframe.srcdoc = srcdoc

  let done = false
  const cleanup = () => {
    window.removeEventListener('message', onMsg)
    iframe.remove()
    liveCaptures.delete(abandon)
  }
  // Registered so cancelCaptures() can stop this frame mid-snapshot. Rejecting
  // rather than resolving null keeps the caller's existing failure path.
  const abandon = () => {
    if (done) return
    done = true
    cleanup()
    reject(new Error('capture cancelled — the thread was needed elsewhere'))
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
  liveCaptures.add(abandon)
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
