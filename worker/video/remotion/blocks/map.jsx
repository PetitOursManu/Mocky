/**
 * `map` - a world, drawn as a field of dots.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: the field is `palette.accent` quietened by opacity, the links are the same accent quieter still, and the markers are `palette.accent` at full strength.
 *
 * LEGIBILITY: The dots are decoration and carry no text, so nothing sits on them. If a finished version ever puts a label on a marker, that label is on the GROUND and takes `palette.body` - never on the dot. The opacities below are the accent run the palette resolved with the veil LOCKED, so lowering one can only make the field quieter than what was measured, never louder than what was allowed.
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** A hex
 *      value in this file is a colour nobody measured; a curve is a sixth notion
 *      of how things move. Both arrive as props, out of `composition.js`, where
 *      a test can reach them.
 *   2. **No `remotion` import, ever.** Nothing here needs a frame hook - the
 *      frame arrives as `progress` and `life` - and staying free of it is what
 *      lets `blocks.test.js` load the whole registry inside Mocky's own suite,
 *      where Remotion is not installed.
 *
 * -- What this map is, stated rather than implied -----------------------------
 *
 * This container has no egress and no map asset, so whatever it draws has to fit
 * in a source file. What fits is a coarse LAND MASK - `LAND_ROWS`, a plate carrée
 * grid at 5.6 degrees per column, where a cell is land when its centre falls on
 * land - and the resolution is the honest part rather than a limitation somebody
 * will improve. It is far too coarse to draw a border, a coastline or a disputed
 * line, so it draws none: no frontiers, no names, no island smaller than a dot,
 * and nothing identifiable below the scale of a continent. Antarctica is outside
 * the window, because on this projection a pole is a solid band across the bottom
 * of the frame that says nothing.
 *
 * A pretend map with invented borders would have been the same amount of code and
 * a claim nobody could check. A silhouette at continental scale is a claim small
 * enough to be true.
 *
 * `region` is a CROP of that one mask and never a second drawing, which is what
 * keeps `europe` and `world` from disagreeing about where a coast is. Marker
 * positions are the composition's, out of `markerCells`: a latitude in a document
 * would be a coordinate under another name, which is the line this whole feature
 * is drawn on.
 */

import {
  arcControl,
  bezierPoint,
  columnGlow,
  linkPulse,
  mapCells,
  mapExtent,
  markerCells,
  markerPulse,
} from './dataFigures.js'

/** Everything below is in CELL units: the viewBox is the crop itself, so one unit is one dot's cell. */
const DOT = 0.3
const MARKER = 0.58

// Not called `Map`: that name shadows the global constructor for the whole
// module, and the day somebody reaches for `new Map()` in here to index the
// markers, they get this component instead and a TypeError three lines later.
export const WorldMap = ({ block, palette, base, progress, life }) => {
  const { columns, rows } = mapExtent(block.region)
  const cells = mapCells(block.region)
  const markers = markerCells(cells, block.markers)
  const links = block.connections ? markers.slice(1).map((to, i) => ({ from: markers[i], to })) : []
  const hairline = Math.max(1, Math.round(base * 0.0022))

  // Grouped by column so the sweep is one opacity for twenty dots instead of six
  // hundred recomputed per frame — `columnGlow` states the cost this avoids, and
  // a meridian is what a column of the field reads as anyway.
  const field = Array.from({ length: columns }, () => [])
  for (const cell of cells) field[cell.x - 0.5].push(cell)

  return (
    <svg
      viewBox={`0 0 ${columns} ${rows}`}
      // `meet`, unlike every other SVG in this directory: this one holds circles,
      // and a circle in a stretched viewBox is an ellipse. The field is centred in
      // whatever box the layout gave it rather than distorted to fill it.
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: Math.round(base * 0.42), display: 'block', opacity: progress }}
    >
      {field.map((column, i) =>
        // A column of open ocean is a group with nothing in it, and there are
        // fourteen of them in a world crop: an empty node per frame per empty
        // meridian is a cost paid inside a render budget scaled on duration.
        column.length === 0 ? null : (
          <g key={i} opacity={columnGlow(i, columns, life)}>
            {column.map((cell) => (
              <circle key={`${cell.col}.${cell.row}`} cx={cell.x} cy={cell.y} r={DOT} fill={palette.accent.color} />
            ))}
          </g>
        ),
      )}

      {links.map(({ from, to }, i) => {
        const control = arcControl(from, to)
        const pulse = linkPulse(life, i)
        const travelling = bezierPoint(from, control, to, pulse)
        return (
          <g key={`${from.col}.${from.row}-${to.col}.${to.row}`}>
            <path
              d={`M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`}
              fill="none"
              stroke={palette.accent.color}
              strokeWidth={hairline}
              vectorEffect="non-scaling-stroke"
              opacity={0.4}
            />
            {/* A link is a line between two places and it holds perfectly still.
                The pulse crossing it is what makes the connection read as one
                rather than as a stray arc - and it is the only thing in this block
                that moves when the sweep is on the far side of the field. */}
            <circle cx={travelling.x} cy={travelling.y} r={DOT * 0.8} fill={palette.accent.color} opacity={0.85} />
          </g>
        )
      })}

      {markers.map((marker, i) => {
        const pulse = markerPulse(life, i)
        return (
          <g key={`${marker.col}.${marker.row}`}>
            <circle
              cx={marker.x}
              cy={marker.y}
              // The halo grows and brightens together, which reads as a beacon.
              // Growing while it dims reads as a ripple, and a ripple on eight
              // markers at once is a status board.
              r={MARKER * (1 + 1.1 * pulse)}
              fill="none"
              stroke={palette.accent.color}
              strokeWidth={hairline}
              vectorEffect="non-scaling-stroke"
              opacity={0.5 * pulse}
            />
            <circle cx={marker.x} cy={marker.y} r={MARKER * (0.85 + 0.15 * pulse)} fill={palette.accent.color} />
          </g>
        )
      })}
    </svg>
  )
}
