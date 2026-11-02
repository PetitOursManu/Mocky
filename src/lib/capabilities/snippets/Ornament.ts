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

const KIND_KEY = { fill: 'f', fluid: 'u', line: 'l', motion: 'm' } as const
const PAINT_KEY = { color: 0, accent: 1, light: 2 } as const

/**
 * The stored shapes, short keys: kind ('f' fill, 'u' fluid, 'l' line, 'm'
 * motion), ratio, path, `z` for a nonzero fill, `m` for how a motion moves, and
 * `L` its layers as `[d, paint, stroke width, opacity, flags]` — flags 1 solid,
 * 2 moves. Patterns are drawn below.
 */
const RUNTIME = Object.fromEntries(
  ORNAMENTS.filter((o) => o.kind !== 'pattern').map((o) => [
    o.id,
    {
      k: KIND_KEY[o.kind as keyof typeof KIND_KEY],
      r: o.ratio,
      d: o.d,
      ...(o.nonzero ? { z: 1 } : {}),
      ...(o.motion ? { m: o.motion === 'spin' ? 's' : 'p' } : {}),
      ...(o.layers?.length
        ? { L: o.layers.map((l) => [l.d, PAINT_KEY[l.paint ?? 'color'], l.stroke ?? 0, l.opacity ?? 1, (l.solid ? 1 : 0) | (l.moves ? 2 : 0)]) }
        : {}),
    },
  ]),
)

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
  triangles: 8,
  rings: 8,
  scales: 8,
  bricks: 8,
  zigzags: 8,
  speckle: 10,
  diamonds: 8,
  'dot-matrix': 10,
  'dash-weave': 8,
  lattice: 8,
  'tri-grid': 6,
  honeycomb: 6,
  cubes: 5,
  herringbone: 8,
  rays: 12,
  'offset-squares': 8,
  capsules: 6,
  plaid: 5,
  pinwheels: 5,
  crosshatch: 10,
  'cross-stitch': 8,
  'half-discs': 6,
  'duo-stripes': 6,
  'crosshatch-dots': 8,
  harlequin: 6,
  fans: 5,
  barcode: 4,
  circuit: 6,
  meander: 6,
  concentric: 8,
  'zigzag-fields': 6,
  ladders: 6,
  orbits: 6,
  'split-squares': 6,
  dashes: 8,
  'graph-paper': 12,
  'pixel-waves': 6,
}

