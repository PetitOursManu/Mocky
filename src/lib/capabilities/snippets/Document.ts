import {
  DEFAULT_PAGE_FORMAT,
  DOC_ATTR,
  DOC_PAGES_MESSAGE,
  FIELD_ATTR,
  FIELD_TYPES,
  FIELD_TYPE_ATTR,
  PAGE_ATTR,
  PAGE_FORMATS,
  PAGE_GAP_PX,
} from '../../pageFormats'

/**
 * The page kit — `<Doc>`, `<Page>`, `<Field>` — for DOCUMENT screens.
 *
 * WHY A KIT AND NOT A PROMPT
 *
 * A page has to be EXACTLY its format's size, or three things stop agreeing:
 * what the canvas shows, what the PDF contains, and where a fillable field
 * lands in it. A model told "794 × 1123 px" writes `h-[1123px]` on one page and
 * `min-h-screen` on the next, pads the root, and centres everything in a grey
 * flex box — each of which moves every page after the first by an amount the
 * export would have to guess. So the size is not the model's to write: `<Page>`
 * sets it inline, from the format of the enclosing `<Doc>`, and the model only
 * decides what is ON the page.
 *
 * THE CONTRACT IS NOT SPELLED HERE
 *
 * The attribute names, the gap, the formats and the message type are
 * interpolated at BUILD time from `lib/pageFormats.ts`, which the exports read
 * too. The frame cannot import a module — this source is a string prepended to
 * the generated code — so the string is built from the constants rather than
 * written with them retyped: an attribute renamed there is renamed here, and
 * the test reads the constants back out of the source.
 *
 * MEASURED MORE THAN ONCE, ON PURPOSE
 *
 * `<Doc>` reports how many pages it holds and which of them overflow, and the
 * canvas sizes the frame from that. Tailwind's runtime writes a class's CSS a
 * task AFTER mount — the scroll sequence shipped a single check at mount and it
 * fixed nothing — and pictures and fonts arrive later still, so a page measured
 * once is a page measured before its padding existed. It is measured on a short
 * ladder of timers, on every load inside it, and when its box changes, and the
 * report is posted only when the answer changes.
 *
 * WHAT "OVERFLOW" MEANS
 *
 * Words or a field outside the page box — clipped on paper, so worth a notice
 * naming the page. NOT a shape: a flyer's blobs and stripes are meant to bleed
 * off the edge and be cut at the trim, so decorative content (anything inside
 * an `<svg>` or an `aria-hidden` subtree, and every element that carries no
 * text of its own) is never counted. Text is measured by its own glyphs when a
 * Range is available, because a sticker's box may bleed while its word does
 * not.
 *
 * WHAT A PAGE LOOKS LIKE OFF THE CANVAS
 *
 * The shadow and the grey backdrop are the canvas's; `@media print` drops both,
 * and a per-page capture of `[data-mocky-page]` never includes a shadow drawn
 * outside the element's box. `print-color-adjust: exact` keeps a flyer's colour
 * blocks when it is printed from a browser, which otherwise strips backgrounds
 * to save ink.
 */
const FORMATS = Object.fromEntries(PAGE_FORMATS.map((f) => [f.id, { w: f.w, h: f.h, size: f.cssSize }]))

/** The grey between pages on the canvas — neutral, so no palette argues with it. */
export const DOC_BACKDROP = '#e4e4e7'

