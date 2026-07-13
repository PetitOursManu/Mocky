// Motion snippet-pack — CSS-only animations, zero dependencies.
// Uses IntersectionObserver + CSS transitions + requestAnimationFrame.
// No framer-motion, no CDN. Respects prefers-reduced-motion.

export const MOTION_EXPORTS = ['FadeIn', 'Stagger', 'Marquee', 'Counter', 'Shimmer', 'Reveal'] as const

export const MotionSource = `// --- Motion (CSS-only, no framer-motion) ---
var _motionStyleInjected = false;
function _injectMotionStyles() {
  if (_motionStyleInjected) return;
  _motionStyleInjected = true;
  var style = document.createElement('style');
  style.textContent = '@keyframes _marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes _marqueeReverse{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}@keyframes _shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}';
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
  var [hovering, setHovering] = useState(false);
  useEffect(function() { _injectMotionStyles(); }, []);
  var animName = reverse ? '_marqueeReverse' : '_marquee';
  var trackStyle = { display: 'flex', width: 'max-content', animation: animName + ' ' + speed + 's linear infinite', animationPlayState: hovering ? 'paused' : 'running' };
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

function Shimmer(props) {
  var children = props.children;
  useEffect(function() { _injectMotionStyles(); }, []);
  var style = {
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
    backgroundSize: '200% 100%',
    animation: _prefersReducedMotion ? 'none' : '_shimmer 2s linear infinite',
    display: 'inline-block',
    borderRadius: 'inherit',
    padding: 'inherit',
    position: 'relative'
  };
  return React.createElement('span', { style: style, className: props.className }, children);
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
      if (entries[0].isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, []);
  var transforms = {
    up: 'translateY(30px)',
    left: 'translateX(-30px)',
    right: 'translateX(30px)',
    down: 'translateY(-30px)'
  };
  var style = {
    opacity: visible[0] ? 1 : 0,
    transform: visible[0] ? 'none' : (transforms[direction] || transforms.up),
    transition: 'opacity 0.6s ease, transform 0.6s ease'
  };
  return React.createElement('div', { ref: ref, style: style }, children);
}`