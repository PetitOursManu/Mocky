/**
 * Depth without WebGL: volumes, a camera, and the tweens that move them.
 *
 * WHY CSS AND NOT three.js
 *
 * The reference frames (plans/sites-interactifs.md, "Révisé le 22/11") show
 * three kinds of depth: boxes on a shelf whose spine and cover are both seen
 * while they turn, a product seen from the front and from the back, and flat
 * prints on the walls of a passage the camera walks along. All three are planes
 * in space — what CSS `preserve-3d` draws natively. Drawn there, a print the
 * visitor clicks IS the element under the pointer (no ray casting, both walls),
 * the rectangle a detail page grows out of IS its getBoundingClientRect (no
 * projection), a picture from another site needs no CORS (it is a background,
 * not a texture), and not one WebGL context is spent (the budget in Canvas.tsx
 * stays the scenes'). What CSS cannot draw — a curved, lit volume seen edge-on —
 * stays `<Scene3D>`'s.
 *
 * Coordinates: inside a `<Space3D>`, units are WORLD units (metres, say) with
 * y UP, converted once by `scale` px per unit — the convention of a 3D scene
 * description, so a brief written for three.js reads unchanged. A `<Box3D>` on
 * its own is in pixels, like the page around it.
 *
 * This file is the second source of the `interact` pack: it reuses
 * `mockyIxStill` and `mockyIxNum` from the first.
 */
