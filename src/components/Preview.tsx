import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, MockyLoader, ScreenSkeleton } from '../ui'
import { useT } from '../i18n'
import { detectComponentName, toPreviewModule } from '../lib/generate'
import { resolveCapabilities } from '../lib/capabilities/select'
import { buildPrelude } from '../lib/capabilities/prelude'
import type { Capability } from '../lib/capabilities/types'
import { DOC_PAGES_MESSAGE } from '../lib/pageFormats'
import { flowStateScript } from '../lib/flows'
import { fontFaceCssFor } from '../lib/fonts'
import { PICK_SOURCE_PLUGIN, readMoveRequest, readPickedSource, type MoveRequest, type PickedSource } from '../lib/screenElements'

export interface PickInfo {
  selector: string
  label: string
  rect: { x: number; y: number; w: number; h: number }
  /** Lowercase tag name of the picked element (e.g. 'button', 'div'). */
  tag?: string
  /** The element's literal class attribute — Tailwind classes here match the JSX verbatim, so it's the strongest anchor for a targeted edit. */
  className?: string
  /** Which JSX this is, from the element up (lib/screenElements.ts). */
  source?: PickedSource[]
  /** Shift, Ctrl or Cmd was held: add to the selection rather than open the element. */
  additive?: boolean
}
export interface DemoLink {
  selector: string
  target: string
}
/**
 * One element a sweep found — everything a user could link FROM.
 *
 * `href` is what a manual pick throws away and what makes automatic linking
 * possible at all: the model wrote `<a href="/tarifs">`, and that is it saying
 * where the link goes.
 */
export interface SweptElement {
  selector: string
  label: string
  href?: string
  rect: { x: number; y: number; w: number; h: number }
}

/**
 * Content-Security-Policy for the preview document.
 *
 * The iframe is sandboxed with `allow-scripts` and no `allow-same-origin`, which
 * gives it an opaque origin — no localStorage, no cookies, no parent DOM. What
 * that does NOT restrict is outbound traffic: a generated component could
 * `fetch()`, `sendBeacon()` or `new Image().src = …` to any host on the
 * internet, from the user's own IP, on every render. It could also navigate
 * itself to an arbitrary page, which would then occupy the whole frame inside
 * Mocky's device chrome.
 *
 * So the genuinely dangerous verbs are denied outright:
 *   connect-src 'none'  — no fetch / XHR / WebSocket / sendBeacon
 *   form-action 'none'  — nowhere to post
 *   frame-src   'none'  — no nested frames
 *   object-src  'none'  — no plugins
 *   base-uri    'none'  — cannot rewrite relative URL resolution
 *
 * `img-src` stays permissive on purpose. A remote image is a weak tracking
 * vector, but it is also how a mockup shows a photo, and models legitimately
 * emit picture URLs; blocking it would break real screens to close a small hole.
 *
 * `media-src` does NOT follow it, and names this origin instead. It exists so a
 * rendered Motion film can play inside a mockup — without it a `<video>` falls
 * back to `default-src 'none'` and is blocked outright, which is why a hero
 * composed around a film came back empty. Narrow rather than permissive because
 * the argument that saves `img-src` does not transfer: a remote video is a
 * megabyte of somebody else's bandwidth autoplaying inside the tool a design is
 * being judged in, and no model needs to emit one.
 *
 * 'unsafe-inline' and 'unsafe-eval' are unavoidable here: the whole point of the
 * document is to run code Babel compiles at runtime, and Tailwind's Play build
 * evaluates the class scanner in-browser. `blob:` covers the compiled module,
 * which is injected as a Blob URL script.
 */
/**
 * Pins the preview's Tailwind to the same settings the exported project uses.
 *
 * Play CDN defaults to `darkMode: 'media'`, so a `dark:` class in a generated
 * screen followed the VIEWER'S operating-system preference. Two consequences,
 * both wrong for a tool whose job is judging screens: the same mockup rendered
 * differently on two machines, and it disagreed with its own export, which sets
 * `darkMode: ['class']` (src/lib/export/project.ts). A mockup's appearance must
 * come from the mockup — never from the room it is being looked at in.
 *
 * `class` and no `.dark` ancestor means the light branch always wins here. A
 * screen that wants to be dark says so in its own classes, and still does.
 */
const TAILWIND_DETERMINISTIC_CONFIG = `<script>
  try { tailwind.config = { darkMode: 'class' } } catch (e) {}
</script>`

