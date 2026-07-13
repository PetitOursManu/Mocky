/**
 * cn() helper — a minimal stand-in for clsx + twMerge.
 * Accepts strings, objects, and arrays; merges into a single class string.
 * MIT-licensed, vendored from the MagicUI project (https://magicui.design).
 *
 * Exported as a STRING (source code) so it can be prepended to the generated
 * component code before Babel.transform.
 */
export const cnSource = `var cn = function() {
  var args = Array.prototype.slice.call(arguments);
  var classes = [];
  for (var i = 0; i < args.length; i++) {
    var input = args[i];
    if (!input) continue;
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      var inner = cn.apply(null, input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (var key in input) {
        if (input[key]) classes.push(key);
      }
    }
  }
  return classes.join(' ');
}`