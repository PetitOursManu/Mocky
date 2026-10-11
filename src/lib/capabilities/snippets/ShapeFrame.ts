import { DEFAULT_FRAME_SHAPE, FRAME_SHAPES } from '../../frameShapes'

/**
 * ShapeFrame — a picture cut into a shape, the way a clipping mask works in an
 * image editor: `<ShapeFrame shape="blob-3" src="…" alt="…" />`.
 *
 * The shapes are a closed catalogue (`lib/frameShapes.ts`, the one source: the
 * template export reads the same paths). This file only draws one.
 *
 * WHY A CSS MASK AND NOT `clip-path: url(#id)`
 *
 * A clip path by id needs an `<svg><defs>` somewhere in the document and an id
 * nobody else uses, and a screen with three frames writes three of them. A
 * `mask-image` whose image IS the shape — a data: URL of a one-path SVG,
 * stretched to the box with `mask-size: 100% 100%` — carries everything on the
 * element itself. It is also what the document exporter can draw: the native
 * rasteriser paints the page with the browser's own engine inside an SVG image
 * that fetches nothing, and a data: URL is already inside it (svgRaster.ts
 * keeps them as they are). The preview's CSP allows `data:` images.
 *
 * WHY THE NAME IS NOT `Frame`
 *
 * `capabilitiesUsedBy` loads a pack when a screen's code names one of its
 * components, and "Frame" is what a model calls its own phone mock-up: the
 * pack's `var Frame` would then collide with the screen's `const Frame` — a
 * fatal redeclaration on a screen that never asked for a shape.
 *
 * WHAT THE EXPORTER READS
 *
 * The root carries `data-mocky-frame` (the shape id) and the picture layer
 * `data-mocky-frame-photo`: the template export draws the page without the
 * picture and the shape as a vector, from those two and the catalogue.
 *
 * Exported as a STRING so it can be prepended to the generated component before
 * Babel.transform, like every other snippet pack.
 */

/** The catalogue as the preview needs it: short keys, no family. */
const RUNTIME = Object.fromEntries(
  FRAME_SHAPES.map((s) => [
    s.id,
    {
      r: s.ratio,
      c: s.clip,
      ...(s.paper ? { p: s.paper, pc: s.paperColor } : {}),
      ...(s.over ? { o: s.over, oc: s.overColor, oa: s.overOpacity } : {}),
    },
  ]),
)

export const ShapeFrameSource = `var MOCKY_FRAME_SHAPES = ${JSON.stringify(RUNTIME)};
var MOCKY_FRAME_FOCUS = { center: '50% 50%', top: '50% 0%', bottom: '50% 100%', left: '0% 50%', right: '100% 50%', 'top-left': '0% 0%', 'top-right': '100% 0%', 'bottom-left': '0% 100%', 'bottom-right': '100% 100%' };
// A colour is a hex or a plain colour name ("white"): it lands in an SVG
// attribute, and anything else — a url(), a var() — is dropped for the fallback.
var mockyFrameHex = function (v, fallback) {
  return typeof v === 'string' && /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[a-zA-Z]{3,20})$/.test(v) ? v : fallback;
};
var mockyFrameNum = function (v, lo, hi, fallback) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
var mockyFrameLayer = function (d, fill, extra) {
  return React.createElement(
    'svg',
    Object.assign({ viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' } }, extra && extra.svg),
    React.createElement('path', Object.assign({ d: d, fill: fill, fillRule: 'evenodd' }, extra && extra.path))
  );
};
var ShapeFrame = function (props) {
  var id = MOCKY_FRAME_SHAPES[props.shape] ? props.shape : ${JSON.stringify(DEFAULT_FRAME_SHAPE)};
  var s = MOCKY_FRAME_SHAPES[id];
  var className = typeof props.className === 'string' ? props.className : '';
  // The shape keeps the proportions it was drawn for unless the page sizes the
  // box itself — an aspect class or a height says the page has decided.
  var sized = /(^|\\s)(aspect-|h-|min-h-|size-)/.test(className);
  var src = typeof props.src === 'string' ? props.src : '';
  var focus = MOCKY_FRAME_FOCUS[props.focus] || '50% 50%';
  var zoom = mockyFrameNum(props.zoom, 1, 2, 1);
  var rotate = mockyFrameNum(props.rotate, -30, 30, 0);
  var stroke = mockyFrameHex(props.stroke, null);
  var strokeWidth = stroke ? mockyFrameNum(props.strokeWidth, 0, 16, 3) : 0;
  var paper = mockyFrameHex(props.paper, s.pc || '#ffffff');
  var mask = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="' + s.c + '"/></svg>') + '")';

  var photo = React.createElement(
    'div',
    {
      'data-mocky-frame-photo': '',
      style: {
        position: 'absolute', inset: 0, overflow: 'hidden',
        WebkitMaskImage: mask, maskImage: mask,
        WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        // No picture yet: the shape itself, in a quiet grey, so the layout reads.
        background: src ? undefined : '#e4e4e7',
      },
    },
    src
      ? React.createElement('img', {
          src: src,
          alt: typeof props.alt === 'string' ? props.alt : '',
          draggable: false,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus, transform: zoom !== 1 ? 'scale(' + zoom + ')' : undefined, transformOrigin: focus },
        })
      : null
  );

  return React.createElement(
    'div',
    {
      'data-mocky-frame': id,
      className: className,
      style: Object.assign(
        { position: 'relative' },
        sized ? null : { aspectRatio: String(s.r) },
        rotate ? { transform: 'rotate(' + rotate + 'deg)' } : null,
        // A drop shadow follows what is drawn, so it takes the shape's outline.
        props.shadow ? { filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.18)) drop-shadow(0 2px 4px rgba(0,0,0,0.12))' } : null,
        props.style && typeof props.style === 'object' ? props.style : null
      ),
    },
    s.p ? mockyFrameLayer(s.p, paper) : null,
    photo,
    strokeWidth > 0 ? mockyFrameLayer(s.c, 'none', { path: { stroke: stroke, strokeWidth: strokeWidth, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' } }) : null,
    s.o ? mockyFrameLayer(s.o, mockyFrameHex(props.tape, s.oc || '#efe6cf'), { svg: { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', opacity: s.oa || 1 } } }) : null
  );
};`

export const SHAPEFRAME_EXPORTS = ['ShapeFrame'] as const
