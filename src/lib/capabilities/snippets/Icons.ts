// Plain-JSX icon components — no external library, inline SVG only.
// Each icon is a small component accepting { className, size, ...props }.
// Exposed under a namespace: Icon.Home, Icon.Search, etc.

export const ICONS_EXPORTS = ['Icon'] as const

export const IconsSource = `var Icon = {};

Icon.Home = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
    React.createElement('polyline', { points: '9 22 9 12 15 12 15 22' })
  );
};

Icon.Search = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('circle', { cx: 11, cy: 11, r: 8 }),
    React.createElement('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
  );
};

Icon.Bell = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' }),
    React.createElement('path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' })
  );
};

Icon.User = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
    React.createElement('circle', { cx: 12, cy: 7, r: 4 })
  );
};

Icon.Settings = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
    React.createElement('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })
  );
};

Icon.ChevronRight = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '9 18 15 12 9 6' })
  );
};

Icon.ChevronDown = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '6 9 12 15 18 9' })
  );
};

Icon.Plus = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
    React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
  );
};

Icon.X = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
    React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
  );
};

Icon.Check = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '20 6 9 17 4 12' })
  );
};

Icon.Trash = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '3 6 5 6 21 6' }),
    React.createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
  );
};

Icon.Edit = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
    React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
  );
};

Icon.Download = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    React.createElement('polyline', { points: '7 10 12 15 17 10' }),
    React.createElement('line', { x1: 12, y1: 15, x2: 12, y2: 3 })
  );
};

Icon.Upload = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    React.createElement('polyline', { points: '17 8 12 3 7 8' }),
    React.createElement('line', { x1: 12, y1: 3, x2: 12, y2: 15 })
  );
};

Icon.Calendar = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
    React.createElement('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
    React.createElement('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
    React.createElement('line', { x1: 3, y1: 10, x2: 21, y2: 10 })
  );
};

Icon.Clock = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
    React.createElement('polyline', { points: '12 6 12 12 16 14' })
  );
};

Icon.Mail = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' }),
    React.createElement('polyline', { points: '22,6 12,13 2,6' })
  );
};

Icon.Filter = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polygon', { points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' })
  );
};

Icon.Menu = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 3, y1: 12, x2: 21, y2: 12 }),
    React.createElement('line', { x1: 3, y1: 6, x2: 21, y2: 6 }),
    React.createElement('line', { x1: 3, y1: 18, x2: 21, y2: 18 })
  );
};

Icon.ArrowUp = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 5 }),
    React.createElement('polyline', { points: '5 12 12 5 19 12' })
  );
};

Icon.ArrowDown = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
    React.createElement('polyline', { points: '19 12 12 19 5 12' })
  );
};

Icon.TrendingUp = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '23 6 13.5 15.5 8.5 10.5 1 18' }),
    React.createElement('polyline', { points: '17 6 23 6 23 12' })
  );
};

Icon.TrendingDown = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '23 18 13.5 8.5 8.5 13.5 1 6' }),
    React.createElement('polyline', { points: '17 18 23 18 23 12' })
  );
};

Icon.DollarSign = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 12, y1: 1, x2: 12, y2: 23 }),
    React.createElement('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })
  );
};

Icon.ChevronLeft = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polyline', { points: '15 18 9 12 15 6' })
  );
};

Icon.MoreHorizontal = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('circle', { cx: 12, cy: 12, r: 1 }),
    React.createElement('circle', { cx: 19, cy: 12, r: 1 }),
    React.createElement('circle', { cx: 5, cy: 12, r: 1 })
  );
};

Icon.Eye = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3 })
  );
};

Icon.EyeOff = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }),
    React.createElement('line', { x1: 1, y1: 1, x2: 23, y2: 23 })
  );
};

Icon.Lock = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }),
    React.createElement('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' })
  );
};

Icon.Heart = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' })
  );
};

Icon.Star = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
  );
};

Icon.ArrowRight = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 }),
    React.createElement('polyline', { points: '12 5 19 12 12 19' })
  );
};

Icon.ArrowLeft = function(props) {
  var p = props || {};
  return React.createElement('svg', Object.assign({ xmlns: 'http://www.w3.org/2000/svg', width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, p),
    React.createElement('line', { x1: 19, y1: 12, x2: 5, y2: 12 }),
    React.createElement('polyline', { points: '12 19 5 12 12 5' })
  );
};`