function cspMeta(): string {
  // NOT 'self'. This document is sandboxed without allow-same-origin, so its
  // origin is opaque and 'self' serialises to "null" — it would match nothing,
  // and the vendored React/Babel/Tailwind scripts would all be blocked. The
  // parent's origin has to be named explicitly.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const policy = [
    "default-src 'none'",
    `script-src ${origin} 'unsafe-inline' 'unsafe-eval' blob:`,
    // No external host: daisyUI is vendored too, so the preview loads nothing
    // from the network at all and works offline.
    `style-src ${origin} 'unsafe-inline'`,
    'img-src * data: blob:',
    // Motion films, and NOTHING else. Named origin rather than the `*` img-src
    // carries, and the asymmetry is deliberate: a remote image is how a mockup
    // shows a photo, while a remote video is a megabyte of somebody else's
    // bandwidth playing inside a tool the user is trying to judge a design in.
    // Mocky's own films are served from this origin by hash — see the mount in
    // server/index.js — so naming the origin is the whole permission.
    `media-src ${origin}`,
    // Mocky's own /fonts are what a screen is meant to use (lib/fonts), and
    // they are on this origin; `*` stays for the same reason img-src's does —
    // a font is a weak beacon, and refusing one breaks a screen to close nothing.
    'font-src * data:',
    "connect-src 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')
  return `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
}

/**
 * Builds a self-contained HTML document for the sandboxed iframe. React,
 * ReactDOM, Babel and Tailwind are all served locally from public/vendor/
 * (never a CDN), so a CDN compromise can't reach the iframe and previews work
 * offline. The JSX is compiled INSIDE the iframe by that vendored Babel.
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

/**
 * A screen's preview document on its own — the exact srcDoc this component
 * builds, for a caller that serves it at a real URL instead: the MCP live view
 * (server/mcp/view.js), where an assistant's conversation shows the screen
 * moving and clickable. Served under `Content-Security-Policy: sandbox
 * allow-scripts`, it gets the opaque origin the iframe's `sandbox` attribute
 * gives it here, and its own policy below rather than an inherited one.
 */
export function previewDocument(code: string, caps: string[], opts: { frameId: string; animations?: boolean }): string {
  return buildSrcDoc(
    toPreviewModule(code),
    detectComponentName(code),
    opts.frameId,
    false,
    caps.length ? resolveCapabilities(caps) : [],
    false,
    opts.animations !== false,
  )
}

function buildSrcDoc(
  sourceCode: string,
  componentName: string,
  frameId: string,
  hideScrollbars: boolean,
  caps: Capability[] = [],
  generating: boolean = false,
  /**
   * "Sans animation" holds ALREADY GENERATED screens still too.
   *
   * The switch decides which capabilities a new screen gets, but a screen that
   * already has `<Animated>` baked into its code would have kept moving — the
   * button says "no animation" and the mockup animates. Dropping the capability
   * at render instead would leave `<Animated>` undefined and crash the screen,
   * so the flag is passed INTO the frame and the component reads it, exactly
   * like it already reads prefers-reduced-motion.
   */
  animations: boolean = true,
  /**
   * A working prototype's shared data, as an escaped JSON literal
   * (`flowStateScript`), for the frame to start with (snippets/Flow.ts).
   * Absent on every preview that is not part of a demo, which therefore gets
   * the document it always got.
   */
  flowInit?: string,
): string {
  const b64 = utf8ToBase64(sourceCode)
  const hideCss = hideScrollbars
    ? ' *{scrollbar-width:none;-ms-overflow-style:none} *::-webkit-scrollbar{display:none;width:0;height:0}'
    : ''

  /*
   * "Sans animation", for everything — not just <Animated>.
   *
   * The flag below tells <Animated> to skip its entrance, and that is all it
   * can do: a screen that animates with a Tailwind `animate-*` class, a
   * hand-written @keyframes, a CSS transition, or the retired motion pack keeps
   * moving, and the switch looks broken because from the user's side it IS.
   *
   * Animations are RUN TO COMPLETION rather than removed. `animation: none` on
   * a fade-in whose resting state is `opacity: 0` leaves the content
   * permanently invisible — a blank mockup instead of a still one. Collapsing
   * the duration and forcing the final frame is the same recipe Mocky's own
   * stylesheet uses for prefers-reduced-motion, for exactly this reason.
   */
  const stillCss = animations
    ? ''
    : ' *,*::before,*::after{animation-duration:0.01ms !important;animation-delay:0ms !important;' +
      'animation-iteration-count:1 !important;animation-fill-mode:forwards !important;' +
      'transition-duration:0.01ms !important;transition-delay:0ms !important;' +
      'scroll-behavior:auto !important}'
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

  /*
   * The typefaces this screen NAMES, declared from Mocky's own /fonts — see
   * lib/fonts. A screen that names none gets no <style> and no extra report, so
   * its document is the one it always was.
   *
   * The second size report is for the same screen: with font-display: block,
   * text is laid out in the fallback's metrics until the face arrives, and the
   * 80 ms report measured THAT page — a headline in a narrower display face
   * wraps differently, and the canvas sized the frame for lines that no longer
   * exist.
   */
  const fontCss = fontFaceCssFor(sourceCode, typeof window !== 'undefined' ? window.location.origin : '')
  const fontStyle = fontCss ? `<style data-mocky-fonts>${fontCss}</style>` : ''
  const fontSizeReport = fontCss
    ? 'try{if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){if(!self.__f){window.__mockyPost("size",{height:Math.ceil(document.documentElement.scrollHeight)});}});}}catch(e){}'
    : ''

  // Dev diagnostic: only log when NOT generating (avoids console spam during
  // streaming). Log the MESSAGE only — dumping the full prelude + component
  // source made the console unreadable (thousands of lines of icon defs per
  // error). The real source is one click away in the Code view.
  const devErrorLog = generating
    ? ''
    : `try { console.error('[Mocky iframe error]', e && e.message ? e.message : e); } catch (_) {}`

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${cspMeta()}
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="/vendor/tailwind.min.js"></script>
${TAILWIND_DETERMINISTIC_CONFIG}
${cdnLinks.join('\n')}
${cdnScripts.join('\n')}
<script src="/vendor/babel.min.js"></script>
<style>html,body{margin:0;padding:0}#root{min-height:100vh}${hideCss}${stillCss}</style>
${fontStyle}
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
    // Read by <Animated> — see the note on buildSrcDoc's animations argument.
    window.__mockyAnimations = ${animations ? 'true' : 'false'};
    ${flowInit !== undefined ? `window.__mockyFlowInit = ${flowInit};` : ''}
    ${globalHoists.join('\n    ')}
    // A mockup must never leave its own document. The click guard further down
    // stops <a href> navigations, but a generated component can also call
    // window.open(...) — which in a sandbox without allow-popups either opens a
    // real tab or, with a "_self"-ish target, replaces the frame. Either way the
    // mockup is gone. Neutralise it before any generated code runs.
    // window.location is deliberately NOT touched: it is a non-configurable
    // accessor, so redefining it throws and would take the whole bridge down.
    // Programmatic location writes are caught by the parent's load-count net.
    try { window.open = function () { return null; }; } catch (_) {}
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
      // Tagged with each element's rank in the source, so a click can say which
      // JSX it was (lib/screenElements.ts). A helper, never a reason to lose the
      // screen: if it fails, the page compiles as it always did.
      var out;
      try { out = Babel.transform(combined, { presets: [['react', { runtime: 'classic' }]], plugins: [(${PICK_SOURCE_PLUGIN})(preludeSrc ? preludeSrc.length + 1 : 0)] }).code; }
      catch (_) { out = Babel.transform(combined, { presets: [['react', { runtime: 'classic' }]] }).code; }
      // Execute the compiled JS via a Blob URL. This avoids DOM-insertion
      // quirks (textContent) and gives real error locations. Blob URLs are
      // same-origin to the iframe's null origin — no CORS needed (invariant 2).
      //
      // The blob runs as a separate <script> in the iframe's GLOBAL scope, so it
      // cannot see post/fail (which live in this IIFE closure). Expose them on
      // window under mocky-namespaced names so the render wrapper can report to
      // the parent from inside the blob.
      window.__mockyPost = post; window.__mockyFail = fail;
      // Mount the component inside a React error boundary. createRoot renders
      // ASYNCHRONOUSLY, so a render/runtime error is thrown after this script's
      // synchronous try/catch has already returned — it would otherwise escape
      // to window.onerror as an opaque "Script error." with no detail (blob:null
      // origin). The boundary catches it WITH the real message + component stack
      // and posts it to the parent (feeding the error box AND fixComponent). It
      // only ever fires on real errors — valid code mounts and posts "ok"
      // (invariant 5: never blocks valid code).
      var renderCode = out + '\\n;(function(){function EB(p){React.Component.call(this,p);this.state={f:0};this.__f=0;}EB.prototype=Object.create(React.Component.prototype);EB.getDerivedStateFromError=function(){return {f:1};};EB.prototype.componentDidCatch=function(e,info){this.__f=1;var m=(e&&e.message?e.message:String(e));if(/Minified React error #130/.test(m)){m="Element type is invalid (React #130): a component or icon you rendered is undefined — likely a missing or misspelled name (e.g. an icon not in the Icon set). "+m;}if(info&&info.componentStack){m+=info.componentStack;}window.__mockyFail(m);};EB.prototype.componentDidMount=function(){var self=this;Promise.resolve().then(function(){if(!self.__f){window.__mockyPost("ok");setTimeout(function(){try{window.__mockyPost("size",{height:Math.ceil(document.documentElement.scrollHeight)});}catch(e){}},80);${fontSizeReport}}});};EB.prototype.render=function(){return this.state.f?null:this.props.children;};try{ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(EB,null,React.createElement(' + ${JSON.stringify(componentName)} + ')));}catch(re){window.__mockyFail(re&&re.message?re.message:String(re));}})();';
      var blob = new Blob([renderCode], { type: 'text/javascript' });
      var blobUrl = URL.createObjectURL(blob);
      var scr = document.createElement('script');
      scr.src = blobUrl;
      scr.onload = function() { URL.revokeObjectURL(blobUrl); };
      scr.onerror = function() { URL.revokeObjectURL(blobUrl); fail('Failed to execute compiled module (blob URL script error)'); };
      document.body.appendChild(scr);
    } catch (e) {
      // Dev: log the full source so the error line maps to something inspectable.
      // Only log when NOT generating — during streaming, transient errors from
      // incomplete code are expected and would spam the console.
      ${devErrorLog}
      var errMsg = e && e.message ? (e.message + '\\n' + (e.stack || '')) : String(e);
      fail(errMsg);
    }

    // --- Interaction bridge ---
    var mode = null, links = [], hl = null, pickFill = true, pickPrecise = false;
    function pickTarget(el) {
      // Modify mode wants the exact element under the cursor. Link mode walks up
      // to the nearest interactive ancestor (you link the whole button/anchor).
      if (pickPrecise) return el;
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
    /*
     * Every element a user could sensibly link FROM.
     *
     * The same notion of "interactive" pickTarget already uses, inverted: it
     * walks up from one element, this walks down over all of them. It has to
     * live in here because a usable selector only exists in the rendered tree —
     * cssPath counts nth-of-type positions, and .map() loops, conditionals and
     * the capability prelude all shift those, so no amount of reading the source
     * could mint one.
     *
     * The href is the point of the exercise. The model routinely writes
     * <a href="/tarifs">, this document neuters it at click time, and a manual
     * pick throws it away — yet it is the model stating where that link goes.
     *
     * No backticks anywhere in here: this whole script is inside a template
     * literal, and one would close it.
     */
    function sweepLinkables() {
      var found = [], seen = [];
      var nodes = document.querySelectorAll('button, a[href], [role="button"], [onclick]');
      var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
      for (var i = 0; i < nodes.length && found.length < 60; i++) {
        var el = nodes[i];
        var r = el.getBoundingClientRect();
        // Zero-sized means hidden, collapsed, or inside a closed menu — not
        // something the user can click, so not something to offer them.
        if (r.width < 4 || r.height < 4) continue;
        // A button inside an anchor is one control, and the outer one is what a
        // person would say they clicked.
        var nested = false;
        for (var j = 0; j < seen.length; j++) { if (seen[j].contains(el)) { nested = true; break; } }
        if (nested) continue;
        seen.push(el);
        var label = ((el.innerText || (el.getAttribute && el.getAttribute('aria-label')) || '') + '')
          .replace(/\\s+/g, ' ').trim().slice(0, 60);
        var href = (el.getAttribute && el.getAttribute('href')) || '';
        if (!label && !href) continue;
        found.push({
          selector: cssPath(el),
          label: label,
          href: href,
          rect: { x: r.left / vw, y: r.top / vh, w: r.width / vw, h: r.height / vh },
        });
      }
      return found;
    }
    function moveHl(el) {
      if (!hl) { hl = document.createElement('div'); hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border-radius:4px'; document.body.appendChild(hl); }
      // Link mode uses a violet fill; Modify mode a fuchsia outline only (no
      // tint over the screen — a big container would otherwise look filtered).
      hl.style.border = pickFill ? '2px solid #6366f1' : '2px solid #d946ef';
      hl.style.background = pickFill ? 'rgba(99,102,241,0.18)' : 'transparent';
      var r = el.getBoundingClientRect();
      hl.style.display = 'block'; hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px'; hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
    }
    function hideHl() { if (hl) hl.style.display = 'none'; }
    /*
     * Which JSX this element is, read up React's own tree: every fiber keeps the
     * props it was made with, so a component's use is found even though it never
     * reaches the DOM. Works on the production build, and reads nothing else.
     */
    function sourceChain(el) {
      var key = null;
      for (var k in el) { if (k.indexOf('__reactFiber$') === 0) { key = k; break; } }
      if (!key) return [];
      var out = [], f = el[key];
      while (f && out.length < 32) {
        var s = f.memoizedProps && f.memoizedProps['data-mocky-src'];
        if (s != null) out.push({ rank: Number(s), index: f.index || 0 });
        f = f.return;
      }
      return out;
    }
    // On the elements themselves, so a mark follows the page when it scrolls.
    var marked = [];
    function setMarks(selectors) {
      for (var i = 0; i < marked.length; i++) { marked[i].style.outline = ''; marked[i].style.outlineOffset = ''; }
      marked = [];
      var info = [];
      for (var j = 0; j < selectors.length; j++) {
        var el = null; try { el = document.querySelector(selectors[j]); } catch (_) {}
        if (el) { el.style.outline = '2px solid #d946ef'; el.style.outlineOffset = '1px'; marked.push(el); info.push({ selector: selectors[j], source: sourceChain(el) }); }
      }
      // A selection outlives the document it was made in: after a move the
      // screen is a new document, and the chains the parent holds name the old
      // one. These are the chains of what is outlined NOW.
      if (info.length && mode === 'pick') post('marks', { items: info });
    }
    /*
     * Moving an element by dragging it (lib/screenElements.ts, planMove).
     *
     * Only what the DOM knows is decided here — which sibling, which side,
     * which grid cell — and only chains travel, never offsets: the parent
     * resolves both ends on the stored code and refuses what it cannot write.
     * A press that does not travel stays a click, so picking is unchanged.
     * The dragged element is the selected one when the press lands inside it;
     * otherwise the hovered one, or its nearest ancestor that HAS siblings — an
     * only child has nowhere to go, and a press on a card's text means the card.
     */
    var pickMove = false, press = null, drag = null, dropHl = null, pressDragged = false, swallowClick = false;
    function siblingsOf(el) {
      var p = el.parentElement, out = [];
      if (!p) return out;
      for (var i = 0; i < p.children.length; i++) {
        var c = p.children[i];
        if (c === el || c === hl || c === dropHl || /^(SCRIPT|STYLE|TEMPLATE|LINK|META)$/.test(c.tagName)) continue;
        var r = c.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) out.push(c);
      }
      return out;
    }
    function dragSource(el) {
      for (var i = 0; i < marked.length; i++) { if (marked[i] === el || marked[i].contains(el)) return marked[i]; }
      var n = pickTarget(el);
      while (n && n.parentElement && n.parentElement !== document.body && !siblingsOf(n).length) n = n.parentElement;
      if (!n || !n.parentElement || n.parentElement === document.body || !siblingsOf(n).length) return null;
      return sourceChain(n).length ? n : null;
    }
    // Grid tracks as the browser resolved them: px sizes, line names dropped.
    function tracks(v) {
      var out = [], parts = String(v || '').replace(/\\[[^\\]]*\\]/g, ' ').trim().split(/\\s+/);
      for (var i = 0; i < parts.length; i++) { var n = parseFloat(parts[i]); if (n > 0) out.push(n); }
      return out;
    }
    function gridOf(p) {
      var cs = getComputedStyle(p);
      if (cs.display.indexOf('grid') < 0) return null;
      var cols = tracks(cs.gridTemplateColumns), rows = tracks(cs.gridTemplateRows);
      if (!cols.length || !rows.length) return null;
      var r = p.getBoundingClientRect();
      return { cols: cols, rows: rows, cg: parseFloat(cs.columnGap) || 0, rg: parseFloat(cs.rowGap) || 0,
        x: r.left + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0) - p.scrollLeft,
        y: r.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0) - p.scrollTop };
    }
    function trackAt(list, g, s, v) { for (var i = 0; i < list.length; i++) { if (v >= s && v < s + list[i]) return i + 1; s += list[i] + g; } return 0; }
    function trackEdge(list, g, s, i, end) { for (var k = 0; k < i - 1; k++) s += list[k] + g; return end ? s + list[i - 1] : s; }
    // How many tracks the element covers: those whose middle it contains.
    function spanOf(list, g, s, a, b) { var n = 0; for (var i = 0; i < list.length; i++) { var c = s + list[i] / 2; if (c >= a && c <= b) n++; s += list[i] + g; } return n || 1; }
    function showDrop(x, y, w, h, cell) {
      if (!dropHl) { dropHl = document.createElement('div'); dropHl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border-radius:3px;box-sizing:border-box'; document.body.appendChild(dropHl); }
      dropHl.style.background = cell ? 'rgba(217,70,239,0.14)' : '#d946ef';
      dropHl.style.border = cell ? '2px dashed #d946ef' : 'none';
      dropHl.style.display = 'block'; dropHl.style.left = x + 'px'; dropHl.style.top = y + 'px'; dropHl.style.width = w + 'px'; dropHl.style.height = h + 'px';
    }
    function hideDrop() { if (dropHl) dropHl.style.display = 'none'; }
    function startDrag() {
      var el = dragSource(press.target);
      press = null;
      if (!el) return;
      var p = el.parentElement, g = gridOf(p), cs = getComputedStyle(p), axis = 'y', rev = false, r = el.getBoundingClientRect();
      if (g) axis = cs.gridAutoFlow.indexOf('column') >= 0 ? 'y' : 'x';
      else if (cs.display.indexOf('flex') >= 0) { axis = cs.flexDirection.indexOf('row') === 0 ? 'x' : 'y'; rev = cs.flexDirection.indexOf('reverse') > 0; }
      else if (getComputedStyle(el).display.indexOf('inline') === 0) axis = 'x';
      drag = { el: el, sibs: siblingsOf(el), grid: g, axis: axis, rev: rev, to: null, before: false, cell: null,
        opacity: el.style.opacity, select: document.documentElement.style.userSelect,
        cs: g ? spanOf(g.cols, g.cg, g.x, r.left, r.right) : 1, rs: g ? spanOf(g.rows, g.rg, g.y, r.top, r.bottom) : 1 };
      pressDragged = true;
      el.style.opacity = '0.45';
      document.documentElement.style.userSelect = 'none';
      try { window.getSelection().removeAllRanges(); } catch (_) {}
      hideHl();
    }
    function endDrag() {
      if (!drag) return;
      drag.el.style.opacity = drag.opacity;
      document.documentElement.style.userSelect = drag.select;
      hideDrop();
      drag = null;
    }
    // Where a drop at (x, y) would go: a grid cell nothing occupies, or a side of the nearest sibling.
    function aim(x, y) {
      drag.to = null; drag.cell = null;
      var self = drag.el.getBoundingClientRect();
      if (x >= self.left && x <= self.right && y >= self.top && y <= self.bottom) { hideDrop(); return; }
      var near = null, best = Infinity;
      for (var i = 0; i < drag.sibs.length; i++) {
        var r = drag.sibs[i].getBoundingClientRect();
        var dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0, dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        if (dx * dx + dy * dy < best) { best = dx * dx + dy * dy; near = { el: drag.sibs[i], r: r }; }
      }
      var g = drag.grid;
      if (g && best > 0) {
        var col = trackAt(g.cols, g.cg, g.x, x), row = trackAt(g.rows, g.rg, g.y, y);
        if (col && row) {
          col = Math.max(1, Math.min(col, g.cols.length - drag.cs + 1));
          var c2 = Math.min(col + drag.cs - 1, g.cols.length), r2 = Math.min(row + drag.rs - 1, g.rows.length);
          var x0 = trackEdge(g.cols, g.cg, g.x, col, false), y0 = trackEdge(g.rows, g.rg, g.y, row, false);
          drag.cell = { col: col, row: row, colSpan: drag.cs, rowSpan: drag.rs };
          showDrop(x0, y0, trackEdge(g.cols, g.cg, g.x, c2, true) - x0, trackEdge(g.rows, g.rg, g.y, r2, true) - y0, true);
          return;
        }
      }
      if (!near) { hideDrop(); return; }
      var b = near.r, mid = drag.axis === 'x' ? x < b.left + b.width / 2 : y < b.top + b.height / 2;
      drag.to = near.el; drag.before = drag.rev ? !mid : mid;
      if (drag.axis === 'x') showDrop(mid ? b.left - 2 : b.right - 1, b.top, 3, b.height, false);
      else showDrop(b.left, mid ? b.top - 2 : b.bottom - 1, b.width, 3, false);
    }
    // What the element's selector will be once the screen has re-rendered with it there.
    function selectorAfter(el, to, before) {
      var p = el.parentNode, next = el.nextSibling, out = '';
      try { p.insertBefore(el, before ? to : to.nextSibling); out = cssPath(el); } catch (_) {}
      try { p.insertBefore(el, next); } catch (_) {}
      return out;
    }
    function postMove(el, to, before, cell, byKey) {
      var from = sourceChain(el);
      if (!from.length) return;
      var m = { selector: cssPath(el), from: from, step: !!byKey };
      if (cell) { m.grid = cell; m.after = m.selector; }
      else { m.to = sourceChain(to); m.before = !!before; m.after = selectorAfter(el, to, before); }
      post('move', m);
    }
    // Alt+Arrow: the one selected element, one sibling over.
    function step(delta) {
      if (marked.length !== 1) return;
      var el = marked[0], sibs = siblingsOf(el), p = el.parentElement, all = [];
      if (!p) return;
      for (var i = 0; i < p.children.length; i++) { var c = p.children[i]; if (c === el || sibs.indexOf(c) >= 0) all.push(c); }
      var to = all[all.indexOf(el) + delta];
      if (to) postMove(el, to, delta < 0, null, true);
    }
    document.addEventListener('keydown', function (e) {
      if (mode !== 'pick') return;
      if (drag && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endDrag(); return; }
      if (pickMove && e.altKey && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
        e.preventDefault(); step(e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1); return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Escape') return;
      e.preventDefault(); post('pick-key', { key: e.key });
    }, true);
    document.addEventListener('mousedown', function (e) {
      press = null; pressDragged = false;
      if (mode !== 'pick' || !pickMove || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
      press = { x: e.clientX, y: e.clientY, target: e.target };
    }, true);
    // An image or a link would start the browser's own drag and eat the gesture.
    document.addEventListener('dragstart', function (e) { if (mode === 'pick') e.preventDefault(); }, true);
    document.addEventListener('mousemove', function (e) {
      if (mode !== 'pick') return;
      // Released outside the frame: no mouseup ever arrives in here.
      if (drag && !(e.buttons & 1)) { endDrag(); return; }
      if (press && !drag) {
        if (!(e.buttons & 1)) press = null;
        else if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 6) startDrag();
      }
      if (drag) { e.preventDefault(); aim(e.clientX, e.clientY); return; }
      moveHl(pickTarget(e.target));
    }, true);
    document.addEventListener('mouseup', function () {
      press = null;
      if (pressDragged) { swallowClick = true; setTimeout(function () { swallowClick = false; }, 0); }
      if (!drag) return;
      var d = drag;
      endDrag();
      if (d.cell) postMove(d.el, null, false, d.cell, false);
      else if (d.to) postMove(d.el, d.to, d.before, null, false);
    }, true);
    document.addEventListener('click', function (e) {
      if (mode === 'pick' && swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return false; }
      if (mode === 'pick') {
        e.preventDefault(); e.stopPropagation();
        var el = pickTarget(e.target), r = el.getBoundingClientRect(), vw = window.innerWidth || 1, vh = window.innerHeight || 1;
        var label = ((el.innerText || (el.getAttribute && el.getAttribute('aria-label')) || el.tagName || '') + '').replace(/\\s+/g, ' ').trim().slice(0, 40);
        var cls = ((el.getAttribute && el.getAttribute('class')) || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
        post('picked', { selector: cssPath(el), label: label, tag: (el.tagName || '').toLowerCase(), className: cls, rect: { x: r.left / vw, y: r.top / vh, w: r.width / vw, h: r.height / vh }, source: sourceChain(el), additive: !!(e.shiftKey || e.ctrlKey || e.metaKey) });
        return false;
      }
      if (mode === 'demo') {
        for (var i = 0; i < links.length; i++) {
          var t = null; try { t = document.querySelector(links[i].selector); } catch (_) {}
          if (t && (t === e.target || t.contains(e.target))) { e.preventDefault(); e.stopPropagation(); post('navigate', { target: links[i].target }); return false; }
        }
      }
      // A mockup is a picture of a page, not a page. Generated screens routinely
      // contain <a href="/">, <a href="/pricing"> and the like; clicking one in
      // Interact mode navigated THIS frame away from the mockup and loaded
      // Mocky's own index.html into it. Because the frame is sandboxed to an
      // opaque origin, every module script of the app then failed CORS and
      // filled the console — while the screen the user had just generated was
      // simply gone. Links stay clickable (hover, focus and :active still run);
      // they just never navigate.
      //
      // <area href> is included because an image map is a navigation source too,
      // and closest('a[href]') never matches an <area> (it is not an <a>).
      //
      // What this guard cannot see: an <a> with no href whose onClick assigns
      // location, or any other programmatic navigation. That is expected — the
      // parent counts the frame's load events and restores the mockup.
      var a = e.target && e.target.closest ? e.target.closest('a[href], area[href]') : null;
      if (a) {
        var href = a.getAttribute('href') || '';
        // EVERY href is stopped, fragments included.
        //
        // "#pricing" looks like an in-page anchor and was let through on that
        // basis. It is not one here: a srcdoc document inherits the PARENT's
        // URL as its base, so the browser resolves "#pricing" to
        // http://localhost:8787/#pricing — a different document — and navigates
        // the frame to Mocky's own app. Sandboxed to an opaque origin, the app
        // then fails CORS on its own stylesheet and module script, twice each,
        // and the mockup is gone. That is the flood of "from origin 'null' has
        // been blocked by CORS policy" in the console.
        e.preventDefault();
        // The scroll a fragment was meant to perform, done by hand so anchor
        // links in a long generated page still behave like anchor links.
        if (href.length > 1 && href.charAt(0) === '#') {
          var id = href.slice(1), t2 = null;
          try { t2 = document.getElementById(id); } catch (_) {}
          if (!t2) { try { t2 = document.getElementsByName(id)[0] || null; } catch (_) {} }
          if (t2 && t2.scrollIntoView) { t2.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          // A fragment naming nothing used to do nothing, silently, and looked
          // exactly like a broken link in a broken preview. The model writes
          // these itself — a nav pointing at "#features" over a page whose
          // section is "#feature-grid" — so say which anchor is missing rather
          // than leaving the click unexplained.
          else { post('anchor-missing', { anchor: id }); }
        }
      }
    }, true);
    // A generated <form> with no action submits to the document URL — which,
    // for the same base-URL reason, is Mocky's own page. Same navigation, same
    // console flood, from a control nobody thinks of as a link.
    document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    // And with no allow-forms in the sandbox — which this frame does not have,
    // on purpose — the browser refuses a submission BEFORE it fires the submit
    // event: a generated <form onSubmit> never ran, so a sign-in form was a
    // picture of one and a working prototype could not exist. The two gestures
    // that submit a form, a submit button and Enter in a field, fire the event
    // by hand instead. Nothing is ever sent: the listener above still prevents
    // the default, and the sandbox would refuse it anyway. In the bubble phase,
    // after React's own handlers, so a button whose onClick prevents the
    // default keeps its own meaning.
    function fireSubmit(f, by) {
      var ev;
      try { ev = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: by || null }); }
      catch (_) { ev = new Event('submit', { bubbles: true, cancelable: true }); }
      f.dispatchEvent(ev);
    }
    function validates(f, by) {
      if (f.noValidate || (by && by.formNoValidate)) return true;
      try { return f.reportValidity ? f.reportValidity() : true; } catch (_) { return true; }
    }
    document.addEventListener('click', function (e) {
      if (mode === 'pick' || e.defaultPrevented) return;
      var b = e.target && e.target.closest ? e.target.closest('button, input[type="submit"], input[type="image"]') : null;
      if (!b || !b.form || b.disabled) return;
      var type = (b.getAttribute('type') || (b.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
      if (type !== 'submit' && type !== 'image') return;
      e.preventDefault();
      if (validates(b.form, b)) fireSubmit(b.form, b);
    });
    document.addEventListener('keydown', function (e) {
      if (mode === 'pick' || e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
      var t = e.target;
      if (!t || t.tagName !== 'INPUT' || !t.form) return;
      if (/^(checkbox|radio|button|submit|reset|file|image|range|color)$/.test((t.type || 'text').toLowerCase())) return;
      e.preventDefault();
      if (validates(t.form)) fireSubmit(t.form);
    });
    function markLinks() { for (var i = 0; i < links.length; i++) { var el = null; try { el = document.querySelector(links[i].selector); } catch (_) {} if (el) el.style.cursor = 'pointer'; } }
    window.addEventListener('message', function (e) {
      // Only Mocky itself may command this frame. parent.frames[i] is reachable
      // cross-origin, so without this a generated screen could force a SIBLING
      // preview into demo mode with links of its own choosing.
      if (e.source !== window.parent) return;
      var d = e.data || {};
      if (d.__mockyCmd === 'pick') {
        if (d.on) { mode = 'pick'; pickFill = d.fill !== false; pickPrecise = !!d.precise; pickMove = !!d.move; }
        else if (mode === 'pick') { mode = null; hideHl(); }
        if (!d.on || !d.move) { endDrag(); press = null; pickMove = !!d.on && !!d.move; }
      }
      if (d.__mockyCmd === 'pick-step' && mode === 'pick' && pickMove) step(d.delta < 0 ? -1 : 1);
      if (d.__mockyCmd === 'pick-marks') { setMarks(Array.isArray(d.selectors) ? d.selectors : []); }
      if (d.__mockyCmd === 'demo') { mode = 'demo'; links = d.links || []; markLinks(); }
      // The WebGL budget, granted by the canvas. A browser keeps about sixteen
      // live contexts per renderer process and silently kills the OLDEST when a
      // seventeenth is asked for, so a screen far off the canvas would blank the
      // scene somebody is looking at. A frame cannot arbitrate that — it sees
      // only itself — so the parent decides and this line is the whole of what
      // the frame does about it. <Scene3D> listens for the event.
      if (d.__mockyCmd === 'gl') {
        window.__mockyGL = d.on !== false;
        try { window.dispatchEvent(new Event('mocky:gl')); } catch (_) {}
      }
      // Read-only, and it changes no mode: a sweep must not disturb whatever the
      // user is doing in the screen at the time.
      if (d.__mockyCmd === 'sweep') { post('swept', { id: d.id, elements: sweepLinkables() }); }
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
  pickOutlineOnly,
  pickPrecise,
  pickMove,
  onMove,
  onMarksInfo,
  pickStep,
  gl,
  retrying,
  onPick,
  onPickKey,
  pickMarks,
  demoLinks,
  onNavigate,
  hideScrollbars,
  radius,
  captureRequest,
  sweepRequest,
  onSwept,
  onCaptureRect,
  onError,
  generating,
  caps,
  animations,
  onContentHeight,
  onDocPages,
  flow,
}: {
  code: string
  pickMode?: boolean
  /** In pick mode, use a fuchsia outline only (no violet fill) — used by Modify mode. */
  pickOutlineOnly?: boolean
  /** In pick mode, pick the exact element under the cursor (no walk-up) — used by Modify mode. */
  pickPrecise?: boolean
  /** In pick mode, a press that travels drags the element to another place among its siblings (Modify mode). */
  pickMove?: boolean
  /** A drag or Alt+Arrow ended on a place: the parent plans it on the source (lib/screenElements.ts). */
  onMove?: (move: MoveRequest) => void
  /** The selected elements' chains, as the CURRENT document reads them. */
  onMarksInfo?: (items: { selector: string; source?: PickedSource[] }[]) => void
  /** Ask the frame to move the one selected element a sibling over; `nonce` makes a repeat a new request. */
  pickStep?: { delta: -1 | 1; nonce: number } | null
  /**
   * May this screen hold a live WebGL context?
   *
   * The canvas grants it to the screens nearest the viewport and withholds it
   * from the rest — a browser keeps about sixteen contexts per renderer process
   * and silently kills the oldest when a seventeenth is asked for, so without an
   * arbiter a screen scrolled far away would blank the scene somebody is looking
   * at. Absent means granted: a preview outside the canvas — the capture frame,
   * a test — is on its own and should simply work.
   */
  gl?: boolean
  /** Auto-fix is repairing a render error on this screen — show a calm "Repairing…" state instead of the red error banner. */
  retrying?: boolean
  onPick?: (info: PickInfo) => void
  /** Delete, Backspace or Escape pressed inside the frame while picking. */
  onPickKey?: (key: string) => void
  /** The elements currently selected, outlined in the frame. */
  pickMarks?: string[]
  demoLinks?: DemoLink[]
  onNavigate?: (target: string) => void
  hideScrollbars?: boolean
  radius?: string
  captureRequest?: CaptureRequest | null
  /** Bumped to ask the frame to list every element one could link FROM. */
  sweepRequest?: number | null
  onSwept?: (elements: SweptElement[]) => void
  onCaptureRect?: (id: string, rect: { x: number; y: number; w: number; h: number }) => void
  /** Called when the iframe reports a compile or runtime error (only when not generating). */
  onError?: (error: string) => void
  /** When true, the model is still streaming code. Shows a "Generating…" overlay and hides errors. */
  generating?: boolean
  /** Capability IDs to enable in the preview iframe (e.g. ['motion', 'charts']). */
  caps?: string[]
  /** false = "Sans animation": already-generated screens hold still too. */
  animations?: boolean
  /** Reports the rendered content height (px) — used by the "Full height" format. */
  onContentHeight?: (height: number) => void
  /**
   * A DOCUMENT's page kit reporting its pages (lib/pageFormats.ts): how many,
   * and the 0-based indices of those whose words run past the edge. Raw, as
   * the frame sent it — the caller bounds it (`docFrameUpdate`). `format` is
   * the page format the kit actually laid out (the code's `<Doc format>`).
   */
  onDocPages?: (count: unknown, overflow: unknown, format: unknown, fold?: unknown) => void
  /**
   * This frame is a page of a working prototype (snippets/Flow.ts): it starts
   * with `state`, and reports what its code writes and where it asks to go.
   * Read once per document — the state is baked into the srcDoc when it is
   * built, so a page opened later starts with what the earlier ones wrote.
   * The holder remounts the frame (a `key`) to start it over. Without this
   * prop the frame's requests are ignored, like a `navigate` without links.
   */
  flow?: {
    state: Record<string, unknown>
    onSet: (key: string, value: unknown) => void
    onGo: (route: string) => void
    onReset: () => void
  }
}) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  /** True for ~3s after the frame tried to leave the mockup and was put back. */
  const [navBlocked, setNavBlocked] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const frameId = useState(() => 'f' + Math.random().toString(36).slice(2))[0]

  // Keep the latest callbacks in refs so the message listener doesn't need to
  // re-subscribe (and reset `ready`) every time the parent re-renders.
  const onPickRef = useRef(onPick)
  const onPickKeyRef = useRef(onPickKey)
  onPickKeyRef.current = onPickKey
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const onMarksInfoRef = useRef(onMarksInfo)
  onMarksInfoRef.current = onMarksInfo
  const pickMoveRef = useRef(pickMove)
  pickMoveRef.current = pickMove
  const onNavRef = useRef(onNavigate)
  const onCaptureRectRef = useRef(onCaptureRect)
  const onErrorRef = useRef(onError)
  const onContentHeightRef = useRef(onContentHeight)
  const onSweptRef = useRef(onSwept)
  const onDocPagesRef = useRef(onDocPages)
  const flowRef = useRef(flow)
  const lastDocPagesRef = useRef<{ count: unknown; overflow: unknown; format: unknown; fold?: unknown } | null>(null)
  // Same reasoning applied to a value rather than a callback: the listener needs
  // to KNOW whether generation is running, but must not re-subscribe when that
  // changes — re-subscribing resets `ready` and re-arms the render timeout.
  const generatingRef = useRef(generating)
  /*
   * And the two GUARDS the listener applies, for the same reason and after the
   * same bug twice over.
   *
   * The listener drops a `picked` message unless pick mode is on, and a
   * `navigate` unless the frame was given links — both right, and both read out
   * of a closure that is only rebuilt when the srcDoc changes. A tool is turned
   * on AFTER a screen has rendered, always: so the frame received `pick on`
   * (that command has its own effect, with its own dependencies), drew the
   * hover outline, posted the click — and the parent threw it away against a
   * `pickMode` that was still false from render time. Which is exactly what it
   * looked like from the outside: the element lights up, the click does
   * nothing.
   *
   * Refs rather than dependencies, because re-subscribing resets `ready` and
   * re-arms the twenty-second render timeout: a preview would flicker back to
   * "loading" every time somebody picked up a tool.
   */
  const pickModeRef = useRef(pickMode)
  const demoLinksRef = useRef(demoLinks)
  onPickRef.current = onPick
  onNavRef.current = onNavigate
  onCaptureRectRef.current = onCaptureRect
  onErrorRef.current = onError
  onContentHeightRef.current = onContentHeight
  onSweptRef.current = onSwept
  onDocPagesRef.current = onDocPages
  flowRef.current = flow
  generatingRef.current = generating
  pickModeRef.current = pickMode
  demoLinksRef.current = demoLinks

  // Build the iframe srcDoc from the generated code. We debounce 500ms so
  // rapid streaming chunks don't cause an iframe rebuild on every token. The
  // iframe's own Babel handles compilation — if the code is incomplete, the
  // iframe shows the error, but the spinner stays until a valid render ("ok"
  // message) arrives.
  //
  // A 20s timeout guards against iframes that never respond (e.g. Babel CDN
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
      setSrcDoc(
        buildSrcDoc(
          previewCode,
          name,
          frameId,
          !!hideScrollbars,
          resolvedCaps,
          !!generating,
          animations !== false,
          flowRef.current ? flowStateScript(flowRef.current.state) : undefined,
        ),
      )
    }, 500)
    return () => clearTimeout(timer)
    // `animations` is in the list on purpose: flipping the switch has to rebuild
    // the document, or the screens already on the canvas keep moving.
  }, [code, frameId, hideScrollbars, resolvedCaps, animations])

  // --- The mockup must not be able to navigate away from itself --------------
  //
  // The iframe is sandboxed WITHOUT allow-same-origin, but a sandboxed frame is
  // still allowed to navigate ITSELF. `location.href = '/'`, `location.assign()`,
  // a submitted form, an <a> whose onClick navigates — any of them make the frame
  // drop the srcDoc and load Mocky's own index.html instead. Its origin is
  // opaque, so every module script of the app then fails CORS: the user sees a
  // white screen, a console full of errors, and the screen they just generated
  // is gone.
  //
  // The one signal that catches all of those, whatever the cause, is the frame's
  // `load` event: the FIRST load is the srcDoc itself, so any LATER load means
  // the frame went somewhere else. Re-assigning `srcdoc` on the element (which
  // the parent always owns, whatever the frame's origin) puts the mockup back.
  const loadCountRef = useRef(0)
  const navNoticeRef = useRef<number | null>(null)

  // A new generation is a new document: the next load is a legitimate first one.
  useEffect(() => {
    loadCountRef.current = 0
  }, [srcDoc])

  useEffect(() => () => { if (navNoticeRef.current) window.clearTimeout(navNoticeRef.current) }, [])

  function handleFrameLoad() {
    loadCountRef.current += 1
    if (loadCountRef.current < 2) return
    const frame = iframeRef.current
    if (!frame || !srcDoc) return
    // Zero it BEFORE re-assigning: restoring fires a `load` of its own, which
    // must count as the new document's first one or we would restore forever.
    loadCountRef.current = 0
    // Setting the srcdoc attribute re-navigates the frame even to the same
    // value — React keeps the identical prop, so it never re-sets it itself.
    frame.srcdoc = srcDoc
    // The restored document has to announce itself again before it can be told
    // about pick/demo mode, so drop `ready` and let the "ok" message raise it.
    setReady(false)
    setNavBlocked(true)
    if (navNoticeRef.current) window.clearTimeout(navNoticeRef.current)
    navNoticeRef.current = window.setTimeout(() => setNavBlocked(false), 3000)
  }

  // Listen for messages from the iframe. The iframe posts 'ok' when the
  // component rendered successfully, or 'error' when Babel or the component
  // threw. We also set a 20s timeout: if no message arrives, show an error.
  useEffect(() => {
    if (!srcDoc) return
    setError(null)
    setReady(false)
    // A new document reports its own pages; the last one's must not be replayed.
    lastDocPagesRef.current = null
    let timeoutHit = false
    const timeout = setTimeout(() => {
      if (!timeoutHit) {
        timeoutHit = true
        setError(t('preview.timedOut'))
      }
    }, 20000)
    function onMsg(e: MessageEvent) {
      // Identity comes from the window that sent the message, not from a field
      // inside it. `frameId` is written in clear into every srcDoc, so any
      // preview could read another's id out of the DOM and forge messages on its
      // behalf — and e.origin is the useless string "null" for every sandboxed
      // frame, so it cannot be used to tell them apart.
      if (e.source !== iframeRef.current?.contentWindow) return
      const d = e.data
      if (!d || !d.__mocky || d.frameId !== frameId) return
      if (d.type === 'error') {
        timeoutHit = true
        clearTimeout(timeout)
        // Ignore errors while generating — the code is incomplete.
        if (generatingRef.current) return
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
      if (d.type === 'size' && typeof d.height === 'number') onContentHeightRef.current?.(d.height)
      // A frame may only report a pick while pick mode is actually on, and may
      // only ask to navigate while it has demo links. Without these, a rendered
      // component could drive the parent's UI at will.
      if (d.type === 'picked' && pickModeRef.current)
        onPickRef.current?.({ selector: d.selector, label: d.label, rect: d.rect, tag: d.tag, className: d.className, source: readPickedSource(d.source), additive: d.additive === true })
      if (d.type === 'pick-key' && pickModeRef.current && (d.key === 'Delete' || d.key === 'Backspace' || d.key === 'Escape'))
        onPickKeyRef.current?.(d.key)
      // A move is a pick that travelled, and is held to the same gate — plus
      // the tool's own, since Link mode picks too and never moves anything.
      // And both are dropped from a document that no longer shows the code:
      // for the half second before a moved screen is rebuilt, the old one is
      // still there to be dragged or Alt+Arrowed, and its ranks name places in
      // the code BEFORE the move. Planned on the code after it, a second quick
      // step would move a neighbour.
      const current = srcCodeRef.current === code
      if (d.type === 'move' && current && pickModeRef.current && pickMoveRef.current) {
        const move = readMoveRequest(d)
        if (move) onMoveRef.current?.(move)
      }
      if (d.type === 'marks' && current && pickModeRef.current && Array.isArray(d.items))
        onMarksInfoRef.current?.(
          d.items
            .slice(0, 64)
            .filter((i: unknown) => typeof (i as { selector?: unknown } | null)?.selector === 'string')
            .map((i: { selector: string; source?: unknown }) => ({ selector: i.selector.slice(0, 600), source: readPickedSource(i.source) })),
        )
      if (d.type === 'navigate' && demoLinksRef.current && demoLinksRef.current.length > 0) onNavRef.current?.(d.target)
      if (d.type === 'swept' && Array.isArray(d.elements)) onSweptRef.current?.(d.elements)
      // A working prototype's requests, honoured only by a holder that asked
      // for them (the demo, the review page) — on the canvas a screen's code
      // must not be able to steer anything outside its frame.
      if (flowRef.current) {
        if (d.type === 'flow-set' && typeof d.key === 'string' && d.key) flowRef.current.onSet(d.key.slice(0, 80), d.value)
        if (d.type === 'flow-go' && typeof d.route === 'string') flowRef.current.onGo(d.route.slice(0, 80))
        if (d.type === 'flow-reset') flowRef.current.onReset()
      }
      // Kept always, forwarded only once the model has stopped writing: a
      // half-streamed document has half its pages, and the frame would shrink
      // and grow with every chunk. The kit posts only when its answer changes,
      // so the last one is replayed when generation ends (effect below).
      if (d.type === DOC_PAGES_MESSAGE) {
        lastDocPagesRef.current = { count: d.count, overflow: d.overflow, format: d.format, fold: d.fold }
        if (!generatingRef.current) onDocPagesRef.current?.(d.count, d.overflow, d.format, d.fold)
      }
      // A fragment pointing at nothing. Reported rather than swallowed: these
      // come from the model's own markup — a nav item written before the
      // section it names was renamed — and used to be indistinguishable from a
      // dead preview. Console only for now, deliberately: it is the author's
      // problem with their screen, not an error in Mocky, and it does not
      // deserve to seize the composer's banner on a stray click.
      if (d.type === 'anchor-missing' && typeof d.anchor === 'string') {
        console.warn(
          `[Mocky] Ancre introuvable dans l'écran : #${d.anchor} — aucun élément ne porte cet id.`,
        )
      }
    }
    window.addEventListener('message', onMsg)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMsg)
    }
    // `generating` is read through a ref, NOT a dependency. As a dependency it
    // re-armed this effect when generation merely ENDED — which is exactly what
    // happens on a truncated answer: the model hits its token ceiling, so the
    // final code equals the last streamed value, `srcDoc` does not change and
    // the iframe never reloads, yet this effect reset `ready` and started a
    // fresh 20-second clock for an "ok" that could no longer come. The screen
    // sat under the "Rendering…" veil showing perfectly good output, then
    // accused itself of a render timeout.
  }, [srcDoc, frameId, code])

  /*
   * Ask the frame to list what a user could link from.
   *
   * Gated on `ready` because a document that has not rendered has nothing to
   * enumerate — a sweep sent early would come back empty and the feature would
   * look like it found nothing rather than like it ran too soon.
   *
   * `sweepRequest` is a nonce, not a flag: asking twice for the same screen is a
   * legitimate thing to want, and a boolean could not express it. The callback
   * goes through a ref so this effect never re-subscribes on a parent render —
   * the mistake that cost several rounds elsewhere in this file.
   */
  useEffect(() => {
    if (!sweepRequest || !ready) return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage({ __mockyCmd: 'sweep', id: sweepRequest }, '*')
  }, [sweepRequest, ready])

  // The page count the kit reported while the model was still writing, handed
  // over once it has stopped. When the final code equals the last streamed
  // chunk the frame is not rebuilt, so the kit — which posts only on a change —
  // would never say it again, and the document would stay one page tall.
  useEffect(() => {
    const last = lastDocPagesRef.current
    if (!generating && last) onDocPagesRef.current?.(last.count, last.overflow, last.format, last.fold)
  }, [generating])

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
    win.postMessage({ __mockyCmd: 'pick', on: !!pickMode, fill: !pickOutlineOnly, precise: !!pickPrecise, move: !!pickMove }, '*')
    if (demoLinks && demoLinks.length) win.postMessage({ __mockyCmd: 'demo', links: demoLinks }, '*')
    // Undefined means granted — see the prop. The frame keeps the answer on
    // `window.__mockyGL` and `<Scene3D>` starts or stops on the event.
    win.postMessage({ __mockyCmd: 'gl', on: gl !== false }, '*')
  }, [ready, pickMode, pickOutlineOnly, pickPrecise, pickMove, gl, demoKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win || !ready || !pickStep) return
    win.postMessage({ __mockyCmd: 'pick-step', delta: pickStep.delta }, '*')
  }, [pickStep?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const marksKey = (pickMarks ?? []).join('\u0000')
  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win || !ready) return
    win.postMessage({ __mockyCmd: 'pick-marks', selectors: pickMarks ?? [] }, '*')
  }, [ready, marksKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full bg-white" style={{ borderRadius: radius }}>
      {srcDoc && (
        <iframe
          ref={iframeRef}
          title={t('preview.frameTitle')}
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          onLoad={handleFrameLoad}
          style={{ borderRadius: radius }}
        />
      )}
      {(generating || (!ready && !error)) && (
        // A skeleton, not a spinner. A ring says "something is happening
        // somewhere"; blocks in the shape of a screen say what is arriving and
        // roughly where — which is the useful thing on a canvas where several
        // frames may be waiting at once. The label stays, because the two
        // waits are not the same: the model is writing, or the frame is
        // rendering what it wrote.
        <div className="absolute inset-0 overflow-hidden bg-surface" style={{ borderRadius: radius }}>
          <ScreenSkeleton />
          {/* The wordmark writing itself, centred over the blocks.
              It is the same animation the composer's button runs, which is the
              point: one gesture means "Mocky is working", wherever it appears.
              MockyLoader derives its clip-path id from useId(), so several
              frames waiting at once do not collide over one id — which is the
              normal case on a canvas. */}
          {/* The wordmark alone. The written-out "Mocky" already says the only
              thing a wait needs to say, and the caption under it repeated that
              in words — two statements of the same fact, one of them noise.
              The distinction between "the model is writing" and "the frame is
              rendering" survives in the accessible label, where it costs
              nothing to anyone who does not need it. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <MockyLoader
              size={120}
              label={generating ? t('canvas.generating') : t('canvas.rendering')}
              className="text-ink-muted"
            />
          </div>
        </div>
      )}
      {/* While the auto-fixer is repairing a render error, show a calm state —
          the red error only appears if the fix ultimately fails. */}
      {error && retrying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/95" style={{ borderRadius: radius }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-warn/25 border-t-warn" />
          <span className="text-body-sm text-warn">{t('canvas.repairing')}</span>
        </div>
      )}
      {error && !retrying && (
        <div className="absolute inset-x-0 bottom-0 max-h-[50%] overflow-auto border-t border-danger bg-surface p-3 text-body text-danger">
          <div className="mb-1 font-semibold">{t('preview.runtimeError')}</div>
          <pre className="whitespace-pre-wrap font-mono text-body-sm">{error}</pre>
        </div>
      )}
      {/* Rendered last so it sits above the "Rendering…" veil the restore
          briefly puts back. Purely informative: it never covers the screen and
          asks for nothing. */}
      {navBlocked && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-top flex justify-center px-4">
          <div className="flex items-center gap-2 border border-line bg-raised px-3 py-2 text-body-sm text-ink">
            <Icon name="link" size={16} className="text-ink-muted" />
            <span>{t('preview.linksInert')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
