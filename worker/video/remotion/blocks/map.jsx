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
 *   box       **this block's own box**, in pixels, out of `composedLayout`. The
 *             field's size, its sampling and its dots all come off it.
 *   unit      the type unit this block's STACK solved. This block carries no
 *             text, so it reads none of it.
 *   base      the frame's SHORT edge. For the constant metrics named in
 *             `CONSTANT_METRICS`: here the links' hairline, and nothing else.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: the field is `palette.accent` quietened by opacity, the links are the same accent quieter still, and the markers are `palette.accent` at full strength.
 *
 * LEGIBILITY: "The dots carry no text, so nothing sits on them" was written here and it is only half true - a map is the block most likely to be anchored `full`, and a `full` block is painted UNDER the nine cells so that a heading can stand on it. In a cell nothing does. Anchored `full` under a stack, everything in the zones above sits on this field, and what makes that safe is outside this file: `stackedField` detects the pair and `composedPalette` measures each run over the map as a tint sampled along `FIELD_RAMP` - sampled, because a map is not one colour, its dots being at full strength and its links at a fraction. The density it cedes is `palette.field.alpha`, applied to the ZONE by `ComposedSceneVideo`, so nothing here has to know. What this file still owes: a label on a marker, if one is ever drawn, goes on the GROUND with `palette.body` and never on the dot. The opacities below are the accent run resolved with the veil LOCKED, so lowering one can only make the field quieter than what was measured, never louder than what was allowed.
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
 * in a source file. What fits is a LAND MASK - `LAND_ROWS`, a plate carree grid at
 * 2 degrees per column and 1.5 per row, where a cell is land when its centre falls
 * on land - and the resolution is the part that was WRONG rather than the part
 * that was honest. The first mask was 64 by 30, and at 5.6 degrees per column
 * `europe` cropped fourteen columns by nine rows out of it: that is not a coarse
 * Europe, it is a cloud of nine dots, and `asia` and `africa` were the same. Only
 * `world` survived it. A map that does not resemble the territory is worse than no
 * map, so the mask now holds the smallest window's worth of detail and the four
 * sub-regions stay in the schema. `dataFigures.js` states what that costs in bytes
 * and what it deliberately does not cost in dots.
 *
 * What it refuses to draw is unchanged, and the refusal is the honest part: no
 * border, no name, no disputed line, no island smaller than a dot, and nothing
 * identifiable below the scale of a country's outline. Antarctica is outside the
 * window, because on this projection a pole is a solid band across the bottom of
 * the frame that says nothing.
 *
 * A pretend map with invented borders would have been the same amount of code and
 * a claim nobody could check. A silhouette at this scale is a claim small enough
 * to be true.
 *
 * `region` is a CROP of that one mask and never a second drawing, which is what
 * keeps `europe` and `world` from disagreeing about where a coast is. Marker
 * positions are the composition's, out of `markerCells`: a latitude in a document
 * would be a coordinate under another name, which is the line this whole feature
 * is drawn on.
 *
 * -- And the field is the box ------------------------------------------------
 *
 * It used to be `base * 0.42` tall whatever it had been given. Now `mapLayout`
 * fits the crop to the box, opens the crop towards the box's own shape rather than
 * letterboxing the difference away (`mapCrop`), and chooses how finely to sample
 * the mask from the pitch the box can afford (`mapStride`) - so a map given the
 * safe area IS the safe area, and the same map in a cell is a smaller map rather
 * than the same one adrift in a larger frame.
 */

import { columnGlow, arcControl, bezierPoint, linkPulse, mapLayout, markerCells, markerPulse, room } from './dataFigures.js'

/** Everything below is in CELL units: the viewBox is the crop itself, so one unit is one dot's cell. */
const DOT = 0.3
const MARKER = 0.58

// Not called `Map`: that name shadows the global constructor for the whole
// module, and the day somebody reaches for `new Map()` in here to index the
// markers, they get this component instead and a TypeError three lines later.
export const WorldMap = ({ block, palette, box, base, progress, life }) => {
  const layout = mapLayout(block, box, { base })
  const markers = markerCells(layout.cells, block.markers)
  const links = block.connections ? markers.slice(1).map((to, i) => ({ from: markers[i], to })) : []
  const outer = room(box)

  // Grouped by column so the sweep is one opacity for twenty dots instead of six
  // hundred recomputed per frame — `columnGlow` states the cost this avoids, and
  // a meridian is what a column of the field reads as anyway.
  const field = Array.from({ length: layout.columns }, () => [])
  for (const cell of layout.cells) field[cell.x - 0.5].push(cell)

  return (
    // The field keeps its own aspect — this is the one block in the directory
    // holding circles, and a circle in a stretched viewBox is an ellipse. What
    // `mapCrop` could not spend on more mask is spent here, as air around a
    // centred map, rather than on a distorted one.
    <div
      style={{
        width: outer.width,
        height: outer.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox={`0 0 ${layout.columns} ${layout.rows}`}
        width={layout.width}
        height={layout.height}
        style={{ display: 'block', opacity: progress }}
      >
        {field.map((column, i) =>
          // A column of open ocean is a group with nothing in it, and there are
          // fourteen of them in a world crop: an empty node per frame per empty
          // meridian is a cost paid inside a render budget scaled on duration.
          column.length === 0 ? null : (
            <g key={i} opacity={columnGlow(i, layout.columns, life)}>
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
                strokeWidth={layout.stroke}
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
                strokeWidth={layout.stroke}
                vectorEffect="non-scaling-stroke"
                opacity={0.5 * pulse}
              />
              <circle cx={marker.x} cy={marker.y} r={MARKER * (0.85 + 0.15 * pulse)} fill={palette.accent.color} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
