/**
 * The Motion Ultra kit — a hand-written stylesheet of `u-*` classes and one
 * component, `<Backdrop>`.
 *
 * WHY A STYLESHEET AND NOT "WRITE YOUR OWN CSS"
 *
 * The pages Motion Ultra is aiming at are made of a dozen moves — frosted glass,
 * a living colour field, display type, a grain, reveals tied to the scroll — and
 * every one of them is thirty lines of CSS a model gets subtly wrong: a
 * `backdrop-filter` without its `-webkit-` twin, a mask with no fallback, a
 * scroll-driven animation that leaves its element at `opacity: 0` in a browser
 * without `animation-timeline`. Written once here, they are right on every
 * screen; the model composes them by name, the same bargain `<Animated preset>`
 * and `<Scene3D preset>` make.
 *
 * WHY IT IS INJECTED BY THE PRELUDE
 *
 * A `cdn-css` capability would be a file in `public/vendor/`, which is for
 * third-party bundles pinned by hash. This is Mocky's own code, it must reach
 * the preview, the capture shell AND an exported project, and the prelude is
 * the one path all three already take.
 *
 * THREE WAYS A SCREEN MUST STILL READ, AND WHAT EACH COSTS
 *
 * - `prefers-reduced-motion`: every loop stops, every reveal rests visible.
 * - "Sans animation" (`__mockyAnimations === false`): the same, through the
 *   `u-still` class on <html> — the preview's own freeze collapses durations,
 *   which a SCROLL-driven animation does not have, so it needs saying here.
 * - The capture shell (`__mockyStill`): html2canvas cannot paint
 *   `background-clip: text`, so gradient type would come back as a coloured
 *   rectangle in every thumbnail; under `u-capture` it degrades to the accent
 *   ink. It also cannot parse `color-mix()` and THROWS on it, which is why no
 *   colour in this file is computed — layers are tinted by opacity instead.
 */

/** Every class the kit defines, with what it does — printed to the model. */
export const ULTRA_CLASSES: Record<string, string> = {
  'u-display': 'display headline, fluid 3rem→9.5rem, tight leading and tracking',
  'u-display-sm': 'secondary display size, fluid 2.25rem→5rem',
  'u-eyebrow': 'small uppercase kicker above a headline, wide tracking',
  'u-text-gradient': 'gradient-filled text across --u-a → --u-b → --u-c (use on ONE word, not a sentence)',
  'u-text-shine': 'a light sweeping across the text, looping',
  'u-text-outline': 'outlined, hollow letters in the current colour',
  'u-glass': 'frosted dark-ground surface: translucent fill, blur, hairline border',
  'u-glass-light': 'the same surface for a pale ground',
  'u-glow': 'a soft halo in --u-a around a box',
  'u-border-beam': 'a light travelling round the border of a rounded box (give it a radius)',
  'u-sheen': 'a highlight sweeping across a button every few seconds',
  'u-noise': 'a fine film grain over the element',
  'u-reveal': 'rises and fades in as it scrolls into view',
  'u-reveal-blur': 'the same, coming out of a blur',
  'u-mask-up': 'on load, rises out of an invisible mask (inline-block; use on a headline line)',
  'u-parallax': 'drifts against the scroll — for an image in an overflow-hidden band',
  'u-float': 'bobs gently, forever — for an isolated object',
  'u-spin-slow': 'turns once a minute — for a badge or a ring',
  'u-kenburns': 'a slow zoom, forever — for a full-bleed photograph',
  'u-cutout': 'dissolves the edges of a picture into whatever is behind it — for an isolated object whose photo has its own background',
  'u-fade-bottom': 'the element fades to transparent at its bottom edge',
  'u-fade-x': 'fades both horizontal edges — for a marquee',
  'u-stack': 'direct children become sticky cards piling up on scroll; give each style={{"--i": index}}',
}

/** The presets `<Backdrop>` draws. Anything else falls back to the first. */
export const BACKDROP_PRESETS = ['aurora', 'mesh', 'spotlight', 'beams', 'grid'] as const

