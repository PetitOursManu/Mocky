// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.

export const AnimatedBeamSource = `var AnimatedBeam = function(props) {
  var className = props.className;
  return React.createElement('svg', {
    width: '100%',
    height: '100%',
    viewBox: '0 0 100 100',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className: cn('h-full w-full', className),
  },
  React.createElement('path', {
    d: 'M 10 50 Q 50 10 90 50',
    stroke: '#3b82f6',
    strokeWidth: '2',
    strokeDasharray: '4 4',
    fill: 'none',
  }),
  React.createElement('circle', { r: '3', fill: '#3b82f6' },
    React.createElement('animateMotion', { dur: '2s', repeatCount: 'indefinite', path: 'M 10 50 Q 50 10 90 50' })
  ));
}`