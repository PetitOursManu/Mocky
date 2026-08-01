/**
 * `<Animated preset="…">` — the only motion surface the generating model sees.
 *
 * THE RULE THIS ENFORCES
 *
 * The model never writes Motion code. It never imports anything, never writes
 * `motion.div`, never authors a transition or a variant object. It picks a name
 * from a closed list. Everything below is written and tested once, here, so a
 * model that misremembers the library's API cannot produce a broken screen —
 * the worst it can do is name a preset that does not exist, which renders a
 * plain, unanimated element.
 *
 * WHY THERE ARE TWO ENGINES
 *
 * Motion is vendored and loaded as a capability, so it is normally there. When
 * it is not — the script failed, or a screen was generated before the
 * capability existed — the same presets run on a small CSS/IntersectionObserver
 * path instead. The component's contract does not change; only the smoothness
 * does.
 *
 * THE STATIC ESCAPE HATCH, AND WHY IT IS NOT OPTIONAL
 *
 * Motion holds an element at its `initial` state until the frame loop starts,
 * and browsers do not run that loop in a hidden document. Measured: a mockup
 * rendered in a background tab sits at `opacity: 0` indefinitely — a blank
 * screen, not a delayed one. So an entrance is only ever attempted when the
 * document is visible AND the user has not asked for reduced motion. In every
 * other case the element renders in its FINAL state, immediately. A mockup that
 * shows its content without animating is a small loss; a mockup that shows
 * nothing is a bug.
 */
export const AnimateSource = `var MOCKY_PRESETS = {
  'fade-in': {
    variants: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } },
    css: { from: 'opacity:0', to: 'opacity:1', ms: 400 }
  },
  'fade-up': {
    variants: { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } },
    css: { from: 'opacity:0;transform:translateY(16px)', to: 'opacity:1;transform:none', ms: 400 }
  },
  'scale-in': {
    variants: { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } },
    css: { from: 'opacity:0;transform:scale(0.92)', to: 'opacity:1;transform:none', ms: 420 }
  },
  'stagger-list': {
    variants: { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } },
    stagger: true,
    css: { from: 'opacity:0;transform:translateY(12px)', to: 'opacity:1;transform:none', ms: 380 }
  },
  'hover-lift': {
    whileHover: { y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
    hover: true
  },
  'exit-slide': {
    variants: {
      hidden: { opacity: 0, x: -24 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 24, transition: { duration: 0.2 } }
    },
    exit: true,
    css: { from: 'opacity:0;transform:translateX(-24px)', to: 'opacity:1;transform:none', ms: 360 }
  }
};

/* Animate at all? Four independent reasons not to, all of them the user's. */
var mockyMayAnimate = function () {
  try {
    /* The "Sans animation" switch, passed in by the preview shell. It holds
       screens that were GENERATED with animations still as well, which is what
       the button appears to promise. */
    if (window.__mockyAnimations === false) return false;
    if (document.hidden) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch (e) { return false; }
  return true;
};

var Animated = function (props) {
  var name = props && props.preset;
  var config = MOCKY_PRESETS[name];
  var Tag = (props && props.as) || 'div';
  var className = (props && props.className) || undefined;
  var children = props ? props.children : null;
  var delay = Math.min(2, Math.max(0, Number(props && props.delay) || 0));

  /* An unknown preset is not an error: it is a plain element. */
  if (!config || !mockyMayAnimate()) {
    return React.createElement(Tag, { className: className, style: props && props.style }, children);
  }

  var M = window.Motion;
  if (M && M.motion) {
    var MotionTag = M.motion[Tag] || M.motion.div;
    var extra = {};
    if (config.whileHover) extra.whileHover = config.whileHover;
    if (config.variants) {
      extra.initial = 'hidden';
      extra.animate = 'visible';
      extra.variants = config.variants;
      if (config.exit) extra.exit = 'exit';
    }
    /* staggerChildren only reaches children that are themselves variant-driven;
       the parent's transition carries the delay for everything else. */
    extra.transition = { delay: delay };
    return React.createElement(
      MotionTag,
      Object.assign({ className: className, style: props && props.style }, extra),
      config.exit && M.AnimatePresence
        ? React.createElement(M.AnimatePresence, null, children)
        : children
    );
  }

  /* ---- no Motion: the same presets, in CSS ---- */
  var ref = React.useRef(null);
  var shown = React.useState(false);
  var isShown = shown[0], setShown = shown[1];
  React.useEffect(function () {
    if (config.hover) return;
    var node = ref.current;
    if (!node) return;
    var reveal = function () { setShown(true); };
    if (typeof IntersectionObserver === 'undefined') { reveal(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { reveal(); io.disconnect(); return; }
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(node);
    return function () { io.disconnect(); };
  }, []);

  var style = Object.assign({}, props && props.style);
  if (config.hover) {
    style.transition = 'transform 200ms ease, box-shadow 200ms ease';
  } else if (config.css) {
    var target = isShown ? config.css.to : config.css.from;
    var parts = target.split(';');
    for (var p = 0; p < parts.length; p++) {
      var kv = parts[p].split(':');
      if (kv.length === 2) style[kv[0].trim() === 'transform' ? 'transform' : kv[0].trim()] = kv[1].trim();
    }
    style.transition = 'opacity ' + config.css.ms + 'ms ease-out ' + (delay * 1000) + 'ms, transform ' + config.css.ms + 'ms ease-out ' + (delay * 1000) + 'ms';
  }

  var handlers = config.hover
    ? {
        onMouseEnter: function (e) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        },
        onMouseLeave: function (e) {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
        }
      }
    : {};

  return React.createElement(
    Tag,
    Object.assign({ ref: ref, className: className, style: style }, handlers),
    children
  );
}`

export const ANIMATE_EXPORTS = ['Animated'] as const

/**
 * The closed vocabulary, restated for the prompt and for tests.
 *
 * Kept next to the source rather than derived from it: the registry's
 * `components` metadata is what reaches the model, and a name that exists in
 * one and not the other is the failure `validatePack` exists to catch.
 */
export const ANIMATE_PRESETS = [
  'fade-in',
  'fade-up',
  'scale-in',
  'stagger-list',
  'hover-lift',
  'exit-slide',
] as const

export type AnimatePreset = (typeof ANIMATE_PRESETS)[number]
