import { useEffect, useRef, useState } from 'react'
import { detectComponentName, toPreviewModule } from '../lib/generate'
import { validateJsx } from '../lib/compile'

export interface PickInfo {
  selector: string
  label: string
  rect: { x: number; y: number; w: number; h: number }
}
export interface DemoLink {
  selector: string
  target: string
}

/**
 * Builds a self-contained HTML document for the sandboxed iframe. The JSX is
 * compiled once in the parent (see compileJsx) and injected as plain JS, so
 * the iframe no longer ships Babel (~3 MB). React/ReactDOM are served locally
 * (public/vendor) to avoid a CDN compromise reaching the iframe.
 *
 * The iframe installs a small "interaction bridge" that talks to the parent
 * over postMessage:
 *   - pick mode: highlight hovered elements; on click, report a CSS selector.
 *   - demo mode: given [{selector, target}], clicking those elements asks the
 *     parent to navigate. Other elements keep their normal behaviour.
 * Every message carries `frameId` so multiple previews don't cross-talk.
 */
/**
 * Encode a UTF-8 string to base64 in the browser. We use this to embed the
 * raw JSX source inside the iframe srcDoc: it removes every character that
 * could break the HTML/template (backticks, `${`, quotes, newlines,
 * `</script>`). Babel then compiles the JSX inside the iframe itself.
 */
function utf8ToBase64(str: string): string {
  return window.btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
}

function buildSrcDoc(
  sourceCode: string,
  componentName: string,
  frameId: string,
  hideScrollbars: boolean,
): string {
  const b64 = utf8ToBase64(sourceCode)
  const hideCss = hideScrollbars
    ? ' *{scrollbar-width:none;-ms-overflow-style:none} *::-webkit-scrollbar{display:none;width:0;height:0}'
    : ''
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh}${hideCss}</style>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="mocky-b64">${b64}</script>
<script>
  (function () {
    var FID = ${JSON.stringify(frameId)};
    function post(type, extra) { var m = { __mocky: true, frameId: FID, type: type }; if (extra) { for (var k in extra) m[k] = extra[k]; } parent.postMessage(m, '*'); }
    function fail(msg) { post('error', { message: String(msg) }); return false; }
    window.onerror = function (msg, _src, line) { fail(String(msg) + (line ? ' (line ' + line + ')' : '')); return false; };
    var hooks = ['useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','useLayoutEffect','useImperativeHandle','useId','useTransition','createContext','memo','forwardRef','Fragment'];
    hooks.forEach(function (k) { if (React[k]) window[k] = React[k]; });
    try {
      var b64 = document.getElementById('mocky-b64').textContent;
      var raw = window.atob(b64);
      var src = decodeURIComponent(
        Array.prototype.map.call(raw, function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
      var out = Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
      // Inject the compiled JS as a new <script> element. textContent is not
      // HTML-parsed, so backticks and template literals in the compiled output
      // are preserved verbatim (unlike inline script bodies in the srcDoc).
      var scr = document.createElement('script');
      scr.textContent = out + ';ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ${JSON.stringify(componentName)} + '));';
      document.body.appendChild(scr);
      post('ok');
    } catch (e) {
      fail((e && e.message) ? e.message : e);
    }

    // --- Interaction bridge ---
    var mode = null, links = [], hl = null;
    function pickTarget(el) {
      var n = el;
      while (n && n.nodeType === 1 && n.tagName !== 'BODY') {
        var tag = n.tagName;
        if (tag === 'BUTTON' || tag === 'A' || (n.getAttribute && n.getAttribute('role') === 'button') || n.onclick) return n;
        n = n.parentNode;
      }
      return el;
    }
    function cssPath(el) {
      var parts = [];
      while (el && el.nodeType === 1 && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
        var p = el.parentNode; if (!p) break;
        var tag = el.tagName.toLowerCase();
        var same = []; for (var i = 0; i < p.children.length; i++) { if (p.children[i].tagName === el.tagName) same.push(p.children[i]); }
        parts.unshift(tag + ':nth-of-type(' + (same.indexOf(el) + 1) + ')');
        el = p;
      }
      return parts.length ? ('body > ' + parts.join(' > ')) : 'body';
    }
    function moveHl(el) {
      if (!hl) { hl = document.createElement('div'); hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #6366f1;background:rgba(99,102,241,0.18);border-radius:4px'; document.body.appendChild(hl); }
      var r = el.getBoundingClientRect();
      hl.style.display = 'block'; hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px'; hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
    }
    function hideHl() { if (hl) hl.style.display = 'none'; }
    document.addEventListener('mousemove', function (e) { if (mode === 'pick') moveHl(pickTarget(e.target)); }, true);
    document.addEventListener('click', function (e) {
      if (mode === 'pick') {
        e.preventDefault(); e.stopPropagation();
        var el = pickTarget(e.target), r = el.getBoundingClientRect(), vw = window.innerWidth || 1, vh = window.innerHeight || 1;
        var label = ((el.innerText || (el.getAttribute && el.getAttribute('aria-label')) || el.tagName || '') + '').replace(/\\s+/g, ' ').trim().slice(0, 40);
        post('picked', { selector: cssPath(el), label: label, rect: { x: r.left / vw, y: r.top / vh, w: r.width / vw, h: r.height / vh } });
        return false;
      }
      if (mode === 'demo') {
        for (var i = 0; i < links.length; i++) {
          var t = null; try { t = document.querySelector(links[i].selector); } catch (_) {}
          if (t && (t === e.target || t.contains(e.target))) { e.preventDefault(); e.stopPropagation(); post('navigate', { target: links[i].target }); return false; }
        }
      }
    }, true);
    function markLinks() { for (var i = 0; i < links.length; i++) { var el = null; try { el = document.querySelector(links[i].selector); } catch (_) {} if (el) el.style.cursor = 'pointer'; } }
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.__mockyCmd === 'pick') { if (d.on) { mode = 'pick'; } else if (mode === 'pick') { mode = null; hideHl(); } }
      if (d.__mockyCmd === 'demo') { mode = 'demo'; links = d.links || []; markLinks(); }
    });
  })();
