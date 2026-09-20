/**
 * `solidChart` - a column chart with volume: the same percentages, drawn as lit
 * blocks standing on a plinth.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`. The labels
 *             are the only thing here that reads it.
 *   box       **this block's own box**, in pixels, out of `composedLayout`. The
 *             canvas, the plot, the row and the label band all come off it.
 *   unit      the type unit this block's STACK solved. The labels are a STEP on
 *             that scale (`caption`), never a fraction of the frame.
 *   base      the frame's SHORT edge. The fallback square for a box handed
 *             without one (Q1), and nothing else: this block draws no hairline.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, twice over. The columns are `palette.solid` - a material colour and an ambient share resolved by `solidShading`, which is the run a lit object carries everywhere in this catalogue - and the labels under the plot are running text on the ground and take `palette.body`. Anchored `full` under a stack this block IS a surface, and `FIELD_PAINTS` says it paints a `solid`: the two ends of its own Lambert segment are what `composedPalette` then samples.
 *
 * LEGIBILITY: Two halves, and the first is not about contrast at all. **A chart whose values cannot be read is a decoration**, and under a perspective camera a 3D chart is exactly that - two equal columns at two depths project to two different heights, so the one thing a bar chart is for is what the projection destroys. This block is drawn ORTHOGRAPHICALLY and the row stands at a single depth, so a value of forty draws four tenths of the plot wherever it stands; `chartProject` is the arithmetic and `dataVolume.test.js` holds it as an equality. The second half is the ordinary one: the columns are painted at more than one brightness, every face lies on the segment between `material x ambient` and `material`, contrast is monotone between them, and `solidShading` measures the two ends. The labels are flat type on the ground and take the run measured for it.
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
 * -- And the third: nothing from `three` -------------------------------------
 *
 * `<mesh>`, `<boxGeometry>` and `<meshLambertMaterial>` are react-three-fiber
 * INTRINSICS, lower-case strings the reconciler resolves at render time. The
 * canvas is opened by `ComposedSceneVideo`, for the reason `solidScene` gives at
 * length: `three` is installed in the worker's manifest and nowhere else, and an
 * import here would take `blocks/index.js` out of Mocky's own suite.
 *
 * -- The labels are FLAT, and that is a decision that had to be written down ---
 *
 * They are DOM, drawn over the canvas rather than inside it, and there are two
 * reasons neither of which is convenience. Type in GL is either an extruded
 * geometry - which needs a font file this container does not carry and a loader
 * this feature does not have - or a texture, which is a canvas nobody measured
 * painting glyphs at a size nobody chose. And a caption is a RUN: it belongs to
 * the one type scale `TYPE_ROLES` owns, it is sized by `labelBand` against the
 * lane it sits under, and it disappears rather than overflowing. None of that
 * survives being handed to a renderer.
 *
 * What it costs is one number: the lane a caption is centred on is the PROJECTION
 * of its column's centre line, not the column's world position, so
 * `solidChartLayout` answers `lanes` in canvas pixels and this file draws them
 * there. A caption under the wrong column is worse than no caption at all.
 *
 * -- What moves, and what must not -------------------------------------------
 *
 * The columns grow in a cascade (`barGrowths`, the flat chart's own) and then
 * STOP: a column's height is the number the document stated, and a value that
 * breathes is a value nobody can read. What carries the rest of the scene is the
 * LIGHT, which re-shades every face continuously and changes no height - the 3D
 * counterpart of the reading mark that scrubs across a flat chart, and plainly an
 * ornament in the same way.
 */

import { barGrowths } from './dataFigures.js'
import { CHART_AZIMUTH, CHART_CAMERA, CHART_ELEVATION, chartLightAt, solidChartLayout } from './dataVolume.js'
import { litAmbient } from './shading.js'

/**
 * What "intensity 1" means to this renderer.
 *
 * three has used physically correct light units since r155: a punctual light's
 * radiance is divided by pi, and the migration note is to multiply the old
 * intensities by pi to keep the old look. `solidScene` carries the same constant
 * and the same paragraph; both are here rather than in `composition.js` because
 * it is a property of the RENDERER and not of the colour, and the two intensities
 * still sum to one before it is applied - which is what keeps `solidShading`'s
 * segment the segment it measured.
 */
const LIGHT_UNIT = Math.PI

