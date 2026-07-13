// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.

export const BORDER_BEAM_EXPORTS = ['BorderBeam'] as const
export const BorderBeamSource = `function BorderBeam(props) {
  var size = props.size || 200;
  var duration = props.duration || 15;
  var borderWidth = props.borderWidth || 1.5;
  var colorFrom = props.colorFrom || '#ff0028';
  var colorTo = props.colorTo || '#ffaa00';
  var delay = props.delay || 0;
  var className = props.className;
  return React.createElement('div', {
    style: {
      '--size': size + 'px',
      '--duration': duration + 's',
      '--color-from': colorFrom,
      '--color-to': colorTo,
      '--border-width': borderWidth + 'px',
      animationDelay: delay + 's',
    },
    className: cn('pointer-events-none absolute inset-0 rounded-[inherit]', className),
    dangerouslySetInnerHTML: { __html: '<div style="position:absolute;inset:0;aspect-ratio:1;border-radius:inherit;padding:calc(var(--border-width));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:border-beam var(--duration) linear infinite;background:conic-gradient(from 90deg,var(--color-from),var(--color-to),var(--color-from))"></div>' },
  });
}`