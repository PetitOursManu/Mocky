import { detectComponentName, toPreviewModule } from './generate'

/**
 * Screenshots a region of a generated component.
 *
 * The live previews stay sandboxed (safe), but html2canvas cannot read a
 * sandboxed cross-origin iframe. So we spin up a short-lived, offscreen
 * same-origin capture iframe, render the component fresh, snapshot the region,
 * and destroy the iframe. `rect` is normalized (0..1) to the screen viewport.
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
    const safe = previewCode.replace(/<\/script>/gi, '<\\/script>')

    const srcdoc = `<!doctype html><html><head><meta charset="utf-8"/>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh} *{scrollbar-width:none} *::-webkit-scrollbar{display:none}</style>
</head><body><div id="root"></div>
<script type="text/plain" id="mocky-src">${safe}</script>
<script>(function(){
  function post(m){ var o={__mockyCap:true,id:${JSON.stringify(id)}}; for(var k in m) o[k]=m[k]; parent.postMessage(o,'*'); }
  ['useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','useLayoutEffect','useImperativeHandle','useId','useTransition','createContext','memo','forwardRef','Fragment'].forEach(function(k){ if(React[k]) window[k]=React[k]; });
  try {
    var out = Babel.transform(document.getElementById('mocky-src').textContent, { presets:[['react',{runtime:'classic'}]] }).code;
    new Function('React','ReactDOM', out + '\\n;ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ${JSON.stringify(componentName)} + '));')(React, ReactDOM);
  } catch(e){ post({ error: String((e&&e.message)||e) }); return; }
  setTimeout(function(){
    var vw = window.innerWidth||1, vh = window.innerHeight||1, r = ${JSON.stringify(rect)};
    try {
      html2canvas(document.body, { x: r.x*vw, y: r.y*vh, width: Math.max(1,Math.round(r.w*vw)), height: Math.max(1,Math.round(r.h*vh)), scale: 2, backgroundColor:'#ffffff', logging:false })
        .then(function(canvas){ post({ dataUrl: canvas.toDataURL('image/png') }); })
        .catch(function(e){ post({ error: String((e&&e.message)||e) }); });
    } catch(e){ post({ error: String((e&&e.message)||e) }); }
  }, 400);
})();</script></body></html>`

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
  })
}
