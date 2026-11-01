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
  /* Depth without WebGL: the element turns towards the pointer inside its own
     perspective. It costs no rendering context — which is the whole reason it
     sits here beside the flat presets rather than in the 3D capability, where
     every scene is rationed. */
  'tilt-3d': { tilt: 9 },
  'exit-slide': {
    variants: {
      hidden: { opacity: 0, x: -24 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 24, transition: { duration: 0.2 } }
    },
    exit: true,
    css: { from: 'opacity:0;transform:translateX(-24px)', to: 'opacity:1;transform:none', ms: 360 }
  },
  /* A long, slow rise: the entrance of a hero headline or a large picture,
     where fade-up's 16 px would not be seen. */
  'rise': {
    variants: { hidden: { opacity: 0, y: 48 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } },
    css: { from: 'opacity:0;transform:translateY(48px)', to: 'opacity:1;transform:none', ms: 700 }
  },
  'slide-down': {
    variants: { hidden: { opacity: 0, y: -24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } },
    css: { from: 'opacity:0;transform:translateY(-24px)', to: 'opacity:1;transform:none', ms: 450 }
  },
  /* A picture that settles: it arrives slightly too close and steps back. */
  'zoom-out': {
    variants: { hidden: { opacity: 0, scale: 1.12 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } },
    css: { from: 'opacity:0;transform:scale(1.12)', to: 'opacity:1;transform:none', ms: 800 }
  },
  'flip-up': {
    variants: { hidden: { opacity: 0, rotateX: 60, transformPerspective: 800 }, visible: { opacity: 1, rotateX: 0, transformPerspective: 800, transition: { duration: 0.6, ease: 'easeOut' } } },
    css: { from: 'opacity:0;transform:perspective(800px) rotateX(60deg)', to: 'opacity:1;transform:perspective(800px) rotateX(0deg)', ms: 600 }
  },
  'rotate-in': {
    variants: { hidden: { opacity: 0, rotate: -8, scale: 0.92 }, visible: { opacity: 1, rotate: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 20 } } },
    css: { from: 'opacity:0;transform:rotate(-8deg) scale(0.92)', to: 'opacity:1;transform:none', ms: 500 }
  },
  /* A spring with little damping: it overshoots and comes back. A badge, a
     sticker, a price — never a paragraph. */
  'bounce-in': {
    variants: { hidden: { opacity: 0, scale: 0.6 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 12 } } },
    css: { from: 'opacity:0;transform:scale(0.6)', to: 'opacity:1;transform:none', ms: 520, ease: 'cubic-bezier(0.34,1.56,0.64,1)' }
  },
  /* Curtains: the block is uncovered rather than moved, so nothing around it
     shifts and the text is never seen sliding. */
  'reveal-up': {
    variants: { hidden: { clipPath: 'inset(100% 0% 0% 0%)' }, visible: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } },
    css: { from: 'clip-path:inset(100% 0% 0% 0%)', to: 'clip-path:inset(0% 0% 0% 0%)', ms: 800 }
  },
  'wipe-right': {
    variants: { hidden: { clipPath: 'inset(0% 100% 0% 0%)' }, visible: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } },
    css: { from: 'clip-path:inset(0% 100% 0% 0%)', to: 'clip-path:inset(0% 0% 0% 0%)', ms: 800 }
  },
  'hover-scale': {
    whileHover: { scale: 1.04 },
    hover: true,
    hoverCss: { transform: 'scale(1.04)' }
  },
  /* The hand-placed look of a sticker that is picked up. */
  'hover-rotate': {
    whileHover: { rotate: -2, scale: 1.03 },
    hover: true,
    hoverCss: { transform: 'rotate(-2deg) scale(1.03)' }
  },
  /* Loops: CSS keyframes in both engines (there is nothing a variant adds to a
     movement that never ends), held at rest by everything that holds an
     entrance — and by a capture frame, where a loop caught mid-swing is a
     picture of an element in the wrong place. */
  'float': { loop: 'mocky-float 5s ease-in-out infinite' },
  'pulse': { loop: 'mocky-pulse 2.4s ease-in-out infinite' },
  'spin-slow': { loop: 'mocky-spin 24s linear infinite' },
  'wobble': { loop: 'mocky-wobble 3s ease-in-out infinite' }
};