/* A static film grain. No `#` in a data URI inside CSS: it would end the URL. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/** The stylesheet itself. Exported so the tests can hold it to ULTRA_CLASSES. */
export const ULTRA_CSS = [
  ':root{--u-a:#7c5cff;--u-b:#22d3ee;--u-c:#f472b6;--u-line:rgba(255,255,255,.14)}',
  '@property --u-angle{syntax:"<angle>";initial-value:0deg;inherits:false}',

  // Type
  '.u-display{font-size:clamp(3rem,9vw,9.5rem);line-height:.92;letter-spacing:-.045em;font-weight:700}',
  '.u-display-sm{font-size:clamp(2.25rem,5.5vw,5rem);line-height:.98;letter-spacing:-.035em;font-weight:650}',
  '.u-eyebrow{font-size:.75rem;line-height:1rem;letter-spacing:.24em;text-transform:uppercase;font-weight:600}',
  '.u-text-gradient{background:linear-gradient(100deg,var(--u-a),var(--u-b) 50%,var(--u-c));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}',
  '.u-text-shine{background:linear-gradient(110deg,currentColor 38%,rgba(255,255,255,.95) 50%,currentColor 62%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:u-shine 5s linear infinite}',
  '.u-text-outline{-webkit-text-fill-color:transparent;-webkit-text-stroke:1.5px currentColor}',

  // Surfaces
  '.u-glass{background:rgba(255,255,255,.07);-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 24px 60px -24px rgba(0,0,0,.5)}',
  '.u-glass-light{background:rgba(255,255,255,.6);-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);border:1px solid rgba(15,23,42,.08);box-shadow:0 20px 50px -24px rgba(15,23,42,.25)}',
  '.u-glow{box-shadow:0 0 0 1px rgba(255,255,255,.06),0 30px 90px -20px var(--u-a)}',
  '.u-border-beam{position:relative;isolation:isolate}',
  '.u-border-beam::before{content:"";position:absolute;inset:0;padding:1px;border-radius:inherit;background:conic-gradient(from var(--u-angle),transparent 0 70%,var(--u-a) 80%,var(--u-b) 90%,transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:u-beam 6s linear infinite;pointer-events:none;z-index:1}',
  '.u-sheen{position:relative;overflow:hidden;isolation:isolate}',
  '.u-sheen::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-100%);animation:u-sheen 3.6s ease-in-out infinite;pointer-events:none}',
  `.u-noise{position:relative;isolation:isolate}`,
  `.u-noise::after{content:"";position:absolute;inset:0;background-image:${GRAIN};opacity:.12;mix-blend-mode:overlay;pointer-events:none;border-radius:inherit}`,

  // Motion on load / forever
  '.u-mask-up{display:inline-block;animation:u-mask 1.1s cubic-bezier(.2,.7,.1,1) both}',
  '.u-float{animation:u-float 7s ease-in-out infinite}',
  '.u-spin-slow{animation:u-spin 60s linear infinite}',
  '.u-kenburns{animation:u-kenburns 26s ease-in-out infinite alternate;transform-origin:50% 40%}',

  // Motion tied to the scroll. Only where the browser can do it: elsewhere the
  // element simply rests where it is, visible — never parked at opacity 0.
  '@supports (animation-timeline: view()){',
  '.u-reveal{animation:u-rise linear both;animation-timeline:view();animation-range:entry 0% entry 70%}',
  '.u-reveal-blur{animation:u-rise-blur linear both;animation-timeline:view();animation-range:entry 0% entry 80%}',
  '.u-parallax{animation:u-par linear both;animation-timeline:view();animation-range:cover 0% cover 100%}',
  '}',

  // Layout helpers
  // An isolated object is generated on "a plain background", and plain is never
  // the page's own ground: the first real run shipped a hero speaker inside a
  // visible beige rectangle. A soft radial mask removes the rectangle whatever
  // the two colours are, which no prompt to either model could guarantee.
  '.u-cutout{-webkit-mask-image:radial-gradient(closest-side,#000 64%,transparent 100%);mask-image:radial-gradient(closest-side,#000 64%,transparent 100%)}',
  '.u-fade-bottom{-webkit-mask-image:linear-gradient(to bottom,#000 60%,transparent);mask-image:linear-gradient(to bottom,#000 60%,transparent)}',
  '.u-fade-x{-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}',
  '.u-stack>*{position:sticky;top:calc(5rem + var(--i,0) * 1.25rem)}',

  // <Backdrop>
  '.u-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}',
  '.u-backdrop-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:u-kenburns 30s ease-in-out infinite alternate}',
  '.u-backdrop-layer{position:absolute;inset:0}',
  '.u-blob{position:absolute;width:60%;aspect-ratio:1;border-radius:50%;filter:blur(80px);opacity:.55;mix-blend-mode:screen;animation:u-drift 22s ease-in-out infinite alternate}',
  '.u-blob-1{background:var(--u-a);top:-20%;left:-10%}',
  '.u-blob-2{background:var(--u-b);top:5%;right:-15%;animation-duration:28s;animation-delay:-6s}',
  '.u-blob-3{background:var(--u-c);bottom:-35%;left:20%;animation-duration:34s;animation-delay:-12s}',
  '.u-tone-light .u-blob{mix-blend-mode:multiply;opacity:.3}',
  '.u-backdrop-mesh .u-backdrop-layer{inset:-20%;background:radial-gradient(at 20% 20%,var(--u-a) 0,transparent 45%),radial-gradient(at 80% 10%,var(--u-b) 0,transparent 40%),radial-gradient(at 60% 85%,var(--u-c) 0,transparent 45%);opacity:.65;animation:u-mesh 30s ease-in-out infinite alternate}',
  '.u-tone-light.u-backdrop-mesh .u-backdrop-layer{opacity:.35}',
  '.u-backdrop-spotlight .u-backdrop-layer{background:radial-gradient(640px circle at var(--u-x,50%) var(--u-y,30%),var(--u-a),transparent 60%);opacity:.4}',
  '.u-backdrop-beams .u-backdrop-layer{left:50%;top:-70%;width:220%;height:auto;aspect-ratio:1;background:repeating-conic-gradient(from 0deg,var(--u-a) 0deg 3deg,transparent 3deg 16deg);opacity:.16;-webkit-mask-image:radial-gradient(closest-side,#000 15%,transparent 72%);mask-image:radial-gradient(closest-side,#000 15%,transparent 72%);animation:u-beams 120s linear infinite}',
  '.u-backdrop-grid .u-backdrop-layer{inset:-40% -50% 0 -50%;background-image:linear-gradient(var(--u-line) 1px,transparent 1px),linear-gradient(90deg,var(--u-line) 1px,transparent 1px);background-size:56px 56px;transform:perspective(600px) rotateX(60deg);transform-origin:50% 100%;-webkit-mask-image:linear-gradient(to top,#000 10%,transparent 85%);mask-image:linear-gradient(to top,#000 10%,transparent 85%);animation:u-grid 6s linear infinite}',
  '.u-tone-light.u-backdrop-grid{--u-line:rgba(15,23,42,.1)}',
  '.u-backdrop-grid::before{content:"";position:absolute;left:50%;bottom:-25%;width:70%;height:60%;transform:translateX(-50%);background:radial-gradient(closest-side,var(--u-a),transparent);opacity:.45;filter:blur(40px)}',
  '.u-backdrop-veil{position:absolute;inset:0;background:#000}',
  '.u-tone-light .u-backdrop-veil{background:#fff}',
  `.u-grain-layer{position:absolute;inset:0;background-image:${GRAIN};opacity:.09;mix-blend-mode:overlay}`,

  // Keyframes
  '@keyframes u-shine{from{background-position:120% 0}to{background-position:-120% 0}}',
  '@keyframes u-beam{to{--u-angle:360deg}}',
  '@keyframes u-sheen{0%,55%{transform:translateX(-100%)}85%,100%{transform:translateX(100%)}}',
  '@keyframes u-mask{from{clip-path:inset(0 0 100% 0);transform:translateY(35%)}to{clip-path:inset(0 0 0 0);transform:none}}',
  '@keyframes u-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}',
  '@keyframes u-spin{to{transform:rotate(360deg)}}',
  '@keyframes u-kenburns{from{transform:scale(1)}to{transform:scale(1.12)}}',
  '@keyframes u-rise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}',
  '@keyframes u-rise-blur{from{opacity:0;filter:blur(14px);transform:translateY(24px)}to{opacity:1;filter:none;transform:none}}',
  '@keyframes u-par{from{transform:translateY(-10%)}to{transform:translateY(10%)}}',
  '@keyframes u-drift{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(8%,6%,0) scale(1.12)}100%{transform:translate3d(-6%,10%,0) scale(.95)}}',
  '@keyframes u-mesh{to{transform:rotate(8deg) scale(1.1)}}',
  '@keyframes u-beams{from{transform:translateX(-50%) rotate(0)}to{transform:translateX(-50%) rotate(360deg)}}',
  '@keyframes u-grid{to{background-position:0 56px}}',

  // Held still: reduced motion, "Sans animation", and the capture shell. Loops
  // stop; every entrance rests at its FINAL state, never its first.
  STILL('@media (prefers-reduced-motion: reduce){', '}'),
  STILL('', '', '.u-still '),
  // html2canvas paints neither `background-clip: text` nor a text stroke.
  '.u-capture .u-text-gradient,.u-capture .u-text-shine{background:none!important;-webkit-text-fill-color:currentColor!important}',
  '.u-capture .u-text-gradient{color:var(--u-a)!important}',
  '.u-capture .u-text-outline{-webkit-text-fill-color:currentColor!important}',
].join('\n')

