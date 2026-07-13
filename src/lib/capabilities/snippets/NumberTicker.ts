// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.
// Uses React hooks (useState, useEffect, useRef) as globals.

export const NUMBER_TICKER_EXPORTS = ['NumberTicker'] as const
export const NumberTickerSource = `function NumberTicker(props) {
  var value = props.value;
  var direction = props.direction || 'up';
  var delay = props.delay || 0;
  var className = props.className;
  var ref = useRef(null);
  var displayValue = useState(0)[0];
  var setDisplayValue = useState(0)[1];

  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        var duration = 2000;
        var start = direction === 'down' ? value : 0;
        var end = direction === 'down' ? 0 : value;
        var startTime = performance.now() + delay;
        function animate(now) {
          var elapsed = Math.max(0, now - startTime);
          var progress = Math.min(elapsed / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.floor(start + (end - start) * eased));
          if (progress < 1) requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, [value, direction, delay]);

  return React.createElement('span', { ref: ref, className: className }, displayValue.toLocaleString());
}`