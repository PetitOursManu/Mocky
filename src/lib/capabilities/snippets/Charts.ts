// Plain-JSX chart components — no external library, inline SVG + Tailwind only.
// Exported as STRING source for injection into the prelude.

export const CHARTS_EXPORTS = ['BarChart', 'LineChart', 'DonutChart', 'Sparkline', 'ProgressRing'] as const

export const ChartsSource = `// --- Charts (inline SVG, no dependencies) ---
var DEFAULT_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

// NOTE: the bar/line SVGs use viewBox 0 0 100 100 + preserveAspectRatio:none,
// which stretches the drawing to the (usually wide) container. That is fine for
// the bars/line themselves, but would turn dots into ovals and squash text. So
// markers and axis labels are rendered as NON-distorted HTML positioned in % —
// the SVG only ever holds shapes that survive stretching.
function BarChart(props) {
  var data = props.data || [];
  var colors = props.colors || DEFAULT_COLORS;
  var height = props.height || 200;
  var maxVal = Math.max.apply(null, data.map(function(d) { return d.value || 0; })) || 1;
  var n = Math.max(data.length, 1);
  var barW = 100 / n;
  return React.createElement('div', { className: 'w-full flex flex-col', style: { height: height + 'px', paddingLeft: '6px', paddingRight: '6px' } },
    React.createElement('div', { className: 'relative flex-1' },
      React.createElement('svg', { width: '100%', height: '100%', viewBox: '0 0 100 100', preserveAspectRatio: 'none', style: { position: 'absolute', inset: 0 } },
        data.map(function(d, i) {
          var h = ((d.value || 0) / maxVal) * 100;
          var color = d.color || colors[i % colors.length];
          return React.createElement('rect', { key: i, x: i * barW + barW * 0.15, y: 100 - h, width: barW * 0.7, height: h, fill: color, rx: 0.6, style: { transition: 'all 0.3s ease' } });
        })
      )
    ),
    React.createElement('div', { className: 'relative', style: { height: '18px', marginTop: '4px' } },
      data.map(function(d, i) {
        return React.createElement('span', { key: i, style: { position: 'absolute', left: (i * barW + barW / 2) + '%', transform: 'translateX(-50%)', fontSize: '11px', lineHeight: '16px', opacity: 0.6, color: 'currentColor', whiteSpace: 'nowrap' } }, d.label || '');
      })
    )
  );
};

function LineChart(props) {
  var data = props.data || [];
  var colors = props.colors || DEFAULT_COLORS;
  var height = props.height || 200;
  var stroke = colors[0] || '#4f46e5';
  var maxVal = Math.max.apply(null, data.map(function(d) { return d.value || 0; })) || 1;
  var minVal = Math.min.apply(null, data.map(function(d) { return d.value || 0; }));
  var range = maxVal - minVal || 1;
  var coords = data.map(function(d, i) {
    var x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
    var y = 95 - (((d.value || 0) - minVal) / range) * 90;
    return { x: x, y: y, label: d.label || '' };
  });
  var pts = coords.map(function(c) { return c.x + ',' + c.y; }).join(' ');
  return React.createElement('div', { className: 'w-full flex flex-col', style: { height: height + 'px', paddingLeft: '6px', paddingRight: '6px' } },
    React.createElement('div', { className: 'relative flex-1' },
      React.createElement('svg', { width: '100%', height: '100%', viewBox: '0 0 100 100', preserveAspectRatio: 'none', style: { position: 'absolute', inset: 0 } },
        React.createElement('polyline', { points: pts, fill: 'none', stroke: stroke, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' })
      ),
      coords.map(function(c, i) {
        return React.createElement('span', { key: i, style: { position: 'absolute', left: c.x + '%', top: c.y + '%', width: '8px', height: '8px', borderRadius: '50%', background: stroke, transform: 'translate(-50%, -50%)' } });
      })
    ),
    React.createElement('div', { className: 'relative', style: { height: '18px', marginTop: '4px' } },
      coords.map(function(c, i) {
        return React.createElement('span', { key: i, style: { position: 'absolute', left: c.x + '%', transform: 'translateX(-50%)', fontSize: '11px', lineHeight: '16px', opacity: 0.6, color: 'currentColor', whiteSpace: 'nowrap' } }, c.label);
      })
    )
  );
};

function DonutChart(props) {
  var data = props.data || [];
  var colors = props.colors || DEFAULT_COLORS;
  var size = props.size || 160;
  var thickness = props.thickness || 18;
  var total = data.reduce(function(s, d) { return s + (d.value || 0); }, 0) || 1;
  var radius = 50 - thickness / 4;
  var circ = 2 * Math.PI * radius;
  var offset = 25;
  var segments = [];
  var acc = 0;
  data.forEach(function(d, i) {
    var frac = (d.value || 0) / total;
    var len = frac * circ;
    var color = d.color || colors[i % colors.length];
    segments.push({ dash: len + ' ' + (circ - len), offset: offset - acc, color: color, label: d.label, value: d.value, frac: frac });
    acc += len;
  });
  return React.createElement('div', { className: 'flex items-center gap-4' },
    React.createElement('svg', { width: size, height: size, viewBox: '0 0 100 100', style: { transform: 'rotate(-90deg)' } },
      segments.map(function(s, i) {
        return React.createElement('circle', {
          key: i, cx: 50, cy: 50, r: radius, fill: 'none', stroke: s.color,
          strokeWidth: thickness / 2, strokeDasharray: s.dash, strokeDashoffset: s.offset
        });
      }),
      React.createElement('text', { x: 50, y: 50, textAnchor: 'middle', dominantBaseline: 'central', fontSize: '10', fill: 'currentColor', style: { transform: 'rotate(90deg)', transformOrigin: '50px 50px' } }, total)
    ),
    React.createElement('div', { className: 'flex flex-col gap-1 text-xs' },
      data.map(function(d, i) {
        var color = d.color || colors[i % colors.length];
        return React.createElement('div', { key: i, className: 'flex items-center gap-2' },
          React.createElement('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' } }),
          React.createElement('span', null, d.label),
          React.createElement('span', { style: { opacity: 0.5 } }, Math.round((d.value / total) * 100) + '%')
        );
      })
    )
  );
};

function Sparkline(props) {
  var data = props.data || [];
  var colors = props.colors || DEFAULT_COLORS;
  var height = props.height || 40;
  var width = props.width || 120;
  var stroke = colors[0] || '#4f46e5';
  if (data.length < 2) return React.createElement('div', { style: { height: height + 'px', width: width + 'px' } });
  var max = Math.max.apply(null, data);
  var min = Math.min.apply(null, data);
  var range = max - min || 1;
  var pts = data.map(function(v, i) {
    var x = (i / (data.length - 1)) * 100;
    var y = 95 - ((v - min) / range) * 85;
    return x + ',' + y;
  }).join(' ');
  return React.createElement('svg', { width: width, height: height, viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
    React.createElement('polyline', { points: pts, fill: 'none', stroke: stroke, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' })
  );
};

function ProgressRing(props) {
  var value = props.value || 0;
  var colors = props.colors || DEFAULT_COLORS;
  var size = props.size || 120;
  var thickness = props.thickness || 8;
  var stroke = colors[0] || '#4f46e5';
  var radius = 50 - thickness / 4;
  var circ = 2 * Math.PI * radius;
  var dash = (value / 100) * circ;
  return React.createElement('div', { className: 'relative inline-flex items-center justify-center', style: { width: size, height: size } },
    React.createElement('svg', { width: size, height: size, viewBox: '0 0 100 100', style: { transform: 'rotate(-90deg)' } },
      React.createElement('circle', { cx: 50, cy: 50, r: radius, fill: 'none', stroke: 'currentColor', strokeWidth: thickness / 2, opacity: 0.1 }),
      React.createElement('circle', { cx: 50, cy: 50, r: radius, fill: 'none', stroke: stroke, strokeWidth: thickness / 2, strokeDasharray: dash + ' ' + (circ - dash), strokeLinecap: 'round', style: { transition: 'stroke-dasharray 0.5s ease' } })
    ),
    React.createElement('span', { className: 'absolute text-lg font-bold' }, Math.round(value) + '%')
  );
};`