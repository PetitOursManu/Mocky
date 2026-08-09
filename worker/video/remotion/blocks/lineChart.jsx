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
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: the line, the area, the head and its ping are all `palette.accent`, the label is `palette.body`.
 *
 * LEGIBILITY: The area is the accent at a low opacity, and it is the one place this block can spend contrast: it is painted UNDER the line and never under text. A label laid over the area would be a run on a surface the palette never measured, so the label sits outside it.
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
 * The curve is drawn in a unit box that CSS STRETCHES to the width of whatever
 * cell the block landed in, because a block never learns how wide its box is:
 * `composedLayout` owns the boxes and hands a component only `base`. Everything
 * round is therefore drawn OUTSIDE that box, as absolutely positioned elements in
 * percent - a circle inside a non-uniformly stretched viewBox is an ellipse, and
 * the head of a trace is the one element in this file that has to look like a
 * point.
 *
 * The trace itself is a shorter polyline, not a clipped long one and not a dash
 * offset; `tracedPoints` says why both of those are worse than they look.
 */

import { PING_REACH, pingFade, pingPhase, pingReach, pointAtX, seriesPoints, tracedPoints } from './dataFigures.js'

export const LineChart = ({ block, palette, theme, base, progress, life }) => {
  const points = seriesPoints(block.values)
  const drawn = tracedPoints(points, progress)
  const head = pointAtX(points, progress)
  const plot = Math.round(base * 0.24)
  const phase = pingPhase(life)
  const dot = Math.max(4, Math.round(base * 0.012))
  const stroke = Math.max(1, Math.round(base * 0.0028))
  const path = drawn.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ')
  // A ring is placed by its centre, so it is offset by half of whatever it has
  // grown to - `transform` would be a second way of moving something in a
  // directory where movement comes from one place.
  const ring = dot * pingReach(phase)
  // The plot is inset by the widest the ring ever gets, because the last sample
  // is AT `x = 1`: a mark centred on it hangs half its width past the box, and the
  // box's edge is the safe margin `composedSafeArea` promises nothing crosses. The
  // curve loses 4% of a 900 px measure; the guarantee is worth more than that.
  const reach = Math.round((dot * PING_REACH) / 2)

  return (
    <div style={{ width: '100%', paddingLeft: reach, paddingRight: reach, boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', height: plot }}>
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
                strokeWidth={stroke}
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
            border: `${stroke}px solid ${palette.accent.color}`,
            opacity: pingFade(phase) * progress,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${head.x * 100}%`,
            top: `${head.y * 100}%`,
            width: dot,
            height: dot,
            marginLeft: -dot / 2,
            marginTop: -dot / 2,
            borderRadius: '50%',
            backgroundColor: palette.accent.color,
            opacity: progress,
          }}
        />
      </div>

      {block.label ? (
        <div
          style={{
            marginTop: Math.round(base * 0.016),
            fontFamily: theme.bodyFont,
            fontSize: Math.round(base * 0.022),
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