export const OrnamentSource = `var MOCKY_ORNAMENTS = ${JSON.stringify(RUNTIME)};
var MOCKY_ORNAMENT_DENSITY = ${JSON.stringify(PATTERN_DENSITY)};
/* What a motion does, once per document: a turn about its own centre, or a beat. */
(function () {
  try {
    if (document.getElementById('mocky-orn-kf')) return;
    var st = document.createElement('style');
    st.id = 'mocky-orn-kf';
    st.textContent = '@keyframes mocky-orn-spin{to{transform:rotate(360deg)}}@keyframes mocky-orn-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.78);opacity:0.5}}';
    document.head.appendChild(st);
  } catch (e) {}
})();
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
  /* The second colour of a two-tone texture; with none given, the first one again. */
  var acc = accent || color;
  var R = mockyOrnR;
  var lineIn = function (d, stroke, op, w) { if (d) out.push(React.createElement('path', { key: k++, d: d, fill: 'none', stroke: stroke, strokeWidth: w || weight, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: op == null || op === 1 ? undefined : op, vectorEffect: 'non-scaling-stroke' })); };
  var fillIn = function (d, fill, op) { if (d) out.push(React.createElement('path', { key: k++, d: d, fill: fill, opacity: op == null || op === 1 ? undefined : op })); };
  var P = function (x, y) { return R(x) + ' ' + R(y); };
  var rectD = function (x, y, w, h) { return 'M' + P(x, y) + 'H' + R(x + w) + 'V' + R(y + h) + 'H' + R(x) + 'Z'; };
  var circleD = function (x, y, r) { return 'M' + P(x, y - r) + 'A' + R(r) + ' ' + R(r) + ' 0 1 1 ' + P(x, y + r) + 'A' + R(r) + ' ' + R(r) + ' 0 1 1 ' + P(x, y - r) + 'Z'; };
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
  else if (id === 'triangles') { var tr = ''; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var tx = i * cell + (j % 2 ? cell / 2 : 0), ty = j * cell; tr += 'M' + mockyOrnR(tx + cell * 0.15) + ' ' + mockyOrnR(ty + cell * 0.8) + 'L' + mockyOrnR(tx + cell / 2) + ' ' + mockyOrnR(ty + cell * 0.2) + 'L' + mockyOrnR(tx + cell * 0.85) + ' ' + mockyOrnR(ty + cell * 0.8) + 'Z'; } out.push(React.createElement('path', { key: k++, d: tr, fill: color })); }
  else if (id === 'diamonds') { var dm = ''; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var dx = (i + 0.5) * cell, dy = (j + 0.5) * cell, h2 = cell * 0.32; dm += 'M' + mockyOrnR(dx) + ' ' + mockyOrnR(dy - h2) + 'L' + mockyOrnR(dx + h2) + ' ' + mockyOrnR(dy) + 'L' + mockyOrnR(dx) + ' ' + mockyOrnR(dy + h2) + 'L' + mockyOrnR(dx - h2) + ' ' + mockyOrnR(dy) + 'Z'; } out.push(React.createElement('path', { key: k++, d: dm, fill: color })); }
  else if (id === 'rings') { var rg = '', rr = cell * 0.3; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var rx = (i + 0.5) * cell, ry = (j + 0.5) * cell; rg += 'M' + mockyOrnR(rx - rr) + ' ' + mockyOrnR(ry) + 'A' + mockyOrnR(rr) + ' ' + mockyOrnR(rr) + ' 0 1 1 ' + mockyOrnR(rx + rr) + ' ' + mockyOrnR(ry) + 'A' + mockyOrnR(rr) + ' ' + mockyOrnR(rr) + ' 0 1 1 ' + mockyOrnR(rx - rr) + ' ' + mockyOrnR(ry); } line(rg); }
  /* Fish scales: a row of half circles hanging under a line, every other row
     shifted by half a scale so each one sits between two above it. */
  else if (id === 'scales') { var sc = ''; for (j = 0; j <= n; j++) { var off = j % 2 ? -cell / 2 : 0; for (i = 0; i <= n; i++) { var sx = i * cell + off; sc += 'M' + mockyOrnR(sx) + ' ' + mockyOrnR(j * cell) + 'A' + mockyOrnR(cell / 2) + ' ' + mockyOrnR(cell / 2) + ' 0 0 0 ' + mockyOrnR(sx + cell) + ' ' + mockyOrnR(j * cell); } } line(sc); }
  else if (id === 'bricks') { var br = ''; for (j = 0; j <= n * 2; j++) { br += 'M0 ' + mockyOrnR(j * cell / 2) + 'H100'; for (i = 0; i <= n; i++) { var bx = i * cell + (j % 2 ? cell / 2 : 0); br += 'M' + mockyOrnR(bx) + ' ' + mockyOrnR(j * cell / 2) + 'V' + mockyOrnR((j + 1) * cell / 2); } } line(br); }
  else if (id === 'zigzags') { var zz = ''; for (j = 0; j < n; j++) { var zy = (j + 0.5) * cell; zz += 'M0 ' + mockyOrnR(zy + cell * 0.18); for (i = 1; i <= n * 2; i++) zz += 'L' + mockyOrnR(i * cell / 2) + ' ' + mockyOrnR(zy + (i % 2 ? -1 : 1) * cell * 0.18); } line(zz); }
  else if (id === 'dot-matrix') { for (i = 0; i < n; i++) for (j = 0; j < n; j++) dot((i + 0.5) * cell, (j + 0.5) * cell, cell * 0.16, color); for (i = 0; i <= n; i++) for (j = 0; j <= n; j++) dot(i * cell, j * cell, cell * 0.08, acc); }
  /* Basket weave: a dash across in one cell, a dash down in the next. */
  else if (id === 'dash-weave') { var dwa = '', dwb = ''; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var wx = i * cell, wy = j * cell; if ((i + j) % 2 === 0) dwa += 'M' + P(wx + cell * 0.2, wy + cell * 0.5) + 'H' + R(wx + cell * 0.8); else dwb += 'M' + P(wx + cell * 0.5, wy + cell * 0.2) + 'V' + R(wy + cell * 0.8); } lineIn(dwa, color); lineIn(dwb, acc); }
  /* Lines at sixty degrees both ways (lattice), and the horizontals that make them triangles (tri-grid). */
  else if (id === 'lattice' || id === 'tri-grid') {
    var lt = '', run = 100 / Math.tan(Math.PI / 3);
    for (i = -n * 2; i <= n * 3; i++) { var lx = i * cell; lt += 'M' + P(lx, 0) + 'L' + P(lx + run, 100) + 'M' + P(lx, 0) + 'L' + P(lx - run, 100); }
    if (id === 'tri-grid') for (j = 0; j * cell * 0.866 <= 100; j++) lt += 'M0 ' + R(j * cell * 0.866) + 'H100';
    line(lt);
  }
  else if (id === 'honeycomb') {
    var hr = cell / 2, hc = '';
    for (i = -1; i * 1.5 * hr <= 100 + hr; i++) for (j = -1; j * 1.732 * hr <= 100 + hr; j++) {
      var hx = i * 1.5 * hr, hy = j * 1.732 * hr + (Math.abs(i) % 2 ? 0.866 * hr : 0);
      for (var q = 0; q <= 6; q++) { var ha = (q % 6) * Math.PI / 3; hc += (q ? 'L' : 'M') + P(hx + hr * Math.cos(ha), hy + hr * Math.sin(ha)); }
    }
    line(hc);
  }
  /* Isometric cubes: each hexagon is three faces, lit from above. */
  else if (id === 'cubes') {
    var cr = cell / 1.732, top = '', left = '', right = '';
    for (j = -1; j * 1.5 * cr <= 100 + cr; j++) for (i = -1; i <= n + 1; i++) {
      var ux = (i + (Math.abs(j) % 2 ? 0.5 : 0)) * cell, uy = j * 1.5 * cr, w2 = 0.866 * cr;
      top += 'M' + P(ux, uy - cr) + 'L' + P(ux + w2, uy - cr / 2) + 'L' + P(ux, uy) + 'L' + P(ux - w2, uy - cr / 2) + 'Z';
      left += 'M' + P(ux - w2, uy - cr / 2) + 'L' + P(ux, uy) + 'L' + P(ux, uy + cr) + 'L' + P(ux - w2, uy + cr / 2) + 'Z';
      right += 'M' + P(ux, uy) + 'L' + P(ux + w2, uy - cr / 2) + 'L' + P(ux + w2, uy + cr / 2) + 'L' + P(ux, uy + cr) + 'Z';
    }
    fillIn(top, color); fillIn(left, acc, accent ? 1 : 0.6); fillIn(right, color, 0.35);
  }
  else if (id === 'herringbone') { var hb = ''; for (i = 0; i < n; i++) for (j = -1; j <= n * 2; j++) { var bx2 = i * cell, by2 = j * cell / 2; hb += i % 2 ? 'M' + P(bx2, by2) + 'L' + P(bx2 + cell, by2 + cell / 2) : 'M' + P(bx2, by2 + cell / 2) + 'L' + P(bx2 + cell, by2); } line(hb); }
  /* A sunburst behind a title: every other sector of a disc larger than the box. */
  else if (id === 'rays') { var ry2 = '', sectors = n * 2; for (i = 0; i < sectors; i += 2) { var a1 = i * 2 * Math.PI / sectors, a2 = (i + 1) * 2 * Math.PI / sectors; ry2 += 'M50 50L' + P(50 + 80 * Math.cos(a1), 50 + 80 * Math.sin(a1)) + 'L' + P(50 + 80 * Math.cos(a2), 50 + 80 * Math.sin(a2)) + 'Z'; } fillIn(ry2, color); }
  else if (id === 'offset-squares') { var oa = '', ob = ''; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { oa += rectD(i * cell + cell * 0.1, j * cell + cell * 0.1, cell * 0.38, cell * 0.38); ob += rectD(i * cell + cell * 0.52, j * cell + cell * 0.52, cell * 0.38, cell * 0.38); } fillIn(oa, color); fillIn(ob, acc, accent ? 1 : 0.45); }
  else if (id === 'capsules') {
    var cp = '', cw = cell * 0.7, rr2 = cell * 0.16;
    for (j = 0; j < n; j++) for (i = -1; i <= n; i++) {
      var ccx = (i + 0.5) * cell + (j % 2 ? cell / 2 : 0), ccy = (j + 0.5) * cell;
      cp += 'M' + P(ccx - cw / 2 + rr2, ccy - rr2) + 'H' + R(ccx + cw / 2 - rr2) + 'A' + R(rr2) + ' ' + R(rr2) + ' 0 0 1 ' + P(ccx + cw / 2 - rr2, ccy + rr2) + 'H' + R(ccx - cw / 2 + rr2) + 'A' + R(rr2) + ' ' + R(rr2) + ' 0 0 1 ' + P(ccx - cw / 2 + rr2, ccy - rr2) + 'Z';
    }
    line(cp);
  }
  /* Tartan: translucent bands both ways, so their crossings are darker, and a thread through each. */
  else if (id === 'plaid') { var pa = '', pb = '', pt2 = ''; for (i = 0; i < n; i++) { pa += rectD(0, i * cell + cell * 0.1, 100, cell * 0.34); pb += rectD(i * cell + cell * 0.1, 0, cell * 0.34, 100); pt2 += 'M0 ' + R(i * cell + cell * 0.75) + 'H100M' + R(i * cell + cell * 0.75) + ' 0V100'; } fillIn(pa, acc, 0.4); fillIn(pb, color, 0.4); lineIn(pt2, color, 0.7); }
  else if (id === 'pinwheels') {
    var pwa = '', pwb = '';
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      var x0 = i * cell, y0 = j * cell, x1 = x0 + cell, y1 = y0 + cell, mx = x0 + cell / 2, my = y0 + cell / 2;
      pwa += 'M' + P(x0, y0) + 'L' + P(mx, y0) + 'L' + P(mx, my) + 'Z' + 'M' + P(x1, y1) + 'L' + P(mx, y1) + 'L' + P(mx, my) + 'Z';
      pwb += 'M' + P(x1, y0) + 'L' + P(x1, my) + 'L' + P(mx, my) + 'Z' + 'M' + P(x0, y1) + 'L' + P(x0, my) + 'L' + P(mx, my) + 'Z';
    }
    fillIn(pwa, color); fillIn(pwb, acc, accent ? 1 : 0.45);
  }
  else if (id === 'crosshatch') { var ch2 = ''; for (i = 0; i <= 2 * n; i++) ch2 += 'M' + P(i * cell - 100, 100) + 'L' + P(i * cell, 0) + 'M' + P(i * cell - 100, 0) + 'L' + P(i * cell, 100); line(ch2); }
  else if (id === 'cross-stitch') { var xs = '', xa = cell * 0.22; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var sx2 = (i + 0.5) * cell, sy2 = (j + 0.5) * cell; xs += 'M' + P(sx2 - xa, sy2 - xa) + 'L' + P(sx2 + xa, sy2 + xa) + 'M' + P(sx2 + xa, sy2 - xa) + 'L' + P(sx2 - xa, sy2 + xa); } line(xs); }
  else if (id === 'half-discs') {
    var hda = '', hdb = '', hrr = cell * 0.42;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      var dx2 = (i + 0.5) * cell, dy2 = (j + 0.5) * cell, up = (i + j) % 2 === 0;
      var seg = 'M' + P(dx2 - hrr, dy2) + 'A' + R(hrr) + ' ' + R(hrr) + ' 0 0 ' + (up ? 1 : 0) + ' ' + P(dx2 + hrr, dy2) + 'Z';
      if (up) hda += seg; else hdb += seg;
    }
    fillIn(hda, color); fillIn(hdb, acc);
  }
  else if (id === 'duo-stripes') { var dsa = '', dsb = ''; for (i = 0; i < n; i++) { dsa += rectD(i * cell, 0, cell * 0.3, 100); dsb += rectD(i * cell + cell * 0.5, 0, cell * 0.3, 100); } fillIn(dsa, color); fillIn(dsb, acc, accent ? 1 : 0.45); }
  /* Hatching with a dot in every gap: the dots sit half a cell off the lines' diagonal. */
  else if (id === 'crosshatch-dots') { var cd = ''; for (i = 0; i <= 2 * n; i++) cd += 'M' + P(i * cell - 100, 100) + 'L' + P(i * cell, 0); line(cd); for (i = 0; i < n; i++) for (j = 0; j <= n; j++) dot((i + 0.5) * cell, j * cell, cell * 0.1, acc); }
  else if (id === 'harlequin') {
    var ha2 = '', hb2 = '';
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      var qx = (i + 0.5) * cell, qy = (j + 0.5) * cell, h3 = cell / 2;
      var dd = 'M' + P(qx, qy - h3) + 'L' + P(qx + h3, qy) + 'L' + P(qx, qy + h3) + 'L' + P(qx - h3, qy) + 'Z';
      if ((i + j) % 2) hb2 += dd; else ha2 += dd;
    }
    fillIn(ha2, color); fillIn(hb2, acc, accent ? 1 : 0.45);
  }
  /* Art-deco fans: three quarter arcs from the bottom left corner of every cell. */
  else if (id === 'fans') { var fn = ''; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var fx = i * cell, fy = (j + 1) * cell; [0.92, 0.62, 0.32].forEach(function (f) { var fr = cell * f; fn += 'M' + P(fx, fy - fr) + 'A' + R(fr) + ' ' + R(fr) + ' 0 0 1 ' + P(fx + fr, fy); }); } line(fn); }
  else if (id === 'barcode') { var bc = '', bars = [1, 3, 1, 2, 1, 1, 3, 2], gaps = [2, 1, 2, 1, 3, 1, 1, 2], u = 100 / (n * 12), bxx = 0; for (i = 0; bxx < 100; i++) { var bw = bars[i % 8] * u; bc += rectD(bxx, 0, bw, 100); bxx += bw + gaps[i % 8] * u; } fillIn(bc, color); }
  /* A printed circuit: from every pad a trace leaves one way and turns, on a fixed seed. */
  else if (id === 'circuit') {
    var cs = 29 >>> 0;
    var crand = function () { cs = (cs + 0x6d2b79f5) >>> 0; var t = cs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    var ct = '';
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      var px2 = (i + 0.5) * cell, py2 = (j + 0.5) * cell, sxn = crand() < 0.5 ? -1 : 1, syn = crand() < 0.5 ? -1 : 1;
      ct += 'M' + P(px2, py2) + 'H' + R(px2 + sxn * cell * 0.5) + 'V' + R(py2 + syn * cell * 0.5);
    }
    line(ct);
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) dot((i + 0.5) * cell, (j + 0.5) * cell, cell * 0.11, acc);
  }
  else if (id === 'meander') { var mk = ''; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var kx = i * cell, ky = j * cell; mk += 'M' + P(kx + cell * 0.1, ky + cell * 0.9) + 'V' + R(ky + cell * 0.1) + 'H' + R(kx + cell * 0.9) + 'V' + R(ky + cell * 0.9) + 'H' + R(kx + cell * 0.35) + 'V' + R(ky + cell * 0.35) + 'H' + R(kx + cell * 0.65) + 'V' + R(ky + cell * 0.65); } line(mk); }
  else if (id === 'concentric') { for (i = 1; i * cell / 2 <= 72; i++) lineIn(circleD(50, 50, i * cell / 2), i % 2 ? color : acc); }
  else if (id === 'zigzag-fields') {
    var za = '', zb = '', steps = n * 2, zs = 100 / steps;
    for (j = 0; j < n; j++) {
      var zy0 = j * cell, zt = 'M0 ' + R(zy0);
      for (i = 1; i <= steps; i++) zt += 'L' + P(i * zs, zy0 + (i % 2 ? cell * 0.25 : 0));
      for (i = steps; i >= 0; i--) zt += 'L' + P(i * zs, zy0 + cell * 0.5 + (i % 2 ? cell * 0.25 : 0));
      zt += 'Z';
      if (j % 2) zb += zt; else za += zt;
    }
    fillIn(za, color); fillIn(zb, acc, accent ? 1 : 0.45);
  }
  else if (id === 'ladders') { var ld = ''; for (i = 0; i < n; i++) { var la = i * cell + cell * 0.25, lb = i * cell + cell * 0.75; ld += 'M' + R(la) + ' 0V100M' + R(lb) + ' 0V100'; for (j = 0; j * cell * 0.35 <= 100; j++) ld += 'M' + P(la, j * cell * 0.35) + 'H' + R(lb); } line(ld); }
  else if (id === 'orbits') { var ob2 = '', erx = cell * 0.42, ery = cell * 0.16; for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var ox = (i + 0.5) * cell, oy = (j + 0.5) * cell; ob2 += 'M' + P(ox - erx, oy) + 'A' + R(erx) + ' ' + R(ery) + ' 0 1 1 ' + P(ox + erx, oy) + 'A' + R(erx) + ' ' + R(ery) + ' 0 1 1 ' + P(ox - erx, oy); } line(ob2); for (i = 0; i < n; i++) for (j = 0; j < n; j++) dot((i + 0.5) * cell + erx, (j + 0.5) * cell, cell * 0.08, acc); }
  else if (id === 'split-squares') {
    var sqa = '', sqb = '', m2 = cell * 0.12, sz = cell * 0.76;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var tx0 = i * cell + m2, ty0 = j * cell + m2; sqa += 'M' + P(tx0, ty0) + 'L' + P(tx0 + sz, ty0) + 'L' + P(tx0, ty0 + sz) + 'Z'; sqb += 'M' + P(tx0 + sz, ty0) + 'L' + P(tx0 + sz, ty0 + sz) + 'L' + P(tx0, ty0 + sz) + 'Z'; }
    fillIn(sqa, color); fillIn(sqb, acc, accent ? 1 : 0.45);
  }
  else if (id === 'dashes') { var ds = ''; for (j = 0; j < n; j++) { var dyy = (j + 0.5) * cell, off2 = j % 2 ? cell / 2 : 0; for (i = -1; i <= n; i++) ds += 'M' + P(i * cell + off2 + cell * 0.1, dyy) + 'H' + R(i * cell + off2 + cell * 0.6); } line(ds); }
  /* Graph paper: a faint line every cell, a firm one every four. */
  else if (id === 'graph-paper') { var gmin = '', gmaj = ''; for (i = 0; i <= n; i++) { var gl = 'M' + R(i * cell) + ' 0V100M0 ' + R(i * cell) + 'H100'; if (i % 4) gmin += gl; else gmaj += gl; } lineIn(gmin, color, 0.35, weight * 0.6); lineIn(gmaj, color); }
  else if (id === 'pixel-waves') { var pxa = '', pxb = '', ps = cell / 4, wave = [0, 1, 2, 1]; for (j = 0; j < n; j++) for (i = 0; i * ps < 100; i++) { var pd = rectD(i * ps, j * cell + wave[i % 4] * ps, ps, ps); if (j % 2) pxb += pd; else pxa += pd; } fillIn(pxa, color); fillIn(pxb, acc, accent ? 1 : 0.45); }
  else if (id === 'confetti' || id === 'speckle') {
    /* mulberry32 on a fixed seed: the same scatter on every render, in every
       export and in every capture — a texture that moved between two renders of
       one page would read as a bug. */
    var s = (id === 'speckle' ? 13 : 7) >>> 0;
    var rand = function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    if (id === 'speckle') {
      for (i = 0; i < n * n; i++) dot(rand() * 100, rand() * 100, cell * (0.05 + rand() * 0.12), accent && i % 3 === 0 ? accent : color);
      return out;
    }
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
  } else if (s.d) {
    children = React.createElement('path', { d: s.d, fill: color, fillRule: s.z ? 'nonzero' : 'evenodd' });
  }
  if (s && s.L) {
    /* The layers over the main path: the accent ribbon of a fluid, the dots of a
       loader. An accent the page did not give is the main colour at half
       strength, so a ribbon over its own blob still shows. */
    var layered = [], moved = [];
    for (var li = 0; li < s.L.length; li++) {
      var L = s.L[li];
      var paint = L[1] === 1 ? accent || color : L[1] === 2 ? '#ffffff' : color;
      var op = L[3] * (L[1] === 1 && !accent ? 0.5 : 1);
      var lp = { key: 'l' + li, d: L[0] };
      if (line && !(L[4] & 1)) Object.assign(lp, { fill: 'none', stroke: paint, strokeWidth: weight, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' });
      else if (L[2]) Object.assign(lp, { fill: 'none', stroke: paint, strokeWidth: L[2], strokeLinecap: 'round', strokeLinejoin: 'round' });
      else lp.fill = paint;
      if (op !== 1) lp.opacity = op;
      (L[4] & 2 ? moved : layered).push(React.createElement('path', lp));
    }
    /* A motion's moving layers turn or beat as one, about their own centre —
       and hold still wherever an entrance would (mockyOrnStill). */
    if (moved.length) layered.push(React.createElement('g', {
      key: 'moves',
      style: still.current || !s.m ? undefined : {
        transformBox: 'fill-box',
        transformOrigin: 'center',
        animation: (s.m === 's' ? 'mocky-orn-spin 2.4s linear ' : 'mocky-orn-pulse 1.6s ease-in-out ') + delay + 's infinite'
      }
    }, moved));
    children = [children ? React.cloneElement(children, { key: 'main' }) : null].concat(layered);
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
        { display: 'block', overflow: line || (s && s.k === 'u') ? 'visible' : 'hidden', pointerEvents: 'none' },
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