</script>
</body>
</html>`
}

export interface CaptureRequest {
  id: string
  clientRect: { left: number; top: number; width: number; height: number }
}

export default function Preview({
  code,
  pickMode,
  onPick,
  demoLinks,
  onNavigate,
  hideScrollbars,
  radius,
  captureRequest,
  onCaptureRect,
}: {
  code: string
  pickMode?: boolean
  onPick?: (info: PickInfo) => void
  demoLinks?: DemoLink[]
  onNavigate?: (target: string) => void
  hideScrollbars?: boolean
  radius?: string
  captureRequest?: CaptureRequest | null
  onCaptureRect?: (id: string, rect: { x: number; y: number; w: number; h: number }) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const frameId = useState(() => 'f' + Math.random().toString(36).slice(2))[0]

  // Keep the latest callbacks in refs so the message listener doesn't need to
  // re-subscribe (and reset `ready`) every time the parent re-renders.
  const onPickRef = useRef(onPick)
  const onNavRef = useRef(onNavigate)
  const onCaptureRectRef = useRef(onCaptureRect)
  onPickRef.current = onPick
  onNavRef.current = onNavigate
  onCaptureRectRef.current = onCaptureRect

  // Transform the raw generated module into preview-ready source and pass the
  // JSX source (not pre-compiled JS) into the iframe. The iframe loads Babel
  // from CDN and compiles the code there, which avoids all srcDoc/escaping
  // edge cases around complex generated code.
  //
  // During streaming the code may be incomplete (and thus not valid JSX). We
  // debounce validation: only attempt to validate after the code has been
  // stable for 300ms. This avoids hammering Babel on every chunk and prevents
  // validation races that would leave the preview stuck.
  const [srcDoc, setSrcDoc] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  useEffect(() => {
    if (!code || !code.trim()) {
      setStreaming(true)
      setError(null)
      setReady(false)
      return
    }
    // Wait 300ms after the last change before validating. During streaming,
    // chunks arrive rapidly; this debounce ensures we only validate once the
    // code has settled (either the stream finished or there's a pause).
    const timer = setTimeout(() => {
      const previewCode = toPreviewModule(code)
      const name = detectComponentName(code)
      validateJsx(previewCode).then((err) => {
        if (err) {
          // Code is not valid yet (probably still streaming). Don't clobber
          // the existing preview; just mark that we're waiting for more.
          setStreaming(true)
          setError(null)
          setReady(false)
        } else {
          setStreaming(false)
          setError(null)
          setReady(false)
          setSrcDoc(buildSrcDoc(previewCode, name, frameId, !!hideScrollbars))
        }
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [code, frameId, hideScrollbars])

  useEffect(() => {
    setError(null)
    setReady(false)
    function onMsg(e: MessageEvent) {
      const d = e.data
      if (!d || !d.__mocky || d.frameId !== frameId) return
      if (d.type === 'error') setError(d.message)
      if (d.type === 'ok') {
        setError(null)
        setReady(true)
      }
      if (d.type === 'picked') onPickRef.current?.({ selector: d.selector, label: d.label, rect: d.rect })
      if (d.type === 'navigate') onNavRef.current?.(d.target)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [srcDoc, frameId])

  // When a capture is requested, translate the client-space rect into this
  // screen's viewport coordinates (handles the device-frame inset + zoom) and
  // hand it up — the actual snapshot happens in a same-origin capture iframe.
  useEffect(() => {
    if (!captureRequest) return
    const iframe = iframeRef.current
    if (!iframe) return
    const ir = iframe.getBoundingClientRect()
    const cr = captureRequest.clientRect
    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    onCaptureRectRef.current?.(captureRequest.id, {
      x: clamp((cr.left - ir.left) / ir.width),
      y: clamp((cr.top - ir.top) / ir.height),
      w: clamp(cr.width / ir.width),
      h: clamp(cr.height / ir.height),
    })
  }, [captureRequest])

  // Push interaction commands to the iframe once it is mounted.
  const demoKey = JSON.stringify(demoLinks || [])
  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win || !ready) return
    win.postMessage({ __mockyCmd: 'pick', on: !!pickMode }, '*')
    if (demoLinks && demoLinks.length) win.postMessage({ __mockyCmd: 'demo', links: demoLinks }, '*')
  }, [ready, pickMode, demoKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full bg-white" style={{ borderRadius: radius }}>
      {srcDoc && (
        <iframe
          ref={iframeRef}
          title="preview"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{ borderRadius: radius }}
        />
      )}
      {(!ready || streaming) && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white" style={{ borderRadius: radius }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          <span className="text-xs text-slate-400">{streaming ? 'Generating…' : 'Rendering…'}</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 bottom-0 max-h-[50%] overflow-auto border-t border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="mb-1 font-semibold">Runtime error in generated component</div>
          <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
        </div>
      )}
    </div>
  )
}
