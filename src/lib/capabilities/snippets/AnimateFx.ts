/**
 * The second engine behind `<Animated>`: every preset is DATA, every trigger is
 * a separate axis, so seventy entrances times six triggers is one table and one
 * function rather than four hundred components.
 *
 * WHY THE WEB ANIMATIONS API AND NOT MOTION
 *
 * Three things the first engine could not do, each found by reading it:
 *
 * - Its entrances are `animate: 'visible'`, so with Motion loaded they play at
 *   MOUNT: a section below the fold had finished arriving before anybody
 *   scrolled to it. A paused animation held at its first frame and released by
 *   an observer is what "on scroll" means.
 * - `staggerChildren` only reaches children that are themselves Motion
 *   components, and a generated list's children are plain `<li>`s: the preset
 *   did nothing at all. Here the children are the targets.
 * - It writes `transform`, which replaces the one Tailwind's `-translate-x-1/2`
 *   centres an element with. The individual `translate` / `scale` / `rotate`
 *   properties COMPOSE with it, and a keyframe list that stops at `{}` ends on
 *   the element's own style, so an `opacity-80` block does not jump at the end.
 *   The presets that need a perspective are the exception, and the card says so.
 *
 * WHY THE OLD ENGINE IS STILL THERE
 *
 * A screen that was generated with `<Animated preset="fade-up">` and no trigger
 * keeps exactly the behaviour it was reviewed with. `mockyFxWanted` is the whole
 * of that decision.
 *
 * THE CONTRACT, THE SAME AS THE REST OF THE PACK
 *
 * Nothing is ever hidden unless something is going to reveal it. No hold is
 * placed when the engine may not run (reduced motion, "Sans animation", a hidden
 * document, a capture frame), and the server render of this file is the final
 * state. An element that starts above the fold is released at once rather than
 * waiting on an observer: a preset that moves its box out of the viewport
 * (`drop-in` at the top of a page) would otherwise wait for an intersection that
 * can never happen, with the content hidden.
 *
 * Names: everything a screen can reach starts with `Animated`, everything else
 * with `mocky`. The pack is one scope with the generated code, and a model that
 * writes its own `const FlipCard` beside a pack's `var FlipCard` gets a syntax
 * error instead of a screen; `ShapeFrame` was renamed from `Frame` for that.
 *
 * ASCII only below: `sanitizeSource` runs over this string.
 */

/** What the model may name, by family. The card is printed from these lists. */
export const FX_ENTRANCES = {
  soft: ['fade-in', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'rise', 'float-in', 'drift-up', 'drift-left', 'drift-right'],
  depth: ['scale-in', 'zoom-in', 'zoom-out', 'zoom-blur', 'push-in', 'ghost-in', 'blur-in', 'blur-up', 'blur-left', 'blur-right', 'focus-in'],
  turn: ['flip-up', 'flip-down', 'flip-left', 'flip-right', 'fold-down', 'fold-up', 'door-left', 'door-right', 'swing-in', 'tilt-in', 'rotate-in', 'roll-in', 'spiral-in', 'tumble-in', 'curl-in'],
  curtain: ['reveal-up', 'reveal-down', 'wipe-right', 'wipe-left', 'split-x', 'split-y', 'iris-in', 'corner-in', 'diamond-in', 'diagonal-in', 'round-reveal'],
  spring: ['bounce-in', 'pop-in', 'spring-up', 'spring-down', 'spring-left', 'spring-right', 'drop-in', 'jelly-in', 'rubber-in', 'squash-in'],
  styled: ['skew-in', 'shear-up', 'swoop-left', 'swoop-right', 'shutter-in', 'unroll', 'stretch-in', 'glitch-in', 'flicker-in', 'neon-in', 'ink-in'],
} as const

export const FX_ATTENTION = ['shake', 'shake-y', 'nod', 'wiggle', 'jelly', 'rubber-band', 'tada', 'heartbeat', 'ping', 'squish', 'boing', 'spin-once', 'flip-once', 'swing', 'flash', 'pop', 'recoil'] as const

export const FX_HOVER = ['hover-lift', 'hover-glow', 'hover-scale', 'hover-rotate', 'hover-sink', 'hover-float', 'hover-tilt-left', 'hover-tilt-right', 'hover-skew', 'hover-stretch', 'hover-dim', 'hover-bright', 'hover-nudge-right', 'hover-nudge-left', 'hover-nudge-up', 'hover-spin', 'hover-pop', 'hover-shadow'] as const

export const FX_LOOPS = ['float', 'pulse', 'spin-slow', 'wobble', 'bob', 'sway', 'drift', 'breathe', 'orbit', 'rock-3d', 'glow-pulse', 'blink', 'spin', 'spin-reverse', 'morph', 'hue-shift', 'tremble', 'levitate'] as const

export const FX_SCROLL = ['parallax', 'parallax-slow', 'parallax-fast', 'parallax-reverse', 'scroll-zoom-in', 'scroll-zoom-out', 'scroll-rotate', 'scroll-spin', 'scroll-fade-out', 'scroll-fade-through', 'scroll-blur-out', 'scroll-slide-left', 'scroll-slide-right', 'scroll-tilt', 'scroll-skew', 'scroll-wipe', 'scroll-grow-x'] as const

/** Presets drawn by a function rather than by keyframes. */
export const FX_POINTER = ['magnetic', 'spotlight', 'tilt-glare', 'cursor-parallax', 'hover-shine', 'hover-zoom'] as const
export const FX_CLICK = ['ripple', 'burst'] as const

/** The list a generic entrance is shown with; `stagger-list` is the one with no sibling family. */
export const FX_PRESETS = [
  ...Object.values(FX_ENTRANCES).flat(),
  'stagger-list',
  ...FX_ATTENTION,
  ...FX_HOVER,
  ...FX_LOOPS,
  ...FX_SCROLL,
  ...FX_POINTER,
  ...FX_CLICK,
] as readonly string[]

export const FX_TRIGGERS = ['view', 'load', 'scroll', 'hover', 'click', 'change'] as const

export const FX_EXPORTS = ['AnimatedProgress', 'AnimatedCollapse', 'AnimatedFlip', 'AnimatedWord', 'AnimatedScrollText', 'AnimatedCursorGlow'] as const

