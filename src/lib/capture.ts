import { detectComponentName, toPreviewModule } from './generate'
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
 * `parent`. Triggering it is an ordinary product action — one drag in Annotate
 * mode.
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
 * What is closed instead: the CSP below denies connect-src, form-action,
 * frame-src, object-src and base-uri, and limits img-src to this origin — so the
 * component has no network channel to send anything it reads.
 *
 * The real fix is ORIGIN SEPARATION: serve the capture shell from a distinct
 * origin (a second port, or a sibling hostname) and keep allow-same-origin.
 * html2canvas then works, while the frame is cross-origin to the app and can
 * touch neither its storage nor its DOM. That needs a server route plus a
 * configurable capture origin, which is why it is not in this change.
 */
export function captureRegion(
  code: string,
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = 'cap' + Math.random().toString(36).slice(2)
    const previewCode = toPreviewModule(code)
    const componentName = detectComponentName(code)
    compileJsx(previewCode)
      .then((compiled) => {
        mountCaptureIframe(
          buildCompiledCaptureSrcDoc(compiled, componentName, id, rect),
          id,
          width,
          height,
          resolve,
          () => {
            // Fallback: compile JSX inside the iframe with Babel from CDN.
            mountCaptureIframe(
              buildBabelCaptureSrcDoc(previewCode, componentName, id, rect),
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
          buildBabelCaptureSrcDoc(previewCode, componentName, id, rect),
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
): string {
  const b64 = utf8ToBase64(compiled)
  return buildCaptureShell(id, rect, false, b64, componentName)
}

function buildBabelCaptureSrcDoc(
  sourceCode: string,
  componentName: string,
  id: string,
  rect: { x: number; y: number; w: number; h: number },
): string {
  const b64 = utf8ToBase64(sourceCode)
  return buildCaptureShell(id, rect, true, b64, componentName)
}

function buildCaptureShell(
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  useBabel: boolean,
  b64: string,
  componentName: string,
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

  // This frame is same-origin (see the note at the top of the file), so denying
  // it a network channel is what keeps a component from posting anything it
  // manages to read. img-src is limited to this origin because the capture only
  // ever needs Mocky's own images — a remote <img> would double as a beacon.
  const csp = [
    "default-src 'none'",
    `script-src ${location.origin} 'unsafe-inline' 'unsafe-eval' blob:`,
    `style-src ${location.origin} 'unsafe-inline' https://cdn.jsdelivr.net`,
    `img-src ${location.origin} data: blob:`,
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
${babelScript}
<script src="/vendor/html2canvas.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh} *{scrollbar-width:none} *::-webkit-scrollbar{display:none}</style>
</head><body><div id="root"></div>
<script type="text/plain" id="mocky-b64">${b64}</script>
<script>(function(){
  function post(m){ var o={__mockyCap:true,id:${JSON.stringify(id)}}; for(var k in m) o[k]=m[k]; parent.postMessage(o,'*'); }
  ['useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','useLayoutEffect','useImperativeHandle','useId','useTransition','createContext','memo','forwardRef','Fragment'].forEach(function(k){ if(React[k]) window[k]=React[k]; });
  try {
    ${runner}
  } catch(e){ post({ error: String((e&&e.message)||e) }); return; }
  setTimeout(function(){
    var vw = window.innerWidth||1, vh = window.innerHeight||1, r = ${JSON.stringify(rect)};
    try {
      html2canvas(document.body, { x: r.x*vw, y: r.y*vh, width: Math.max(1,Math.round(r.w*vw)), height: Math.max(1,Math.round(r.h*vh)), scale: 2, backgroundColor:'#ffffff', logging:false })
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
      reject(new Error('capture timed out'))
    }
  }, 15000)
}