export const Interact3DSource = `var MOCKY_EASE = {
  linear: function (t) { return t; },
  quadOut: function (t) { return 1 - (1 - t) * (1 - t); },
  cubicOut: function (t) { return 1 - Math.pow(1 - t, 3); },
  quartOut: function (t) { return 1 - Math.pow(1 - t, 4); },
  expoOut: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  sineInOut: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
  cubicInOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
};
// cubic-bezier(x1, y1, x2, y2) as a function of time: x(s) solved for s by
// Newton then bisection, the way a browser does, so a curve copied from a
// brief's CSS moves a camera exactly as it moves an element.
var mockyBezier = function (x1, y1, x2, y2) {
  var bx = function (s) { return 3 * x1 * s * (1 - s) * (1 - s) + 3 * x2 * s * s * (1 - s) + s * s * s; };
  var by = function (s) { return 3 * y1 * s * (1 - s) * (1 - s) + 3 * y2 * s * s * (1 - s) + s * s * s; };
  var dx = function (s) { return 3 * x1 * (1 - s) * (1 - s) + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s; };
  return function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var s = t;
    for (var i = 0; i < 8; i++) {
      var e = bx(s) - t, d = dx(s);
      if (Math.abs(e) < 1e-6) return by(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    var lo = 0, hi = 1; s = t;
    for (var j = 0; j < 30; j++) { var v = bx(s); if (Math.abs(v - t) < 1e-6) break; if (v < t) lo = s; else hi = s; s = (lo + hi) / 2; }
    return by(s);
  };
};
var mockyEaseOf = function (e) {
  if (typeof e === 'function') return e;
  if (Array.isArray(e) && e.length === 4) return mockyBezier(e[0], e[1], e[2], e[3]);
  return MOCKY_EASE[e] || MOCKY_EASE.cubicOut;
};

/* ---------- A value that travels to its target over a duration ---------- */

var useTweened = function (target, options) {
  var o = options || {};
  var isObj = target !== null && typeof target === 'object';
  var key = JSON.stringify(target);
  var st = React.useRef(null);
  if (!st.current) st.current = { value: target, from: target, to: target, t0: 0, raf: 0 };
  var s = st.current;
  var tick = React.useReducer(function (x) { return x + 1; }, 0)[1];
  var optsRef = React.useRef(o);
  optsRef.current = o;
  React.useLayoutEffect(function () {
    if (key === JSON.stringify(s.to)) return;
    s.from = s.value; s.to = target; s.t0 = performance.now();
    var dur = mockyIxNum(optsRef.current.duration, 0, 20000, 600);
    if (mockyIxStill() || dur === 0) { s.value = target; tick(); return; }
    var ease = optsRef.current.easing;
    var step = function (now) {
      var t = Math.min(1, (now - s.t0) / dur);
      if (isObj) {
        var out = {};
        for (var k in s.to) {
          var a = s.from && typeof s.from[k] === 'number' ? s.from[k] : s.to[k];
          var f = mockyEaseOf(ease && typeof ease === 'object' && !Array.isArray(ease) ? ease[k] : ease);
          out[k] = a + (s.to[k] - a) * f(t);
        }
        s.value = out;
      } else {
        var a0 = typeof s.from === 'number' ? s.from : s.to;
        s.value = a0 + (s.to - a0) * mockyEaseOf(ease)(t);
      }
      tick();
      if (t < 1) s.raf = requestAnimationFrame(step);
      else { s.raf = 0; if (typeof optsRef.current.onDone === 'function') optsRef.current.onDone(s.value); }
    };
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(step);
  }, [key]);
  React.useEffect(function () { return function () { cancelAnimationFrame(s.raf); }; }, []);
  return s.value;
};

/* ---------- The viewport, as numbers ---------- */

var useViewportSize = function () {
  var read = function () { return { w: window.innerWidth || 0, h: window.innerHeight || 0 }; };
  var st = React.useState(read);
  React.useEffect(function () {
    var on = function () { st[1](read()); };
    window.addEventListener('resize', on);
    return function () { window.removeEventListener('resize', on); };
  }, []);
  return st[0];
};

/* ---------- Lines that rise out of their own masks ---------- */

var MaskRise = function (props) {
  var play = props.play !== false;
  var refs = React.useRef([]);
  var items = React.Children.toArray(props.children);
  var from = mockyIxNum(props.from, 0, 300, 110);
  React.useLayoutEffect(function () {
    var nodes = refs.current;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el) continue;
      if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); });
      if (!play) { el.style.transform = 'translateY(' + from + '%)'; continue; }
      el.style.transform = '';
      if (mockyIxStill() || !el.animate) continue;
      el.animate([{ transform: 'translateY(' + from + '%)' }, { transform: 'translateY(0)' }], {
        duration: mockyIxNum(props.duration, 0, 4000, 900),
        delay: mockyIxNum(props.delay, 0, 6000, 0) + i * mockyIxNum(props.stagger, 0, 1000, 75),
        easing: props.easing || 'cubic-bezier(.2,.8,.2,1)',
        fill: 'backwards',
      });
    }
  }, [play, items.length]);
  return React.createElement(props.as || 'div', { className: props.className, style: props.style },
    items.map(function (child, i) {
      return React.createElement('div', { key: i, style: { overflow: 'hidden' } },
        React.createElement('div', { ref: function (n) { refs.current[i] = n; }, style: { transform: play ? undefined : 'translateY(' + from + '%)' } }, child));
    }));
};

// A ref the page passes AND one the component needs, on one element.
var mockyMergeRefs = function (a, b) {
  return function (node) {
    [a, b].forEach(function (r) { if (typeof r === 'function') r(node); else if (r) r.current = node; });
  };
};

/* ---------- A box with six faces, lit ---------- */

// The rotation the box gets, as CSS composes it: rotateZ · rotateX · rotateY.
// Used for one thing only — to know where each face points, so its shade
// follows the turn the way light falls on a real box.
var mockyRot = function (rx, ry, rz) {
  var a = rx * Math.PI / 180, b = ry * Math.PI / 180, c = rz * Math.PI / 180;
  var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  var X = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]];
  var Y = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]];
  var Z = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]];
  var mul = function (p, q) {
    var r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) r[i][j] += p[i][k] * q[k][j];
    return r;
  };
  return mul(mul(Z, X), Y);
};
var mockyApply = function (m, v) {
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
};
// CSS axes: x right, y DOWN, z towards the viewer. Normals of the six faces.
var MOCKY_BOX_FACES = {
  front: { n: [0, 0, 1] }, back: { n: [0, 0, -1] }, right: { n: [1, 0, 0] },
  left: { n: [-1, 0, 0] }, top: { n: [0, -1, 0] }, bottom: { n: [0, 1, 0] },
};
var mockyBoxShade = function (rx, ry, rz, face, light) {
  var n = mockyApply(mockyRot(rx, ry, rz), MOCKY_BOX_FACES[face].n);
  var L = light || [-0.35, -0.45, 1];
  var len = Math.hypot(L[0], L[1], L[2]) || 1;
  return { lambert: Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len), normal: n };
};
var Box3D = React.forwardRef(function (props, ref) {
  var w = mockyIxNum(props.w, 0, 10000, 100), h = mockyIxNum(props.h, 0, 10000, 100), d = mockyIxNum(props.d, 0, 10000, 20);
  var rx = mockyIxNum(props.rotateX, -100000, 100000, 0), ry = mockyIxNum(props.rotateY, -100000, 100000, 0), rz = mockyIxNum(props.rotateZ, -100000, 100000, 0);
  var x = mockyIxNum(props.x, -1e6, 1e6, 0), y = mockyIxNum(props.y, -1e6, 1e6, 0), z = mockyIxNum(props.z, -1e6, 1e6, 0);
  var shade = mockyIxNum(props.shade, 0, 1, 0.55);
  var gloss = mockyIxNum(props.gloss, 0, 1, 0);
  var className = typeof props.className === 'string' ? props.className : '';
  var placed = /(^|\\s)(?:[\\w-]+:)*(absolute|fixed|sticky|relative)(\\s|$)/.test(className);
  var geo = {
    front: [w, h, 'translateZ(' + d / 2 + 'px)'],
    back: [w, h, 'rotateY(180deg) translateZ(' + d / 2 + 'px)'],
    right: [d, h, 'rotateY(90deg) translateZ(' + w / 2 + 'px)'],
    left: [d, h, 'rotateY(-90deg) translateZ(' + w / 2 + 'px)'],
    top: [w, d, 'rotateX(90deg) translateZ(' + h / 2 + 'px)'],
    bottom: [w, d, 'rotateX(-90deg) translateZ(' + h / 2 + 'px)'],
  };
  var faces = Object.keys(geo).filter(function (k) { return props[k] != null; }).map(function (k) {
    var g = geo[k];
    var lit = mockyBoxShade(rx, ry, rz, k, props.light);
    var dark = shade * (1 - lit.lambert);
    var sheenAt = 50 + lit.normal[0] * 70;
    return React.createElement('div', {
      key: k, 'data-face': k, className: props.faceClassName,
      style: Object.assign({
        position: 'absolute', left: (w - g[0]) / 2, top: (h - g[1]) / 2, width: g[0], height: g[1],
        transform: g[2], backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', overflow: 'hidden',
      }, props.faceStyle || null),
    },
      props[k],
      dark > 0.002 ? React.createElement('div', { 'aria-hidden': true, style: { position: 'absolute', inset: 0, background: '#000', opacity: dark, pointerEvents: 'none' } }) : null,
      gloss > 0 && (k === 'front' || k === 'back') ? React.createElement('div', { 'aria-hidden': true, style: { position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: 'linear-gradient(105deg, transparent ' + (sheenAt - 22) + '%, rgba(255,255,255,' + 0.55 * gloss + ') ' + sheenAt + '%, transparent ' + (sheenAt + 22) + '%)' } }) : null
    );
  });
  var rest = {};
  for (var p in props) if (/^(on[A-Z]|data-|aria-|role$|tabIndex$|id$|title$)/.test(p)) rest[p] = props[p];
  return React.createElement('div', Object.assign(rest, {
    ref: ref, className: className,
    style: Object.assign(
      placed ? {} : { position: 'relative' },
      { width: w, height: h, transformStyle: 'preserve-3d', transform: 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) rotateZ(' + rz + 'deg) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)' },
      props.style || null
    ),
  }), faces, props.children);
});

/* ---------- A world, a camera, and things placed in it ---------- */

var MockySpaceContext = React.createContext(null);
// Where a world point stands for the camera: how far ahead, and how far.
var mockyView = function (cam, p) {
  var vx = p[0] - (cam.x || 0), vy = p[1] - (cam.y || 0), vz = p[2] - (cam.z || 0);
  var yaw = cam.yaw || 0, pitch = cam.pitch || 0;
  var fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
  return { ahead: vx * fx + vy * fy + vz * fz, dist: Math.hypot(vx, vy, vz) };
};
// The page's ref (useGlideTrack's bind.ref reads the wheel on it) is merged
// with the one that measures the height: a function component drops a ref it
// is not forwarded, and the walk ignored the wheel.
var Space3D = React.forwardRef(function (props, outerRef) {
  var cam = props.camera || {};
  var box = React.useRef(null);
  // Stable across renders: a new callback each frame would detach and
  // re-attach the wheel listener sixty times a second.
  var merged = React.useMemo(function () { return mockyMergeRefs(box, outerRef); }, [outerRef]);
  var hs = React.useState(0), h = hs[0], setH = hs[1];
  React.useLayoutEffect(function () {
    var el = box.current;
    if (!el) return;
    var read = function () { setH(el.clientHeight || window.innerHeight || 0); };
    read();
    if (typeof ResizeObserver === 'function') { var ro = new ResizeObserver(read); ro.observe(el); return function () { ro.disconnect(); }; }
    window.addEventListener('resize', read);
    return function () { window.removeEventListener('resize', read); };
  }, []);
  var fov = mockyIxNum(props.fov, 10, 150, 56);
  var s = mockyIxNum(props.scale, 0.01, 10000, 100);
  var P = (h || 600) / 2 / Math.tan(fov * Math.PI / 360);
  var ctx = { cam: cam, scale: s, fog: props.fog || null, near: mockyIxNum(props.near, 0, 1000, 0.1) };
  var className = typeof props.className === 'string' ? props.className : '';
  var placed = /(^|\\s)(?:[\\w-]+:)*(absolute|fixed|sticky|relative)(\\s|$)/.test(className);
  var rest = {};
  for (var p in props) if (/^(on[A-Z]|data-|aria-|role$|tabIndex$|id$)/.test(p)) rest[p] = props[p];
  return React.createElement('div', Object.assign(rest, {
    ref: merged, className: className,
    style: Object.assign(placed ? {} : { position: 'relative' }, { overflow: 'hidden', perspective: P + 'px', perspectiveOrigin: '50% 50%' }, props.style || null),
  }),
    React.createElement('div', {
      'data-mocky-world': '',
      style: {
        position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transformStyle: 'preserve-3d',
        transform: 'translateZ(' + P + 'px) rotateX(' + (cam.pitch || 0) + 'rad) rotateY(' + -(cam.yaw || 0) + 'rad) translate3d(' + -(cam.x || 0) * s + 'px,' + (cam.y || 0) * s + 'px,' + -(cam.z || 0) * s + 'px)',
      },
    }, React.createElement(MockySpaceContext.Provider, { value: ctx }, props.children)),
    props.overlay || null
  );
});
var Place3D = React.forwardRef(function (props, ref) {
  var ctx = React.useContext(MockySpaceContext);
  var at = props.at || [0, 0, 0];
  var s = ctx ? ctx.scale : 1;
  var hidden = false, opacity = 1;
  if (ctx) {
    var v = mockyView(ctx.cam, at);
    var radius = mockyIxNum(props.radius, 0, 1e6, 1);
    // Behind the eye a CSS plane is not clipped but turned inside out; a thing
    // wholly behind the camera is not drawn at all.
    if (props.cull !== false && v.ahead + radius < ctx.near) hidden = true;
    if (ctx.fog && props.fog !== false) {
      var f0 = ctx.fog[0], f1 = ctx.fog[1];
      opacity = 1 - Math.max(0, Math.min(1, (v.dist - f0) / Math.max(1e-6, f1 - f0)));
      if (opacity < 0.01) hidden = true;
    }
  }
  var rest = {};
  for (var p in props) if (/^(on[A-Z]|data-|aria-|role$|tabIndex$|id$|title$)/.test(p)) rest[p] = props[p];
  return React.createElement('div', {
    style: {
      position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformStyle: 'preserve-3d',
      display: hidden ? 'none' : undefined,
      transform: 'translate3d(' + at[0] * s + 'px,' + -at[1] * s + 'px,' + at[2] * s + 'px) rotateY(' + (props.yaw || 0) + 'rad) rotateX(' + (props.pitch || 0) + 'rad) rotateZ(' + (props.roll || 0) + 'rad)',
    },
  }, React.createElement('div', Object.assign(rest, {
    ref: ref, className: props.className,
    style: Object.assign({ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%)', transformStyle: 'preserve-3d', opacity: opacity < 1 ? opacity : undefined }, props.style || null),
  }), props.children));
});
// Helpers for the arithmetic every walk-through needs. Angles in radians,
// world axes with y up; a ring lies in the x–z plane around the origin.
var MockySpace = {
  // The yaw that makes an object at \`from\` face the point \`to\`.
  facing: function (from, to) { return Math.atan2(to[0] - from[0], to[2] - from[2]); },
  // The camera yaw that looks from \`from\` towards \`to\`.
  look: function (from, to) { return Math.atan2(-(to[0] - from[0]), -(to[2] - from[2])); },
  // A point on a ring of radius r at angle a, at height y.
  ring: function (a, r, y) { return [r * Math.cos(a), y || 0, r * Math.sin(a)]; },
  // The pixel rectangle of an element, wherever it is in space.
  rect: function (el) { return el && el.getBoundingClientRect ? el.getBoundingClientRect() : null; },
};
// The walls of a round room or a curved passage: a ring of panels, each
// facing the axis (inside) or away from it.
var Ring3D = function (props) {
  var r = mockyIxNum(props.radius, 0.01, 1e5, 10);
  var n = Math.round(mockyIxNum(props.segments, 3, 360, 48));
  var hgt = mockyIxNum(props.height, 0.01, 1e5, 3);
  var y = props.y != null ? props.y : hgt / 2;
  var ctx = React.useContext(MockySpaceContext);
  var s = ctx ? ctx.scale : 1;
  var width = 2 * r * Math.tan(Math.PI / n) * 1.02;
  var panels = [];
  for (var i = 0; i < n; i++) {
    var a = (i + 0.5) * 2 * Math.PI / n;
    var at = MockySpace.ring(a, r, y);
    var yaw = props.inside === false ? MockySpace.facing([0, y, 0], at) : MockySpace.facing(at, [0, y, 0]);
    panels.push(React.createElement(Place3D, { key: i, at: at, yaw: yaw, radius: width, fog: props.fog },
      React.createElement('div', { 'aria-hidden': true, style: { width: width * s, height: hgt * s, background: props.background || '#f5ebd8', backfaceVisibility: 'hidden' } })));
  }
  return panels;
};`

export const INTERACT3D_EXPORTS = ['useTweened', 'useViewportSize', 'MaskRise', 'Box3D', 'Space3D', 'Place3D', 'Ring3D', 'MockySpace'] as const