export const AnimateFxSource = `
var mockySpringCurve = function (zeta, turns) {
  var pts = [], w = turns * 2 * Math.PI, d = Math.sqrt(1 - zeta * zeta);
  for (var i = 0; i <= 48; i++) {
    var t = i / 48;
    var v = 1 - Math.exp(-zeta * w * t) * (Math.cos(w * d * t) + (zeta / d) * Math.sin(w * d * t));
    pts.push(i === 48 ? '1' : v.toFixed(3));
  }
  return 'linear(' + pts.join(',') + ')';
};
var mockyBounceCurve = function () {
  var pts = [];
  for (var i = 0; i <= 48; i++) {
    var t = i / 48, v, n = 7.5625, d = 2.75;
    if (t < 1 / d) v = n * t * t;
    else if (t < 2 / d) { t -= 1.5 / d; v = n * t * t + 0.75; }
    else if (t < 2.5 / d) { t -= 2.25 / d; v = n * t * t + 0.9375; }
    else { t -= 2.625 / d; v = n * t * t + 0.984375; }
    pts.push(v.toFixed(3));
  }
  return 'linear(' + pts.join(',') + ')';
};
/* linear() is what a spring is made of here, and a browser without it gets the
   overshooting bezier: a slightly plainer arrival, never a refused animation. */
var mockyEase = (function () {
  var has = false;
  try { has = !!(window.CSS && window.CSS.supports && window.CSS.supports('animation-timing-function', 'linear(0, 1)')); } catch (e) {}
  var over = 'cubic-bezier(0.34,1.56,0.64,1)';
  return {
    soft: 'cubic-bezier(0.22,1,0.36,1)',
    expo: 'cubic-bezier(0.16,1,0.3,1)',
    io: 'cubic-bezier(0.65,0,0.35,1)',
    sine: 'ease-in-out',
    linear: 'linear',
    hold: 'linear',
    spring: has ? mockySpringCurve(0.45, 2.2) : over,
    bouncy: has ? mockySpringCurve(0.28, 2.6) : over,
    drop: has ? mockyBounceCurve() : over
  };
})();

var mockyP = 'perspective(900px) ';
var mockyC = function (a, b) { return [{ opacity: 0, clipPath: a }, { clipPath: b }]; };
var MOCKY_FX = {
  /* ---- entrances: a list that stops at its first frame ends on the element's own style ---- */
  'fade-in': { f: 'in', k: [{ opacity: 0 }], ms: 500 },
  'fade-up': { f: 'in', k: [{ opacity: 0, translate: '0 16px' }], ms: 550 },
  'fade-down': { f: 'in', k: [{ opacity: 0, translate: '0 -16px' }], ms: 550 },
  'slide-left': { f: 'in', k: [{ opacity: 0, translate: '-32px 0' }], ms: 600 },
  'slide-right': { f: 'in', k: [{ opacity: 0, translate: '32px 0' }], ms: 600 },
  'slide-up': { f: 'in', k: [{ opacity: 0, translate: '0 40px' }], ms: 650 },
  'slide-down': { f: 'in', k: [{ opacity: 0, translate: '0 -24px' }], ms: 600 },
  'rise': { f: 'in', k: [{ opacity: 0, translate: '0 48px' }], ms: 850, e: 'expo' },
  'float-in': { f: 'in', k: [{ opacity: 0, translate: '0 80px' }], ms: 1300, e: 'expo' },
  'drift-up': { f: 'in', k: [{ opacity: 0, translate: '0 10px' }], ms: 1400 },
  'drift-left': { f: 'in', k: [{ opacity: 0, translate: '-14px 0' }], ms: 1400 },
  'drift-right': { f: 'in', k: [{ opacity: 0, translate: '14px 0' }], ms: 1400 },

  'scale-in': { f: 'in', k: [{ opacity: 0, scale: 0.92 }], ms: 650, e: 'spring' },
  'zoom-in': { f: 'in', k: [{ opacity: 0, scale: 0.7 }], ms: 750, e: 'expo' },
  'zoom-out': { f: 'in', k: [{ opacity: 0, scale: 1.12 }], ms: 950, e: 'expo' },
  'zoom-blur': { f: 'in', k: [{ opacity: 0, scale: 1.25, filter: 'blur(18px)' }], ms: 950, e: 'expo' },
  'push-in': { f: 'in', k: [{ opacity: 0, scale: 0.86, translate: '0 40px' }], ms: 850, e: 'expo' },
  'ghost-in': { f: 'in', k: [{ opacity: 0, scale: 1.05, filter: 'blur(6px)' }], ms: 1050 },
  'blur-in': { f: 'in', k: [{ opacity: 0, filter: 'blur(12px)' }], ms: 650 },
  'blur-up': { f: 'in', k: [{ opacity: 0, filter: 'blur(10px)', translate: '0 24px' }], ms: 750 },
  'blur-left': { f: 'in', k: [{ opacity: 0, filter: 'blur(10px)', translate: '-36px 0' }], ms: 750 },
  'blur-right': { f: 'in', k: [{ opacity: 0, filter: 'blur(10px)', translate: '36px 0' }], ms: 750 },
  'focus-in': { f: 'in', k: [{ opacity: 0, filter: 'blur(28px)', scale: 0.97 }], ms: 1100 },

  /* A perspective has to live in \`transform\`: these replace it for their length. */
  'flip-up': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateX(60deg)' }, { transform: mockyP + 'rotateX(0deg)' }], ms: 700, o: '50% 100%' },
  'flip-down': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateX(-60deg)' }, { transform: mockyP + 'rotateX(0deg)' }], ms: 700, o: '50% 0%' },
  'flip-left': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateY(-70deg)' }, { transform: mockyP + 'rotateY(0deg)' }], ms: 750 },
  'flip-right': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateY(70deg)' }, { transform: mockyP + 'rotateY(0deg)' }], ms: 750 },
  'fold-down': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateX(-90deg)' }, { transform: mockyP + 'rotateX(0deg)' }], ms: 800, o: '50% 0%', e: 'expo' },
  'fold-up': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateX(90deg)' }, { transform: mockyP + 'rotateX(0deg)' }], ms: 800, o: '50% 100%', e: 'expo' },
  'door-left': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateY(90deg)' }, { transform: mockyP + 'rotateY(0deg)' }], ms: 850, o: '0% 50%', e: 'expo' },
  'door-right': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateY(-90deg)' }, { transform: mockyP + 'rotateY(0deg)' }], ms: 850, o: '100% 50%', e: 'expo' },
  'swing-in': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotateX(-80deg)' }, { opacity: 1, transform: mockyP + 'rotateX(16deg)', offset: 0.55 }, { transform: mockyP + 'rotateX(-8deg)', offset: 0.8 }, { transform: mockyP + 'rotateX(0deg)' }], ms: 950, o: '50% 0%', e: 'sine' },
  'tilt-in': { f: 'in', k: [{ opacity: 0, transform: 'perspective(1200px) translateY(70px) rotateX(24deg)' }, { transform: 'perspective(1200px) translateY(0px) rotateX(0deg)' }], ms: 1000, o: '50% 100%', e: 'expo' },
  'rotate-in': { f: 'in', k: [{ opacity: 0, rotate: '-8deg', scale: 0.92 }], ms: 700, e: 'spring' },
  'roll-in': { f: 'in', k: [{ opacity: 0, translate: '-120px 0', rotate: '-40deg' }], ms: 850, e: 'expo' },
  'spiral-in': { f: 'in', k: [{ opacity: 0, rotate: '-180deg', scale: 0.3 }], ms: 950, e: 'expo' },
  'tumble-in': { f: 'in', k: [{ opacity: 0, transform: mockyP + 'rotate3d(1,1,0,70deg) scale(0.8)' }, { transform: mockyP + 'rotate3d(1,1,0,0deg) scale(1)' }], ms: 900, e: 'expo' },
  'curl-in': { f: 'in', k: [{ opacity: 0, transform: 'perspective(1000px) translateY(30px) rotate3d(1,-1,0,50deg)' }, { transform: 'perspective(1000px) translateY(0px) rotate3d(1,-1,0,0deg)' }], ms: 950, o: '0% 0%', e: 'expo' },

  /* Curtains: the block is uncovered, so nothing beside it moves. */
  'reveal-up': { f: 'in', k: mockyC('inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'), ms: 900, e: 'expo' },
  'reveal-down': { f: 'in', k: mockyC('inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'), ms: 900, e: 'expo' },
  'wipe-right': { f: 'in', k: mockyC('inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'), ms: 900, e: 'expo' },
  'wipe-left': { f: 'in', k: mockyC('inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'), ms: 900, e: 'expo' },
  'split-x': { f: 'in', k: mockyC('inset(0% 50% 0% 50%)', 'inset(0% 0% 0% 0%)'), ms: 900, e: 'expo' },
  'split-y': { f: 'in', k: mockyC('inset(50% 0% 50% 0%)', 'inset(0% 0% 0% 0%)'), ms: 900, e: 'expo' },
  'iris-in': { f: 'in', k: mockyC('circle(0% at 50% 50%)', 'circle(150% at 50% 50%)'), ms: 1000, e: 'io' },
  'corner-in': { f: 'in', k: mockyC('circle(0% at 0% 0%)', 'circle(150% at 0% 0%)'), ms: 1000, e: 'io' },
  'diamond-in': { f: 'in', k: mockyC('polygon(50% 50%,50% 50%,50% 50%,50% 50%)', 'polygon(50% -50%,150% 50%,50% 150%,-50% 50%)'), ms: 1000, e: 'io' },
  'diagonal-in': { f: 'in', k: mockyC('polygon(0% 0%,0% 0%,0% 0%)', 'polygon(0% 0%,200% 0%,0% 200%)'), ms: 1000, e: 'io' },
  'round-reveal': { f: 'in', k: [{ opacity: 0, scale: 1.06, clipPath: 'inset(18% 18% round 48px)' }, { clipPath: 'inset(0% 0% round 0px)' }], ms: 1100, e: 'expo' },

  'bounce-in': { f: 'in', k: [{ opacity: 0, scale: 0.6 }], ms: 850, e: 'bouncy' },
  'pop-in': { f: 'in', k: [{ opacity: 0, scale: 0.4 }], ms: 650, e: 'spring' },
  'spring-up': { f: 'in', k: [{ opacity: 0, translate: '0 60px' }], ms: 850, e: 'spring' },
  'spring-down': { f: 'in', k: [{ opacity: 0, translate: '0 -60px' }], ms: 850, e: 'spring' },
  'spring-left': { f: 'in', k: [{ opacity: 0, translate: '-60px 0' }], ms: 850, e: 'spring' },
  'spring-right': { f: 'in', k: [{ opacity: 0, translate: '60px 0' }], ms: 850, e: 'spring' },
  'drop-in': { f: 'in', k: [{ opacity: 0, translate: '0 -120px' }], ms: 1000, e: 'drop' },
  'jelly-in': { f: 'in', k: [{ opacity: 0, scale: '0.3 0.3' }, { opacity: 1, scale: '1.2 0.8', offset: 0.4 }, { scale: '0.85 1.15', offset: 0.6 }, { scale: '1.06 0.95', offset: 0.8 }, {}], ms: 850, e: 'sine' },
  'rubber-in': { f: 'in', k: [{ opacity: 0, scale: '1.6 0.4' }, { opacity: 1, scale: '0.8 1.2', offset: 0.5 }, { scale: '1.1 0.92', offset: 0.75 }, {}], ms: 800, e: 'sine' },
  'squash-in': { f: 'in', k: [{ opacity: 0, translate: '0 -60px', scale: '0.8 1.2' }, { opacity: 1, translate: '0 0', scale: '1.2 0.8', offset: 0.55 }, { scale: '0.95 1.05', offset: 0.8 }, {}], ms: 800, e: 'sine' },

  'skew-in': { f: 'in', k: [{ opacity: 0, translate: '-40px 0', transform: 'skewX(-12deg)' }, { transform: 'skewX(0deg)' }], ms: 750, e: 'expo' },
  'shear-up': { f: 'in', k: [{ opacity: 0, translate: '0 50px', transform: 'skewY(6deg)' }, { transform: 'skewY(0deg)' }], ms: 850, e: 'expo' },
  'swoop-left': { f: 'in', k: [{ opacity: 0, translate: '-120px 60px', rotate: '-6deg' }, { opacity: 1, translate: '-20px -10px', rotate: '1deg', offset: 0.6 }, {}], ms: 950, e: 'sine' },
  'swoop-right': { f: 'in', k: [{ opacity: 0, translate: '120px 60px', rotate: '6deg' }, { opacity: 1, translate: '20px -10px', rotate: '-1deg', offset: 0.6 }, {}], ms: 950, e: 'sine' },
  'shutter-in': { f: 'in', k: [{ opacity: 0, scale: '1 0' }], ms: 700, e: 'expo' },
  'unroll': { f: 'in', k: [{ scale: '1 0' }], ms: 850, o: '50% 0%', e: 'expo' },
  'stretch-in': { f: 'in', k: [{ scale: '0 1' }], ms: 850, o: '0% 50%', e: 'expo' },
  'glitch-in': { f: 'in', k: [{ opacity: 0, translate: '-12px 0', clipPath: 'inset(40% 0% 30% 0%)' }, { opacity: 1, translate: '10px 0', clipPath: 'inset(10% 0% 60% 0%)', offset: 0.2 }, { translate: '-6px 0', clipPath: 'inset(70% 0% 5% 0%)', offset: 0.4 }, { translate: '4px 0', clipPath: 'inset(0% 0% 0% 0%)', offset: 0.6 }, { translate: '-2px 0', clipPath: 'inset(0% 0% 0% 0%)', offset: 0.8 }, { translate: '0 0', clipPath: 'inset(0% 0% 0% 0%)' }], ms: 500, e: 'hold' },
  'flicker-in': { f: 'in', k: [{ opacity: 0 }, { opacity: 0.7, offset: 0.1 }, { opacity: 0.1, offset: 0.2 }, { opacity: 0.9, offset: 0.35 }, { opacity: 0.3, offset: 0.45 }, { opacity: 1, offset: 0.6 }, { opacity: 0.6, offset: 0.7 }, {}], ms: 900, e: 'hold' },
  'neon-in': { f: 'in', k: [{ opacity: 0, filter: 'brightness(3) blur(6px)' }, { opacity: 1, filter: 'brightness(1.8) blur(1px)', offset: 0.4 }, { opacity: 0.6, filter: 'brightness(1.2) blur(0px)', offset: 0.55 }, { opacity: 1, filter: 'brightness(1.4) blur(0px)', offset: 0.75 }, { filter: 'brightness(1) blur(0px)' }], ms: 1100, e: 'linear' },
  'ink-in': { f: 'in', k: [{ opacity: 0, filter: 'contrast(3) blur(10px)' }], ms: 1100 },

  /* On the LIST: the children are the targets, each with its own delay. */
  'stagger-list': { f: 'in', k: [{ opacity: 0, translate: '0 12px' }], ms: 500, st: 0.07 },

  /* ---- one-shots that start and end at rest ---- */
  'shake': { f: 'hit', k: [{}, { translate: '-8px 0', offset: 0.15 }, { translate: '8px 0', offset: 0.3 }, { translate: '-6px 0', offset: 0.45 }, { translate: '6px 0', offset: 0.6 }, { translate: '-3px 0', offset: 0.75 }, { translate: '3px 0', offset: 0.9 }, {}], ms: 500, e: 'linear' },
  'shake-y': { f: 'hit', k: [{}, { translate: '0 -6px', offset: 0.2 }, { translate: '0 6px', offset: 0.4 }, { translate: '0 -4px', offset: 0.6 }, { translate: '0 4px', offset: 0.8 }, {}], ms: 450, e: 'linear' },
  'nod': { f: 'hit', k: [{}, { translate: '0 5px', scale: 0.98, offset: 0.35 }, { translate: '0 -2px', offset: 0.7 }, {}], ms: 500, e: 'sine' },
  'wiggle': { f: 'hit', k: [{}, { rotate: '-6deg', offset: 0.2 }, { rotate: '6deg', offset: 0.45 }, { rotate: '-4deg', offset: 0.7 }, { rotate: '2deg', offset: 0.88 }, {}], ms: 600, e: 'sine' },
  'jelly': { f: 'hit', k: [{}, { scale: '1.2 0.82', offset: 0.3 }, { scale: '0.86 1.14', offset: 0.5 }, { scale: '1.08 0.94', offset: 0.7 }, { scale: '0.98 1.02', offset: 0.87 }, {}], ms: 700, e: 'sine' },
  'rubber-band': { f: 'hit', k: [{}, { scale: '1.25 0.75', offset: 0.3 }, { scale: '0.75 1.25', offset: 0.4 }, { scale: '1.15 0.85', offset: 0.5 }, { scale: '0.95 1.05', offset: 0.65 }, { scale: '1.05 0.95', offset: 0.75 }, {}], ms: 800, e: 'sine' },
  'tada': { f: 'hit', k: [{}, { scale: 0.92, rotate: '-3deg', offset: 0.15 }, { scale: 1.08, rotate: '3deg', offset: 0.35 }, { scale: 1.08, rotate: '-3deg', offset: 0.55 }, { scale: 1.08, rotate: '3deg', offset: 0.75 }, {}], ms: 850, e: 'sine' },
  'heartbeat': { f: 'hit', k: [{}, { scale: 1.14, offset: 0.14 }, { scale: 1, offset: 0.28 }, { scale: 1.14, offset: 0.42 }, { scale: 1, offset: 0.7 }, {}], ms: 1000, e: 'sine' },
  'ping': { f: 'hit', k: [{}, { scale: 1.14, filter: 'brightness(1.2)', offset: 0.4 }, {}], ms: 420, e: 'sine' },
  'squish': { f: 'hit', k: [{}, { scale: 0.92, offset: 0.35 }, { scale: 1.04, offset: 0.7 }, {}], ms: 340, e: 'sine' },
  'boing': { f: 'hit', k: [{}, { translate: '0 -18px', offset: 0.35 }, { translate: '0 0', offset: 0.6 }, { translate: '0 -7px', offset: 0.78 }, {}], ms: 700, e: 'sine' },
  'spin-once': { f: 'hit', k: [{ rotate: '0deg' }, { rotate: '360deg' }], ms: 800, e: 'expo' },
  'flip-once': { f: 'hit', k: [{ transform: mockyP + 'rotateY(0deg)' }, { transform: mockyP + 'rotateY(360deg)' }], ms: 900, e: 'expo' },
  'swing': { f: 'hit', k: [{}, { rotate: '12deg', offset: 0.2 }, { rotate: '-9deg', offset: 0.4 }, { rotate: '5deg', offset: 0.6 }, { rotate: '-3deg', offset: 0.8 }, {}], ms: 900, o: '50% 0%', e: 'sine' },
  'flash': { f: 'hit', k: [{}, { opacity: 0.2, offset: 0.25 }, { offset: 0.5 }, { opacity: 0.2, offset: 0.75 }, {}], ms: 700, e: 'linear' },
  'pop': { f: 'hit', k: [{ scale: 1.18 }, {}], ms: 500, e: 'bouncy' },
  'recoil': { f: 'hit', k: [{}, { translate: '0 4px', scale: 0.97, offset: 0.3 }, {}], ms: 300, e: 'sine' },

  /* ---- states: forward under the pointer, backward when it leaves, from wherever they were ---- */
  'hover-lift': { f: 'hover', k: [{}, { translate: '0 -4px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }], ms: 240 },
  'hover-glow': { f: 'hover', k: [{}, { scale: 1.02, filter: 'brightness(1.08) saturate(1.08)' }], ms: 240 },
  'hover-scale': { f: 'hover', k: [{}, { scale: 1.04 }], ms: 240 },
  'hover-rotate': { f: 'hover', k: [{}, { rotate: '-2deg', scale: 1.03 }], ms: 260 },
  'hover-sink': { f: 'hover', k: [{}, { translate: '0 3px', scale: 0.985 }], ms: 200 },
  'hover-float': { f: 'hover', k: [{}, { translate: '0 -10px', boxShadow: '0 18px 40px rgba(0,0,0,0.18)' }], ms: 340, e: 'expo' },
  'hover-tilt-left': { f: 'hover', k: [{}, { rotate: '-3deg' }], ms: 280 },
  'hover-tilt-right': { f: 'hover', k: [{}, { rotate: '3deg' }], ms: 280 },
  'hover-skew': { f: 'hover', k: [{}, { transform: 'skewX(-4deg)' }], ms: 240 },
  'hover-stretch': { f: 'hover', k: [{}, { scale: '1.04 1' }], ms: 240 },
  'hover-dim': { f: 'hover', k: [{}, { opacity: 0.68 }], ms: 200 },
  'hover-bright': { f: 'hover', k: [{}, { filter: 'brightness(1.15)' }], ms: 200 },
  'hover-nudge-right': { f: 'hover', k: [{}, { translate: '6px 0' }], ms: 280, e: 'spring' },
  'hover-nudge-left': { f: 'hover', k: [{}, { translate: '-6px 0' }], ms: 280, e: 'spring' },
  'hover-nudge-up': { f: 'hover', k: [{}, { translate: '0 -6px' }], ms: 280, e: 'spring' },
  'hover-spin': { f: 'hover', k: [{}, { rotate: '15deg' }], ms: 420, e: 'spring' },
  'hover-pop': { f: 'hover', k: [{}, { scale: 1.08 }], ms: 420, e: 'spring' },
  'hover-shadow': { f: 'hover', k: [{}, { boxShadow: '0 22px 50px rgba(0,0,0,0.22)' }], ms: 300 },

  /* ---- loops ---- */
  'float': { f: 'loop', k: [{ translate: '0 0' }, { translate: '0 -8px' }], ms: 2500, dir: 'alternate' },
  'pulse': { f: 'loop', k: [{ scale: 1 }, { scale: 1.04 }], ms: 1200, dir: 'alternate' },
  'spin-slow': { f: 'loop', k: [{ rotate: '0deg' }, { rotate: '360deg' }], ms: 24000, e: 'linear' },
  'wobble': { f: 'loop', k: [{ rotate: '-3deg' }, { rotate: '3deg' }], ms: 1500, dir: 'alternate' },
  'bob': { f: 'loop', k: [{ translate: '0 0' }, { translate: '0 -4px' }], ms: 900, dir: 'alternate' },
  'sway': { f: 'loop', k: [{ rotate: '-2deg' }, { rotate: '2deg' }], ms: 2000, dir: 'alternate', o: '50% 100%' },
  'drift': { f: 'loop', k: [{ translate: '0 0' }, { translate: '6px -5px' }], ms: 4000, dir: 'alternate' },
  'breathe': { f: 'loop', k: [{ scale: 1, opacity: 1 }, { scale: 1.02, opacity: 0.85 }], ms: 3000, dir: 'alternate' },
  'orbit': { f: 'loop', k: [{ translate: '6px 0' }, { translate: '0 6px' }, { translate: '-6px 0' }, { translate: '0 -6px' }, { translate: '6px 0' }], ms: 6000, e: 'linear' },
  'rock-3d': { f: 'loop', k: [{ transform: mockyP + 'rotateY(-12deg)' }, { transform: mockyP + 'rotateY(12deg)' }], ms: 3000, dir: 'alternate' },
  'glow-pulse': { f: 'loop', k: [{ filter: 'brightness(1)' }, { filter: 'brightness(1.25)' }], ms: 1500, dir: 'alternate' },
  'blink': { f: 'loop', k: [{ opacity: 1 }, { opacity: 0.35 }], ms: 1000, dir: 'alternate' },
  'spin': { f: 'loop', k: [{ rotate: '0deg' }, { rotate: '360deg' }], ms: 3000, e: 'linear' },
  'spin-reverse': { f: 'loop', k: [{ rotate: '0deg' }, { rotate: '-360deg' }], ms: 18000, e: 'linear' },
  'morph': { f: 'loop', k: [{ borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' }, { borderRadius: '58% 42% 38% 62% / 60% 52% 48% 40%' }, { borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' }], ms: 8000 },
  'hue-shift': { f: 'loop', k: [{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }], ms: 12000, e: 'linear' },
  'tremble': { f: 'loop', k: [{ translate: '-1px 0' }, { translate: '1px 1px' }], ms: 120, dir: 'alternate', e: 'linear' },
  'levitate': { f: 'loop', k: [{ translate: '0 0', boxShadow: '0 10px 20px rgba(0,0,0,0.18)' }, { translate: '0 -12px', boxShadow: '0 26px 40px rgba(0,0,0,0.12)' }], ms: 3000, dir: 'alternate' },

  /* ---- the element's whole passage across the viewport drives these ---- */
  'parallax': { f: 'scrub', k: [{ translate: '0 60px' }, { translate: '0 -60px' }] },
  'parallax-slow': { f: 'scrub', k: [{ translate: '0 30px' }, { translate: '0 -30px' }] },
  'parallax-fast': { f: 'scrub', k: [{ translate: '0 120px' }, { translate: '0 -120px' }] },
  'parallax-reverse': { f: 'scrub', k: [{ translate: '0 -60px' }, { translate: '0 60px' }] },
  'scroll-zoom-in': { f: 'scrub', k: [{ scale: 0.85 }, { scale: 1.12 }] },
  'scroll-zoom-out': { f: 'scrub', k: [{ scale: 1.15 }, { scale: 0.92 }] },
  'scroll-rotate': { f: 'scrub', k: [{ rotate: '-6deg' }, { rotate: '6deg' }] },
  'scroll-spin': { f: 'scrub', k: [{ rotate: '0deg' }, { rotate: '360deg' }] },
  'scroll-fade-out': { f: 'scrub', k: [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }] },
  'scroll-fade-through': { f: 'scrub', k: [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }] },
  'scroll-blur-out': { f: 'scrub', k: [{ filter: 'blur(0px)' }, { filter: 'blur(0px)', offset: 0.55 }, { filter: 'blur(14px)' }] },
  'scroll-slide-left': { f: 'scrub', k: [{ translate: '120px 0' }, { translate: '-120px 0' }] },
  'scroll-slide-right': { f: 'scrub', k: [{ translate: '-120px 0' }, { translate: '120px 0' }] },
  'scroll-tilt': { f: 'scrub', k: [{ transform: 'perspective(1200px) rotateX(18deg)' }, { transform: 'perspective(1200px) rotateX(-18deg)' }] },
  'scroll-skew': { f: 'scrub', k: [{ transform: 'skewY(4deg)' }, { transform: 'skewY(-4deg)' }] },
  'scroll-wipe': { f: 'scrub', k: [{ clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', offset: 0.5 }, { clipPath: 'inset(0% 0% 0% 0%)' }] },
  'scroll-grow-x': { f: 'scrub', k: [{ scale: '0 1' }, { scale: '1 1', offset: 0.5 }, { scale: '1 1' }], o: '0% 50%' },

  /* ---- drawn by a function ---- */
  'magnetic': { f: 'fn', fn: 'magnetic' },
  'spotlight': { f: 'fn', fn: 'spotlight' },
  'tilt-glare': { f: 'fn', fn: 'tiltGlare' },
  'cursor-parallax': { f: 'fn', fn: 'cursorParallax' },
  'hover-shine': { f: 'fn', fn: 'shine' },
  'hover-zoom': { f: 'fn', fn: 'zoom' },
  'ripple': { f: 'fn', fn: 'ripple' },
  'burst': { f: 'fn', fn: 'burst' }
};

var MOCKY_FX_TRIGGERS = {
  'in': ['view', 'load', 'scroll', 'hover', 'click', 'change'],
  hit: ['click', 'hover', 'view', 'load', 'change'],
  hover: ['hover', 'click'],
  loop: ['load', 'hover'],
  scrub: ['scroll']
};
/* A trigger a family has no use for is its default, never an element that waits
   for something that cannot happen. */
var mockyFxTrigger = function (cfg, asked) {
  var list = MOCKY_FX_TRIGGERS[cfg.f];
  return list && list.indexOf(asked) >= 0 ? asked : list ? list[0] : asked;
};
var mockyFxMay = function () {
  try {
    return mockyMayAnimate() && !window.__mockyStill && typeof document.documentElement.animate === 'function';
  } catch (e) { return false; }
};
var mockyFxFrames = function (cfg) {
  var out = cfg.k.map(function (f) { return Object.assign({}, f); });
  if (cfg.f === 'in' && out.length === 1) out.push({});
  for (var i = 0; i < out.length; i++) {
    if (cfg.o) out[i].transformOrigin = cfg.o;
    if (cfg.e === 'hold') out[i].easing = 'steps(1,end)';
  }
  return out;
};
var mockyFxEaseOf = function (cfg) { return mockyEase[cfg.e || (cfg.f === 'loop' ? 'sine' : 'soft')]; };

/* One passive listener and one frame, however many things on the page follow the
   scroll. The observer is for Tailwind's runtime, which writes the classes a
   task AFTER mount and moves every offset measured before it. */
var mockyBus = { subs: [], raf: 0, on: false };
var mockyBusKick = function () {
  if (mockyBus.raf) return;
  mockyBus.raf = window.requestAnimationFrame(function () {
    mockyBus.raf = 0;
    mockyBus.subs.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
  });
};
var mockyBusJoin = function (fn) {
  mockyBus.subs.push(fn);
  if (!mockyBus.on) {
    mockyBus.on = true;
    window.addEventListener('scroll', mockyBusKick, { passive: true });
    window.addEventListener('resize', mockyBusKick);
    try { new ResizeObserver(mockyBusKick).observe(document.documentElement); } catch (e) {}
  }
  mockyBusKick();
  return function () {
    var i = mockyBus.subs.indexOf(fn);
    if (i >= 0) mockyBus.subs.splice(i, 1);
  };
};
/* Off the LAYOUT, never getBoundingClientRect: a rect includes the translate
   this very animation wrote, and a parallax that measures its own displacement
   feeds back into itself and shakes. */
var mockyLayoutTop = function (node) {
  var y = 0, n = node;
  while (n && typeof n.offsetTop === 'number') { y += n.offsetTop; n = n.offsetParent; }
  return y;
};
var mockyDocMax = function () {
  var d = document.documentElement;
  return Math.max(d.scrollHeight, document.body ? document.body.scrollHeight : 0) - (window.innerHeight || 0);
};
/* 0 to 1 along a stretch of the page. When the page ends before the stretch does
   the stretch is cut to fit: the last block of a page has to be able to finish.
   A page that does not scroll (a frame sized to its content, an inner scroller)
   is simply at the end, so nothing is left half-drawn. */
var mockyProgress = function (node, mode) {
  var top = mockyLayoutTop(node), h = node.offsetHeight || 0, vh = window.innerHeight || 1, max = mockyDocMax();
  if (max <= 1 && mode !== 'pass') return 1;
  var s, e;
  if (mode === 'pass') { s = top - vh; e = top + h; }
  else if (mode === 'fill') { s = top - vh * 0.85; e = top + h - vh * 0.45; }
  else { s = top - vh * 0.95; e = top + h * 0.5 - vh * 0.5; }
  if (mode !== 'pass') {
    if (e > max) e = max;
    if (s > e - vh * 0.4) s = e - vh * 0.4;
  }
  if (e <= s) return 1;
  return Math.max(0, Math.min(1, ((window.pageYOffset || 0) - s) / (e - s)));
};
/* Thresholds rather than a negative margin: a margin leaves the last few pixels
   of a page out of reach for good, and a footer that is never "in view" is a
   footer that is never shown. */
var mockyFxSeen = function (node, cb) {
  if (typeof IntersectionObserver === 'undefined') { cb(true); return function () {}; }
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e.isIntersecting) cb(false);
      else if (e.intersectionRatio >= 0.15 || e.intersectionRect.height >= 90) cb(true);
    }
  }, { threshold: [0, 0.02, 0.05, 0.1, 0.15, 0.25] });
  io.observe(node);
  return function () { io.disconnect(); };
};
var mockyFxPointerOk = function (e) { return !e || e.pointerType !== 'touch'; };

/* An overlay that clips itself, so the element keeps its own overflow. */
var mockyFxLayer = function (node, css) {
  var prev = null;
  if (window.getComputedStyle(node).position === 'static') { prev = node.style.position; node.style.position = 'relative'; }
  var l = document.createElement('span');
  l.setAttribute('aria-hidden', 'true');
  l.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;' + (css || '');
  node.appendChild(l);
  return { el: l, remove: function () {
    if (l.parentNode) l.parentNode.removeChild(l);
    if (prev !== null) node.style.position = prev;
  } };
};
var mockyFxListen = function (node, name, fn, opts) {
  node.addEventListener(name, fn, opts);
  return function () { node.removeEventListener(name, fn, opts); };
};
var mockyFxHoverOn = function (node, enter, leave) {
  var offs = [
    mockyFxListen(node, 'pointerenter', function (e) { if (mockyFxPointerOk(e)) enter(e); }),
    mockyFxListen(node, 'pointerleave', function (e) { if (mockyFxPointerOk(e)) leave(e); }),
    mockyFxListen(node, 'focusin', function () { enter(); }),
    mockyFxListen(node, 'focusout', function () { leave(); })
  ];
  return function () { offs.forEach(function (off) { off(); }); };
};

/* The presets a keyframe list cannot say. Each returns its own cleanup, and each
   paints with the element's currentColor or plain light: the screen has its own
   palette and none of this may guess at it. */
var MOCKY_FX_FN = {
  ripple: function (node) {
    var layers = [];
    var off = mockyFxListen(node, 'click', function (e) {
      var r = node.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 2.2;
      var layer = mockyFxLayer(node);
      layers.push(layer);
      var dot = document.createElement('span');
      var x = (e.clientX || r.left + r.width / 2) - r.left - size / 2;
      var y = (e.clientY || r.top + r.height / 2) - r.top - size / 2;
      dot.style.cssText = 'position:absolute;border-radius:50%;background:currentColor;left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px';
      layer.el.appendChild(dot);
      var a = dot.animate([{ scale: 0, opacity: 0.28 }, { scale: 1, opacity: 0 }], { duration: 650, easing: mockyEase.soft });
      a.onfinish = function () { layer.remove(); };
    });
    return function () { off(); layers.forEach(function (l) { l.remove(); }); };
  },
  burst: function (node, o) {
    var bits = [];
    var off = mockyFxListen(node, 'click', function (e) {
      var r = node.getBoundingClientRect();
      var x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
      var ink = (o.colors && o.colors.length) ? o.colors : [window.getComputedStyle(node).color];
      for (var i = 0; i < 16; i++) {
        var b = document.createElement('span');
        var w = 5 + Math.random() * 5;
        b.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + (w * 0.6) + 'px;border-radius:1px;background:' + ink[i % ink.length];
        document.body.appendChild(b);
        bits.push(b);
        var ang = (i / 16) * Math.PI * 2 + Math.random() * 0.5, dist = 50 + Math.random() * 70;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        var a = b.animate([
          { translate: '-50% -50%', rotate: '0deg', opacity: 1 },
          { translate: dx + 'px ' + dy + 'px', rotate: (Math.random() * 360) + 'deg', opacity: 1, offset: 0.6, easing: 'ease-in' },
          { translate: dx * 1.1 + 'px ' + (dy + 60) + 'px', rotate: (Math.random() * 720) + 'deg', opacity: 0 }
        ], { duration: 800 + Math.random() * 300, easing: mockyEase.expo, fill: 'both' });
        a.onfinish = (function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; })(b);
      }
    });
    return function () { off(); bits.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); }); };
  },
  magnetic: function (node) {
    var dx = 0, dy = 0;
    var prevT = node.style.transition, prevM = node.style.translate;
    var off1 = mockyFxListen(node, 'pointermove', function (e) {
      if (!mockyFxPointerOk(e)) return;
      var r = node.getBoundingClientRect();
      dx = (e.clientX - (r.left - dx + r.width / 2)) * 0.3;
      dy = (e.clientY - (r.top - dy + r.height / 2)) * 0.3;
      node.style.transition = 'translate 140ms ease-out';
      node.style.translate = dx.toFixed(1) + 'px ' + dy.toFixed(1) + 'px';
    });
    var off2 = mockyFxListen(node, 'pointerleave', function () {
      dx = 0; dy = 0;
      node.style.transition = 'translate 650ms ' + mockyEase.spring;
      node.style.translate = '0px 0px';
    });
    return function () { off1(); off2(); node.style.transition = prevT; node.style.translate = prevM; };
  },
  spotlight: function (node, o) {
    var layer = null;
    var ink = (o.colors && o.colors[0]) || 'currentColor';
    var at = function (e) {
      if (!layer) return;
      var r = node.getBoundingClientRect();
      layer.el.style.background = 'radial-gradient(circle 240px at ' + (e.clientX - r.left).toFixed(0) + 'px ' + (e.clientY - r.top).toFixed(0) + 'px,' + ink + ',transparent 70%)';
    };
    var offH = mockyFxHoverOn(node, function (e) {
      if (!e) return;
      if (!layer) { layer = mockyFxLayer(node, 'opacity:0;transition:opacity 260ms ease;'); layer.el.getBoundingClientRect(); layer.el.style.opacity = '0.16'; }
      at(e);
    }, function () {
      var l = layer; layer = null;
      if (!l) return;
      l.el.style.opacity = '0';
      window.setTimeout(function () { l.remove(); }, 280);
    });
    var offM = mockyFxListen(node, 'pointermove', at);
    return function () { offH(); offM(); if (layer) layer.remove(); };
  },
  tiltGlare: function (node) {
    var prevT = node.style.transform, prevTr = node.style.transition, layer = null;
    var offH = mockyFxHoverOn(node, function () {
      if (!layer) layer = mockyFxLayer(node, 'opacity:0.22;mix-blend-mode:overlay;');
      node.style.transition = 'transform 70ms linear';
    }, function () {
      node.style.transition = 'transform 520ms ' + mockyEase.spring;
      node.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
      if (layer) { layer.remove(); layer = null; }
    });
    var offM = mockyFxListen(node, 'pointermove', function (e) {
      if (!mockyFxPointerOk(e)) return;
      var r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = 'perspective(900px) rotateX(' + (-py * 12).toFixed(2) + 'deg) rotateY(' + (px * 12).toFixed(2) + 'deg)';
      if (layer) layer.el.style.background = 'radial-gradient(circle at ' + ((px + 0.5) * 100).toFixed(0) + '% ' + ((py + 0.5) * 100).toFixed(0) + '%,#fff,transparent 62%)';
    });
    return function () { offH(); offM(); if (layer) layer.remove(); node.style.transform = prevT; node.style.transition = prevTr; };
  },
  cursorParallax: function (node) {
    var prevT = node.style.transition, prevM = node.style.translate;
    node.style.transition = 'translate 420ms cubic-bezier(0.22,1,0.36,1)';
    var off = mockyFxListen(window, 'pointermove', function (e) {
      if (!mockyFxPointerOk(e)) return;
      var w = window.innerWidth || 1, h = window.innerHeight || 1;
      node.style.translate = (-(e.clientX / w - 0.5) * 22).toFixed(1) + 'px ' + (-(e.clientY / h - 0.5) * 22).toFixed(1) + 'px';
    }, { passive: true });
    return function () { off(); node.style.transition = prevT; node.style.translate = prevM; };
  },
  shine: function (node) {
    var layers = [];
    var off = mockyFxHoverOn(node, function () {
      var layer = mockyFxLayer(node);
      layers.push(layer);
      var band = document.createElement('span');
      band.style.cssText = 'position:absolute;top:-20%;bottom:-20%;left:0;width:45%;rotate:18deg;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)';
      layer.el.appendChild(band);
      var a = band.animate([{ translate: '-160% 0' }, { translate: '320% 0' }], { duration: 760, easing: mockyEase.io });
      a.onfinish = function () { layer.remove(); };
    }, function () {});
    return function () { off(); layers.forEach(function (l) { l.remove(); }); };
  },
  zoom: function (node) {
    var target = node.querySelector('img') || node.firstElementChild;
    if (!target) return function () {};
    var prev = node.style.overflow, a = null;
    node.style.overflow = 'hidden';
    var off = mockyFxHoverOn(node, function () {
      if (a) { a.playbackRate = 1; a.play(); return; }
      a = target.animate([{}, { scale: 1.08 }], { duration: 900, easing: mockyEase.expo, fill: 'both' });
      a.onfinish = function () { if (a && a.playbackRate < 0) { a.cancel(); a = null; } };
    }, function () {
      if (a) { a.playbackRate = -1; a.play(); }
    });
    return function () { off(); if (a) a.cancel(); node.style.overflow = prev; };
  }
};

var mockyFxMount = function (node, cfg, o) {
  if (cfg.f === 'fn') return MOCKY_FX_FN[cfg.fn](node, o);
  var trigger = mockyFxTrigger(cfg, o.trigger);
  var frames = mockyFxFrames(cfg);
  var scrubbed = trigger === 'scroll';
  var speed = o.speed === 'fast' ? 0.6 : o.speed === 'slow' ? 1.6 : 1;
  var step = Math.max(0, Math.min(0.5, Number(o.stagger) || cfg.st || 0));
  var anims = [], offs = [];
  var targets = function () {
    return step && node.children.length ? Array.prototype.slice.call(node.children, 0, 60) : [node];
  };
  var stop = function () {
    anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    anims = [];
  };
  var make = function (held) {
    stop();
    anims = targets().map(function (el, i) {
      var t = cfg.f === 'loop'
        ? { duration: cfg.ms * speed, delay: o.delay * 1000, easing: mockyFxEaseOf(cfg), iterations: Infinity, direction: cfg.dir || 'normal' }
        : scrubbed
          ? { duration: 1000, easing: 'linear', fill: 'both' }
          : { duration: cfg.ms * speed, delay: (o.delay + i * step) * 1000, easing: mockyFxEaseOf(cfg), fill: 'both' };
      var a = el.animate(frames, t);
      if (held) a.pause();
      return a;
    });
  };
  /* Cancelled at the end, not kept: a finished fill holds a stacking context and
     a compositor layer for as long as the page lives. */
  var released = function () {
    anims.forEach(function (a) { a.onfinish = function () { try { a.cancel(); } catch (e) {} }; a.play(); });
  };
  var once = function () { make(true); released(); };

  if (cfg.f === 'hover') {
    var a = null, on = false;
    var set = function (next) {
      if (next === on) return;
      on = next;
      if (!a) {
        if (!next) return;
        a = node.animate(frames, { duration: cfg.ms * speed, easing: mockyFxEaseOf(cfg), fill: 'both' });
        a.onfinish = function () { if (a && a.playbackRate < 0) { a.cancel(); a = null; } };
        return;
      }
      a.playbackRate = next ? 1 : -1;
      a.play();
    };
    var offState = trigger === 'click'
      ? mockyFxListen(node, 'click', function () { set(!on); })
      : mockyFxHoverOn(node, function () { set(true); }, function () { set(false); });
    return function () { offState(); if (a) a.cancel(); };
  }

  if (scrubbed) {
    make(true);
    var mode = cfg.f === 'scrub' ? 'pass' : 'enter';
    var leave = mockyBusJoin(function () {
      var at = mockyProgress(node, mode) * 1000;
      anims.forEach(function (a) { a.currentTime = at; });
    });
    return function () { leave(); stop(); };
  }

  if (cfg.f === 'loop') {
    if (trigger === 'hover') {
      var offLoop = mockyFxHoverOn(node, function () { if (!anims.length) make(false); }, stop);
      return function () { offLoop(); stop(); };
    }
    make(true);
    var offSeen = mockyFxSeen(node, function (seen) {
      anims.forEach(function (a) { if (seen) a.play(); else a.pause(); });
    });
    return function () { offSeen(); stop(); };
  }

  if (trigger === 'load') {
    make(true);
    released();
    return stop;
  }
  if (trigger === 'change') {
    if (o.bind) { o.bind(once); offs.push(function () { o.bind(null); }); }
  } else if (trigger === 'click') {
    offs.push(mockyFxListen(node, 'click', once));
  } else if (trigger === 'hover') {
    offs.push(mockyFxHoverOn(node, function (e) { if (e) once(); }, function () {}));
  } else if (trigger === 'view') {
    var entering = cfg.f === 'in';
    if (entering) make(true);
    var played = false;
    var play = function () { played = true; if (entering) released(); else once(); };
    /* Above the fold: released now, whatever the observer would say. */
    var inFirstScreen = mockyLayoutTop(node) - (window.pageYOffset || 0) < (window.innerHeight || 0) * 0.85;
    if (inFirstScreen) play();
    if (!inFirstScreen || o.repeat) {
      var offIo = null;
      offIo = mockyFxSeen(node, function (seen) {
        if (seen && !played) {
          play();
          if (!o.repeat && offIo) offIo();
        } else if (!seen && played && o.repeat) {
          played = false;
          if (entering) make(true);
        }
      });
      offs.push(function () { if (offIo) offIo(); });
    }
  }
  return function () { offs.forEach(function (off) { off(); }); stop(); };
};

var mockyLayoutEffect = (typeof window !== 'undefined' && window.document && React.useLayoutEffect) || React.useEffect;
var MOCKY_FX_OWN = { preset: 1, trigger: 1, delay: 1, stagger: 1, speed: 1, repeat: 1, on: 1, as: 1, children: 1, colors: 1 };

var MockyFx = function (props) {
  var cfg = MOCKY_FX[props.preset];
  var Tag = props.as || 'div';
  var ref = React.useRef(null);
  var delay = Math.min(2, Math.max(0, Number(props.delay) || 0));
  var colors = props.colors ? props.colors.join(',') : '';
  var replay = React.useRef(null);
  mockyLayoutEffect(function () {
    var node = ref.current;
    if (!node || !mockyFxMay()) return;
    /* "change" is a click nobody made: the effect below calls what is bound. */
    var opts = { trigger: props.trigger, delay: delay, stagger: props.stagger, speed: props.speed, repeat: !!props.repeat, colors: props.colors, bind: function (fn) { replay.current = fn; } };
    var off;
    try {
      off = mockyFxMount(node, cfg, opts);
    } catch (e) {
      /* A browser that refuses one keyframe gets the element, whole and still. */
      try { (node.getAnimations ? node.getAnimations() : []).forEach(function (a) { a.cancel(); }); } catch (e2) {}
      return;
    }
    return off;
  }, [props.preset, props.trigger, delay, props.stagger, props.speed, !!props.repeat, colors]);
  var first = React.useRef(true);
  React.useEffect(function () {
    if (first.current) { first.current = false; return; }
    if (replay.current) replay.current();
  }, [props.on]);
  var rest = { ref: ref };
  for (var k in props) if (!MOCKY_FX_OWN[k]) rest[k] = props[k];
  return React.createElement(Tag, rest, props.children);
};

/* The whole of "which engine". A screen with no trigger on an old preset name is
   a screen somebody already approved, and it keeps the engine it was made with. */
var mockyFxWanted = function (props) {
  if (!props || !MOCKY_FX[props.preset]) return false;
  return !!(props.trigger || props.stagger || !MOCKY_PRESETS[props.preset] || props.preset === 'stagger-list');
};
var Animated = function (props) {
  return React.createElement(mockyFxWanted(props) ? MockyFx : MockyMotionAnimated, props);
};

/** AnimatedProgress: how far through the page the reader is. */
var AnimatedProgress = function (props) {
  var p = props || {};
  var ref = React.useRef(null);
  var may = React.useRef(null);
  if (may.current === null) may.current = mockyFxMay();
  React.useEffect(function () {
    if (!may.current) return;
    return mockyBusJoin(function () {
      var node = ref.current;
      if (!node) return;
      var max = mockyDocMax();
      node.style.transform = 'scaleX(' + (max > 1 ? Math.min(1, (window.pageYOffset || 0) / max) : 0) + ')';
    });
  }, []);
  if (!may.current) return null;
  var style = { position: 'fixed', left: 0, right: 0, height: Math.max(1, Math.min(12, Number(p.height) || 3)), transformOrigin: '0 50%', transform: 'scaleX(0)', pointerEvents: 'none', zIndex: 60 };
  style[p.position === 'bottom' ? 'bottom' : 'top'] = 0;
  style.background = p.color || 'currentColor';
  return React.createElement('div', { ref: ref, 'aria-hidden': true, className: p.className, style: style });
};

/** AnimatedCollapse: a block that opens to its own height, whatever that height is. */
var AnimatedCollapse = function (props) {
  var p = props || {};
  var open = !!p.open;
  var ease = 'cubic-bezier(0.22,1,0.36,1)';
  return React.createElement('div', {
    className: p.className,
    style: { display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 420ms ' + ease }
  }, React.createElement('div', {
    'aria-hidden': open ? undefined : true,
    style: { overflow: 'hidden', minHeight: 0, opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transition: 'opacity 300ms ease, visibility 420ms' }
  }, p.children));
};

/** AnimatedFlip: a card with two faces, in one grid cell so it is as tall as the taller one. */
var AnimatedFlip = function (props) {
  var p = props || {};
  var st = React.useState(false);
  var flipped = st[0], setFlipped = st[1];
  var click = p.trigger === 'click';
  var face = { gridArea: '1 / 1', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };
  var toggle = function () { setFlipped(function (v) { return !v; }); };
  var outer = { className: p.className, style: { perspective: '1200px', cursor: click ? 'pointer' : undefined } };
  if (click) {
    outer.role = 'button';
    outer.tabIndex = 0;
    outer['aria-pressed'] = flipped;
    outer.onClick = toggle;
    outer.onKeyDown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
  } else {
    outer.onPointerEnter = function (e) { if (mockyFxPointerOk(e)) setFlipped(true); };
    outer.onPointerLeave = function (e) { if (mockyFxPointerOk(e)) setFlipped(false); };
    outer.onClick = toggle;
  }
  return React.createElement('div', outer,
    React.createElement('div', { style: { display: 'grid', height: '100%', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)' } },
      React.createElement('div', { style: face, 'aria-hidden': flipped ? true : undefined }, p.front),
      React.createElement('div', { style: Object.assign({}, face, { transform: 'rotateY(180deg)' }), 'aria-hidden': flipped ? undefined : true }, p.back)
    )
  );
};

/** AnimatedWord: one word of a headline that keeps changing, in a box sized for the longest. */
var AnimatedWord = function (props) {
  var p = props || {};
  var words = Array.isArray(p.words) && p.words.length ? p.words : [''];
  var may = React.useRef(null);
  if (may.current === null) may.current = mockyFxMay();
  var st = React.useState(0);
  var at = st[0], setAt = st[1];
  var every = Math.max(1000, Math.min(10000, (Number(p.interval) || 2.4) * 1000));
  React.useEffect(function () {
    if (!may.current || words.length < 2) return;
    var id = window.setInterval(function () { setAt(function (i) { return (i + 1) % words.length; }); }, every);
    return function () { window.clearInterval(id); };
  }, [every, words.length]);
  if (!may.current) return React.createElement('span', { className: p.className }, words[0]);
  var kind = p.preset === 'fade' || p.preset === 'blur' || p.preset === 'flip' ? p.preset : 'up';
  var out = function (i) {
    if (kind === 'fade') return { opacity: 0 };
    if (kind === 'blur') return { opacity: 0, filter: 'blur(8px)' };
    if (kind === 'flip') return { opacity: 0, transform: 'perspective(600px) rotateX(' + (i < at ? '80deg' : '-80deg') + ')' };
    return { opacity: 0, transform: 'translateY(' + (i < at ? '-60%' : '60%') + ')' };
  };
  return React.createElement('span', { className: p.className, style: { display: 'inline-grid', verticalAlign: 'baseline' } },
    words.map(function (w, i) {
      var live = i === at;
      var s = Object.assign({ gridArea: '1 / 1', whiteSpace: 'nowrap', transition: 'opacity 500ms ease, transform 600ms cubic-bezier(0.22,1,0.36,1), filter 500ms ease', opacity: 1, transform: 'none', filter: 'none' }, live ? {} : out(i));
      return React.createElement('span', { key: i, style: s, 'aria-hidden': live ? undefined : true }, w);
    })
  );
};

/** AnimatedScrollText: a giant line that slides sideways as the page scrolls. */
var AnimatedScrollText = function (props) {
  var p = props || {};
  var text = mockyTextOf(p.children);
  var may = React.useRef(null);
  if (may.current === null) may.current = mockyFxMay() && text !== null;
  var track = React.useRef(null);
  var speed = Math.max(0.1, Math.min(3, Number(p.speed) || 0.6)) * (p.reverse ? -1 : 1);
  React.useEffect(function () {
    if (!may.current) return;
    return mockyBusJoin(function () {
      var node = track.current;
      if (!node || !node.firstElementChild) return;
      var w = node.firstElementChild.offsetWidth || 1;
      var x = ((window.pageYOffset || 0) * speed) % w;
      node.style.transform = 'translate3d(' + (-(x < 0 ? x + w : x)).toFixed(1) + 'px,0,0)';
    });
  }, [speed]);
  var Tag = p.as || 'div';
  if (!may.current) return React.createElement(Tag, { className: p.className, style: { overflow: 'hidden', whiteSpace: 'nowrap' } }, p.children);
  var items = [];
  for (var i = 0; i < 6; i++) items.push(React.createElement('span', { key: i, style: { paddingRight: '0.6em', flexShrink: 0 } }, text));
  return React.createElement(Tag, { className: p.className, style: { overflow: 'hidden', whiteSpace: 'nowrap' }, 'aria-label': text },
    React.createElement('span', { ref: track, 'aria-hidden': true, style: { display: 'inline-flex', willChange: 'transform' } }, items)
  );
};

/** AnimatedCursorGlow: a soft light that trails the pointer across the whole page. */
var AnimatedCursorGlow = function (props) {
  var p = props || {};
  var size = Math.max(120, Math.min(1000, Number(p.size) || 420));
  var ref = React.useRef(null);
  var may = React.useRef(null);
  if (may.current === null) {
    var fine = false;
    try { fine = window.matchMedia('(hover: hover)').matches; } catch (e) {}
    may.current = mockyFxMay() && fine;
  }
  React.useEffect(function () {
    if (!may.current) return;
    return mockyFxListen(window, 'pointermove', function (e) {
      var node = ref.current;
      if (!node || !mockyFxPointerOk(e)) return;
      node.style.opacity = String(Math.max(0, Math.min(1, Number(p.opacity) || 0.28)));
      node.style.translate = (e.clientX - size / 2) + 'px ' + (e.clientY - size / 2) + 'px';
    }, { passive: true });
  }, [size, p.opacity]);
  if (!may.current) return null;
  return React.createElement('div', {
    ref: ref,
    'aria-hidden': true,
    style: { position: 'fixed', left: 0, top: 0, width: size, height: size, borderRadius: '50%', opacity: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(circle,' + (p.color || 'currentColor') + ',transparent 68%)', transition: 'translate 500ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease' }
  });
};

/* ---- the three text presets that are not a from-state ---- */
var mockyTextTrigger = function (ref, trigger, go) {
  var node = ref.current;
  if (!node) return function () {};
  if (trigger === 'load') { go(); return function () {}; }
  var off = null;
  off = mockyFxSeen(node, function (seen) { if (seen) { if (off) off(); go(); } });
  return function () { if (off) off(); };
};
var MOCKY_SCRAMBLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@';
var MockyTextScramble = function (props) {
  var Tag = props.as || 'span';
  var text = mockyTextOf(props.children);
  var ref = React.useRef(null);
  var live = React.useRef(null);
  var delay = Math.min(2, Math.max(0, Number(props.delay) || 0));
  React.useEffect(function () {
    var raf = 0, timer = 0, chars = Array.from(text);
    var noise = function () { return chars.map(function (c) { return /\\s/.test(c) ? c : MOCKY_SCRAMBLE[Math.floor(Math.random() * MOCKY_SCRAMBLE.length)]; }).join(''); };
    if (live.current) live.current.textContent = noise();
    var off = mockyTextTrigger(ref, props.trigger, function () {
      timer = window.setTimeout(function () {
        var t0 = 0, total = Math.min(2200, 500 + chars.length * 34), last = 0;
        var step = function (now) {
          if (!t0) t0 = now;
          var p = Math.min(1, (now - t0) / total);
          if (now - last > 45 || p === 1) {
            last = now;
            var n = Math.floor(p * chars.length);
            var out = chars.slice(0, n).join('') + chars.slice(n).map(function (c) { return /\\s/.test(c) ? c : MOCKY_SCRAMBLE[Math.floor(Math.random() * MOCKY_SCRAMBLE.length)]; }).join('');
            if (live.current) live.current.textContent = out;
          }
          if (p < 1) raf = window.requestAnimationFrame(step);
        };
        raf = window.requestAnimationFrame(step);
      }, delay * 1000);
    });
    return function () {
      off();
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
      if (live.current) live.current.textContent = text;
    };
  }, [text, delay, props.trigger]);
  return React.createElement(Tag, { ref: ref, className: props.className, style: props.style, 'aria-label': text },
    React.createElement('span', { 'aria-hidden': true, style: { display: 'inline-grid' } },
      React.createElement('span', { style: { gridArea: '1 / 1', visibility: 'hidden' } }, text),
      React.createElement('span', { ref: live, style: { gridArea: '1 / 1' } }, text)
    )
  );
};
var MockyTextTypewriter = function (props) {
  var Tag = props.as || 'span';
  var text = mockyTextOf(props.children);
  var chars = Array.from(text);
  var ref = React.useRef(null);
  var st = React.useState(0);
  var n = st[0], setN = st[1];
  var delay = Math.min(2, Math.max(0, Number(props.delay) || 0));
  var each = Math.max(12, Math.min(200, (Number(props.stagger) || 0.035) * 1000));
  React.useEffect(function () {
    var id = 0, timer = 0;
    var off = mockyTextTrigger(ref, props.trigger, function () {
      timer = window.setTimeout(function () {
        id = window.setInterval(function () {
          setN(function (v) {
            if (v + 1 >= chars.length) window.clearInterval(id);
            return Math.min(chars.length, v + 1);
          });
        }, each);
      }, delay * 1000);
    });
    return function () { off(); window.clearTimeout(timer); window.clearInterval(id); };
  }, [text, delay, each, props.trigger]);
  var done = n >= chars.length;
  return React.createElement(Tag, { ref: ref, className: props.className, style: props.style, 'aria-label': text },
    React.createElement('span', { 'aria-hidden': true },
      chars.slice(0, n).join(''),
      done ? null : React.createElement('span', { style: { borderLeft: '0.08em solid currentColor', marginRight: '-0.08em' } }),
      React.createElement('span', { style: { visibility: 'hidden' } }, chars.slice(n).join(''))
    )
  );
};
var MockyTextScrollFill = function (props) {
  var Tag = props.as || 'span';
  var text = mockyTextOf(props.children);
  var ref = React.useRef(null);
  var words = text.split(/(\\s+)/);
  React.useEffect(function () {
    var node = ref.current;
    if (!node) return;
    var spans = node.querySelectorAll('[data-w]');
    return mockyBusJoin(function () {
      var p = mockyProgress(node, 'fill') * spans.length;
      for (var i = 0; i < spans.length; i++) spans[i].style.opacity = String(0.18 + 0.82 * Math.max(0, Math.min(1, p - i)));
    });
  }, [text]);
  return React.createElement(Tag, { ref: ref, className: props.className, style: props.style, 'aria-label': text },
    React.createElement('span', { 'aria-hidden': true }, words.map(function (w, i) {
      return /^\\s+$/.test(w) || !w ? w : React.createElement('span', { key: i, 'data-w': 1, style: { opacity: 0.18 } }, w);
    }))
  );
};
var MOCKY_TEXT_DYNAMIC = { scramble: MockyTextScramble, typewriter: MockyTextTypewriter, 'scroll-fill': MockyTextScrollFill };
var AnimatedText = function (props) {
  var Dyn = props && MOCKY_TEXT_DYNAMIC[props.preset];
  var text = props ? mockyTextOf(props.children) : null;
  var go = React.useRef(null);
  if (go.current === null) go.current = !!Dyn && text !== null && mockyFxMay();
  return React.createElement(go.current ? Dyn : MockyAnimatedTextPlain, props);
};
`
