// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.
// Uses React hooks as globals.

export const TextRevealSource = `var TextReveal = function(props) {
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
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        var i = 0;
        var interval = setInterval(function() {
          if (i <= words.length) {
            setVisibleCount(i);
            i++;
          } else {
            clearInterval(interval);
          }
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
        style: {
          opacity: i < visibleCount ? 1 : 0.2,
          transition: 'opacity 0.3s ease',
          marginRight: '0.3em',
        },
      }, word);
    })
  );
}`