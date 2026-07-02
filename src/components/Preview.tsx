import { useEffect, useMemo, useRef, useState } from 'react'
import { detectComponentName, toPreviewModule } from '../lib/generate'

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
 * Builds a self-contained HTML document for the sandboxed iframe. Besides
 * compiling + mounting the component, it installs a small "interaction bridge"
 * that talks to the parent over postMessage:
 *   - pick mode: highlight hovered elements; on click, report a CSS selector
 *     for the element (so links can bind to real buttons, not rectangles).
 *   - demo mode: given [{selector, target}], clicking those elements asks the
 *     parent to navigate. Other elements keep their normal behaviour.
 * Every message carries `frameId` so multiple previews don't cross-talk.
 */
function buildSrcDoc(
  previewCode: string,
  componentName: string,
  frameId: string,
  hideScrollbars: boolean,
): string {
  const safe = previewCode.replace(/<\/script>/gi, '<\\/script>')
  const hideCss = hideScrollbars
    ? ' *{scrollbar-width:none;-ms-overflow-style:none} *::-webkit-scrollbar{display:none;width:0;height:0}'
    : ''
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh}${hideCss}</style>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="mocky-src">${safe}</script>
<script>
  (function () {
    var FID = ${JSON.stringify(frameId)};
    function post(type, extra) { var m = { __mocky: true, frameId: FID, type: type }; if (extra) { for (var k in extra) m[k] = extra[k]; } parent.postMessage(m, '*'); }
    function fail(msg) { post('error', { message: String(msg) }); }
    window.onerror = function (msg, _src, line) { fail(String(msg) + (line ? ' (line ' + line + ')' : '')); return false; };
    var hooks = ['useState','useEffect','useRef','useMemo','useCallback','useReducer','useContext','useLayoutEffect','useImperativeHandle','useId','useTransition','createContext','memo','forwardRef','Fragment'];
    hooks.forEach(function (k) { if (React[k]) window[k] = React[k]; });
    try {
      var src = document.getElementById('mocky-src').textContent;
      var out = Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
      var run = new Function('React', 'ReactDOM',
        out + '\\n;ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(' + ${JSON.stringify(componentName)} + '));');
      run(React, ReactDOM);
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

export default function Preview({
  code,
  pickMode,
  onPick,
  demoLinks,
  onNavigate,
  hideScrollbars,
  radius,
}: {
  code: string
  pickMode?: boolean
  onPick?: (info: PickInfo) => void
  demoLinks?: DemoLink[]
  onNavigate?: (target: string) => void
  hideScrollbars?: boolean
  radius?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const frameId = useState(() => 'f' + Math.random().toString(36).slice(2))[0]

  // Keep the latest callbacks in refs so the message listener doesn't need to
  // re-subscribe (and reset `ready`) every time the parent re-renders.
  const onPickRef = useRef(onPick)
  const onNavRef = useRef(onNavigate)
  onPickRef.current = onPick
  onNavRef.current = onNavigate

  const srcDoc = useMemo(() => {
    const previewCode = toPreviewModule(code)
    const name = detectComponentName(code)
    return buildSrcDoc(previewCode, name, frameId, !!hideScrollbars)
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
      <iframe
        ref={iframeRef}
        title="preview"
        className="h-full w-full border-0 bg-white"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ borderRadius: radius }}
      />
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white" style={{ borderRadius: radius }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          <span className="text-xs text-slate-400">Rendering…</span>
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
