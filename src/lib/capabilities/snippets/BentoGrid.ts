// Vendored and rewritten from MagicUI (https://magicui.design) — MIT License.
// Exported as a STRING (source code) for injection into the prelude.

export const BentoGridSource = `var BentoGrid = function(props) {
  var children = props.children;
  var className = props.className;
  return React.createElement('div', {
    className: cn('grid w-full auto-rows-[22rem] grid-cols-3 gap-4', className),
  }, children);
}

var BentoCard = function(props) {
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
}`