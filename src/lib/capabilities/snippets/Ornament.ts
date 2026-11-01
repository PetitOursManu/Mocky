import { ORNAMENTS, ORNAMENT_PATTERN_IDS } from '../../ornaments'

/**
 * Ornament — a decorative shape out of a closed catalogue:
 * `<Ornament shape="squiggle" color="#e11d48" className="absolute -bottom-3 left-0 w-48" />`.
 *
 * The catalogue is `lib/ornaments.ts`; this file only draws one. It is an inline
 * SVG rather than a mask like `<ShapeFrame>`, because there is no picture to cut:
 * the shape IS the drawing, and an inline SVG is what every renderer of a page
 * already copies as it is — the canvas, html2canvas in the capture shell, and
 * the native rasteriser of the document exports.
 *
 * WHAT IT NEVER DOES
 *
 * It never carries meaning: `aria-hidden`, no pointer events, no text. And it
 * never moves unless `draw` asks for it, which is honoured only where an
 * entrance is: the "Sans animation" switch, a hidden document, reduced motion
 * and a capture frame (`__mockyStill`) all get the finished stroke at once —
 * a squiggle frozen at its first frame is an empty box on paper.
 *
 * Exported as a STRING so it can be prepended to the generated component before
 * Babel.transform, like every other snippet pack.
 */

/** The stored shapes, short keys: kind ('f' fill, 'l' line), ratio, path. Patterns are drawn below. */
const RUNTIME = Object.fromEntries(ORNAMENTS.filter((o) => o.kind !== 'pattern').map((o) => [o.id, { k: o.kind === 'fill' ? 'f' : 'l', r: o.ratio, d: o.d }]))

/** The density each texture looks right at when the page gives none. */
export const PATTERN_DENSITY: Record<(typeof ORNAMENT_PATTERN_IDS)[number], number> = {
  dots: 10,
  grid: 8,
  stripes: 8,
  diagonal: 10,
  checker: 8,
  halftone: 12,
  waves: 8,
  crosses: 8,
  confetti: 10,
}