var MOCKY_LOOP_CSS = '@keyframes mocky-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
  '@keyframes mocky-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}' +
  '@keyframes mocky-spin{to{transform:rotate(360deg)}}' +
  '@keyframes mocky-wobble{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}';
/* Once per document, at load: one stylesheet for every loop on the page. */
(function () {
  try {
    if (document.getElementById('mocky-loop-kf')) return;
    var st = document.createElement('style');
    st.id = 'mocky-loop-kf';
    st.textContent = MOCKY_LOOP_CSS;
    document.head.appendChild(st);
  } catch (e) {}
})();

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
  var usesCssReveal = animating && !!config && !config.hover && !config.parallax && !config.tilt && !config.loop && !(window.Motion && window.Motion.motion);

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

  /* Pointer-driven depth, and the same DOM path with or without Motion for
     parallax's reason: there is no variant to describe, only a transform that
     follows a cursor. The element returns to flat when the pointer leaves, so
     nothing is left rotated in a screenshot. */
  var tiltOn = animating && !!config && !!config.tilt;
  var tilt = React.useState(null);
  var tiltAt = tilt[0], setTilt = tilt[1];
  var onTiltMove = React.useCallback(function (e) {
    var node = ref.current;
    if (!node) return;
    var r = node.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var px = (e.clientX - r.left) / r.width - 0.5;
    var py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: px, y: py });
  }, []);
  var onTiltLeave = React.useCallback(function () { setTilt(null); }, []);

  /* An unknown preset is not an error: it is a plain element. */
  if (!animating) {
    return React.createElement(Tag, { ref: ref, className: className, style: props && props.style }, children);
  }

  if (config.tilt) {
    var deg = config.tilt;
    var tStyle = Object.assign({}, props && props.style);
    tStyle.transform = tiltAt
      ? 'perspective(900px) rotateX(' + (-tiltAt.y * deg).toFixed(2) + 'deg) rotateY(' + (tiltAt.x * deg).toFixed(2) + 'deg)'
      : 'perspective(900px)';
    tStyle.transition = tiltAt ? 'transform 60ms linear' : 'transform 260ms cubic-bezier(0.22,1,0.36,1)';
    tStyle.willChange = 'transform';
    return React.createElement(
      Tag,
      { ref: ref, className: className, style: tStyle, onPointerMove: onTiltMove, onPointerLeave: onTiltLeave },
      children,
    );
  }

  if (config.loop) {
    var lStyle = Object.assign({}, props && props.style);
    var still = false;
    try { still = !!window.__mockyStill; } catch (e) {}
    if (!still) lStyle.animation = config.loop + (delay ? ' ' + delay + 's' : '');
    return React.createElement(Tag, { ref: ref, className: className, style: lStyle }, children);
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
      /* clip-path → clipPath: React sets a style key as it is written. */
      if (kv.length === 2) style[kv[0].trim().replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = kv[1].trim();
    }
    /* Every property a preset moves: blur-in's filter jumped for want of one. */
    var ease = config.css.ease || 'ease-out';
    style.transition = ['opacity', 'transform', 'filter', 'clip-path'].map(function (prop) {
      return prop + ' ' + config.css.ms + 'ms ' + ease + ' ' + (delay * 1000) + 'ms';
    }).join(', ');
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
};

/**
 * AnimatedText — a line of text whose words (or letters) arrive one after another.
 *
 * Plain CSS transitions, no Motion: the pieces are inline-blocks with a delay
 * each, revealed together when the line scrolls into view. The whole string is
 * the element's accessible name and the pieces are hidden from screen readers,
 * so a reader hears a heading and not a list of words.
 *
 * When nothing may move it renders the string ALONE — the same markup a plain
 * heading would have — so a still, a PDF or "Sans animation" cannot tell it was
 * ever split.
 */
