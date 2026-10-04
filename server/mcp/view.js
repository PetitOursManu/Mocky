/**
 * The live view (phase 5): an MCP Apps resource that shows a design inside the
 * assistant's conversation — moving, scrollable, clickable — instead of only
 * its picture. Hosts that do not speak MCP Apps ignore it and keep the picture.
 *
 * Spec: modelcontextprotocol/ext-apps, 2026-01-26 (`text/html;profile=mcp-app`,
 * `_meta.ui.resourceUri` on the tool, JSON-RPC over postMessage). ChatGPT and
 * Claude both implement it.
 *
 * Why a nested frame on Mocky's origin rather than the screen inlined here:
 * a preview compiles its JSX with Babel at runtime (`unsafe-eval`), and an
 * srcdoc document INHERITS its parent's policy — this view's, set by the host,
 * which has no `unsafe-eval` (see the header comment in server/index.js). So
 * the screen is served at a real URL, `/mcp-view/<hash>.html`, signed and
 * expiring like a picture link, under `sandbox allow-scripts` — the opaque
 * origin the composer's iframe gives it — with its own policy. This view is a
 * frame around that URL and nothing more; the resource itself is static, and
 * what it shows arrives as the tool result (`structuredContent.view`).
 *
 * Nothing here may trust the result: it is rendered with textContent, and the
 * only URL it frames must be on Mocky's origin, which is also the one domain
 * the resource declares (`frameDomains`).
 */

export const VIEW_URI = 'ui://mocky/screen-v1.html'
export const VIEW_MIME = 'text/html;profile=mcp-app'
/** The spec revision this view speaks. */
export const APPS_PROTOCOL = '2026-01-26'
/** Tallest the frame grows in a conversation; the page scrolls inside it. */
export const VIEW_MAX_HEIGHT = 720

