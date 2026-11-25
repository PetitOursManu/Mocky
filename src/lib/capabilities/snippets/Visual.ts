import { VISUAL_BOUNDS, VISUAL_FAMILIES } from '../../visuals/families'

/**
 * `<Visual family="cycle" doc={…} colors={[…]} />` — a text's ideas laid out
 * as one of the families of `lib/visuals/families.ts`.
 *
 * The model writes the CONTENT and names a family; everything drawn here is
 * arithmetic over the measured box. Three choices are worth knowing:
 *
 *  - Boxes are HTML, only connectors are SVG. The .pptx "everything as separate
 *    elements" export turns a box into a shape and a run of text into a text
 *    box, while an `<svg>` becomes a picture (docExport/decompose.ts): drawn in
 *    HTML, a visual comes out of PowerPoint editable, which is the one thing
 *    people export it for.
 *  - Type is sized per ROLE, never per box: every card of a visual shares one
 *    label size, the largest at which ALL of them fit, and a detail is always
 *    smaller than its label. Sized per box, a short label came back twice the
 *    size of its neighbour and the visual read as noise. When nothing fits even
 *    at the floor, the details go first and the labels stay.
 *  - Colours come from the page: `colors` are the palette's, `ink` and `ground`
 *    the page's text and background. Every run of text is measured against the
 *    surface it is painted on (4.5:1, 3:1 for the large figures) and the ink is
 *    chosen among the page's own colours before black or white — the rule
 *    `legibleOn` applies to films.
 *
 * Nothing moves: a visual is read, printed and exported, and a still frame of
 * it must be the visual itself.
 *
 * Exported as a STRING, prepended to the generated component before Babel like
 * every snippet pack. Every top-level name is prefixed: the screen's own code
 * shares this scope.
 */

export const VISUAL_EXPORTS = ['Visual'] as const

