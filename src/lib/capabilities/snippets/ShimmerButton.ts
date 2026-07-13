// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.

export const SHIMMER_BUTTON_EXPORTS = ['ShimmerButton'] as const
export const ShimmerButtonSource = `function ShimmerButton(props) {
  var shimmerColor = props.shimmerColor || '#ffffff';
  var shimmerDuration = props.shimmerDuration || '3s';
  var borderRadius = props.borderRadius || '100px';
  var background = props.background || 'rgba(0, 0, 0, 1)';
  var className = props.className;
  var children = props.children;
  return React.createElement('button', {
    style: {
      '--shimmer-color': shimmerColor,
      '--speed': shimmerDuration,
      '--radius': borderRadius,
      background: background,
    },
    className: cn('relative inline-flex h-14 w-40 overflow-hidden rounded-full p-[1px] transition-all hover:shadow-2xl text-white', className),
  },
  React.createElement('div', {
    className: 'absolute inset-0 overflow-visible rounded-full',
    dangerouslySetInnerHTML: { __html: '<div style="position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle_at_center,var(--shimmer-color)_0%,transparent_65%);mask:linear-gradient(white,transparent_50%);animation:shimmer var(--speed)_infinite"></div>' },
  }),
  React.createElement('div', {
    className: 'flex w-full items-center justify-center rounded-full bg-black/90 px-4 text-sm font-medium backdrop-blur-xl',
    style: { borderRadius: borderRadius },
  }, children));
}`