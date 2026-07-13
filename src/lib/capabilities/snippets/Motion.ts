// Motion snippet-pack — CSS-only animations, zero dependencies.
// Uses IntersectionObserver + CSS transitions + requestAnimationFrame.
// No framer-motion, no CDN. Respects prefers-reduced-motion.
// Merged with former magicui components (BentoGrid, BorderBeam, etc.).

export const MOTION_EXPORTS = [
  'FadeIn', 'Stagger', 'Marquee', 'Counter', 'Reveal',
  'ShimmerButton', 'BentoGrid', 'BentoCard', 'BorderBeam',
  'TextReveal', 'Meteors', 'AnimatedBeam',
] as const

export const MotionSource = `// --- Motion (CSS-only, no framer-motion) ---
// Merged: motion + magicui animation components.
var _motionStyleInjected = false;
function _injectMotionStyles() {
  if (_motionStyleInjected) return;
  _motionStyleInjected = true;
  var style = document.createElement('style');
  style.textContent = '@keyframes _marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes _marqueeReverse{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}@keyframes _shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes _borderBeam{0%,100%{offset-distance:0%}50%{offset-distance:100%}}';
  document.head.appendChild(style);
}
var _prefersReducedMotion = false;
try { _prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) {}

function FadeIn(props) {
  var delay = props.delay || 0;
  var y = props.y != null ? props.y : 16;
  var children = props.children;
  var ref = useRef(null);
  var visible = useState(false);
  var setVisible = visible[1];
  useEffect(function() {
    _injectMotionStyles();
    var el = ref.current;
    if (!el) return;
    if (_prefersReducedMotion) { setVisible(true); return; }
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        setTimeout(function() { setVisible(true); }, delay);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, [delay]);
  var style = { opacity: visible[0] ? 1 : 0, transform: visible[0] ? 'translateY(0)' : ('translateY(' + y + 'px)'), transition: 'opacity 0.6s ease, transform 0.6s ease' };
  return React.createElement('div', { ref: ref, style: style }, children);
}

function Stagger(props) {
  var delay = props.delay || 80;
  var children = props.children;
  var ref = useRef(null);
  var started = useState(false);
  var setStarted = started[1];
  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    if (_prefersReducedMotion) { setStarted(true); return; }
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) { setStarted(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, []);
  var items = Array.isArray(children) ? children : [children];
  return React.createElement('div', { ref: ref },
    items.map(function(child, i) {
      var childDelay = started[0] ? (i * delay) : 0;
      var childStyle = { opacity: started[0] ? 1 : 0, transform: started[0] ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.5s ease, transform 0.5s ease', transitionDelay: childDelay + 'ms' };
      return React.createElement('div', { key: i, style: childStyle }, child);
    })
  );
}

function Marquee(props) {
  var pauseOnHover = props.pauseOnHover || false;
  var reverse = props.reverse || false;
  var speed = props.speed || 20;
  var children = props.children;
  var ref = useRef(null);
  var hovering = useState(false);
  var setHovering = hovering[1];
  useEffect(function() { _injectMotionStyles(); }, []);
  var animName = reverse ? '_marqueeReverse' : '_marquee';
  var trackStyle = { display: 'flex', width: 'max-content', animation: animName + ' ' + speed + 's linear infinite', animationPlayState: hovering[0] ? 'paused' : 'running' };
  if (_prefersReducedMotion) { trackStyle.animation = 'none'; }
  return React.createElement('div', {
    ref: ref,
    style: { overflow: 'hidden', width: '100%' },
    onMouseEnter: function() { if (pauseOnHover) setHovering(true); },
    onMouseLeave: function() { if (pauseOnHover) setHovering(false); }
  },
    React.createElement('div', { style: trackStyle },
      React.createElement('div', { style: { display: 'flex', flexShrink: 0 } }, children),
      React.createElement('div', { style: { display: 'flex', flexShrink: 0 } }, children)
    )
  );
}

function Counter(props) {
  var to = props.to || 100;
  var duration = props.duration || 1200;
  var prefix = props.prefix || '';
  var suffix = props.suffix || '';
  var ref = useRef(null);
  var val = useState(0);
  var setVal = val[1];
  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    if (_prefersReducedMotion) { setVal(to); return; }
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        var startTime = performance.now();
        function tick(now) {
          var progress = Math.min((now - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          setVal(Math.floor(to * eased));
          if (progress < 1) requestAnimationFrame(tick);
          else setVal(to);
        }
        requestAnimationFrame(tick);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, [to, duration]);
  return React.createElement('span', { ref: ref }, prefix + val[0].toLocaleString() + suffix);
}

function Reveal(props) {
  var direction = props.direction || 'up';
  var children = props.children;
  var ref = useRef(null);
  var visible = useState(false);
  var setVisible = visible[1];
  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    if (_prefersReducedMotion) { setVisible(true); return; }
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.15 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, []);
  var transforms = { up: 'translateY(30px)', left: 'translateX(-30px)', right: 'translateX(30px)', down: 'translateY(-30px)' };
  var style = { opacity: visible[0] ? 1 : 0, transform: visible[0] ? 'none' : (transforms[direction] || transforms.up), transition: 'opacity 0.6s ease, transform 0.6s ease' };
  return React.createElement('div', { ref: ref, style: style }, children);
}

function ShimmerButton(props) {
  var shimmerColor = props.shimmerColor || '#ffffff';
  var shimmerDuration = props.shimmerDuration || '3s';
  var borderRadius = props.borderRadius || '100px';
  var background = props.background || 'rgba(0, 0, 0, 1)';
  var className = props.className;
  var children = props.children;
  useEffect(function() { _injectMotionStyles(); }, []);
  return React.createElement('button', {
    style: { '--shimmer-color': shimmerColor, '--speed': shimmerDuration, '--radius': borderRadius, background: background },
    className: cn('relative inline-flex h-14 w-40 overflow-hidden rounded-full p-[1px] transition-all hover:shadow-2xl text-white', className),
  },
  React.createElement('div', {
    className: 'absolute inset-0 overflow-visible rounded-full',
    dangerouslySetInnerHTML: { __html: '<div style="position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle_at_center,var(--shimmer-color)_0%,transparent_65%);mask:linear-gradient(white,transparent_50%);animation:_shimmer var(--speed)_infinite"></div>' },
  }),
  React.createElement('div', {
    className: 'flex w-full items-center justify-center rounded-full bg-black/90 px-4 text-sm font-medium backdrop-blur-xl',
    style: { borderRadius: borderRadius },
  }, children));
}

function BentoGrid(props) {
  var children = props.children;
  var className = props.className;
  return React.createElement('div', {
    className: cn('grid w-full auto-rows-[22rem] grid-cols-3 gap-4', className),
  }, children);
}

function BentoCard(props) {
  var name = props.name;
  var description = props.description;
  var href = props.href;
  var cta = props.cta;
  var className = props.className;
  var children = props.children;
  return React.createElement('div', {
    className: cn('group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-4 shadow-xl lg:col-span-2', className),
  },
  React.createElement('div', { className: 'flex flex-1 flex-col space-y-4' }, children),
  React.createElement('div', { className: 'flex items-center justify-between' },
    React.createElement('div', null,
      React.createElement('h3', { className: 'text-lg font-semibold text-black' }, name),
      React.createElement('p', { className: 'text-sm text-gray-500' }, description)
    ),
    React.createElement('a', { href: href || '#', className: 'text-sm font-medium text-blue-600 hover:underline' }, cta || 'View')
  ));
}

function BorderBeam(props) {
  var size = props.size || 200;
  var duration = props.duration || 15;
  var borderWidth = props.borderWidth || 1.5;
  var colorFrom = props.colorFrom || '#ff0028';
  var colorTo = props.colorTo || '#ffaa00';
  var delay = props.delay || 0;
  var className = props.className;
  return React.createElement('div', {
    style: { '--size': size + 'px', '--duration': duration + 's', '--color-from': colorFrom, '--color-to': colorTo, '--border-width': borderWidth + 'px', animationDelay: delay + 's' },
    className: cn('pointer-events-none absolute inset-0 rounded-[inherit]', className),
    dangerouslySetInnerHTML: { __html: '<div style="position:absolute;inset:0;aspect-ratio:1;border-radius:inherit;padding:calc(var(--border-width));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:_borderBeam var(--duration) linear infinite;background:conic-gradient(from 90deg,var(--color-from),var(--color-to),var(--color-from))"></div>' },
  });
}

function TextReveal(props) {
  var text = props.text;
  var className = props.className;
  var words = text.split(' ');
  var state = useState(0);
  var visibleCount = state[0];
  var setVisibleCount = state[1];
  var ref = useRef(null);
  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    if (_prefersReducedMotion) { setVisibleCount(words.length); return; }
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        var i = 0;
        var interval = setInterval(function() {
          if (i <= words.length) { setVisibleCount(i); i++; }
          else { clearInterval(interval); }
        }, 100);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, [words.length]);
  return React.createElement('div', { ref: ref, className: cn('text-2xl font-bold', className) },
    words.map(function(word, i) {
      return React.createElement('span', {
        key: i,
        style: { opacity: i < visibleCount ? 1 : 0.2, transition: 'opacity 0.3s ease', marginRight: '0.3em' },
      }, word);
    })
  );
}

function Meteors(props) {
  var number = props.number || 20;
  var className = props.className;
  return React.createElement('div', {
    className: cn('pointer-events-none absolute inset-0 overflow-hidden', className),
  },
  Array.from({ length: number }).map(function(_, idx) {
    return React.createElement('span', {
      key: idx,
      style: { animationDelay: (idx * 0.3) + 's', animationDuration: (Math.random() * 5 + 5) + 's' },
      className: 'absolute left-1/2 top-0 h-0.5 w-0.5 rounded-full bg-white',
    },
    React.createElement('div', {
      style: { position: 'absolute', top: '0', left: '0', width: '1px', height: '50px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)', transform: 'rotate(215deg)', transformOrigin: 'top' },
    }));
  }));
}

function AnimatedBeam(props) {
  var className = props.className;
  return React.createElement('svg', {
    width: '100%', height: '100%', viewBox: '0 0 100 100', fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className: cn('h-full w-full', className),
  },
  React.createElement('path', { d: 'M 10 50 Q 50 10 90 50', stroke: '#3b82f6', strokeWidth: '2', strokeDasharray: '4 4', fill: 'none' }),
  React.createElement('circle', { r: '3', fill: '#3b82f6' },
    React.createElement('animateMotion', { dur: '2s', repeatCount: 'indefinite', path: 'M 10 50 Q 50 10 90 50' })
  ));
}`