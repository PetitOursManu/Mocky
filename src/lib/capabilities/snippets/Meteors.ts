// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.

export const MeteorsSource = `var Meteors = function(props) {
  var number = props.number || 20;
  var className = props.className;
  return React.createElement('div', {
    className: cn('pointer-events-none absolute inset-0 overflow-hidden', className),
  },
  Array.from({ length: number }).map(function(_, idx) {
    return React.createElement('span', {
      key: idx,
      style: {
        animationDelay: (idx * 0.3) + 's',
        animationDuration: (Math.random() * 5 + 5) + 's',
      },
      className: 'absolute left-1/2 top-0 h-0.5 w-0.5 rounded-full bg-white',
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '1px',
        height: '50px',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)',
        transform: 'rotate(215deg)',
        transformOrigin: 'top',
      },
    }));
  }));
}`