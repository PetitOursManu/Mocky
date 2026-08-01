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
  'slide-left': {
    variants: {
      hidden: { opacity: 0, x: -32 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: 'easeOut' } }
    },
    css: { from: 'opacity:0;transform:translateX(-32px)', to: 'opacity:1;transform:none', ms: 450 }
  },
  'slide-right': {
    variants: {
      hidden: { opacity: 0, x: 32 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: 'easeOut' } }
    },
    css: { from: 'opacity:0;transform:translateX(32px)', to: 'opacity:1;transform:none', ms: 450 }
  },
  'blur-in': {
    variants: {
      hidden: { opacity: 0, filter: 'blur(12px)' },
      visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.5, ease: 'easeOut' } }
    },
    css: { from: 'opacity:0;filter:blur(12px)', to: 'opacity:1;filter:blur(0px)', ms: 500 }
  },
  'hover-lift': {
    whileHover: { y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
    hover: true
  },
  /* Light rather than colour: the generated screen has its own palette and this
     must not guess at it. Brightness works on any background. */
  'hover-glow': {
    whileHover: { scale: 1.02, filter: 'brightness(1.08) saturate(1.08)' },
    hover: true,
    hoverCss: { transform: 'scale(1.02)', filter: 'brightness(1.08) saturate(1.08)' }
  },
  /* Scroll-linked, so it is driven by the same DOM path in both engines —
     see the note where it is rendered. */
  'parallax': { parallax: 0.25 },
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

  /* EVERY hook runs on every render, unconditionally.
     They used to sit after the early return below, which is a bug that waits:
     document.hidden can flip while a mockup is open (switch tab, come back),
     and the next parent re-render would then take the short path and call
     FEWER hooks than the previous one — "Rendered fewer hooks than expected",
     which kills the whole frame. The decision is taken once, at mount, and
     frozen; the effects below simply do nothing when there is nothing to do. */
  var allowed = React.useRef(null);
  if (allowed.current === null) allowed.current = mockyMayAnimate();
  var ref = React.useRef(null);
  var shown = React.useState(false);
  var isShown = shown[0], setShown = shown[1];
  var shift = React.useState(0);
  var offset = shift[0], setOffset = shift[1];
  var rafRef = React.useRef(0);

  var animating = Boolean(config) && allowed.current === true;
  var usesCssReveal = animating && !!config && !config.hover && !config.parallax && !(window.Motion && window.Motion.motion);

  React.useEffect(function () {
    if (!usesCssReveal) return;
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
  }, [usesCssReveal]);

  /* Parallax is scroll-linked, so it is the same DOM code with or without
     Motion — there is nothing for a variant to describe. */
  var parallaxOn = animating && !!config && !!config.parallax;
  React.useEffect(function () {
    if (!parallaxOn) return;
    var depth = config.parallax;
    var update = function () {
      rafRef.current = 0;
      var node = ref.current;
      if (!node) return;
      var rect = node.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      /* -1 above the viewport, 0 centred, +1 below. Translating by a fraction
         of that keeps the block near its layout position at every scroll
         offset, so it never drifts out of its own section. */
      var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      setOffset(Math.max(-80, Math.min(80, progress * depth * vh * -0.5)));
    };
    var schedule = function () {
      if (rafRef.current) return;
      rafRef.current = 1;
      window.requestAnimationFrame(function () { rafRef.current = 0; update(); });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return function () {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [parallaxOn]);

  /* An unknown preset is not an error: it is a plain element. */
  if (!animating) {
    return React.createElement(Tag, { ref: ref, className: className, style: props && props.style }, children);
  }

  if (config.parallax) {
    var pStyle = Object.assign({}, props && props.style);
    pStyle.transform = 'translate3d(0,' + Math.round(offset) + 'px,0)';
    pStyle.willChange = 'transform';
    return React.createElement(Tag, { ref: ref, className: className, style: pStyle }, children);
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
  var style = Object.assign({}, props && props.style);
  if (config.hover) {
    style.transition = 'transform 200ms ease, box-shadow 200ms ease, filter 200ms ease';
  } else if (config.css) {
    var target = isShown ? config.css.to : config.css.from;
    var parts = target.split(';');
    for (var p = 0; p < parts.length; p++) {
      var kv = parts[p].split(':');
      if (kv.length === 2) style[kv[0].trim() === 'transform' ? 'transform' : kv[0].trim()] = kv[1].trim();
    }
    style.transition = 'opacity ' + config.css.ms + 'ms ease-out ' + (delay * 1000) + 'ms, transform ' + config.css.ms + 'ms ease-out ' + (delay * 1000) + 'ms';
  }

  var hoverCss = config.hoverCss || { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' };
  var handlers = config.hover
    ? {
        onMouseEnter: function (e) {
          for (var k in hoverCss) e.currentTarget.style[k] = hoverCss[k];
        },
        onMouseLeave: function (e) {
          for (var k2 in hoverCss) e.currentTarget.style[k2] = '';
        }
      }
    : {};

  return React.createElement(
    Tag,
    Object.assign({ ref: ref, className: className, style: style }, handlers),
    children
  );
};

/**
 * Ticker — a row that scrolls forever.
 *
 * The track is duplicated and translated by exactly half its width, so the
 * seam is invisible and the loop point looks identical to the start. That
 * detail is also what makes it survive "Sans animation": collapsing the
 * animation to one instant pass lands it at -50%, which is the same picture.
 */
var Ticker = function (props) {
  var speed = Math.min(120, Math.max(4, Number(props && props.speed) || 24));
  var reverse = !!(props && props.reverse);
  var pauseOnHover = props && props.pauseOnHover !== false;
  var className = (props && props.className) || '';
  var children = props ? props.children : null;
  var id = React.useRef(null);
  if (!id.current) id.current = 'mq' + Math.random().toString(36).slice(2, 8);
  var run = mockyMayAnimate();

  var track = React.createElement(
    'div',
    { style: { display: 'flex', gap: '2rem', flexShrink: 0, minWidth: '100%', justifyContent: 'space-around' } },
    children
  );

  return React.createElement(
    'div',
    { className: className, style: { overflow: 'hidden', display: 'flex', width: '100%' }, 'data-mq': id.current },
    React.createElement('style', null,
      '@keyframes ' + id.current + '{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
      '[data-mq="' + id.current + '"]:hover .' + id.current + '-t{animation-play-state:' + (pauseOnHover ? 'paused' : 'running') + '}'
    ),
    React.createElement(
      'div',
      {
        className: id.current + '-t',
        style: {
          display: 'flex',
          gap: '2rem',
          width: 'max-content',
          animation: run ? id.current + ' ' + speed + 's linear infinite' + (reverse ? ' reverse' : '') : 'none'
        }
      },
      track,
      track
    )
  );
};

/**
 * CountUp — a number that counts up when it comes into view.
 *
 * Renders the FINAL value when animation is off, hidden, or reduced. A statistic
 * stuck at 0 is worse than a statistic that never moved: it is wrong.
 */
var CountUp = function (props) {
  var to = Number(props && props.to) || 0;
  var duration = Math.min(6000, Math.max(200, Number(props && props.duration) || 1200));
  var decimals = Math.min(3, Math.max(0, Number(props && props.decimals) || 0));
  var prefix = (props && props.prefix) || '';
  var suffix = (props && props.suffix) || '';
  var className = (props && props.className) || undefined;

  var allowed = React.useRef(null);
  if (allowed.current === null) allowed.current = mockyMayAnimate();
  var ref = React.useRef(null);
  var st = React.useState(allowed.current ? 0 : to);
  var value = st[0], setValue = st[1];

  React.useEffect(function () {
    if (!allowed.current) return;
    var node = ref.current;
    if (!node) return;
    var started = false;
    var start = function () {
      if (started) return;
      started = true;
      var t0 = 0;
      var step = function (now) {
        if (!t0) t0 = now;
        var p = Math.min(1, (now - t0) / duration);
        /* easeOutCubic — fast first, settles on the number. */
        setValue(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) window.requestAnimationFrame(step);
        else setValue(to);
      };
      window.requestAnimationFrame(step);
    };
    if (typeof IntersectionObserver === 'undefined') { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { start(); io.disconnect(); return; }
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(node);
    return function () { io.disconnect(); };
  }, [to, duration]);

  return React.createElement(
    'span',
    { ref: ref, className: className },
    prefix + value.toFixed(decimals).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + suffix
  );
}`

export const ANIMATE_EXPORTS = ['Animated', 'Ticker', 'CountUp'] as const

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
  'slide-left',
  'slide-right',
  'blur-in',
  'hover-lift',
  'hover-glow',
  'parallax',
  'exit-slide',
] as const

export type AnimatePreset = (typeof ANIMATE_PRESETS)[number]