export const DocumentSource = `var MOCKY_DOC_FORMATS = ${JSON.stringify(FORMATS)};
var MOCKY_DOC_DEFAULT = ${JSON.stringify(DEFAULT_PAGE_FORMAT)};
var MOCKY_DOC_ATTR = ${JSON.stringify(DOC_ATTR)};
var MOCKY_PAGE_ATTR = ${JSON.stringify(PAGE_ATTR)};
var MOCKY_FIELD_ATTR = ${JSON.stringify(FIELD_ATTR)};
var MOCKY_FIELD_TYPE_ATTR = ${JSON.stringify(FIELD_TYPE_ATTR)};
var MOCKY_FIELD_TYPES = ${JSON.stringify(FIELD_TYPES)};
var MOCKY_DOC_GAP = ${JSON.stringify(PAGE_GAP_PX)};
var MOCKY_DOC_MESSAGE = ${JSON.stringify(DOC_PAGES_MESSAGE)};
var MOCKY_DOC_BACKDROP = ${JSON.stringify(DOC_BACKDROP)};
var MOCKY_DOC_TOLERANCE = 2;
var MockyDocContext = React.createContext(null);

function mockyDocFormat(id) {
  return Object.prototype.hasOwnProperty.call(MOCKY_DOC_FORMATS, id) ? id : MOCKY_DOC_DEFAULT;
}

function mockyDocOutside(r, box) {
  if (!r || (r.width === 0 && r.height === 0)) return false;
  var t = MOCKY_DOC_TOLERANCE;
  return r.bottom > box.bottom + t || r.right > box.right + t || r.top < box.top - t || r.left < box.left - t;
}

function mockyPageOverflows(page) {
  var box = page.getBoundingClientRect();
  var els = page.querySelectorAll('*');
  var range = null;
  try { range = document.createRange ? document.createRange() : null; } catch (e) { range = null; }
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.hasAttribute && el.hasAttribute(MOCKY_FIELD_ATTR)) {
      if (mockyDocOutside(el.getBoundingClientRect(), box)) return true;
      continue;
    }
    if (el.closest && el.closest('svg,[aria-hidden="true"]')) continue;
    var kids = el.childNodes || [];
    for (var k = 0; k < kids.length; k++) {
      var n = kids[k];
      if (n.nodeType !== 3 || !/\\S/.test(n.nodeValue || '')) continue;
      var r = null;
      if (range) {
        try { range.selectNodeContents(n); r = range.getBoundingClientRect(); } catch (e) { r = null; }
      }
      if (!r) r = el.getBoundingClientRect();
      if (mockyDocOutside(r, box)) return true;
    }
  }
  return false;
}

// Field names made unique in DOM order, the second 'nom' becoming 'nom-2': a
// PDF form holds ONE field per name, so a recto-verso with a coupon on each side
// either failed to export or tied both boxes to one value. The same rule as the
// page numbers below — the kit owns the contract, so the kit makes it true.
// Every name is collected first, so a rename never lands on a name the model
// wrote further down.
function mockyDocUniqueFields(root) {
  var fields = root.querySelectorAll('[' + MOCKY_FIELD_ATTR + ']');
  var taken = {};
  for (var i = 0; i < fields.length; i++) taken[fields[i].getAttribute(MOCKY_FIELD_ATTR)] = true;
  var seen = {};
  for (var j = 0; j < fields.length; j++) {
    var el = fields[j];
    var name = el.getAttribute(MOCKY_FIELD_ATTR);
    if (!name) continue;
    if (!seen[name]) { seen[name] = true; continue; }
    var k = 2;
    while (taken[name + '-' + k]) k++;
    var next = name + '-' + k;
    taken[next] = true;
    seen[next] = true;
    el.setAttribute(MOCKY_FIELD_ATTR, next);
    el.setAttribute('name', next);
  }
}

function mockyDocMeasure(root) {
  mockyDocUniqueFields(root);
  var pages = root.querySelectorAll('[' + MOCKY_PAGE_ATTR + ']');
  var overflow = [];
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    // Renumbered in DOM order: a Page reached through a wrapper or a fragment
    // was not counted by <Doc>, and the exports read this value as the order.
    if (p.getAttribute(MOCKY_PAGE_ATTR) !== String(i)) p.setAttribute(MOCKY_PAGE_ATTR, String(i));
    if (mockyPageOverflows(p)) overflow.push(i);
  }
  return { count: pages.length, overflow: overflow };
}

function mockyDocCss(f) {
  var P = '[' + MOCKY_PAGE_ATTR + ']';
  var D = '[' + MOCKY_DOC_ATTR + ']';
  return 'html,body{background:' + MOCKY_DOC_BACKDROP + '}' +
    ':where(' + P + '){background:#ffffff;color:#111111}' +
    P + '{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:0 1px 2px rgba(0,0,0,0.10),0 10px 28px rgba(0,0,0,0.12)}' +
    '@page{size:' + f.size + ';margin:0}' +
    '@media print{html,body{background:none}' + D + '{gap:0 !important;background:none !important}' + P + '{box-shadow:none;break-after:page}}';
}

var Page = function (props) {
  var ctx = React.useContext(MockyDocContext);
  var f = ctx ? ctx.f : MOCKY_DOC_FORMATS[MOCKY_DOC_DEFAULT];
  var attrs = {};
  for (var k in props) {
    if (k === 'children' || k === 'style' || k === '__mockyIndex') continue;
    attrs[k] = props[k];
  }
  // The size is the kit's and wins over anything the page was given: a page
  // that is not exactly its format moves every page after it in the export.
  attrs.style = Object.assign({}, props.style || {}, {
    width: f.w + 'px',
    height: f.h + 'px',
    minHeight: 0,
    maxHeight: 'none',
    margin: 0,
    position: 'relative',
    overflow: 'hidden',
    flex: 'none',
    boxSizing: 'border-box',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  });
  attrs[MOCKY_PAGE_ATTR] = String(props.__mockyIndex == null ? 0 : props.__mockyIndex);
  return React.createElement('section', attrs, props.children);
};

var Doc = function (props) {
  var id = mockyDocFormat(props.format);
  var f = MOCKY_DOC_FORMATS[id];
  var ref = React.useRef(null);
  var last = React.useRef('');
  React.useEffect(function () {
    var root = ref.current;
    if (!root) return;
    var stopped = false;
    var timers = [];
    function run() {
      if (stopped || !ref.current) return;
      var m;
      try { m = mockyDocMeasure(ref.current); } catch (e) { return; }
      var key = id + ':' + m.count + ':' + m.overflow.join(',');
      if (key === last.current) return;
      last.current = key;
      // The format LAID OUT goes with the count: the canvas sizes the frame
      // and records Screen.page from it, so an edit that rewrote the format
      // (or wrote one the kit did not know, laid out as the default) is not
      // drawn at one width inside a frame of another.
      try { if (window.__mockyPost) window.__mockyPost(MOCKY_DOC_MESSAGE, { count: m.count, overflow: m.overflow, format: id }); } catch (e) {}
    }
    [0, 80, 300, 800, 1600, 3200].forEach(function (ms) { timers.push(setTimeout(run, ms)); });
    var ro = null;
    try { if (window.ResizeObserver) { ro = new ResizeObserver(function () { run(); }); ro.observe(root); } } catch (e) { ro = null; }
    // A picture that arrives late can push words past the edge: 'load' does
    // not bubble, so it is caught on the way down.
    root.addEventListener('load', run, true);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); } catch (e) {}
    return function () {
      stopped = true;
      timers.forEach(function (t) { clearTimeout(t); });
      if (ro) ro.disconnect();
      root.removeEventListener('load', run, true);
    };
  });
  var n = 0;
  var children = React.Children.map(props.children, function (c) {
    if (c && c.type === Page) return React.cloneElement(c, { __mockyIndex: n++ });
    return c;
  });
  var attrs = {
    ref: ref,
    style: {
      width: f.w + 'px',
      display: 'flex',
      flexDirection: 'column',
      gap: MOCKY_DOC_GAP + 'px',
      margin: 0,
      padding: 0,
      background: MOCKY_DOC_BACKDROP
    }
  };
  attrs[MOCKY_DOC_ATTR] = id;
  return React.createElement(
    MockyDocContext.Provider,
    { value: { id: id, f: f } },
    React.createElement('div', attrs, React.createElement('style', null, mockyDocCss(f)), children)
  );
};

var MOCKY_FIELD_LOOK = 'block w-full rounded-md border border-black/25 bg-white/90 px-3 py-2 text-[15px] leading-snug text-neutral-900 placeholder:text-neutral-500';
var MOCKY_FIELD_CHECK = 'h-5 w-5 shrink-0 accent-neutral-900';

var Field = function (props) {
  var uid = React.useId ? React.useId() : '';
  var type = MOCKY_FIELD_TYPES.indexOf(props.type) >= 0 ? props.type : 'text';
  var label = props.label ? String(props.label) : '';
  // The model's own name when it gave one — the PDF shows it to whoever fills
  // the form in — with the dot removed, which a PDF form reads as a hierarchy.
  // A label stands in for a missing name, and a stable id for a missing both.
  var given = String(props.name || '').trim().replace(/[.\\s]+/g, '-');
  var slug = label.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  var name = given || slug || ('field-' + String(uid).replace(/[^a-zA-Z0-9]/g, ''));
  var a = { name: name, className: props.className || MOCKY_FIELD_LOOK, style: props.style };
  a[MOCKY_FIELD_ATTR] = name;
  a[MOCKY_FIELD_TYPE_ATTR] = type;
  if (!label) a['aria-label'] = props.placeholder || name;
  if (type === 'checkbox') {
    a.type = 'checkbox';
    a.className = props.className || MOCKY_FIELD_CHECK;
    a.defaultChecked = !!props.checked;
    return React.createElement(
      'label',
      { className: props.labelClassName || 'inline-flex items-center gap-2' },
      React.createElement('input', a),
      label ? React.createElement('span', null, label) : null
    );
  }
  var control;
  if (type === 'multiline') {
    a.rows = props.rows || 3;
    a.placeholder = props.placeholder;
    a.defaultValue = props.value;
    a.style = Object.assign({ resize: 'none' }, props.style || {});
    control = React.createElement('textarea', a);
  } else if (type === 'select') {
    var list = Array.isArray(props.options) ? props.options : [];
    var opts = list.map(function (o, i) {
      var obj = o && typeof o === 'object';
      var v = obj ? String(o.value != null ? o.value : o.label) : String(o);
      var l = obj ? String(o.label != null ? o.label : o.value) : String(o);
      return React.createElement('option', { key: i, value: v }, l);
    });
    if (props.placeholder) opts.unshift(React.createElement('option', { key: 'placeholder', value: '' }, props.placeholder));
    a.defaultValue = props.value != null ? props.value : '';
    control = React.createElement('select', a, opts);
  } else {
    a.type = type;
    a.placeholder = props.placeholder;
    a.defaultValue = props.value;
    control = React.createElement('input', a);
  }
  if (!label) return control;
  return React.createElement(
    'label',
    { className: props.labelClassName || 'block' },
    React.createElement('span', { className: 'mb-1 block text-[12px] font-semibold uppercase tracking-wide opacity-80' }, label),
    control
  );
};`

export const DOCUMENT_EXPORTS = ['Doc', 'Page', 'Field'] as const
