/**
 * Handwriting — a few words written by hand, stroke by stroke:
 * `<Handwriting text="Merci !" font="parisienne" className="text-6xl text-rose-700" />`.
 *
 * The writing is Tegaki's (MIT, https://github.com/gkurt/tegaki): a real
 * handwriting font traced in a pen's order, which `public/vendor/tegaki.js`
 * turns into a self-drawing SVG — paths and CSS keyframes. An SVG rather than a
 * canvas because every renderer of a page copies one as it is: the canvas,
 * html2canvas in the capture shell, and the native rasteriser of the document
 * exports. The fonts are files of their own beside the renderer, loaded the
 * first time a screen names one (`scripts/build-vendor-tegaki.mjs` has the
 * weights).
 *
 * WHAT IT GUARANTEES
 *
 * - A word is never written with letters missing. Three of the fonts carry
 *   ASCII only, so a text with an accent one of them lacks ("Été", "Noël") is
 *   written in EMS Allure, which has them — `HANDWRITING_FALLBACK`. A character
 *   no font has is the case for plain text: the words are then set in a cursive
 *   face, unanimated, rather than drawn with a hole (Q1).
 * - It is text to a reader: the words are in the DOM, visually hidden, and the
 *   drawing is `aria-hidden`.
 * - It holds still where a page holds still: "Sans animation", reduced motion and
 *   a capture frame (`__mockyStill`) all get the finished words at once — a
 *   signature frozen on its first frame is an empty box on paper. A capture
 *   waits for the font (`__mockyStillPending`).
 * - Two of them on a page do not animate each other: the SVG's names all start
 *   with `tk-`, and inline SVG shares the page's namespace, so each instance
 *   renames them.
 *
 * Exported as a STRING so it can be prepended to the generated component before
 * Babel.transform, like every other snippet pack.
 */

/** Kept in step with `TEGAKI_FONTS` in scripts/build-vendor-tegaki.mjs — a test holds the two. */
export const HANDWRITING_FONTS = ['parisienne', 'caveat', 'italianno', 'ems-allure', 'hershey-script'] as const

/** The font with Latin-1 and Latin Extended-A, for a text the chosen one cannot write whole. */
export const HANDWRITING_FALLBACK = 'ems-allure'

export const HANDWRITING_EXPORTS = ['Handwriting'] as const

