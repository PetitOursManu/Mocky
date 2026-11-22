/**
 * Interactive sites: the pieces a page needs when the visitor HANDLES it —
 * drags a shelf, flicks a carousel, opens a card into a page and closes it back
 * onto the card it came from.
 *
 * WHY A PACK AND NOT A PROMPT
 *
 * Every one of these was writable by hand before this file existed: nothing in
 * the pipeline strips `requestAnimationFrame`, pointer listeners or an SVG mask.
 * What a model writes by hand each time is the part that goes wrong each time —
 * a drag that swallows the click on the tape it ended over, a wheel listener
 * that is passive so `preventDefault` throws, a crop whose percentages divide by
 * zero when the box is the whole sheet, a sheet that grows from the cover and
 * cannot be closed while it is still growing. The arithmetic lives here, once,
 * and the model composes. Same rule as the films' blocks: naming is not
 * describing (plans/sites-interactifs.md).
 *
 * Names are distinctive on purpose (`SheetCrop`, not `Crop`; `PointerRing`, not
 * `Cursor`): a pack is inferred from the code (`capabilitiesUsedBy`), and a
 * screen that declares its own `const Cursor` would collide with a `var Cursor`
 * prepended in front of it — the reason `forcedOnly` exists for the page kit.
 *
 * Everything honours the three ways a screen stops moving — "Sans animation",
 * `prefers-reduced-motion`, and a capture frame (`__mockyStill`) — by arriving
 * at the end state at once, never by leaving the page half-drawn.
 */