var MOCKY_ANIMATED_TEXT = {
  up: { from: { opacity: 0, transform: 'translateY(0.45em)' } },
  fade: { from: { opacity: 0 } },
  blur: { from: { opacity: 0, filter: 'blur(8px)' } },
  mask: { from: { transform: 'translateY(105%)' }, mask: true }
};
var mockyTextOf = function (children) {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children) && children.every(function (c) { return typeof c === 'string' || typeof c === 'number'; })) return children.join('');
  return null;
};
var AnimatedText = function (props) {
  var Tag = (props && props.as) || 'span';
  var className = (props && props.className) || undefined;
  var text = mockyTextOf(props ? props.children : null);
  var style = MOCKY_ANIMATED_TEXT[props && props.preset] || MOCKY_ANIMATED_TEXT.up;
  var letters = props && props.by === 'letter';
  var stagger = Math.min(0.3, Math.max(0.01, Number(props && props.stagger) || (letters ? 0.025 : 0.06)));
  var delay = Math.min(2, Math.max(0, Number(props && props.delay) || 0));

  var allowed = React.useRef(null);
  if (allowed.current === null) allowed.current = mockyMayAnimate() && !(typeof window !== 'undefined' && window.__mockyStill);
  var ref = React.useRef(null);
  var st = React.useState(false);
  var shown = st[0], setShown = st[1];
  var on = allowed.current === true && text !== null;
  React.useEffect(function () {
    if (!on) return;
    var node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { setShown(true); io.disconnect(); return; }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(node);
    return function () { io.disconnect(); };
  }, [on]);

  if (!on) return React.createElement(Tag, { className: className, style: props && props.style }, props ? props.children : null);

  var n = 0;
  var piece = function (str, key) {
    var i = n++;
    var s = { display: 'inline-block', transition: 'opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1), filter 600ms cubic-bezier(0.22,1,0.36,1)', transitionDelay: (delay + i * stagger).toFixed(3) + 's', willChange: 'transform' };
    if (!shown) Object.assign(s, style.from);
    return React.createElement('span', { key: key, style: s }, str);
  };
  var words = text.split(/(\\s+)/);
  var out = [];
  for (var w = 0; w < words.length; w++) {
    var word = words[w];
    if (!word) continue;
    if (/^\\s+$/.test(word)) { out.push(' '); continue; }
    /* A word never breaks across lines, letters or not: its pieces sit in a
       nowrap box, and a masked word in a box that clips it. */
    var inner = letters ? Array.from(word).map(function (ch, c) { return piece(ch, c); }) : [piece(word, 0)];
    out.push(React.createElement('span', { key: 'w' + w, style: { display: 'inline-block', whiteSpace: 'nowrap', overflow: style.mask ? 'hidden' : undefined, verticalAlign: 'top' } }, inner));
  }
  return React.createElement(
    Tag,
    { ref: ref, className: className, style: props && props.style, 'aria-label': text },
    React.createElement('span', { 'aria-hidden': true }, out)
  );
}`

export const ANIMATE_EXPORTS = ['Animated', 'Ticker', 'CountUp', 'AnimatedText'] as const

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
  'tilt-3d',
  'exit-slide',
  'rise',
  'slide-down',
  'zoom-out',
  'flip-up',
  'rotate-in',
  'bounce-in',
  'reveal-up',
  'wipe-right',
  'hover-scale',
  'hover-rotate',
  'float',
  'pulse',
  'spin-slow',
  'wobble',
] as const

/** The ways `<AnimatedText>` brings its words in — the snippet's `MOCKY_ANIMATED_TEXT`, restated for the same reason. */
export const ANIMATED_TEXT_PRESETS = ['up', 'fade', 'blur', 'mask'] as const

export type AnimatePreset = (typeof ANIMATE_PRESETS)[number]
