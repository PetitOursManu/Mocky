// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Plain JSX, no TypeScript, no imports — uses the `motion` global from framer-motion.
// Exported as a STRING (source code) for injection into the prelude.

export const MARQUEE_EXPORTS = ['Marquee'] as const
export const MarqueeSource = `function Marquee(props) {
  var children = props.children;
  var reverse = props.reverse || false;
  var pauseOnHover = props.pauseOnHover || false;
  var repeat = props.repeat || 4;
  var className = props.className;
  var style = Object.assign({}, { '--duration': '40s', '--gap': '1rem' }, props.style || {});
  return React.createElement('div', {
    className: cn('group flex overflow-hidden p-2', className),
    style: style,
  }, Array.from({ length: repeat }).map(function(_, i) {
    return React.createElement('div', {
      key: i,
      className: 'flex shrink-0 justify-around',
      style: {
        animation: 'marquee var(--duration) linear infinite',
        animationDirection: reverse ? 'reverse' : 'normal',
        gap: 'var(--gap)',
      },
      onMouseEnter: pauseOnHover ? function(e) { e.currentTarget.style.animationPlayState = 'paused' } : undefined,
      onMouseLeave: pauseOnHover ? function(e) { e.currentTarget.style.animationPlayState = 'running' } : undefined,
    }, children);
  }));
}`