export const SolidChart = ({ block, palette, box, unit, base, progress, life }) => {
  const layout = solidChartLayout(block, box, { unit, base })
  const growths = barGrowths(block.values.length, progress)
  const light = chartLightAt(life)
  // The palette's share, in the space this renderer shades in: `solidShading`
  // measures a multiplier on BYTES and `three` multiplies in linear light. See
  // `shading.js` - handing the byte share to a light left every column two
  // thirds of the way to its own material and the row of them read as flat.
  const ambient = litAmbient(palette.solid.color, palette.solid.ambient)

  return (
    <>
      {/*
        Two lights and no more, exactly as `solidScene` has them: the ambient is
        the share `solidShading` computed, the directional is the rest, and
        together they are the Lambert term the proof is written about. A third
        light would put a face outside the segment that was measured.
      */}
      <ambientLight intensity={ambient * LIGHT_UNIT} />
      <directionalLight position={light} intensity={(1 - ambient) * LIGHT_UNIT} />

      {/*
        Offset, then scaled, then turned - and the turn is TWO groups rather than
        one triple of angles. A three's Euler triple has an order, this file would
        have to agree with it, and `chartProject` would have to agree with both;
        two nested rotations about one axis each say what they do and are the two
        lines the projection is written from.
      */}
      <group position={[layout.offset.x, layout.offset.y, 0]} scale={layout.scale}>
        <group rotation={[-CHART_ELEVATION * (Math.PI / 180), 0, 0]}>
          <group rotation={[0, CHART_AZIMUTH * (Math.PI / 180), 0]}>
            {block.plinth === false ? null : (
              <mesh position={[0, -layout.world.plinth / 2, 0]}>
                <boxGeometry args={[layout.world.plate.width, layout.world.plinth, layout.world.plate.depth]} />
                <meshLambertMaterial color={palette.solid.color} toneMapped={false} />
              </mesh>
            )}

            {layout.world.bars.map((bar, i) => {
              // Rooted on the plinth and grown upward, which is why the height is
              // computed once and the centre read off it: two expressions of one
              // quantity is how a column ends up a hair off the plate it stands on.
              const grown = bar.height * Math.max(0, Math.min(1, growths[i] ?? 1))
              if (grown <= 0) return null
              return (
                <mesh key={i} position={[bar.x, grown / 2, 0]}>
                  <boxGeometry args={[bar.width, grown, bar.depth]} />
                  {/*
                    Lambert and not Standard, for `solidScene`'s reason: a physical
                    material adds a specular highlight computed from a roughness
                    nobody set, which is a face brighter than the material colour -
                    outside the segment the palette measured, and therefore outside
                    the guarantee. It is also the cheaper shader.

                    `toneMapped` off, for `extrudedType`'s reason: react-three-
                    fiber turns ACES tone mapping on by default, and a curve
                    applied after the light is computed paints a colour nobody
                    measured - lower than the material at both ends of the
                    segment, which on a dark ground is less contrast than what
                    was cleared.
                  */}
                  <meshLambertMaterial color={palette.solid.color} toneMapped={false} />
                </mesh>
              )
            })}
          </group>
        </group>
      </group>
    </>
  )
}

/**
 * The flat half: the row of captions under the plot.
 *
 * Drawn by `ComposedSceneVideo` OVER the canvas rather than inside it - see the
 * header - and positioned on `layout.lanes`, which are the projected centre lines
 * of the columns rather than their world positions.
 *
 * It takes the same props as the block itself, so the two halves cannot disagree
 * about the box they were given.
 */
export const SolidChartLabels = ({ block, palette, theme, box, unit, base, progress }) => {
  const layout = solidChartLayout(block, box, { unit, base })
  if (!layout.label.shown) return null
  const growths = barGrowths(block.values.length, progress)

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: layout.width, height: layout.height }}>
      {block.values.map((_, i) => {
        const lane = layout.lanes[i]
        if (!lane) return null
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: lane.start,
              width: lane.size,
              top: layout.height - layout.label.height,
              height: layout.label.height,
              textAlign: 'center',
              fontFamily: theme.bodyFont,
              fontSize: layout.label.size,
              lineHeight: `${layout.label.height}px`,
              color: palette.body.color,
              // The LAST resort, and not the wrapping model `labelBand` measures
              // with. `wordCeiling` bounds the type so the longest word of a run
              // fits its measure, so this only ever fires under
              // `WORD_FIT_FLOOR_PX` - a word no legible size can hold, where
              // breaking is the decided lesser evil. Left out, that word would run
              // out of the box instead.
              wordBreak: 'break-word',
              // Sized to fit its own lane by `labelBand`; this is the belt, and it
              // is what makes "it never overflows" true of a face whose real
              // metrics differ from the estimate.
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              // With its own column rather than with the block: a caption that
              // arrived before the bar it names reads as a label looking for one.
              opacity: growths[i] ?? 1,
            }}
          >
            {/* The two arrays are allowed to differ in length - see the schema -
                so this draws the pairs it has and never invents a caption. */}
            {block.labels?.[i] ?? ''}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The canvas this block needs, for `BLOCK_CANVASES` in `blocks/canvases.js` — and
 * the only entry so far that uses the two optional answers.
 *
 * `orthographic` is the whole legibility argument of this block; the header says
 * why, and `chartProject` is where it becomes arithmetic. `frame` is TALLER than
 * the canvas, because the row of captions is flat type drawn under the GL surface
 * rather than inside it — `overlay` is what draws it, over the frame.
 */
export const SOLID_CHART_CANVAS = (block, box, base, unit) => {
  const layout = solidChartLayout(block, box, { base, unit })
  return {
    width: layout.canvas.width,
    height: layout.canvas.height,
    camera: CHART_CAMERA,
    orthographic: true,
    frame: { width: layout.width, height: layout.height },
    overlay: SolidChartLabels,
  }
}