export function buildViewHtml(origin) {
  const o = JSON.stringify(String(origin || ''))
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { --ink:#1d1d1b; --muted:#6b6a64; --line:#d9d6cc; --bg:transparent; --accent:#20796c; }
  @media (prefers-color-scheme: dark) { :root { --ink:#ecebe6; --muted:#a3a19a; --line:#3a3a36; --accent:#2dc7b0; } }
  html, body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .bar { display:flex; align-items:center; gap:12px; padding:8px 2px; }
  .title { flex:1; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .open { border:1px solid var(--line); background:none; color:var(--accent); font:inherit; font-weight:600; padding:5px 10px; border-radius:6px; cursor:pointer; }
  .stage { position:relative; overflow:hidden; border:1px solid var(--line); border-radius:8px; }
  .stage iframe { position:absolute; top:0; left:0; border:0; transform-origin:0 0; background:#fff; }
  .note { color:var(--muted); padding:6px 2px; }
</style></head>
<body><div id="root"><p class="note">…</p></div>
<script>
(function () {
  var ORIGIN = ${o};
  var MAX_H = ${VIEW_MAX_HEIGHT};
  var root = document.getElementById('root');
  var nextId = 1, pending = {};
  var view = null;

  function send(msg) { window.parent.postMessage(Object.assign({ jsonrpc: '2.0' }, msg), '*'); }
  function request(method, params) {
    var id = nextId++;
    send({ id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) { pending[id] = { resolve: resolve, reject: reject }; });
  }
  function notify(method, params) { send({ method: method, params: params || {} }); }

  function reportSize() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    notify('ui/notifications/size-changed', { width: Math.ceil(document.documentElement.clientWidth), height: h });
    // ChatGPT's own channel, beside the standard one: its first real test showed
    // a frame a few pixels tall.
    try { if (window.openai && window.openai.notifyIntrinsicHeight) window.openai.notifyIntrinsicHeight(h); } catch (e) {}
  }

  function openLink(url) {
    try {
      if (window.openai && window.openai.openExternal) { window.openai.openExternal({ href: url }); return; }
    } catch (e) {}
    request('ui/open-link', { url: url }).catch(function () {});
  }

  /** Only a frame on Mocky's own origin, and only its live-view path. */
  function safeUrl(u) {
    try {
      var url = new URL(String(u));
      return url.origin === ORIGIN && url.pathname.indexOf('/mcp-view/') === 0 ? url.href : null;
    } catch (e) { return null; }
  }

  function layout() {
    if (!view) return;
    var stage = root.querySelector('.stage');
    var frame = stage && stage.querySelector('iframe');
    if (!frame) return;
    var avail = Math.max(200, root.clientWidth || document.documentElement.clientWidth);
    var scale = Math.min(1, avail / view.width);
    var h = Math.min(view.height, Math.round(MAX_H / scale));
    frame.style.width = view.width + 'px';
    frame.style.height = h + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    stage.style.width = Math.round(view.width * scale) + 'px';
    stage.style.height = Math.round(h * scale) + 'px';
    reportSize();
  }

  function note(text) {
    root.textContent = '';
    var p = document.createElement('p');
    p.className = 'note';
    p.textContent = text;
    root.appendChild(p);
    reportSize();
  }

  /**
   * Draw what a tool result carries. Two hosts, two shapes: the standard
   * notification hands the whole CallToolResult, ChatGPT's window.openai hands
   * its structuredContent alone — both end here as the structured part.
   *
   * A result with no screen never replaces one already shown: a host may send
   * the result again, or another one, and the first ChatGPT test showed the
   * design for a second and then an empty frame.
   */
  function render(sc) {
    sc = sc && typeof sc === 'object' ? sc : {};
    var v = sc.view;
    var url = v && safeUrl(v.url);
    if (!url) {
      if (view) return;
      received = true;
      note(sc.status === 'running' || sc.status === 'awaiting_code'
        ? 'Le design n’est pas encore prêt. · The design is not ready yet.'
        : 'Pas d’aperçu pour cette réponse. · No preview for this answer.');
      return;
    }
    if (view && view.url === url) return;
    received = true;
    view = { url: url, width: Math.max(200, Math.min(4000, Number(v.width) || 1440)), height: Math.max(200, Math.min(20000, Number(v.height) || 900)) };
    root.textContent = '';
    var bar = document.createElement('div');
    bar.className = 'bar';
    var title = document.createElement('span');
    title.className = 'title';
    title.textContent = String(v.title || 'Mocky');
    bar.appendChild(title);
    var link = typeof v.link === 'string' && v.link.indexOf(ORIGIN + '/') === 0 ? v.link : null;
    if (link) {
      var btn = document.createElement('button');
      btn.className = 'open';
      btn.type = 'button';
      btn.textContent = String(v.openLabel || 'Ouvrir dans Mocky');
      btn.addEventListener('click', function () { openLink(link); });
      bar.appendChild(btn);
    }
    root.appendChild(bar);
    var stage = document.createElement('div');
    stage.className = 'stage';
    var frame = document.createElement('iframe');
    // The served page already carries this sandbox as a header; the attribute
    // says it a second time, from the side that embeds it.
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('title', String(v.title || 'Mocky'));
    frame.src = url;
    stage.appendChild(frame);
    root.appendChild(stage);
    layout();
  }

  var received = false;

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.jsonrpc !== '2.0') return;
    if (msg.id != null && pending[msg.id]) {
      var p = pending[msg.id];
      delete pending[msg.id];
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
      return;
    }
    if (msg.method === 'ui/notifications/tool-result') render(msg.params && msg.params.structuredContent);
  });
  window.addEventListener('resize', layout);

  // ChatGPT's channel: the result may already be there, or arrive as a global.
  function fromOpenAI() {
    try { if (window.openai && window.openai.toolOutput) render(window.openai.toolOutput); } catch (e) {}
  }
  window.addEventListener('openai:set_globals', function (e) {
    var g = e && e.detail && e.detail.globals;
    if (g && g.toolOutput) render(g.toolOutput);
  });
  fromOpenAI();

  // The handshake. A host that never answers it still gets "initialized" —
  // the standard says a host waits for it before sending the result, and
  // waiting on an answer that does not come would leave this frame empty.
  var initialized = false;
  function ready() {
    if (initialized) return;
    initialized = true;
    notify('ui/notifications/initialized');
    reportSize();
    fromOpenAI();
  }
  request('ui/initialize', {
    protocolVersion: '${APPS_PROTOCOL}',
    clientInfo: { name: 'mocky-view', version: '1.0.0' },
    appCapabilities: { availableDisplayModes: ['inline'] },
  }).then(ready, ready);
  setTimeout(ready, 1500);

  // Said, rather than an empty frame: what to report if a host sends nothing.
  setTimeout(function () {
    fromOpenAI();
    if (!received) note('L’aperçu n’a reçu aucun résultat de l’assistant. · The preview received no result from the assistant.');
  }, 8000);
})();
</script></body></html>`
}