function STILL(open: string, close: string, scope = ''): string {
  const loops = [
    '.u-backdrop *', '.u-backdrop-img', '.u-float', '.u-spin-slow', '.u-kenburns', '.u-text-shine',
    '.u-border-beam::before', '.u-sheen::after',
  ]
  const entrances = ['.u-reveal', '.u-reveal-blur', '.u-mask-up', '.u-parallax']
  const s = (list: string[]) => list.map((sel) => scope + sel).join(',')
  return (
    open +
    `${s(loops)}{animation:none!important}` +
    `${s(entrances)}{animation:none!important;opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}` +
    close
  )
}

export const UltraSource = `var MOCKY_ULTRA_CSS = ${JSON.stringify(ULTRA_CSS)};
var MOCKY_BACKDROPS = ${JSON.stringify(BACKDROP_PRESETS)};
(function () {
  try {
    var root = document.documentElement;
    if (window.__mockyStill === true) root.classList.add('u-capture', 'u-still');
    if (window.__mockyAnimations === false) root.classList.add('u-still');
    if (document.getElementById('mocky-ultra')) return;
    var el = document.createElement('style');
    el.id = 'mocky-ultra';
    el.textContent = MOCKY_ULTRA_CSS;
    document.head.appendChild(el);
  } catch (e) {}
})();

function mockyUltraHex(c) {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : null;
}

function Backdrop(props) {
  var p = props || {};
  var preset = MOCKY_BACKDROPS.indexOf(p.preset) >= 0 ? p.preset : MOCKY_BACKDROPS[0];
  var tone = p.tone === 'light' ? 'light' : 'dark';
  var colors = (Array.isArray(p.colors) ? p.colors : []).map(mockyUltraHex).filter(Boolean);
  var image = typeof p.image === 'string' && p.image ? p.image : null;
  var veil = typeof p.veil === 'number' && isFinite(p.veil) ? Math.max(0, Math.min(0.9, p.veil)) : (image ? 0.35 : 0);
  var ref = React.useRef(null);

  /* The spotlight follows the cursor, read from the window: in a hero the
     headline is on top of the backdrop, and a backdrop that only answered when
     hovered directly would never answer at all. */
  React.useEffect(function () {
    if (preset !== 'spotlight') return;
    var el = ref.current;
    if (!el) return;
    function move(e) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      el.style.setProperty('--u-x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--u-y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }
    window.addEventListener('pointermove', move, { passive: true });
    return function () { window.removeEventListener('pointermove', move); };
  }, [preset]);

  var style = {};
  if (colors[0]) style['--u-a'] = colors[0];
  if (colors[1] || colors[0]) style['--u-b'] = colors[1] || colors[0];
  if (colors[2] || colors[1] || colors[0]) style['--u-c'] = colors[2] || colors[1] || colors[0];

  var layers = [];
  if (image) layers.push(React.createElement('img', { key: 'img', className: 'u-backdrop-img', src: image, alt: '' }));
  if (preset === 'aurora') {
    layers.push(React.createElement('span', { key: 'b1', className: 'u-blob u-blob-1' }));
    layers.push(React.createElement('span', { key: 'b2', className: 'u-blob u-blob-2' }));
    layers.push(React.createElement('span', { key: 'b3', className: 'u-blob u-blob-3' }));
  } else {
    layers.push(React.createElement('div', { key: 'layer', className: 'u-backdrop-layer' }));
  }
  if (veil > 0) layers.push(React.createElement('div', { key: 'veil', className: 'u-backdrop-veil', style: { opacity: veil } }));
  if (p.grain !== false) layers.push(React.createElement('div', { key: 'grain', className: 'u-grain-layer' }));

  return React.createElement(
    'div',
    {
      ref: ref,
      'aria-hidden': 'true',
      className: 'u-backdrop u-backdrop-' + preset + ' u-tone-' + tone + (p.className ? ' ' + p.className : ''),
      style: style,
    },
    layers
  );
}
`

export const ULTRA_EXPORTS = ['Backdrop'] as const
