/**
 * `lineChart` - a line over a series, with an optional area under it.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       **this block's own box**, in pixels, out of `composedLayout`. The
 *             plot is what is left of it under the label, inset by the ping.
 *   unit      the type unit this block's STACK solved. The label is the
 *             `caption` step of it, never a fraction of the frame.
 *   base      the frame's SHORT edge. For the constant metrics named in
 *             `CONSTANT_METRICS`: here the stroke, and nothing else.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: the line, the area, the head and its ping are all `palette.accent`, the label is `palette.body`.
 *
 * LEGIBILITY: The area is the accent at a low opacity, and inside a CELL it is the one place this block can spend contrast: it is painted under the line and under nothing else, so a label laid over it - a run on a surface the palette never measured - sits outside it instead. That sentence was the whole of this note, and it is the sentence that was false the moment somebody anchored the chart `full`: a `full` block is painted UNDER the nine cells on purpose, so the area is then the surface a headline stands on. `stackedField` is what notices, `composedPalette` measures every run over the chart as a tint sampled along `FIELD_RAMP`, and the density the field cedes is `palette.field.alpha` on the ZONE. Nothing about that is in this file, and that is deliberate: `full` is what makes a block a field, so the rule lives where `full` means something.
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
 * -- Two geometries that are not the same one --------------------------------
 *
 * The curve is drawn in a unit box that CSS STRETCHES to the plot's own rectangle,
 * which `lineChartLayout` computes off `box` - it used to be `base * 0.24`, a
 * fraction of the frame, so a chart given the safe area drew a quarter of the
 * short edge in the middle of it. Everything ROUND is drawn OUTSIDE that unit box,
 * as absolutely positioned elements in percent: a circle inside a non-uniformly
 * stretched viewBox is an ellipse, and the head of a trace is the one element in
 * this file that has to look like a point.
 *
 * The plot is inset by the widest the ping ever gets, on all four sides. The last
 * sample sits at `x = 1` and a value of 100 sits at `y = 0`, so a ring centred on
 * either would hang half its width past the box - and the box's edge is the margin
 * `composedSafeArea` promises nothing crosses.
 *
 * The one place this family does NOT fill its box is `LINE_MAX_ASPECT`, and the
 * argument is in `dataFigures.js`: nothing rescales the values, so stretching the
 * plot taller than it is wide draws a ten-point difference as a cliff. In a column
 * the leftover is air, split above and below.
 *
 * The trace itself is a shorter polyline, not a clipped long one and not a dash
 * offset; `tracedPoints` says why both of those are worse than they look.
 */

import {
  lineChartLayout,
  pingFade,
  pingPhase,
  pingReach,
  pointAtX,
  seriesPoints,
  tracedPoints,
} from './dataFigures.js'

export const LineChart = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const layout = lineChartLayout(block, box, { base, unit })
  const points = seriesPoints(block.values)
  const drawn = tracedPoints(points, progress)
  const head = pointAtX(points, progress)
  const phase = pingPhase(life)
  const path = drawn.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ')
  // A ring is placed by its centre, so it is offset by half of whatever it has
  // grown to - `transform` would be a second way of moving something in a
  // directory where movement comes from one place.
  const ring = layout.dot * pingReach(phase)

  return (
    <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
      <div
        style={{
          position: 'absolute',
          left: layout.plot.left,
          top: layout.plot.top,
          width: layout.plot.width,
          height: layout.plot.height,
        }}
      >
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Two points is what makes a line. One is the first frame of the
              trace, where there is nothing to draw yet and a `polyline` with a
              single vertex would still cost a node on every frame of it. */}
          {drawn.length > 1 ? (
            <>
              {block.area ? (
                <polygon
                  points={`${drawn[0].x.toFixed(4)},1 ${path} ${head.x.toFixed(4)},1`}
                  fill={palette.accent.color}
                  // Under the line and never under text, which is why an opacity
                  // is legitimate here and nowhere else in this directory.
                  opacity={0.18}
                />
              ) : null}
              <polyline
                points={path}
                fill="none"
                stroke={palette.accent.color}
                strokeWidth={layout.stroke}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
        </svg>

        {/*
          The ping, and it is what keeps this block alive. A traced line moves once
          and then holds for the rest of its scene, which is `DEFAULT_KEN_BURNS`'s
          mistake one level down. A ring expanding off the last point is the honest
          way out: it marks where the series ends and claims nothing about the
          numbers - a chart that kept redrawing itself would claim they changed.
        */}
        <div
          style={{
            position: 'absolute',
            left: `${head.x * 100}%`,
            top: `${head.y * 100}%`,
            width: ring,
            height: ring,
            marginLeft: -ring / 2,
            marginTop: -ring / 2,
            borderRadius: '50%',
            border: `${layout.stroke}px solid ${palette.accent.color}`,
            opacity: pingFade(phase) * progress,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${head.x * 100}%`,
            top: `${head.y * 100}%`,
            width: layout.dot,
            height: layout.dot,
            marginLeft: -layout.dot / 2,
            marginTop: -layout.dot / 2,
            borderRadius: '50%',
            backgroundColor: palette.accent.color,
            opacity: progress,
          }}
        />
      </div>

      {layout.label.shown ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: layout.height - layout.label.height,
            width: layout.width,
            fontFamily: theme.bodyFont,
            fontSize: layout.label.size,
            // The LAST resort, and not the wrapping model this file measures with.
            // `wordCeiling` bounds the type so the longest word of a run fits the
            // measure, so this only ever fires under `WORD_FIT_FLOOR_PX` — a word no
            // legible size can hold, where breaking is the decided lesser evil. Left
            // out, that word would run out of the box instead. A rendered frame showed
            // the other half of it, back when nothing bounded the size at all:
            // `NEUF S` / `EIZIEME` / `S`.
            wordBreak: 'break-word',
            lineHeight: layout.label.leading,
            color: palette.body.color,
            opacity: progress,
          }}
        >
          {block.label}
        </div>
      ) : null}
    </div>
  )
}