export const VisualSource = `// --- Visual (snippets/Visual.ts) ---
var MOCKY_VISUAL_BOUNDS = ${JSON.stringify(VISUAL_BOUNDS)};
var MOCKY_VISUAL_FAMILIES = ${JSON.stringify(VISUAL_FAMILIES)};
var MOCKY_VISUAL_DEFAULT_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'];
var mockyVisualSeq = 0;

// ---- colour ----------------------------------------------------------------
function mockyVisualRgb(hex) {
  if (typeof hex !== 'string') return null;
  var h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  if (h.length !== 6) return null;
  var n = parseInt(h, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mockyVisualHex(rgb) {
  return '#' + rgb.map(function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
}
function mockyVisualLum(hex) {
  var c = mockyVisualRgb(hex) || [0, 0, 0];
  var l = c.map(function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function mockyVisualContrast(a, b) {
  var x = mockyVisualLum(a), y = mockyVisualLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** a mixed towards b by t (0 = a, 1 = b). */
function mockyVisualMix(a, b, t) {
  var x = mockyVisualRgb(a) || [0, 0, 0], y = mockyVisualRgb(b) || [255, 255, 255];
  return mockyVisualHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
/** The first of the page's own colours that reads on bg, else the better of black and white. */
function mockyVisualInkOn(bg, prefs, floor) {
  var f = floor || 4.5;
  for (var i = 0; i < prefs.length; i++) if (mockyVisualRgb(prefs[i]) && mockyVisualContrast(prefs[i], bg) >= f) return prefs[i];
  return mockyVisualContrast('#000000', bg) >= mockyVisualContrast('#ffffff', bg) ? '#000000' : '#ffffff';
}
/** A palette colour used as INK on bg: pulled towards the ink until it clears the floor. */
function mockyVisualMark(color, bg, ink, floor) {
  for (var t = 0; t <= 1.0001; t += 0.1) {
    var c = mockyVisualMix(color, ink, t);
    if (mockyVisualContrast(c, bg) >= floor) return c;
  }
  return mockyVisualInkOn(bg, [ink], floor);
}

// ---- type ------------------------------------------------------------------
// An estimate with no browser, calibrated on the mean advances of a grotesque:
// what matters is that it never UNDER-estimates a line, so a box it says fits
// does fit. A word longer than the line is not wrapped but refused (Infinity):
// a word cut in half reads as broken software, so the size comes down instead.
function mockyVisualEm(ch) {
  if (ch === ' ') return 0.28;
  if ('iljtfr.,;:!|()[]'.indexOf(ch) >= 0 || ch === "'" || ch === '\\u2019') return 0.34;
  if ('mwMW@%'.indexOf(ch) >= 0) return 0.9;
  if (ch >= 'A' && ch <= 'Z') return 0.7;
  if (ch >= '0' && ch <= '9') return 0.6;
  return 0.56;
}
function mockyVisualTextW(s, size) {
  var w = 0;
  for (var i = 0; i < s.length; i++) w += mockyVisualEm(s.charAt(i));
  return w * size;
}
function mockyVisualLines(text, size, width, weight) {
  if (!text) return 0;
  if (!(width > 0)) return Infinity;
  var k = weight || 1;
  var paras = String(text).split('\\n');
  var total = 0;
  var space = mockyVisualTextW(' ', size) * k;
  for (var p = 0; p < paras.length; p++) {
    var words = paras[p].split(' ').filter(function (x) { return x; });
    var lines = 1, line = 0;
    for (var i = 0; i < words.length; i++) {
      var ww = mockyVisualTextW(words[i], size) * k;
      if (ww > width) return Infinity;
      if (line === 0) line = ww;
      else if (line + space + ww <= width) line += space + ww;
      else { lines++; line = ww; }
    }
    total += lines;
  }
  return total;
}
function mockyVisualNum(v, unit) {
  if (typeof v !== 'number' || !isFinite(v)) return '';
  var lang;
  try { lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || undefined; } catch (e) { lang = undefined; }
  var s;
  try { s = v.toLocaleString(lang, { maximumFractionDigits: 2 }); } catch (e) { s = String(v); }
  if (!unit) return s;
  if (unit === '%') return s + (lang && lang.indexOf('fr') === 0 ? '\\u202f%' : '%');
  return s + '\\u00a0' + unit;
}

/** Height a stack of runs needs in a node, or Infinity when a word cannot fit. */
function mockyVisualStackH(n, s, showDetail) {
  // A vertical run (a matrix's y axis) is laid along the box's height.
  var w = (n.vertical ? n.h : n.w) - 2 * n.pad;
  var t = n.t, h = 0, parts = 0, lines;
  if (t.icon) { h += s.L * 1.45; parts++; }
  if (t.value) { lines = mockyVisualLines(t.value, s.V, w, 1.08); if (!isFinite(lines)) return Infinity; h += lines * s.V * 1.08; parts++; }
  if (t.label) { lines = mockyVisualLines(t.label, s.L, w, 1.07); if (!isFinite(lines)) return Infinity; h += lines * s.L * 1.2; parts++; }
  if (showDetail && t.detail) { lines = mockyVisualLines(t.detail, s.D, w, 1); if (!isFinite(lines)) return Infinity; h += lines * s.D * 1.35; parts++; }
  if (showDetail && t.list) {
    for (var i = 0; i < t.list.length; i++) {
      lines = mockyVisualLines(t.list[i], s.D, w - s.D, 1);
      if (!isFinite(lines)) return Infinity;
      h += lines * s.D * 1.35 + (i ? s.D * 0.25 : 0);
    }
    if (t.list.length) parts++;
  }
  return h + Math.max(0, parts - 1) * s.L * 0.35 + 2 * n.padY;
}

/**
 * One size for a whole role: the largest label size at which every node of the
 * group fits, the detail always smaller. Details are given up before labels go
 * under the floor, and what still does not fit is drawn at the floor.
 */
function mockyVisualFitGroup(nodes, maxL, minL, valueScale) {
  var minD = Math.max(9, minL * 0.82);
  function sizes(L) { return { L: L, D: Math.max(minD, Math.min(L * 0.78, L - 2)), V: L * valueScale }; }
  function fits(s, showDetail) {
    for (var i = 0; i < nodes.length; i++) if (mockyVisualStackH(nodes[i], s, showDetail) > (nodes[i].vertical ? nodes[i].w : nodes[i].h) + 0.5) return false;
    return true;
  }
  var hasDetail = nodes.some(function (n) { return n.t.detail || (n.t.list && n.t.list.length); });
  var floorWithDetail = hasDetail ? Math.max(minL, maxL * 0.45) : minL;
  for (var L = maxL; L >= floorWithDetail - 0.01; L *= 0.94) if (fits(sizes(L), true)) return { s: sizes(L), detail: true, fits: true };
  if (hasDetail) for (L = maxL; L >= minL - 0.01; L *= 0.94) if (fits(sizes(L), false)) return { s: sizes(L), detail: false, fits: true };
  return { s: sizes(minL), detail: false, fits: false };
}

// ---- geometry --------------------------------------------------------------
function mockyVisualOverlap(a, b, m) {
  return a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
}
function mockyVisualInside(p, r, m) {
  return p[0] > r.x - m && p[0] < r.x + r.w + m && p[1] > r.y - m && p[1] < r.y + r.h + m;
}
/**
 * A connector as points, trimmed to the longest run outside every box it would
 * cross: a line drawn from centre to centre and then hidden under the cards is
 * a line that shows through a translucent one.
 */
function mockyVisualTrim(points, rects, m) {
  var best = [], run = [];
  for (var i = 0; i < points.length; i++) {
    var out = true;
    for (var j = 0; j < rects.length; j++) if (mockyVisualInside(points[i], rects[j], m)) { out = false; break; }
    if (out) run.push(points[i]);
    else { if (run.length > best.length) best = run; run = []; }
  }
  if (run.length > best.length) best = run;
  return best;
}
function mockyVisualPath(points) {
  return points.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
}
function mockyVisualSegment(a, b, steps) {
  var out = [];
  for (var i = 0; i <= steps; i++) out.push([a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps]);
  return out;
}

/** Cards on an ellipse, shrunk until no two touch and none touches \`avoid\`. */
function mockyVisualRing(n, box, cw0, ch0, u, avoid, start) {
  var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  if (!(n > 0)) return { rects: [], rx: 0, ry: 0, cx: cx, cy: cy };
  var s = 1, rects = [];
  for (var tries = 0; tries < 24; tries++) {
    var cw = cw0 * s, ch = ch0 * s;
    var rx = box.w / 2 - cw / 2, ry = box.h / 2 - ch / 2;
    rects = [];
    for (var i = 0; i < n; i++) {
      var a = (start == null ? -Math.PI / 2 : start) + 2 * Math.PI * i / n;
      rects.push({ x: cx + rx * Math.cos(a) - cw / 2, y: cy + ry * Math.sin(a) - ch / 2, w: cw, h: ch, a: a });
    }
    var clear = true;
    for (i = 0; i < n && clear; i++) {
      for (var j = i + 1; j < n; j++) if (mockyVisualOverlap(rects[i], rects[j], u * 0.6)) { clear = false; break; }
      if (clear && avoid && mockyVisualOverlap(rects[i], avoid, u * 0.8)) clear = false;
    }
    if (clear) break;
    s *= 0.92;
  }
  return { rects: rects, rx: box.w / 2 - rects[0].w / 2, ry: box.h / 2 - rects[0].h / 2, cx: cx, cy: cy };
}

function mockyVisualClean(doc) {
  var d = doc && typeof doc === 'object' ? doc : {};
  var str = function (v) { return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''; };
  var items = (Array.isArray(d.items) ? d.items : []).filter(function (it) { return it && typeof it === 'object' && str(it.label); }).map(function (it) {
    return {
      label: str(it.label),
      detail: str(it.detail),
      icon: typeof it.icon === 'string' ? it.icon : '',
      value: typeof it.value === 'number' && isFinite(it.value) ? it.value : null,
      unit: str(it.unit),
      emphasis: !!it.emphasis,
      children: (Array.isArray(it.children) ? it.children : []).map(function (c) {
        return typeof c === 'string' ? c.trim() : c && typeof c === 'object' ? [str(c.label), str(c.detail)].filter(Boolean).join(' — ') : '';
      }).filter(Boolean),
    };
  });
  return {
    title: str(d.title), subtitle: str(d.subtitle), source: str(d.source),
    axes: d.axes && typeof d.axes === 'object' ? { x: str(d.axes.x), y: str(d.axes.y) } : { x: '', y: '' },
    relations: (Array.isArray(d.relations) ? d.relations : []).filter(function (r) {
      return r && typeof r.from === 'number' && typeof r.to === 'number' && r.from !== r.to && r.from >= 0 && r.to >= 0 && r.from < items.length && r.to < items.length;
    }).map(function (r) { return { from: Math.round(r.from), to: Math.round(r.to), label: str(r.label) }; }),
    items: items,
  };
}

/**
 * The whole visual as boxes and connectors in a W × H frame. Pure: no DOM, so
 * the suite runs it on documents a browser would take an afternoon to try.
 * Nodes: { kind, x, y, w, h, g (the type role it is sized with), t (its runs),
 * tone, shape, align }. Links: { points, arrow, label }.
 */
function mockyVisualLayout(family, rawDoc, W, H) {
  var doc = mockyVisualClean(rawDoc);
  var fam = MOCKY_VISUAL_FAMILIES.indexOf(family) >= 0 ? family : 'steps';
  var bounds = MOCKY_VISUAL_BOUNDS[fam];
  var u = Math.max(6, Math.min(W, H) / 40);
  var nodes = [], links = [];
  var all = doc.items;
  var centerIdx = -1;
  for (var ci = 0; ci < all.length; ci++) if (all[ci].emphasis) { centerIdx = ci; break; }
  // A hub or a mind map has a centre: the item marked for it, else the title,
  // which then is not set a second time above the drawing.
  var items = all.slice(0, bounds.max);
  if (centerIdx >= items.length) centerIdx = -1;
  var titleIsCentre = (fam === 'hub' && centerIdx < 0) || (fam === 'mindmap' && centerIdx < 0);
  var n = items.length;

  // ---- header and footer ----
  var title = titleIsCentre ? '' : doc.title;
  var T = 0, tl = 0, S = 0, sl = 0, headerH = 0;
  if (title) {
    for (T = Math.min(u * 3, 64); T > 16; T *= 0.94) { tl = mockyVisualLines(title, T, W, 1.08); if (tl <= 2) break; }
    if (!(tl <= 2)) tl = Math.min(3, isFinite(tl) ? tl : 3);
    headerH += tl * T * 1.12;
  }
  if (doc.subtitle) {
    S = Math.max(12, T ? Math.min(T * 0.6, Math.max(u * 1.35, T * 0.46)) : u * 1.35);
    for (; S > 11; S *= 0.94) { sl = mockyVisualLines(doc.subtitle, S, W * 0.9, 1); if (sl <= 2) break; }
    if (!(sl <= 3)) sl = 3;
    headerH += (title ? u * 0.5 : 0) + sl * S * 1.35;
  }
  if (headerH) headerH += u * 1.6;
  var F = Math.max(10, u * 0.7);
  var footH = doc.source ? F * 1.5 + u * 0.6 : 0;
  var box = { x: 0, y: headerH, w: W, h: Math.max(H * 0.35, H - headerH - footH) };
  var bx = box.x, by = box.y, bw = box.w, bh = box.h;
  var pad = Math.max(6, u * 0.85);
  var wide = bw / Math.max(1, bh) >= 1.2;

  function runs(it, opts) {
    var o = opts || {};
    return {
      icon: o.icon && it.icon ? it.icon : '',
      value: o.value && it.value != null ? mockyVisualNum(it.value, it.unit) : '',
      label: it.label,
      detail: o.noDetail ? '' : it.detail,
      list: o.list ? it.children : null,
      kicker: !!o.kicker,
    };
  }
  function node(kind, x, y, w, h, g, t, tone, extra) {
    var nd = { kind: kind, x: x, y: y, w: Math.max(1, w), h: Math.max(1, h), g: g, t: t, tone: tone, shape: 'rect', align: 'center', pad: pad, padY: pad * 0.8 };
    for (var k in extra || {}) nd[k] = extra[k];
    nodes.push(nd);
    return nd;
  }
  function dot(x, y, d, i, it) {
    return node('dot', x, y, d, d, 'dot', { num: it.icon ? '' : String(i + 1), icon: it.icon }, i, { shape: 'circle', pad: 0, padY: 0 });
  }

  if (fam === 'steps' || (fam === 'timeline' && !wide)) {
    if (wide) {
      var g = u * 1.6, cw = (bw - g * (n - 1)) / Math.max(1, n);
      var d = Math.min(cw * 0.42, bh * 0.2, u * 4.4);
      for (var i = 0; i < n; i++) {
        var x = bx + i * (cw + g);
        dot(x + cw / 2 - d / 2, by, d, i, items[i]);
        node('card', x, by + d + u, cw, bh - d - u, 'card', runs(items[i], { kicker: fam === 'timeline' }), i);
        if (i < n - 1) links.push({ points: [[x + cw / 2 + d / 2 + u * 0.5, by + d / 2], [x + cw + g + cw / 2 - d / 2 - u * 0.5, by + d / 2]], arrow: true });
      }
    } else {
      var g2 = u * 1.1, rh = (bh - g2 * (n - 1)) / Math.max(1, n);
      var d2 = Math.min(rh * 0.78, bw * 0.14, u * 4.4);
      for (var r = 0; r < n; r++) {
        var y = by + r * (rh + g2);
        dot(bx, y + rh / 2 - d2 / 2, d2, r, items[r]);
        node('card', bx + d2 + u, y, bw - d2 - u, rh, 'card', runs(items[r], { kicker: fam === 'timeline' }), r, { align: 'left' });
        if (r < n - 1) links.push({ points: [[bx + d2 / 2, y + rh / 2 + d2 / 2 + u * 0.3], [bx + d2 / 2, y + rh + g2 + rh / 2 - d2 / 2 - u * 0.3]], arrow: fam === 'steps' });
      }
    }
  } else if (fam === 'timeline') {
    var axisY = by + bh / 2, slot = bw / Math.max(1, n);
    var dd = Math.min(slot * 0.28, u * 2.2);
    var tw = Math.min(slot * 1.5, bw * 0.42) - u * 0.4;
    links.push({ points: [[bx, axisY], [bx + bw, axisY]], arrow: true });
    for (var t = 0; t < n; t++) {
      var c = bx + slot * (t + 0.5);
      var tx = Math.max(bx, Math.min(bx + bw - tw, c - tw / 2));
      var up = t % 2 === 0;
      var ty = up ? by : axisY + dd / 2 + u;
      var th = up ? axisY - dd / 2 - u - by : by + bh - ty;
      node('dot', c - dd / 2, axisY - dd / 2, dd, dd, 'dot', { num: '' }, t, { shape: 'circle', pad: 0, padY: 0 });
      node('card', tx, ty, tw, th, 'card', runs(items[t], { kicker: true }), t, { align: 'left', valign: up ? 'end' : 'start', plain: true });
      links.push({ points: up ? [[c, axisY - dd / 2], [c, axisY - dd / 2 - u]] : [[c, axisY + dd / 2], [c, axisY + dd / 2 + u]], arrow: false });
    }
  } else if (fam === 'funnel' || fam === 'pyramid') {
    var gb = u * 0.55, bandH = (bh - gb * (n - 1)) / Math.max(1, n);
    for (var b = 0; b < n; b++) {
      var k = n > 1 ? b / (n - 1) : 0;
      var w = fam === 'funnel' ? bw * (1 - 0.55 * k) : bw * (0.38 + 0.62 * k);
      node('band', bx + (bw - w) / 2, by + b * (bandH + gb), w, bandH, 'band', runs(items[b], { value: true }), b, { valueScale: 1.15 });
    }
  } else if (fam === 'comparison' || fam === 'pros-cons') {
    var kc = n, gc = u * 1.4, colW = (bw - gc * (kc - 1)) / Math.max(1, kc);
    var headH = Math.min(bh * 0.28, u * 6.5);
    var M = 1;
    for (var mm = 0; mm < kc; mm++) M = Math.max(M, items[mm].children.length);
    // Rows are capped: a column of two points stretched over the whole height
    // is two empty boxes with a line of text in each.
    var gr = u * 0.6, rowH = Math.min(u * 5.5, (bh - headH - u * 0.8 - gr * (M - 1)) / M);
    for (var col = 0; col < kc; col++) {
      var colX = bx + col * (colW + gc);
      node('card', colX, by, colW, headH, 'head', runs(items[col], { icon: true }), col, { solid: true, ring: items[col].emphasis });
      var kids = items[col].children;
      for (var ch = 0; ch < kids.length; ch++) {
        var mark = fam === 'pros-cons' ? (col === 0 ? '+' : '\\u2212') : '';
        node('card', colX, by + headH + u * 0.8 + ch * (rowH + gr), colW, rowH, 'row', { label: kids[ch], mark: mark }, col, { align: 'left', soft: true });
      }
    }
  } else if (fam === 'matrix') {
    var aw = doc.axes.y ? u * 2.4 : 0, ah = doc.axes.x ? u * 2.4 : 0;
    var gx = bx + aw, gw = bw - aw, gh = bh - ah, gm = u * 0.8;
    var cellW = (gw - gm) / 2, cellH = (gh - gm) / 2;
    for (var q = 0; q < Math.min(4, n); q++) {
      node('card', gx + (q % 2) * (cellW + gm), by + Math.floor(q / 2) * (cellH + gm), cellW, cellH, 'card', runs(items[q], { icon: true }), q, { align: 'left' });
    }
    if (doc.axes.x) {
      node('text', gx, by + gh + u * 0.5, gw, ah - u * 0.5, 'axis', { label: doc.axes.x }, -1, { pad: 0, padY: 0 });
      links.push({ points: [[gx, by + gh + u * 0.25], [gx + gw, by + gh + u * 0.25]], arrow: true });
    }
    if (doc.axes.y) {
      node('text', bx, by, aw - u * 0.5, gh, 'axis', { label: doc.axes.y }, -1, { pad: 0, padY: 0, vertical: true });
      links.push({ points: [[gx - u * 0.25, by + gh], [gx - u * 0.25, by]], arrow: true });
    }
  } else if (fam === 'hub' || fam === 'cycle') {
    var centreItem = fam === 'hub' ? (centerIdx >= 0 ? items[centerIdx] : null) : null;
    var around = fam === 'hub' && centerIdx >= 0 ? items.filter(function (it, i) { return i !== centerIdx; }) : items;
    var na = around.length;
    var D = fam === 'hub' ? Math.min(bw, bh) * 0.36 : 0;
    var hubRect = D ? { x: bx + bw / 2 - D / 2, y: by + bh / 2 - D / 2, w: D, h: D } : null;
    var cw0 = Math.min(bw * 0.3, bw / (na <= 4 ? 2.6 : 3.3));
    var ch0 = Math.min(bh * 0.3, bh / (na <= 4 ? 3.0 : 3.8));
    var ring = mockyVisualRing(na, box, cw0, ch0, u, hubRect, -Math.PI / 2);
    if (hubRect) {
      node('centre', hubRect.x, hubRect.y, D, D, 'centre', centreItem ? runs(centreItem, { icon: true, noDetail: true }) : { label: doc.title }, centerIdx >= 0 ? centerIdx : 0, { shape: 'circle', solid: true });
    }
    for (var s2 = 0; s2 < na; s2++) {
      var rc = ring.rects[s2];
      node('card', rc.x, rc.y, rc.w, rc.h, 'card', runs(around[s2], { icon: true }), s2 + (centreItem ? 1 : 0));
      if (hubRect) {
        var pts = mockyVisualSegment([hubRect.x + D / 2, hubRect.y + D / 2], [rc.x + rc.w / 2, rc.y + rc.h / 2], 60);
        links.push({ points: mockyVisualTrim(pts, [hubRect].concat(ring.rects), u * 0.3), arrow: false });
      }
    }
    if (fam === 'cycle') {
      for (var e = 0; e < na; e++) {
        var a0 = ring.rects[e].a, a1 = ring.rects[(e + 1) % na].a + (e + 1 === na ? 2 * Math.PI : 0);
        var arc = [];
        for (var st = 0; st <= 48; st++) {
          var aa = a0 + (a1 - a0) * st / 48;
          arc.push([ring.cx + ring.rx * Math.cos(aa), ring.cy + ring.ry * Math.sin(aa)]);
        }
        var trimmed = mockyVisualTrim(arc, ring.rects, u * 0.45);
        if (trimmed.length > 1) links.push({ points: trimmed, arrow: true });
      }
    }
  } else if (fam === 'mindmap') {
    var centreText = centerIdx >= 0 ? items[centerIdx] : { label: doc.title || doc.subtitle || '' };
    var branches = centerIdx >= 0 ? items.filter(function (it, i) { return i !== centerIdx; }) : items;
    var cW = Math.min(bw * 0.3, u * 18), cH = Math.min(bh * 0.32, u * 7.5);
    var cX = bx + bw / 2 - cW / 2, cY = by + bh / 2 - cH / 2;
    node('centre', cX, cY, cW, cH, 'centre', { label: centreText.label }, 0, { shape: 'pill', solid: true });
    var rightN = Math.ceil(branches.length / 2);
    var sideW = (bw - cW) / 2 - u * 3;
    [[0, rightN, 1], [rightN, branches.length, -1]].forEach(function (side) {
      var list = branches.slice(side[0], side[1]);
      if (!list.length) return;
      var weights = list.map(function (it) { return 1 + it.children.length * 0.55; });
      var total = weights.reduce(function (a, v) { return a + v; }, 0);
      // A branch is as tall as it needs to be, never the whole side: the stack
      // is then centred on the centre's line.
      var gm2 = u * 0.8, avail = bh - gm2 * (list.length - 1);
      var heights = weights.map(function (wt) { return Math.min(avail * wt / total, u * (6 + wt * 3.5)); });
      var yy = by + (bh - heights.reduce(function (a, v) { return a + v; }, 0) - gm2 * (list.length - 1)) / 2;
      list.forEach(function (it, j) {
        var hh = heights[j];
        var xx = side[2] > 0 ? bx + bw - sideW : bx;
        node('card', xx, yy, sideW, hh, 'card', runs(it, { icon: true, list: true }), side[0] + j, { align: 'left' });
        var sx = side[2] > 0 ? cX + cW : cX, sy = cY + cH / 2;
        var ex = side[2] > 0 ? xx : xx + sideW, ey = yy + hh / 2;
        var pts2 = [];
        for (var q2 = 0; q2 <= 24; q2++) {
          var tt = q2 / 24, mt = 1 - tt, mx = (sx + ex) / 2;
          pts2.push([mt * mt * mt * sx + 3 * mt * mt * tt * mx + 3 * mt * tt * tt * mx + tt * tt * tt * ex, mt * mt * mt * sy + 3 * mt * mt * tt * sy + 3 * mt * tt * tt * ey + tt * tt * tt * ey]);
        }
        links.push({ points: pts2, arrow: false, tone: side[0] + j });
        yy += hh + gm2;
      });
    });
  } else if (fam === 'flow') {
    var rel = doc.relations.length ? doc.relations : items.slice(1).map(function (it, i) { return { from: i, to: i + 1, label: '' }; });
    var level = items.map(function () { return 0; });
    // Levels by longest path over FORWARD edges (in item order); a back edge is
    // drawn but does not move anything, so a loop cannot push a node forever.
    for (var pass = 0; pass < n; pass++) rel.forEach(function (rr) { if (rr.to > rr.from && level[rr.to] < level[rr.from] + 1) level[rr.to] = level[rr.from] + 1; });
    var L = 0;
    level.forEach(function (lv) { if (lv + 1 > L) L = lv + 1; });
    var gf = u * 2.4;
    var placed = [];
    for (var lv = 0; lv < L; lv++) {
      var members = [];
      level.forEach(function (v, i) { if (v === lv) members.push(i); });
      var km = members.length;
      members.forEach(function (idx, j) {
        var incoming = rel.some(function (rr) { return rr.to === idx; }), outgoing = rel.some(function (rr) { return rr.from === idx; });
        var shape = !incoming || !outgoing ? 'pill' : 'rect';
        var rect;
        if (wide) {
          var colW2 = (bw - gf * (L - 1)) / L, nh = Math.min((bh - u * (km - 1)) / km, bh * 0.42);
          var top = by + (bh - (nh * km + u * (km - 1))) / 2;
          rect = { x: bx + lv * (colW2 + gf), y: top + j * (nh + u), w: colW2, h: nh };
        } else {
          var rowH2 = (bh - gf * (L - 1)) / L, nw = Math.min((bw - u * (km - 1)) / km, bw * 0.6);
          var left = bx + (bw - (nw * km + u * (km - 1))) / 2;
          rect = { x: left + j * (nw + u), y: by + lv * (rowH2 + gf), w: nw, h: rowH2 };
        }
        placed[idx] = rect;
        node('card', rect.x, rect.y, rect.w, rect.h, 'card', runs(items[idx], { icon: true }), idx, { shape: shape });
      });
    }
    rel.forEach(function (rr) {
      var A = placed[rr.from], B = placed[rr.to];
      if (!A || !B) return;
      var p0, p3, c1, c2;
      if (rr.to > rr.from && level[rr.to] > level[rr.from]) {
        if (wide) { p0 = [A.x + A.w, A.y + A.h / 2]; p3 = [B.x, B.y + B.h / 2]; c1 = [p0[0] + gf / 2, p0[1]]; c2 = [p3[0] - gf / 2, p3[1]]; }
        else { p0 = [A.x + A.w / 2, A.y + A.h]; p3 = [B.x + B.w / 2, B.y]; c1 = [p0[0], p0[1] + gf / 2]; c2 = [p3[0], p3[1] - gf / 2]; }
      } else {
        // A way back: round the outside, under (or beside) both boxes.
        if (wide) { p0 = [A.x + A.w / 2, A.y + A.h]; p3 = [B.x + B.w / 2, B.y + B.h]; var low = Math.min(by + bh + u * 1.2, Math.max(A.y + A.h, B.y + B.h) + u * 2.4); c1 = [p0[0], low]; c2 = [p3[0], low]; }
        else { p0 = [A.x + A.w, A.y + A.h / 2]; p3 = [B.x + B.w, B.y + B.h / 2]; var far = Math.min(bx + bw + u * 1.2, Math.max(A.x + A.w, B.x + B.w) + u * 2.4); c1 = [far, p0[1]]; c2 = [far, p3[1]]; }
      }
      var curve = [];
      for (var cs = 0; cs <= 32; cs++) {
        var tq = cs / 32, mq = 1 - tq;
        curve.push([mq * mq * mq * p0[0] + 3 * mq * mq * tq * c1[0] + 3 * mq * tq * tq * c2[0] + tq * tq * tq * p3[0], mq * mq * mq * p0[1] + 3 * mq * mq * tq * c1[1] + 3 * mq * tq * tq * c2[1] + tq * tq * tq * p3[1]]);
      }
      links.push({ points: curve, arrow: true, label: rr.label });
    });
  } else if (fam === 'stats') {
    var cols = wide ? (n <= 4 ? n : Math.ceil(n / 2)) : (n <= 2 ? n : 2);
    var rows = Math.ceil(n / cols), gs = u * 1.2;
    var sw = (bw - gs * (cols - 1)) / cols, sh = (bh - gs * (rows - 1)) / rows;
    for (var si = 0; si < n; si++) {
      var row = Math.floor(si / cols), inRow = Math.min(cols, n - row * cols);
      var offset = (bw - (inRow * sw + (inRow - 1) * gs)) / 2;
      node('card', bx + offset + (si % cols) * (sw + gs), by + row * (sh + gs), sw, sh, 'card', runs(items[si], { value: true, icon: true }), si, { valueScale: 2.3 });
    }
  } else if (fam === 'bars') {
    var rowB = bh / Math.max(1, n), labelW = bw * 0.28;
    var max = 0;
    items.forEach(function (it) { if (it.value != null && it.value > max) max = it.value; });
    var valueW = u * 6.5, trackX = bx + labelW + u, trackW = Math.max(u, bw - labelW - u - valueW);
    var barH = Math.min(rowB * 0.62, u * 3.2);
    for (var bi = 0; bi < n; bi++) {
      var ry = by + bi * rowB, mid = ry + rowB / 2;
      var len = max > 0 && items[bi].value != null ? Math.max(0, trackW * items[bi].value / max) : 0;
      node('text', bx, ry, labelW, rowB, 'barlabel', { label: items[bi].label }, bi, { align: 'right', pad: 0, padY: 0 });
      node('track', trackX, mid - barH / 2, trackW, barH, 'none', {}, bi, { shape: 'pill' });
      if (len > 0) node('bar', trackX, mid - barH / 2, len, barH, 'none', {}, bi, { shape: 'pill' });
      node('text', trackX + len + u * 0.6, ry, Math.max(u, bw - (trackX + len + u * 0.6 - bx)), rowB, 'barvalue', { value: mockyVisualNum(items[bi].value, items[bi].unit) }, bi, { align: 'left', pad: 0, padY: 0, valueScale: 1 });
    }
  } else if (fam === 'donut') {
    var dia = Math.min(bh, bw * 0.46);
    var parts = items.map(function (it, i) { return { v: it.value != null && it.value > 0 ? it.value : 0, tone: i }; });
    node('donut', bx, by + (bh - dia) / 2, dia, dia, 'none', { parts: parts }, 0, { shape: 'circle' });
    var lx = bx + dia + u * 2.4, lw = bw - dia - u * 2.4, lrow = Math.min(bh / Math.max(1, n), u * 5.5);
    var ltop = by + (bh - lrow * n) / 2;
    for (var di = 0; di < n; di++) {
      var sz = Math.min(lrow * 0.42, u * 1.4);
      node('swatch', lx, ltop + di * lrow + lrow / 2 - sz / 2, sz, sz, 'none', {}, di, { shape: 'rect' });
      node('text', lx + sz + u * 0.8, ltop + di * lrow, lw - sz - u * 0.8, lrow, 'legend', { value: mockyVisualNum(items[di].value, items[di].unit), label: items[di].label }, di, { align: 'left', pad: 0, padY: 0, valueScale: 1.15, inline: true });
    }
  }

  // ---- one size per role ----
  var groups = {};
  nodes.forEach(function (nd) { if (nd.g && nd.g !== 'none' && nd.g !== 'dot') (groups[nd.g] = groups[nd.g] || []).push(nd); });
  var maxByRole = { card: u * 2.1, head: u * 2.0, row: u * 1.6, band: u * 1.9, centre: u * 2.5, axis: u * 1.2, barlabel: u * 1.6, barvalue: u * 1.7, legend: u * 1.6 };
  var type = {};
  Object.keys(groups).forEach(function (gk) {
    var list = groups[gk];
    var vs = list[0].valueScale || 1.6;
    type[gk] = mockyVisualFitGroup(list, Math.max(11, maxByRole[gk] || u * 1.4), 11, vs);
  });
  // A detail is never as large as a label of a superior role, and a row of a
  // comparison is never as large as its column's head.
  if (type.row && type.head && type.row.s.L > type.head.s.L * 0.86) {
    type.row.s.L = Math.max(11, type.head.s.L * 0.86);
    type.row.s.D = Math.min(type.row.s.D, type.row.s.L * 0.76);
  }
  // The ORDER: a centre is never set smaller than what hangs off it. When the
  // centre cannot grow, the cards come down to it rather than invert it.
  if (type.card && type.centre && type.card.s.L > type.centre.s.L) {
    type.card.s.L = type.centre.s.L;
    type.card.s.D = Math.min(type.card.s.D, Math.max(9, type.card.s.L * 0.78));
    type.card.s.V = type.card.s.L * (groups.card[0].valueScale || 1.6);
  }

  return {
    family: fam, W: W, H: H, u: u, doc: doc, nodes: nodes, links: links, type: type,
    header: { title: title, T: T, subtitle: doc.subtitle, S: S, h: headerH },
    footer: doc.source ? { text: doc.source, F: F, y: H - footH + u * 0.6 } : null,
  };
}

function mockyVisualDonutPath(cx, cy, r0, r1, a0, a1) {
  var large = a1 - a0 > Math.PI ? 1 : 0;
  var p = function (r, a) { return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); };
  return 'M' + p(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + p(r1, a1) + ' L' + p(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + p(r0, a0) + ' Z';
}

function Visual(props) {
  var p = props || {};
  var e = React.createElement;
  var ref = React.useRef(null);
  var id = React.useState(function () { return 'mocky-visual-' + (++mockyVisualSeq); })[0];
  var st = React.useState([p.width || 1200, p.height || 675, false]);
  var size = st[0], setSize = st[1];
  React.useLayoutEffect(function () {
    var el = ref.current;
    if (!el) return undefined;
    function read() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!(w > 0)) return;
      // A parent with no height gives none: the visual then takes 16:9 of its width.
      var auto = !(h > 40);
      var hh = auto ? Math.round(w * 9 / 16) : h;
      setSize(function (prev) { return Math.abs(prev[0] - w) < 1 && Math.abs(prev[1] - hh) < 1 && prev[2] === auto ? prev : [w, hh, auto]; });
    }
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    var ro = new ResizeObserver(read);
    ro.observe(el);
    return function () { ro.disconnect(); };
  }, []);

  var W = size[0], H = size[1];
  var lay = mockyVisualLayout(p.family, p.doc, W, H);
  var u = lay.u;
  var variant = p.variant === 'solid' || p.variant === 'outline' ? p.variant : 'soft';
  var ground = mockyVisualRgb(p.ground) ? p.ground : '#ffffff';
  var ink = mockyVisualRgb(p.ink) ? p.ink : mockyVisualInkOn(ground, ['#111827'], 7);
  var colors = (Array.isArray(p.colors) ? p.colors : []).filter(function (c) { return mockyVisualRgb(c); });
  if (!colors.length) colors = mockyVisualRgb(p.color) ? [p.color] : MOCKY_VISUAL_DEFAULT_COLORS;
  var tone = function (i) { return colors[((i % colors.length) + colors.length) % colors.length]; };
  var muted = mockyVisualMix(ink, ground, 0.35);
  var line = mockyVisualMix(ink, ground, 0.55);
  var stroke = Math.max(1.5, u * 0.14);

  function paint(nd) {
    var c = tone(Math.max(0, nd.tone));
    var solid = nd.solid || variant === 'solid';
    var fill, border = 'none', text, mark;
    if (nd.plain) { fill = 'transparent'; text = mockyVisualInkOn(ground, [ink]); mark = mockyVisualMark(c, ground, ink, 3); }
    else if (solid) { fill = c; text = mockyVisualInkOn(c, [ground, ink]); mark = text; }
    else if (variant === 'outline' && !nd.soft) { fill = ground; border = Math.max(1.5, u * 0.13).toFixed(1) + 'px solid ' + c; text = mockyVisualInkOn(ground, [ink]); mark = mockyVisualMark(c, ground, ink, 3); }
    else { fill = mockyVisualMix(ground, c, nd.soft && variant === 'solid' ? 0.12 : 0.16); text = mockyVisualInkOn(fill, [ink]); mark = mockyVisualMark(c, fill, ink, 3); }
    return { fill: fill, border: border, text: text, mark: mark, sub: mockyVisualContrast(mockyVisualMix(text, fill === 'transparent' ? ground : fill, 0.18), fill === 'transparent' ? ground : fill) >= 4.5 ? mockyVisualMix(text, fill === 'transparent' ? ground : fill, 0.18) : text };
  }
  function radius(nd) {
    if (nd.shape === 'circle' || nd.shape === 'pill') return Math.min(nd.w, nd.h) / 2;
    return Math.min(u * 0.8, nd.h / 4, nd.w / 4);
  }
  function iconOf(name, sz, color) {
    var Ico = typeof Icon !== 'undefined' && Icon && name ? Icon[name] : null;
    return Ico ? e(Ico, { size: sz, strokeWidth: 2, style: { color: color, width: sz, height: sz, display: 'block' } }) : null;
  }

  var children = [];
  if (lay.header.h) {
    children.push(e('div', { key: 'h', style: { position: 'absolute', left: 0, top: 0, width: W, textAlign: 'left' } },
      lay.header.title ? e('div', { style: { fontSize: lay.header.T, lineHeight: 1.12, fontWeight: 800, color: ink, letterSpacing: '-0.01em' } }, lay.header.title) : null,
      lay.header.subtitle ? e('div', { style: { fontSize: lay.header.S, lineHeight: 1.35, color: muted, marginTop: lay.header.title ? u * 0.5 : 0, maxWidth: W * 0.9 } }, lay.header.subtitle) : null));
  }

  // Connectors first, so every box is painted over them.
  var marker = id + '-arrow';
  children.push(e('svg', { key: 'links', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', style: { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' } },
    e('defs', null, e('marker', { id: marker, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, e('path', { d: 'M0 0 L10 5 L0 10 z', fill: line }))),
    lay.links.filter(function (l) { return l.points && l.points.length > 1; }).map(function (l, i) {
      var col = l.tone != null ? mockyVisualMark(tone(l.tone), ground, ink, 3) : line;
      return e('path', { key: i, d: mockyVisualPath(l.points), fill: 'none', stroke: col, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', markerEnd: l.arrow ? 'url(#' + marker + ')' : undefined });
    })));
  lay.links.forEach(function (l, i) {
    if (!l.label || !l.points || l.points.length < 2) return;
    var mid = l.points[Math.floor(l.points.length / 2)];
    var fs = Math.max(10, u * 0.85);
    children.push(e('div', { key: 'll' + i, style: { position: 'absolute', left: mid[0], top: mid[1], transform: 'translate(-50%, -50%)', fontSize: fs, lineHeight: 1.2, padding: '1px ' + (fs * 0.4) + 'px', background: ground, color: muted, whiteSpace: 'nowrap', borderRadius: fs } }, l.label));
  });

  lay.nodes.forEach(function (nd, i) {
    var key = 'n' + i;
    var base = { position: 'absolute', left: nd.x, top: nd.y, width: nd.w, height: nd.h, boxSizing: 'border-box' };
    var c = tone(Math.max(0, nd.tone));
    if (nd.kind === 'dot') {
      var dc = mockyVisualInkOn(c, [ground, ink]);
      var content = nd.t.icon ? iconOf(nd.t.icon, nd.w * 0.5, dc) : null;
      children.push(e('div', { key: key, style: Object.assign(base, { borderRadius: '50%', background: c, color: dc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: nd.w * 0.42, lineHeight: 1 }) }, content || nd.t.num || null));
      return;
    }
    if (nd.kind === 'track') { children.push(e('div', { key: key, style: Object.assign(base, { borderRadius: nd.h / 2, background: mockyVisualMix(ground, c, 0.12) }) })); return; }
    if (nd.kind === 'bar' || nd.kind === 'swatch') { children.push(e('div', { key: key, style: Object.assign(base, { borderRadius: nd.kind === 'bar' ? nd.h / 2 : nd.h * 0.25, background: c }) })); return; }
    if (nd.kind === 'donut') {
      var total = nd.t.parts.reduce(function (a, v) { return a + v.v; }, 0) || 1;
      var a0 = -Math.PI / 2, cx = nd.w / 2, r1 = nd.w / 2, r0 = r1 * 0.58, gapA = nd.t.parts.length > 1 ? 0.012 : 0;
      children.push(e('svg', { key: key, width: nd.w, height: nd.h, viewBox: '0 0 ' + nd.w + ' ' + nd.h, 'aria-hidden': 'true', style: { position: 'absolute', left: nd.x, top: nd.y } },
        nd.t.parts.map(function (pt, j) {
          var sweep = 2 * Math.PI * pt.v / total;
          var d = sweep >= 2 * Math.PI - 1e-6
            ? mockyVisualDonutPath(cx, cx, r0, r1, a0, a0 + Math.PI) + ' ' + mockyVisualDonutPath(cx, cx, r0, r1, a0 + Math.PI, a0 + 2 * Math.PI - 1e-4)
            : sweep > gapA * 2 ? mockyVisualDonutPath(cx, cx, r0, r1, a0 + gapA, a0 + sweep - gapA) : '';
          a0 += sweep;
          return d ? e('path', { key: j, d: d, fill: tone(pt.tone) }) : null;
        })));
      return;
    }

    var fit = lay.type[nd.g];
    var s = fit ? fit.s : { L: 12, D: 10, V: 18 };
    var showDetail = fit ? fit.detail : false;
    var pnt = nd.kind === 'text' ? { fill: 'transparent', border: 'none', text: mockyVisualInkOn(ground, [ink]), mark: mockyVisualMark(c, ground, ink, 3), sub: muted } : paint(nd);
    if (nd.kind === 'text' && mockyVisualContrast(pnt.sub, ground) < 4.5) pnt.sub = pnt.text;
    var runsOut = [];
    var align = nd.align === 'left' ? 'flex-start' : nd.align === 'right' ? 'flex-end' : 'center';
    if (nd.t.icon) { var ic = iconOf(nd.t.icon, s.L * 1.15, pnt.mark); if (ic) runsOut.push(e('div', { key: 'i', style: { marginBottom: s.L * 0.3 } }, ic)); }
    if (nd.t.value && !nd.inline) runsOut.push(e('div', { key: 'v', style: { fontSize: s.V, lineHeight: 1.08, fontWeight: 800, color: pnt.mark, letterSpacing: '-0.02em' } }, nd.t.value));
    if (nd.t.label) {
      var labelColor = nd.t.kicker ? pnt.mark : pnt.text;
      if (nd.inline) {
        runsOut.push(e('div', { key: 'l', style: { fontSize: s.L, lineHeight: 1.25, color: pnt.text } },
          nd.t.value ? e('span', { style: { fontWeight: 800, color: pnt.text, marginRight: s.L * 0.5 } }, nd.t.value) : null,
          e('span', { style: { fontWeight: 500 } }, nd.t.label)));
      } else {
        runsOut.push(e('div', { key: 'l', style: { fontSize: s.L, lineHeight: 1.2, fontWeight: nd.g === 'axis' || nd.g === 'barlabel' || nd.g === 'row' ? 600 : 700, color: nd.g === 'axis' ? muted : labelColor, marginTop: runsOut.length ? s.L * 0.35 : 0 } },
          nd.t.mark ? e('span', { style: { fontWeight: 800, color: pnt.mark, marginRight: s.L * 0.45 } }, nd.t.mark) : null, nd.t.label));
      }
    }
    if (showDetail && nd.t.detail) runsOut.push(e('div', { key: 'd', style: { fontSize: s.D, lineHeight: 1.35, color: pnt.sub, marginTop: s.L * 0.35 } }, nd.t.detail));
    if (showDetail && nd.t.list && nd.t.list.length) {
      runsOut.push(e('ul', { key: 'ls', style: { listStyle: 'none', margin: s.L * 0.35 + 'px 0 0', padding: 0, fontSize: s.D, lineHeight: 1.35, color: pnt.sub } },
        nd.t.list.map(function (x, j) { return e('li', { key: j, style: { paddingLeft: s.D, position: 'relative', marginTop: j ? s.D * 0.25 : 0 } }, e('span', { 'aria-hidden': 'true', style: { position: 'absolute', left: 0, color: pnt.mark } }, '\\u2022'), x); })));
    }
    var style = Object.assign(base, {
      display: 'flex', flexDirection: 'column', justifyContent: nd.valign === 'end' ? 'flex-end' : nd.valign === 'start' ? 'flex-start' : 'center',
      alignItems: align, textAlign: nd.align === 'left' ? 'left' : nd.align === 'right' ? 'right' : 'center',
      padding: nd.padY + 'px ' + nd.pad + 'px', background: pnt.fill, border: pnt.border, borderRadius: radius(nd), color: pnt.text,
      overflowWrap: 'break-word', boxShadow: nd.ring ? '0 0 0 ' + Math.max(2, u * 0.2) + 'px ' + mockyVisualMark(c, ground, ink, 3) : undefined,
    });
    if (nd.vertical) {
      children.push(e('div', { key: key, style: Object.assign({}, base, { display: 'flex', alignItems: 'center', justifyContent: 'center' }) },
        e('div', { style: { transform: 'rotate(-90deg)', whiteSpace: 'nowrap', fontSize: s.L, fontWeight: 600, color: muted } }, nd.t.label)));
      return;
    }
    children.push(e('div', { key: key, style: style }, runsOut));
  });

  if (lay.footer) {
    children.push(e('div', { key: 'f', style: { position: 'absolute', left: 0, top: lay.footer.y, width: W, fontSize: lay.footer.F, lineHeight: 1.5, color: muted, textAlign: 'left' } }, lay.footer.text));
  }

  var label = lay.doc.title || lay.doc.subtitle || undefined;
  return e('div', {
    ref: ref, role: 'group', 'aria-label': label, 'data-mocky-visual': lay.family, className: p.className,
    style: Object.assign({ position: 'relative', width: p.width ? p.width : '100%', height: p.height ? p.height : '100%', minHeight: size[2] ? H : undefined, color: ink, overflow: 'visible' }, p.style || {}),
  }, children);
}
`