export const HandwritingSource = `var MOCKY_HW_FONTS = ${JSON.stringify(HANDWRITING_FONTS)};
var MOCKY_HW_FALLBACK = ${JSON.stringify(HANDWRITING_FALLBACK)};
var mockyHwSeq = 0;
var mockyHwStill = function () {
  try {
    if (window.__mockyAnimations === false || window.__mockyStill) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { return true; }
  return false;
};
/* Typography a handwriting font has no glyph for, written the way a hand would. */
var mockyHwPlain = function (text) {
  return String(text)
    .replace(/[\\u2018\\u2019\\u201A\\u2032]/g, "'")
    /* French guillemets carry their own spaces inside; straight quotes do not. */
    .replace(/\\u00AB[\\s\\u00A0\\u202F]*/g, '"').replace(/[\\s\\u00A0\\u202F]*\\u00BB/g, '"')
    .replace(/[\\u201C\\u201D\\u201E]/g, '"')
    .replace(/\\u0153/g, 'oe').replace(/\\u0152/g, 'OE')
    .replace(/\\u00E6/g, 'ae').replace(/\\u00C6/g, 'AE')
    .replace(/[\\u2013\\u2014]/g, '-')
    .replace(/\\u2026/g, '...')
    .replace(/[\\u00A0\\u202F]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
};
var mockyHwCovers = function (bundle, text) {
  var glyphs = bundle && bundle.glyphData;
  if (!glyphs) return false;
  var chars = Array.from(text);
  for (var i = 0; i < chars.length; i++) {
    if (chars[i] === ' ') continue;
    if (!glyphs[chars[i]]) return false;
  }
  return true;
};
var mockyHwColor = function (value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : 'currentColor';
};
var mockyHwNum = function (value, min, max, fallback) {
  var n = Number(value);
  return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
var mockyHwHold = function (on) {
  try { window.__mockyStillPending = Math.max(0, (window.__mockyStillPending || 0) + (on ? 1 : -1)); } catch (e) {}
};
var Handwriting = function (props) {
  var raw = props.text != null ? props.text : typeof props.children === 'string' ? props.children : '';
  var text = mockyHwPlain(raw);
  var font = MOCKY_HW_FONTS.indexOf(props.font) >= 0 ? props.font : MOCKY_HW_FONTS[0];
  var color = mockyHwColor(props.color);
  /* 2 by default: Tegaki writes at a hand's pace, and on a page that pace read as
     slow — "Merci beaucoup !" took nine seconds. */
  var speed = mockyHwNum(props.speed, 0.25, 4, 2);
  var loop = !!props.loop;
  var className = typeof props.className === 'string' ? props.className : '';

  /* Hooks before any return, every render: see Animated's note on why. */
  var still = React.useRef(null);
  if (still.current === null) still.current = mockyHwStill();
  var scope = React.useRef(null);
  if (scope.current === null) scope.current = 'tk-h' + (++mockyHwSeq) + '-';
  var ref = React.useRef(null);
  var seen = React.useState(still.current);
  var inView = seen[0], setInView = seen[1];
  var drawn = React.useState(null);
  var art = drawn[0], setArt = drawn[1];

  /* Written when it scrolls into view, like an entrance: a signature at the
     foot of a page that wrote itself before anyone got there was never seen. */
  React.useEffect(function () {
    if (inView) return;
    var node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { setInView(true); io.disconnect(); return; }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(node);
    return function () { io.disconnect(); };
  }, [inView]);

  React.useEffect(function () {
    if (!inView || !text) return;
    var live = true;
    var tk = window.MockyTegaki;
    if (!tk) { setArt({ plain: true }); return; }
    var held = still.current;
    if (held) mockyHwHold(true);
    var release = function () { if (held) { held = false; mockyHwHold(false); } };
    var write = function (bundle) {
      var svg = tk.textToSvg(text, bundle, {
        mode: still.current ? 'static' : loop ? 'loop' : 'once',
        color: color,
        fontSize: 100,
        speed: speed,
        crop: false,
      });
      var box = /viewBox="[^"]*?\\s([0-9.]+)"/.exec(svg);
      return { svg: svg.replace(/\\btk-/g, scope.current), em: box ? Number(box[1]) / 100 : 1.4 };
    };
    tk.loadFont(font)
      .then(function (bundle) {
        if (mockyHwCovers(bundle, text)) return bundle;
        return tk.loadFont(MOCKY_HW_FALLBACK).then(function (other) { return mockyHwCovers(other, text) ? other : null; });
      })
      .then(function (bundle) { if (live) setArt(bundle ? write(bundle) : { plain: true }); })
      .catch(function () { if (live) setArt({ plain: true }); })
      .then(release, release);
    return function () { live = false; release(); };
  }, [inView, text, font, color, speed, loop]);

  var drawing = art && art.svg
    ? React.createElement('span', {
        'aria-hidden': 'true',
        style: { display: 'inline-block', height: art.em + 'em', lineHeight: 0, verticalAlign: 'middle' },
        dangerouslySetInnerHTML: { __html: art.svg.replace('<svg ', '<svg style="height:100%;width:auto;display:block;overflow:visible" ') },
      })
    : React.createElement('span', {
        'aria-hidden': 'true',
        /* Before the font arrives the words hold their place unseen; if it never
           does, they are simply shown, in a cursive face. */
        style: { fontFamily: 'cursive', visibility: art && art.plain ? 'visible' : 'hidden', color: color === 'currentColor' ? undefined : color },
      }, text);

  return React.createElement(
    'span',
    { ref: ref, className: ('inline-block ' + className).trim(), style: { position: 'relative' } },
    React.createElement('span', {
      style: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
    }, raw),
    drawing,
  );
};
`