export const OrnamentSource = `var MOCKY_ORNAMENTS = ${JSON.stringify(RUNTIME)};
var MOCKY_ORNAMENT_DENSITY = ${JSON.stringify(PATTERN_DENSITY)};
var mockyOrnColor = function (v, fallback) {
  return typeof v === 'string' && /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[a-zA-Z]{3,20})$/.test(v) ? v : fallback;
};
var mockyOrnNum = function (v, lo, hi, fallback) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
var mockyOrnR = function (n) { return Math.round(n * 100) / 100; };
/* A texture's geometry, made at render time from its name and a density, in
   the 100-unit square the SVG slices over its box. Stroke textures carry
   non-scaling strokes so a dense grid is not a grid of hairlines. */
var mockyOrnPattern = function (id, n, color, accent, weight) {
  var cell = 100 / n, out = [], i, j, k = 0;
  var dot = function (x, y, r, fill) { out.push(React.createElement('circle', { key: k++, cx: mockyOrnR(x), cy: mockyOrnR(y), r: mockyOrnR(r), fill: fill })); };
  var box = function (x, y, w, h, fill, rot) { out.push(React.createElement('rect', { key: k++, x: mockyOrnR(x), y: mockyOrnR(y), width: mockyOrnR(w), height: mockyOrnR(h), fill: fill, transform: rot ? 'rotate(' + rot + ' ' + mockyOrnR(x + w / 2) + ' ' + mockyOrnR(y + h / 2) + ')' : undefined })); };
  var line = function (d) { out.push(React.createElement('path', { key: k++, d: d, fill: 'none', stroke: color, strokeWidth: weight, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' })); };
  if (id === 'dots') { for (i = 0; i < n; i++) for (j = 0; j < n; j++) dot((i + 0.5) * cell, (j + 0.5) * cell, cell * 0.18, color); }
  else if (id === 'halftone') { for (i = 0; i < n; i++) for (j = 0; j < n; j++) dot((i + 0.5) * cell, (j + 0.5) * cell, cell * 0.46 * (i + j + 1) / (2 * n - 1), color); }
  else if (id === 'grid') { var g = ''; for (i = 0; i <= n; i++) g += 'M' + mockyOrnR(i * cell) + ' 0V100M0 ' + mockyOrnR(i * cell) + 'H100'; line(g); }
  else if (id === 'stripes') { for (i = 0; i < n; i++) box(0, i * cell, 100, cell / 2, color); }
  else if (id === 'diagonal') { var dg = ''; for (i = 0; i <= 2 * n; i++) dg += 'M' + mockyOrnR(i * cell - 100) + ' 100L' + mockyOrnR(i * cell) + ' 0'; line(dg); }
  else if (id === 'checker') { for (i = 0; i < n; i++) for (j = 0; j < n; j++) { if ((i + j) % 2 === 0) box(i * cell, j * cell, cell, cell, color); else if (accent) box(i * cell, j * cell, cell, cell, accent); } }
  else if (id === 'waves') {
    var w = '';
    for (j = 0; j < n; j++) {
      var y = (j + 0.5) * cell;
      w += 'M0 ' + mockyOrnR(y);
      for (i = 0; i < n * 2; i++) w += 'Q' + mockyOrnR((i + 0.5) * cell / 2) + ' ' + mockyOrnR(y + (i % 2 ? 1 : -1) * cell * 0.3) + ' ' + mockyOrnR((i + 1) * cell / 2) + ' ' + mockyOrnR(y);
    }
    line(w);
  }
  else if (id === 'crosses') { var c = '', a = cell * 0.18; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var cx = (i + 0.5) * cell, cy = (j + 0.5) * cell; c += 'M' + mockyOrnR(cx - a) + ' ' + mockyOrnR(cy) + 'H' + mockyOrnR(cx + a) + 'M' + mockyOrnR(cx) + ' ' + mockyOrnR(cy - a) + 'V' + mockyOrnR(cy + a); } line(c); }
  else if (id === 'confetti') {
    /* mulberry32 on a fixed seed: the same scatter on every render, in every
       export and in every capture — a texture that moved between two renders of
       one page would read as a bug. */
    var s = 7 >>> 0;
    var rand = function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (i = 0; i < n * 3; i++) {
      var fill = accent && i % 2 ? accent : color;
      var x = rand() * 100, yy = rand() * 100, size = cell * (0.25 + rand() * 0.25);
      if (rand() < 0.4) dot(x, yy, size / 2, fill); else box(x, yy, size * 1.8, size * 0.6, fill, Math.round(rand() * 180));
    }
  }
  return out;
};
var mockyOrnStill = function () {
  try {
    if (window.__mockyAnimations === false || window.__mockyStill || document.hidden) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { return true; }
  return false;
};
var Ornament = function (props) {
  var id = props && props.shape;
  var s = MOCKY_ORNAMENTS[id];
  var pattern = !s && Object.prototype.hasOwnProperty.call(MOCKY_ORNAMENT_DENSITY, id);
  var className = typeof props.className === 'string' ? props.className : '';
  var color = mockyOrnColor(props.color, 'currentColor');
  var accent = mockyOrnColor(props.accent, null);
  var line = !!s && s.k === 'l';
  var weight = mockyOrnNum(props.weight, 0.5, 24, line ? 3 : 1.5);
  var draw = line && !!props.draw;
  var delay = mockyOrnNum(props.delay, 0, 3, 0);

  /* Hooks before any return, every render: see Animated's note on why. */
  var still = React.useRef(null);
  if (still.current === null) still.current = mockyOrnStill();
  var ref = React.useRef(null);
  var drawn = React.useState(!draw || still.current);
  var isDrawn = drawn[0], setDrawn = drawn[1];
  React.useEffect(function () {
    if (isDrawn) return;
    var node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setDrawn(true); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { setDrawn(true); io.disconnect(); return; }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(node);
    return function () { io.disconnect(); };
  }, [isDrawn]);

  /* An unknown name draws nothing: a decoration that is not there is never wrong. */
  if (!s && !pattern) return null;

  var sized = /(^|\\s)(?:[\\w-]+:)*(aspect-|h-|min-h-|size-|inset-|inset-y-)/.test(className);
  var rotate = mockyOrnNum(props.rotate, -180, 180, 0);
  var flip = props.flip === 'y' ? 'scaleY(-1)' : props.flip ? 'scaleX(-1)' : '';
  var transform = [rotate ? 'rotate(' + rotate + 'deg)' : '', flip].filter(Boolean).join(' ');
  var children;
  if (pattern) {
    children = mockyOrnPattern(id, Math.round(mockyOrnNum(props.density, 3, 40, MOCKY_ORNAMENT_DENSITY[id])), color, accent, weight);
  } else if (line) {
    children = React.createElement('path', {
      d: s.d, fill: 'none', stroke: color, strokeWidth: weight, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke',
      pathLength: draw ? 1 : undefined,
      style: draw ? { strokeDasharray: 1, strokeDashoffset: isDrawn ? 0 : 1, transition: still.current ? 'none' : 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1) ' + delay + 's' } : undefined
    });
  } else {
    children = React.createElement('path', { d: s.d, fill: color, fillRule: 'evenodd' });
  }
  return React.createElement(
    'svg',
    {
      ref: ref,
      'data-mocky-ornament': id,
      viewBox: '0 0 100 100',
      preserveAspectRatio: pattern ? 'xMidYMid slice' : 'none',
      'aria-hidden': true,
      focusable: 'false',
      className: className,
      style: Object.assign(
        { display: 'block', overflow: line ? 'visible' : 'hidden', pointerEvents: 'none' },
        sized ? null : { aspectRatio: String(pattern ? 1 : s.r) },
        transform ? { transform: transform } : null,
        props.opacity != null ? { opacity: mockyOrnNum(props.opacity, 0, 1, 1) } : null,
        props.style && typeof props.style === 'object' ? props.style : null
      ),
    },
    children
  );
};`

export const ORNAMENT_EXPORTS = ['Ornament'] as const

/** The textures the snippet knows how to draw — held equal to `ORNAMENT_PATTERN_IDS` by the test. */
export const ORNAMENT_PATTERNS = Object.keys(PATTERN_DENSITY)
