import { detectComponentName, toPreviewModule } from './generate'
import { compileJsx } from './compile'

/**
 * Screenshots a region of a generated component.
 *
 * The live previews stay sandboxed (safe), but html2canvas cannot read a
 * sandboxed cross-origin iframe. So we spin up a short-lived, offscreen
 * same-origin capture iframe, render the component fresh, snapshot the region,
 * and destroy the iframe. `rect` is normalized (0..1) to the screen viewport.
 *
 * First, we try to compile the JSX in the parent and inject the compiled JS.
 * If that fails at runtime inside the iframe, we fall back to loading Babel from
 * a CDN inside the capture iframe and compiling there. React/ReactDOM/html2canvas
 * are served locally (public/vendor) to avoid a CDN compromise reaching this
 * same-origin iframe; Babel is only loaded as a fallback.
 *
 * NOTE: during the brief capture the component runs same-origin. Fine for a
 * self-hosted tool with your own model; a hardened deployment would isolate it.
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
  const babelScript = useBabel
    ? '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>'
    : ''
  const runner = useBabel
    ? `var raw = window.atob(document.getElementById('mocky-b64').textContent);
    var src = decodeURIComponent(Array.prototype.map.call(raw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var out = Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
    var scr = document.createElement('script');
    scr.textContent = out + ';ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ' + ${JSON.stringify(componentName)} + ' + '));';
    document.body.appendChild(scr);`
    : `var raw = window.atob(document.getElementById('mocky-b64').textContent);
    var src = decodeURIComponent(Array.prototype.map.call(raw, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    var scr = document.createElement('script');
    scr.textContent = src + ';ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ' + ${JSON.stringify(componentName)} + ' + '));';
    document.body.appendChild(scr);`

  return `<!doctype html><html><head><meta charset="utf-8"/>
<script crossorigin src="/vendor/react.production.min.js"></script>
<script crossorigin src="/vendor/react-dom.production.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
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
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.round(width)}px;height:${Math.round(height)}px;border:0;`
  iframe.srcdoc = srcdoc

  let done = false
  const cleanup = () => {
    window.removeEventListener('message', onMsg)
    iframe.remove()
  }
  function onMsg(e: MessageEvent) {
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
