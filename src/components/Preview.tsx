import { useEffect, useMemo, useRef, useState } from 'react'
import { detectComponentName, toPreviewModule } from '../lib/generate'
import { resolveCapabilities } from '../lib/capabilities/select'
import { buildPrelude } from '../lib/capabilities/prelude'
import type { Capability } from '../lib/capabilities/types'

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
  caps: Capability[] = [],
  generating: boolean = false,
): string {
  const b64 = utf8ToBase64(sourceCode)
  const hideCss = hideScrollbars
    ? ' *{scrollbar-width:none;-ms-overflow-style:none} *::-webkit-scrollbar{display:none;width:0;height:0}'
    : ''
  // Build CDN tags for selected capabilities. NO crossorigin attribute — the
  // iframe is sandboxed (allow-scripts only, no allow-same-origin), so its
  // origin is null. crossorigin would turn every script into a CORS request
  // with Origin: null, which the server doesn't handle → script load fails.
  const cdnScripts: string[] = []
  const cdnLinks: string[] = []
  const globalHoists: string[] = []
  const readinessChecks: string[] = []
  for (const cap of caps) {
    if (cap.kind === 'cdn-script' && cap.cdn) {
      cdnScripts.push(`<script src="${cap.cdn.url}"></script>`)
      if (cap.cdn.global) {
        if (cap.globals) {
          const names = cap.globals.map((g) => JSON.stringify(g))
          globalHoists.push(
            `if (window.${cap.cdn.global}) { [${names.join(',')}].forEach(function(k){ if (window.${cap.cdn.global}[k]) window[k] = window.${cap.cdn.global}[k]; }); }`,
          )
        }
        readinessChecks.push(
          `if (!need(${JSON.stringify(cap.cdn.global)})) { fail('Capability "${cap.id}" failed to load: window.${cap.cdn.global} is undefined (CDN script may have failed).'); return; }`,
        )
      }
    } else if (cap.kind === 'cdn-css' && cap.cdn) {
      cdnLinks.push(`<link rel="stylesheet" href="${cap.cdn.url}">`)
    }
  }
  // Build prelude source from snippet-pack caps
  const prelude = buildPrelude(caps)
  const preludeB64 = prelude ? utf8ToBase64(prelude) : ''

  // Dev diagnostic: only log when NOT generating (avoids console spam during streaming)
  const devErrorLog = generating
    ? ''
    : `try { console.error('[Mocky iframe error]', e && e.message ? e.message : e, e && e.stack ? e.stack : '', '\\n--- Source ---\\n', (preludeSrc || '') + src); } catch (_) {}`

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
${cdnLinks.join('\n')}
${cdnScripts.join('\n')}
<script src="/vendor/babel.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh}${hideCss}</style>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="mocky-b64">${b64}</script>
${preludeB64 ? `<script type="text/plain" id="mocky-prelude">${preludeB64}</script>` : ''}
<script>
  (function () {
    var FID = ${JSON.stringify(frameId)};
    function post(type, extra) { var m = { __mocky: true, frameId: FID, type: type }; if (extra) { for (var k in extra) m[k] = extra[k]; } parent.postMessage(m, '*'); }
    function fail(msg) { post('error', { message: String(msg) }); return false; }
    function need(name) { if (!window[name]) { return false; } return true; }
    // Last-resort net for errors that escape try/catch
    window.onerror = function (msg, src, line, col) { fail(String(msg) + (line ? ' (line ' + line + ', col ' + col + ')' : '')); return false; };
    window.addEventListener('unhandledrejection', function (e) { fail('Unhandled promise rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))); });
    // --- Core script load guards ---
    if (!need('React')) { fail('React failed to load from /vendor/react.production.min.js'); return; }
    if (!need('ReactDOM')) { fail('ReactDOM failed to load from /vendor/react-dom.production.min.js'); return; }
    if (!need('Babel')) { fail('Babel failed to load from /vendor/babel.min.js'); return; }
    var hooks = ['useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','useLayoutEffect','useImperativeHandle','useId','useTransition','createContext','memo','forwardRef','Fragment'];
    hooks.forEach(function (k) { if (React[k]) window[k] = React[k]; });
    ${globalHoists.join('\n    ')}
    try {
      // --- Capability readiness guard (CDN scripts only) ---
      ${readinessChecks.join('\n      ')}
      function decodeB64(id) {
        var raw = window.atob(document.getElementById(id).textContent);
        return decodeURIComponent(
          Array.prototype.map.call(raw, function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')
        );
      }
      var src = decodeB64('mocky-b64');
      var preludeSrc = '';
      var preEl = document.getElementById('mocky-prelude');
      if (preEl) preludeSrc = decodeB64('mocky-prelude');
      var combined = preludeSrc ? (preludeSrc + '\\n' + src) : src;
      var out = Babel.transform(combined, { presets: [['react', { runtime: 'classic' }]] }).code;
      var scr = document.createElement('script');
      scr.textContent = out + ';ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ${JSON.stringify(componentName)} + '));';
      document.body.appendChild(scr);
      post('ok');
    } catch (e) {
      // Dev: log the full source so the error line maps to something inspectable.
      // Only log when NOT generating — during streaming, transient errors from
      // incomplete code are expected and would spam the console.
      ${devErrorLog}
      var errMsg = e && e.message ? (e.message + '\\n' + (e.stack || '')) : String(e);
      fail(errMsg);
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
  onError,
  generating,
  caps,
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
  /** Called when the iframe reports a compile or runtime error (only when not generating). */
  onError?: (error: string) => void
  /** When true, the model is still streaming code. Shows a "Generating…" overlay and hides errors. */
  generating?: boolean
  /** Capability IDs to enable in the preview iframe (e.g. ['motion', 'magicui']). */
  caps?: string[]
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
  const onErrorRef = useRef(onError)
  onPickRef.current = onPick
  onNavRef.current = onNavigate
  onCaptureRectRef.current = onCaptureRect
  onErrorRef.current = onError

  // Build the iframe srcDoc from the generated code. We debounce 500ms so
  // rapid streaming chunks don't cause an iframe rebuild on every token. The
  // iframe's own Babel handles compilation — if the code is incomplete, the
  // iframe shows the error, but the spinner stays until a valid render ("ok"
  // message) arrives.
  //
  // A 15s timeout guards against iframes that never respond (e.g. Babel CDN
  // unreachable): instead of spinning forever, we show a timeout error.
  //
  // We track the code that was used to build the current srcDoc. If an error
  // arrives but the code has since changed (streaming in progress), the error
  // is from stale code and is ignored — only errors from the CURRENT code are
  // forwarded to the parent (for auto-retry).
  const [srcDoc, setSrcDoc] = useState<string | null>(null)
  const srcCodeRef = useRef<string>('')
  // Resolve caps once when they change, not on every code chunk
  const resolvedCaps = useMemo(
    () => (caps && caps.length ? resolveCapabilities(caps) : []),
    [caps && caps.join(',')],
  )
  useEffect(() => {
    if (!code || !code.trim()) return
    const timer = setTimeout(() => {
      const previewCode = toPreviewModule(code)
      const name = detectComponentName(code)
      srcCodeRef.current = code
      setSrcDoc(buildSrcDoc(previewCode, name, frameId, !!hideScrollbars, resolvedCaps, !!generating))
    }, 500)
    return () => clearTimeout(timer)
  }, [code, frameId, hideScrollbars, resolvedCaps])

  // Listen for messages from the iframe. The iframe posts 'ok' when the
  // component rendered successfully, or 'error' when Babel or the component
  // threw. We also set a 15s timeout: if no message arrives, show an error.
  useEffect(() => {
    if (!srcDoc) return
    setError(null)
    setReady(false)
    let timeoutHit = false
    const timeout = setTimeout(() => {
      if (!timeoutHit) {
        timeoutHit = true
        setError('Preview timed out — the component took too long to render.')
      }
    }, 15000)
    function onMsg(e: MessageEvent) {
      const d = e.data
      if (!d || !d.__mocky || d.frameId !== frameId) return
      if (d.type === 'error') {
        timeoutHit = true
        clearTimeout(timeout)
        // Ignore errors while generating — the code is incomplete.
        if (generating) return
        setError(d.message)
        // Only forward the error if the code hasn't changed since we built
        // the srcDoc. If it has, the error is from stale (incomplete) code
        // and the current code is probably still streaming.
        if (srcCodeRef.current === code) {
          onErrorRef.current?.(d.message)
        }
      }
      if (d.type === 'ok') {
        timeoutHit = true
        clearTimeout(timeout)
        setError(null)
        setReady(true)
      }
      if (d.type === 'picked') onPickRef.current?.({ selector: d.selector, label: d.label, rect: d.rect })
      if (d.type === 'navigate') onNavRef.current?.(d.target)
    }
    window.addEventListener('message', onMsg)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMsg)
    }
  }, [srcDoc, frameId, code, generating])

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
      {(generating || (!ready && !error)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white" style={{ borderRadius: radius }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          <span className="text-xs text-slate-400">{generating ? 'Generating…' : 'Rendering…'}</span>
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