export const InteractSource = `var mockyIxStill = function () {
  try {
    if (window.__mockyAnimations === false || window.__mockyStill) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (_) { return false; }
};
var mockyIxNum = function (v, lo, hi, d) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
// An id usable inside url(#…): React's useId has colons, which some engines
// refuse in a fragment reference.
var mockyIxId = function (raw) { return 'mx' + String(raw).replace(/[^A-Za-z0-9_-]/g, ''); };

/* ---------- Sheets and crops ---------- */

// A crop of a sheet as CSS percentages. Percentages, not pixels, because the
// sheet is often served at another size than the one the brief measured (a
// resizer's &w=2200 for a 2688 px source): a percentage of the box is the same
// fraction of the sheet at every resolution, so the boxes need no conversion.
// The one case the textbook formula gets wrong is a box as wide (or tall) as
// the sheet — W − w is 0 — and then any position is the same position.
var mockyCropCss = function (sheet, box) {
  var W = sheet.w, H = sheet.h, x = box[0], y = box[1], w = box[2], h = box[3];
  return {
    backgroundImage: 'url("' + String(sheet.src).replace(/"/g, '%22') + '")',
    backgroundRepeat: 'no-repeat',
    backgroundSize: (W / w * 100) + '% ' + (H / h * 100) + '%',
    backgroundPosition: (W === w ? 0 : x / (W - w) * 100) + '% ' + (H === h ? 0 : y / (H - h) * 100) + '%',
  };
};
// Why a crop cannot be drawn, in words a person can act on — or null.
var mockyCropProblem = function (sheet, box) {
  if (!sheet || typeof sheet.src !== 'string' || !sheet.src) return 'no sheet src';
  if (!(sheet.w > 0 && sheet.h > 0)) return 'sheet size unknown';
  if (!box || box.length !== 4) return 'box must be [x, y, w, h]';
  for (var i = 0; i < 4; i++) if (typeof box[i] !== 'number' || !isFinite(box[i])) return 'box must be numbers';
  if (box[2] <= 0 || box[3] <= 0) return 'empty box';
  if (box[0] < 0 || box[1] < 0 || box[0] + box[2] > sheet.w + 0.5 || box[1] + box[3] > sheet.h + 0.5) return 'box outside the sheet';
  return null;
};
var mockyCropWarned = {};
var SheetCrop = function (props) {
  var sheet = props.sheet, box = props.box;
  var className = typeof props.className === 'string' ? props.className : '';
  var sized = /(^|\\s)(aspect-|h-|min-h-|size-)/.test(className);
  var problem = mockyCropProblem(sheet, box);
  var label = props.name ? String(props.name) : '';
  if (problem) {
    var key = (sheet && sheet.src) + '|' + String(box) + '|' + problem;
    if (!mockyCropWarned[key]) {
      mockyCropWarned[key] = 1;
      try { console.warn('SheetCrop' + (label ? ' "' + label + '"' : '') + ': ' + problem); } catch (_) {}
      // Said to the page that holds the frame, which tells the person: a
      // striped box in a preview reads as a design choice, not a broken crop.
      try { if (window.__mockyPost) window.__mockyPost('crop-problem', { name: label.slice(0, 80), problem: problem, box: String(box).slice(0, 80) }); } catch (_) {}
    }
  }
  // \`mask\`: the crop is not drawn but CUTS — its alpha becomes the outline of
  // whatever the children paint. The back of a wrapper printed in HTML inside
  // the front's own silhouette, a label in the shape of a bottle.
  var look = problem ? { background: 'repeating-linear-gradient(45deg,#e4e4e7 0 8px,#f4f4f5 8px 16px)' } : mockyCropCss(sheet, box);
  if (props.mask && !problem) {
    look = {
      WebkitMaskImage: look.backgroundImage, maskImage: look.backgroundImage,
      WebkitMaskSize: look.backgroundSize, maskSize: look.backgroundSize,
      WebkitMaskPosition: look.backgroundPosition, maskPosition: look.backgroundPosition,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    };
  }
  var style = Object.assign(
    {},
    sized || problem ? null : { aspectRatio: box[2] + ' / ' + box[3] },
    look,
    props.flip ? { transform: 'scaleX(-1)' } : null,
    props.style && typeof props.style === 'object' ? props.style : null
  );
  var attrs = {
    className: className,
    style: style,
    'data-mocky-crop': label || undefined,
    'data-mocky-crop-error': problem || undefined,
  };
  if (props.alt) { attrs.role = 'img'; attrs['aria-label'] = String(props.alt); }
  else if (!props.children) attrs['aria-hidden'] = true;
  // A mirrored crop must not mirror the words printed over it.
  var kids = props.flip && props.children
    ? React.createElement('div', { style: { transform: 'scaleX(-1)', position: 'absolute', inset: 0 } }, props.children)
    : props.children;
  if (props.flip && props.children && !/(^|\\s)(?:[\\w-]+:)*(absolute|fixed|sticky|relative)(\\s|$)/.test(className)) style.position = 'relative';
  return React.createElement(props.as || 'div', attrs, kids);
};
// The same crop as the attributes of an SVG <image> inside a viewBox of
// vw × vh: the whole sheet, scaled so that only the box covers the view.
var sheetCropSvg = function (sheet, box, vw, vh) {
  var W = sheet.w, H = sheet.h;
  return {
    href: sheet.src,
    x: -box[0] * vw / box[2],
    y: -box[1] * vh / box[3],
    width: W * vw / box[2],
    height: H * vh / box[3],
    preserveAspectRatio: 'none',
  };
};

// The crop as a CSS mask, for a layer that must stop at the picture's own
// outline (Box3D's shade and sheen over a transparent-edged wrapper).
var sheetCropMask = function (sheet, box) {
  if (mockyCropProblem(sheet, box)) return null;
  var c = mockyCropCss(sheet, box);
  return {
    WebkitMaskImage: c.backgroundImage, maskImage: c.backgroundImage,
    WebkitMaskSize: c.backgroundSize, maskSize: c.backgroundSize,
    WebkitMaskPosition: c.backgroundPosition, maskPosition: c.backgroundPosition,
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
  };
};

/* ---------- A continuous track: drag, wheel, keys, snap, inertia, loop ---------- */

var mockyTrackWrap = function (i, n) { return ((Math.round(i) % n) + n) % n; };
var useGlideTrack = function (options) {
  var opts = options || {};
  var optsRef = React.useRef(opts);
  optsRef.current = opts;
  var count = Math.max(1, Math.round(opts.count || 1));
  var loop = !!opts.loop;
  var clampT = function (t) { return loop ? t : Math.max(0, Math.min(count - 1, t)); };
  var st = React.useRef(null);
  if (!st.current) {
    var start = clampT(typeof opts.initial === 'number' ? opts.initial : 0);
    st.current = { pos: start, target: start, dragging: false, raf: 0, last: 0, index: mockyTrackWrap(start, count), dir: 1, drag: null, suppress: false, wheelTimer: 0, el: null };
  }
  var s = st.current;
  var tick = React.useReducer(function (x) { return x + 1; }, 0)[1];

  var unitPx = function () {
    var u = optsRef.current.unit;
    var v = typeof u === 'function' ? u() : u;
    return v > 0 ? v : 100;
  };
  var notify = function () {
    var idx = mockyTrackWrap(s.pos, count);
    if (idx !== s.index) {
      s.dir = s.target >= s.pos ? 1 : -1;
      s.index = idx;
      var cb = optsRef.current.onChange;
      if (typeof cb === 'function') { try { cb(idx, s.dir); } catch (e) { console.error(e); } }
    }
  };
  var frame = function (now) {
    s.raf = 0;
    var dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60;
    s.last = now;
    var o = optsRef.current;
    var k = s.dragging ? (o.dragStiffness || 18) : (o.stiffness || 5.2);
    if (mockyIxStill()) s.pos = s.target;
    else s.pos += (s.target - s.pos) * (1 - Math.exp(-k * dt));
    if (Math.abs(s.target - s.pos) < 1e-4) s.pos = s.target;
    // Far from home after many loops: shift both by whole loops so the
    // numbers never grow until a float loses the fraction.
    if (loop && Math.abs(s.pos) > count * 4) {
      var shift = count * Math.round(s.pos / count);
      s.pos -= shift; s.target -= shift;
      if (s.drag) s.drag.t0 -= shift;
    }
    notify();
    tick();
    if (s.pos !== s.target || s.dragging) { s.raf = requestAnimationFrame(frame); }
    else { s.last = 0; if (typeof o.onSettle === 'function') { try { o.onSettle(s.index); } catch (e) { console.error(e); } } }
  };
  var wake = function () { if (!s.raf) s.raf = requestAnimationFrame(frame); };
  var setTarget = function (t) { s.target = clampT(t); s.dir = s.target >= s.pos ? 1 : -1; wake(); };

  var api = React.useMemo(function () {
    return {
      go: function (i) {
        if (!loop) return setTarget(Math.round(i));
        var cur = mockyTrackWrap(s.target, count);
        var d = ((Math.round(i) - cur) % count + count) % count;
        if (d > count / 2) d -= count;
        setTarget(Math.round(s.target) + d);
      },
      step: function (d) { setTarget(Math.round(s.target) + (d || 1)); },
      set: function (t) { setTarget(t); },
    };
  }, [count, loop]);

  React.useEffect(function () {
    var onKey = function (e) {
      var o = optsRef.current;
      if (!o.keys || o.enabled === false || e.defaultPrevented) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var vertical = o.axis === 'y';
      var next = vertical ? 'ArrowDown' : 'ArrowRight', prev = vertical ? 'ArrowUp' : 'ArrowLeft';
      if (e.key === next) { e.preventDefault(); api.step(1); }
      else if (e.key === prev) { e.preventDefault(); api.step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); if (s.raf) cancelAnimationFrame(s.raf); s.raf = 0; clearTimeout(s.wheelTimer); };
  }, [api]);

  // The element the gestures are read on. A callback ref, because the wheel
  // listener must be NON-passive to be allowed to preventDefault — React's
  // onWheel is passive and the page would scroll under the shelf.
  var ref = React.useCallback(function (el) {
    if (s.el && s.onWheel) s.el.removeEventListener('wheel', s.onWheel);
    s.el = el;
    if (!el) return;
    el.style.touchAction = optsRef.current.axis === 'y' ? 'pan-x' : 'pan-y';
    s.onWheel = function (e) {
      var o = optsRef.current;
      if (!o.wheel || o.enabled === false || e.ctrlKey) return;
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 33;
      if (!d) return;
      e.preventDefault();
      var wu = o.wheelUnit > 0 ? o.wheelUnit : unitPx() * 2;
      setTarget(s.target + d / wu);
      clearTimeout(s.wheelTimer);
      s.wheelTimer = setTimeout(function () { setTarget(Math.round(s.target)); }, o.snapDelay || 160);
    };
    el.addEventListener('wheel', s.onWheel, { passive: false });
  }, []);

  var onPointerDown = React.useCallback(function (e) {
    var o = optsRef.current;
    if (o.drag === false || o.enabled === false) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var vertical = o.axis === 'y';
    var x0 = e.clientX, y0 = e.clientY;
    var d = { t0: s.target, x0: x0, y0: y0, lastP: vertical ? y0 : x0, lastT: performance.now(), v: 0, live: false };
    s.drag = d;
    var move = function (ev) {
      var along = vertical ? ev.clientY - y0 : ev.clientX - x0;
      var across = vertical ? ev.clientX - x0 : ev.clientY - y0;
      if (!d.live) {
        if (Math.abs(along) <= (o.threshold || 5)) return;
        // The page's own scroll wins a gesture that is mostly across the track.
        if (Math.abs(across) > Math.abs(along)) { end(); return; }
        d.live = true; s.dragging = true;
      }
      var now = performance.now(), p = vertical ? ev.clientY : ev.clientX;
      var inst = -(p - d.lastP) / unitPx() / Math.max(1, now - d.lastT);
      d.v = d.v * 0.6 + inst * 0.4;
      d.lastP = p; d.lastT = now;
      s.target = clampT(d.t0 - along / unitPx());
      wake();
    };
    var end = function () {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      s.drag = null;
    };
    var up = function () {
      end();
      if (!d.live) return;
      s.dragging = false;
      // A drag must not also click the tape it ended over.
      s.suppress = true;
      setTimeout(function () { s.suppress = false; }, 0);
      var carry = o.inertia === false ? 0 : Math.max(-2, Math.min(2, d.v * 220));
      setTarget(Math.round(s.target + carry));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, []);
  var onClickCapture = React.useCallback(function (e) {
    if (s.suppress) { s.suppress = false; e.stopPropagation(); e.preventDefault(); }
  }, []);

  var n = count;
  return {
    pos: s.pos,
    target: s.target,
    index: mockyTrackWrap(s.pos, n),
    selected: mockyTrackWrap(s.target, n),
    dir: s.dir,
    dragging: s.dragging,
    settled: s.pos === s.target && !s.dragging,
    // Where item i stands from the centre, in steps — wrapped on a loop so the
    // nearest copy is the one that counts.
    offset: function (i) { var r = i - s.pos; return loop ? r - n * Math.round(r / n) : r; },
    go: api.go, step: api.step, set: api.set,
    bind: { ref: ref, onPointerDown: onPointerDown, onClickCapture: onClickCapture },
  };
};

/* ---------- Text that changes through a mask ---------- */

var MaskSwapItem = function (props) {
  var ref = React.useRef(null);
  React.useLayoutEffect(function () {
    var el = ref.current;
    if (!el || !el.animate || mockyIxStill()) { if (props.phase === 'out') props.onGone(props.k); return; }
    var dist = 105 * props.dir;
    var parts = props.byLetter ? el.querySelectorAll('[data-l]') : [el];
    var anims = [];
    for (var i = 0; i < parts.length; i++) {
      var inFrames = [{ transform: 'translateY(' + dist + '%)', opacity: props.fade ? 0 : 1 }, { transform: 'translateY(0)', opacity: 1 }];
      var outFrames = [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(' + -dist + '%)', opacity: props.fade ? 0 : 1 }];
      if (props.phase === 'in' && props.animate) anims.push(parts[i].animate(inFrames, { duration: props.duration, delay: i * props.stagger, easing: props.easing, fill: 'both' }));
      if (props.phase === 'out') anims.push(parts[i].animate(outFrames, { duration: props.outDuration, delay: i * props.stagger * 0.5, easing: props.easing, fill: 'both' }));
    }
    if (props.phase === 'out') {
      var done = anims.length ? anims[anims.length - 1].finished : Promise.resolve();
      done.then(function () { props.onGone(props.k); }, function () {});
    }
  }, [props.phase]);
  var text = String(props.text);
  var content = props.byLetter
    ? text.split(/(\\s+)/).map(function (word, w) {
        if (/^\\s+$/.test(word)) return word;
        return React.createElement('span', { key: w, style: { display: 'inline-block', whiteSpace: 'nowrap' } },
          word.split('').map(function (ch, c) { return React.createElement('span', { key: c, 'data-l': '', style: { display: 'inline-block' } }, ch); }));
      })
    : text;
  return React.createElement('span', {
    ref: ref,
    'aria-hidden': props.phase === 'out' ? true : undefined,
    style: { gridArea: '1 / 1', display: 'block', willChange: 'transform' },
  }, content);
};
var MaskSwap = function (props) {
  var value = props.value == null ? '' : String(props.value);
  var seq = React.useRef(0);
  var listState = React.useState(function () { return [{ k: 0, text: value, phase: 'in', dir: 1, animate: !!props.appear }]; });
  var list = listState[0], setList = listState[1];
  var shown = React.useRef(value);
  React.useLayoutEffect(function () {
    if (value === shown.current) return;
    shown.current = value;
    var dir = props.dir < 0 ? -1 : 1;
    seq.current += 1;
    var k = seq.current;
    setList(function (prev) {
      return prev.map(function (it) { return it.phase === 'out' ? it : Object.assign({}, it, { phase: 'out', dir: dir }); })
        .concat([{ k: k, text: value, phase: 'in', dir: dir, animate: true }]);
    });
  }, [value]);
  var onGone = React.useCallback(function (k) { setList(function (prev) { return prev.filter(function (it) { return it.k !== k; }); }); }, []);
  var duration = mockyIxNum(props.duration, 0, 3000, 650);
  return React.createElement(props.as || 'div', {
    className: props.className,
    style: Object.assign({ display: 'grid', overflow: 'hidden' }, props.style || null),
  }, list.map(function (it) {
    return React.createElement(MaskSwapItem, {
      key: it.k, k: it.k, text: it.text, phase: it.phase, dir: it.dir, animate: it.animate,
      duration: duration, outDuration: mockyIxNum(props.outDuration, 0, 3000, Math.round(duration * 0.6)),
      easing: props.easing || 'cubic-bezier(.2,.8,.2,1)', fade: !!props.fade,
      byLetter: props.by === 'letter', stagger: mockyIxNum(props.stagger, 0, 120, props.by === 'letter' ? 18 : 0),
      onGone: onGone,
    });
  }));
};

/* ---------- A picture that arrives like ink on paper ---------- */

var mockyIxRand = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
var InkReveal = function (props) {
  var id = mockyIxId(React.useId());
  var sheet = props.sheet, box = props.box;
  var vw = mockyIxNum(props.width, 10, 4000, box ? box[2] : 600);
  var vh = mockyIxNum(props.height, 10, 4000, box ? box[3] : 800);
  var count = Math.round(mockyIxNum(props.blobs, 1, 16, 7));
  var seed = Math.round(mockyIxNum(props.seed, 0, 1e9, 7));
  var blobs = React.useMemo(function () {
    var r = mockyIxRand(seed), out = [];
    for (var i = 0; i < count; i++) out.push({ cx: vw * (0.15 + 0.7 * r()), cy: vh * (0.1 + 0.8 * r()), delay: Math.round(420 * i / Math.max(1, count - 1) * (0.6 + 0.4 * r())) });
    return out;
  }, [count, seed, vw, vh]);
  var circles = React.useRef([]);
  var play = props.play !== false;
  var duration = mockyIxNum(props.duration, 100, 6000, 1250);
  var delay = mockyIxNum(props.delay, 0, 6000, 0);
  var maxR = Math.hypot(vw, vh) * 0.85;
  React.useEffect(function () {
    var nodes = circles.current;
    var set = function (r) { for (var i = 0; i < nodes.length; i++) if (nodes[i]) nodes[i].setAttribute('r', String(r(i))); };
    if (!play) { set(function () { return 0; }); return; }
    if (mockyIxStill()) { set(function () { return maxR; }); return; }
    set(function () { return 0; });
    var t0 = performance.now() + delay, raf = 0;
    var step = function (now) {
      var all = true;
      set(function (i) {
        var p = Math.max(0, Math.min(1, (now - t0 - blobs[i].delay) / duration));
        if (p < 1) all = false;
        return maxR * (1 - Math.pow(1 - p, 3));
      });
      if (!all) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
  }, [play, blobs, duration, delay, maxR, props.replay]);
  var image = sheet && box ? sheetCropSvg(sheet, box, vw, vh) : { href: props.src, x: 0, y: 0, width: vw, height: vh, preserveAspectRatio: 'xMidYMid slice' };
  var rough = mockyIxNum(props.roughness, 0, 400, 120);
  var className = typeof props.className === 'string' ? props.className : '';
  var sized = /(^|\\s)(aspect-|h-|min-h-|size-)/.test(className);
  return React.createElement('svg', {
    viewBox: '0 0 ' + vw + ' ' + vh,
    preserveAspectRatio: 'none',
    className: className,
    role: props.alt ? 'img' : undefined,
    'aria-label': props.alt || undefined,
    'aria-hidden': props.alt ? undefined : true,
    style: Object.assign({ display: 'block' }, sized ? null : { aspectRatio: vw + ' / ' + vh }, props.style || null),
  },
    React.createElement('defs', null,
      React.createElement('filter', { id: id + 'f', x: '-50%', y: '-50%', width: '200%', height: '200%' },
        React.createElement('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.011, numOctaves: 3, seed: seed }),
        React.createElement('feDisplacementMap', { in: 'SourceGraphic', scale: rough, xChannelSelector: 'R', yChannelSelector: 'G' })
      ),
      React.createElement('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: -vw / 2, y: -vh / 2, width: vw * 2, height: vh * 2 },
        React.createElement('g', { filter: 'url(#' + id + 'f)' },
          blobs.map(function (b, i) {
            return React.createElement('circle', { key: i, ref: function (n) { circles.current[i] = n; }, cx: b.cx, cy: b.cy, r: 0, fill: '#fff' });
          })
        )
      ),
      React.createElement('clipPath', { id: id + 'c' }, React.createElement('rect', { x: 0, y: 0, width: vw, height: vh }))
    ),
    React.createElement('g', { clipPath: 'url(#' + id + 'c)', mask: 'url(#' + id + 'm)' }, React.createElement('image', image))
  );
};

/* ---------- A colour that grows out of a point ---------- */

var ColorReveal = function (props) {
  var color = String(props.color || 'transparent');
  var base = React.useRef(color);
  var layer = React.useRef(null);
  var box = React.useRef(null);
  var paint = React.useState(color);
  var shownBase = paint[0], setBase = paint[1];
  var run = React.useRef(0);
  React.useLayoutEffect(function () {
    if (color === base.current) return;
    var el = layer.current, host = box.current;
    var from = base.current;
    base.current = color;
    cancelAnimationFrame(run.current);
    if (!el || !host || mockyIxStill()) { setBase(color); if (el) el.style.background = 'transparent'; return; }
    setBase(from);
    var rect = host.getBoundingClientRect();
    var o = props.origin || [50, 50];
    var cx = rect.width * o[0] / 100, cy = rect.height * o[1] / 100;
    var far = Math.max(Math.hypot(cx, cy), Math.hypot(rect.width - cx, cy), Math.hypot(cx, rect.height - cy), Math.hypot(rect.width - cx, rect.height - cy));
    var R = far * 1.45, dur = mockyIxNum(props.duration, 50, 4000, 420), t0 = performance.now();
    el.style.background = color;
    var step = function (now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      var r = R * e, f = Math.max(60, r * 0.35);
      var g = 'radial-gradient(circle at ' + cx + 'px ' + cy + 'px, #000 ' + Math.max(0, r - f) + 'px, transparent ' + r + 'px)';
      el.style.webkitMaskImage = g; el.style.maskImage = g;
      if (t < 1) run.current = requestAnimationFrame(step);
      else { setBase(color); el.style.background = 'transparent'; el.style.webkitMaskImage = ''; el.style.maskImage = ''; if (typeof props.onDone === 'function') props.onDone(color); }
    };
    run.current = requestAnimationFrame(step);
  }, [color]);
  React.useEffect(function () { return function () { cancelAnimationFrame(run.current); }; }, []);
  var className = typeof props.className === 'string' ? props.className : '';
  var placed = /(^|\\s)(?:[\\w-]+:)*(absolute|fixed|sticky|relative)(\\s|$)/.test(className);
  return React.createElement('div', {
    ref: box, className: className, 'aria-hidden': true,
    style: Object.assign({ background: shownBase, pointerEvents: 'none' }, placed ? null : { position: 'absolute', inset: 0 }, props.style || null),
  }, React.createElement('div', { ref: layer, style: { position: 'absolute', inset: 0 } }));
};

/* ---------- A cursor of the page's own ---------- */

var PointerRing = function (props) {
  var fine = React.useState(function () {
    try { return !window.__mockyStill && window.matchMedia('(pointer: fine)').matches; } catch (_) { return false; }
  })[0];
  var root = React.useRef(null), ring = React.useRef(null), dot = React.useRef(null), label = React.useRef(null);
  var states = props.states || {};
  var statesRef = React.useRef(states);
  statesRef.current = states;
  var size = mockyIxNum(props.size, 12, 200, 58);
  var color = props.color || '#141414';
  React.useEffect(function () {
    if (!fine) return;
    var style = document.createElement('style');
    style.setAttribute('data-mocky-pointer-ring', '');
    style.textContent = '@media (pointer: fine){html,body,a,button,[role=button],[data-cursor]{cursor:none!important}}';
    document.head.appendChild(style);
    var mx = -100, my = -100, x = -100, y = -100, raf = 0, last = 0, name = '';
    var apply = function (next) {
      if (next === name) return;
      name = next;
      var s = statesRef.current[name] || {};
      if (ring.current) {
        ring.current.style.transform = 'scale(' + (s.scale != null ? s.scale : 1) + ')';
        ring.current.style.background = s.fill || 'transparent';
        ring.current.style.borderColor = s.border || s.fill || color;
      }
      if (dot.current) dot.current.style.transform = 'scale(' + (s.dot === false ? 0 : 1) + ')';
      if (label.current) { label.current.textContent = s.label || ''; label.current.style.transform = 'scale(' + (s.label ? 1 : 0) + ')'; }
    };
    var stateAt = function (t) {
      t = t && t.closest ? t : null;
      var tagged = t && t.closest('[data-cursor]');
      return (tagged ? tagged.getAttribute('data-cursor') : (t && t.closest('a,button,[role=button]') && statesRef.current.link ? 'link' : '')) || '';
    };
    // A click changes what is under a pointer that has not moved — a cover
    // opens into a page — and the ring kept saying OPEN over the page until
    // the mouse moved again. Asked again once the page has answered the click.
    var recheck = function () {
      setTimeout(function () { var el = document.elementFromPoint(mx, my); if (el) apply(stateAt(el)); }, 80);
    };
    var onMove = function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      apply(stateAt(e.target));
      if (root.current) root.current.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(step);
    };
    var onLeave = function () { if (root.current) root.current.style.opacity = '0'; };
    var step = function (now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var k = mockyIxStill() ? 1 : 1 - Math.exp(-(props.follow || 16) * dt);
      x += (mx - x) * k; y += (my - y) * k;
      if (root.current) root.current.style.transform = 'translate3d(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px,0)';
      if (Math.abs(mx - x) > 0.1 || Math.abs(my - y) > 0.1) raf = requestAnimationFrame(step);
      else { raf = 0; last = 0; }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('click', recheck, true);
    window.addEventListener('keyup', recheck, true);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return function () {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('click', recheck, true);
      window.removeEventListener('keyup', recheck, true);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      style.remove();
    };
  }, [fine, size, color]);
  if (!fine) return null;
  var ease = 'cubic-bezier(.2,.8,.2,1)';
  return React.createElement('div', {
    ref: root, 'aria-hidden': true,
    style: { position: 'fixed', left: 0, top: 0, width: size, height: size, zIndex: 2147483000, pointerEvents: 'none', opacity: 0, transform: 'translate3d(-200px,-200px,0)' },
  },
    React.createElement('div', { ref: ring, style: { position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid ' + color, transition: 'transform .5s ' + ease + ', background-color .4s ' + ease + ', border-color .4s ' + ease } }),
    React.createElement('div', { ref: dot, style: { position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: -3, borderRadius: '50%', background: color, transition: 'transform .4s ' + ease } }),
    React.createElement('div', { ref: label, className: props.labelClassName, style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'pre-line', color: props.labelColor || '#fff', fontSize: 10, lineHeight: 1.25, letterSpacing: '.1em', fontWeight: 600, transform: 'scale(0)', transition: 'transform .45s ' + ease } })
  );
};

/* ---------- From one place to another: grow and fly ---------- */

var mockyMorphRuns = typeof WeakMap === 'function' ? new WeakMap() : null;
var mockyRectOf = function (x) {
  if (!x) return null;
  if (typeof x.getBoundingClientRect === 'function') return x.getBoundingClientRect();
  if (typeof x.left === 'number' && typeof x.top === 'number') {
    return { left: x.left, top: x.top, width: x.width, height: x.height, right: x.left + x.width, bottom: x.top + x.height };
  }
  return null;
};
var MockyMorph = {
  // The element (a dialog, a page) appears by growing out of \`from\` — an
  // element or a rect — straightening a tilt on the way. Called again with
  // { reverse: true } while it is still growing, it turns back from where it
  // is instead of jumping: that is what closing during the entrance looks like.
  grow: function (el, from, o) {
    o = o || {};
    if (!el || !el.animate) return Promise.resolve();
    var prev = mockyMorphRuns && mockyMorphRuns.get(el);
    var reverse = !!o.reverse;
    // Turned back mid-way: the same animation plays the other way from where it
    // is. updatePlaybackRate and not reverse(): on an animation still pending
    // (its first frame not drawn yet), reverse() jumps to the END first — a
    // dialog closed right after its click flashed full-screen, measured.
    var live = prev && (prev.anim.playState === 'running' || prev.anim.pending);
    if (live && prev.reverse !== reverse) {
      prev.anim.updatePlaybackRate(-prev.anim.playbackRate); prev.reverse = reverse;
      return prev.anim.finished.then(function () {}, function () {});
    }
    if (prev) { try { prev.anim.cancel(); } catch (_) {} }
    var R = el.getBoundingClientRect(), F = mockyRectOf(from) || R;
    var rad = o.radius != null ? o.radius : 3;
    var small = 'inset(' + (F.top - R.top) + 'px ' + (R.right - F.right) + 'px ' + (R.bottom - F.bottom) + 'px ' + (F.left - R.left) + 'px round ' + rad + 'px)';
    var big = 'inset(0px 0px 0px 0px round 0px)';
    var rot = o.rotate || 0;
    el.style.transformOrigin = (F.left - R.left + F.width / 2) + 'px ' + (F.top - R.top + F.height / 2) + 'px';
    var a = { clipPath: small, transform: 'rotate(' + rot + 'deg)' }, b = { clipPath: big, transform: 'rotate(0deg)' };
    var still = mockyIxStill();
    var anim = el.animate(reverse ? [b, a] : [a, b], {
      duration: still ? 1 : (o.duration || (reverse ? 850 : 1050)),
      easing: o.easing || 'cubic-bezier(.76,0,.18,1)',
      fill: 'both',
    });
    if (mockyMorphRuns) mockyMorphRuns.set(el, { anim: anim, reverse: reverse });
    return anim.finished.then(function () {}, function () {});
  },
  // A copy of \`from\` (an element or a rect + o.content) flies onto \`to\`; the
  // real \`to\` stays hidden until it lands, so there is never two of it.
  fly: function (from, to, o) {
    o = o || {};
    var F = mockyRectOf(from), T = mockyRectOf(to);
    if (!F || !T || !document.body.animate) return Promise.resolve();
    var src = o.content || (from && from.cloneNode ? from : null);
    var ghost = src ? src.cloneNode(true) : document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { position: 'fixed', left: F.left + 'px', top: F.top + 'px', width: F.width + 'px', height: F.height + 'px', margin: '0', zIndex: '2147482000', pointerEvents: 'none', transformOrigin: '0 0', boxSizing: 'border-box' });
    document.body.appendChild(ghost);
    var hide = o.hideTarget !== false && to && to.style;
    var prevVis = hide ? to.style.visibility : '';
    if (hide) to.style.visibility = 'hidden';
    var sx = T.width / Math.max(1, F.width), sy = T.height / Math.max(1, F.height);
    var dx = T.left - F.left, dy = T.top - F.top;
    var frames = [{ transform: 'translate(0px,0px) scale(1,1)', opacity: 1 }];
    if (o.lift) frames.push({ transform: 'translate(' + dx * 0.4 + 'px,' + (dy * 0.4 - o.lift) + 'px) scale(' + (1 + (sx - 1) * 0.4) + ',' + (1 + (sy - 1) * 0.4) + ')', opacity: 1, offset: 0.45 });
    frames.push({ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' + (o.rotate ? ' rotate(' + o.rotate + 'deg)' : ''), opacity: o.endOpacity != null ? o.endOpacity : 1 });
    var anim = ghost.animate(frames, { duration: mockyIxStill() ? 1 : (o.duration || 300), delay: o.delay || 0, easing: o.easing || 'cubic-bezier(.25,.75,.25,1)', fill: 'both' });
    return anim.finished.then(function () {}, function () {}).then(function () {
      ghost.remove();
      if (hide) to.style.visibility = prevVis;
    });
  },
};`

export const INTERACT_EXPORTS = ['SheetCrop', 'sheetCropSvg', 'sheetCropMask', 'useGlideTrack', 'MaskSwap', 'InkReveal', 'ColorReveal', 'PointerRing', 'MockyMorph'] as const
