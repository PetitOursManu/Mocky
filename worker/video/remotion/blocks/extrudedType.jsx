/**
 * `extrudedType` - a line of type with real thickness, standing in a real scene
 * and turning in it.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`. The font
 *             stack is read here and it is the whole reason this block does not
 *             use a 3D text package - see `spatialType.js`.
 *   box       THIS block's own box in pixels. Every length comes out of it,
 *             through `spatialLayout`; the canvas is `layout.canvas` and it is
 *             opened around this block by `ComposedSceneVideo`, so what arrives
 *             here is already the right number of pixels.
 *   unit      the type unit its stack agreed on. This block sets TYPE, so it
 *             takes a step on that scale like every other line in the film.
 *   base      the frame's SHORT edge. Unused here: nothing this block draws is a
 *             constant metric.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground. The face of every word is `palette.display`, exactly as a flat `heading` is, and the thickness behind it is `palette.accent` - the ornament's run, which is what a decoration carries everywhere else in this directory. Anchored `full` under a stack this block IS a surface, and it paints BOTH of those inks: `FIELD_PAINTS` calls that paint `type`, and it exists because the two obvious wrong answers are a field measured as the accent alone - which leaves the face, the largest thing on the frame, unmeasured - and a field measured as nothing at all, which is what a heading laid over a full-frame title used to meet at 1:1 in its own ink.
 *
 * LEGIBILITY: A 3D title that cannot be read is worse than a flat one, so every guarantee a flat line has is kept here rather than traded for the dimension. The SIZE is a step on the one type scale, solved against this block's own box by `spatialSize` - `blockExtent`'s own arithmetic, on a run declared `nowrap`, which bounds an unbreakable run by its whole length across the measure. That is a stricter bound than `wordCeiling`'s, so the promise that a word is never cut in half is kept by construction and there is no wrap for a browser to fall back on; and it is `blockExtent`'s and not `typeScale`'s because `typeScale` solves a bare RUN, which came back 36% taller than the box the layout had divided for a block with furniture. The COLOUR is the ink `composedPalette` measured, painted at full strength on every frame: nothing here fades, the arrival is a DEPTH, and no light falls on the face - a Lambert term on a word is the measured ink multiplied by a cosine nobody measured, which is why the materials below are `basic` and `toneMapped` is off. And the GEOMETRY is bounded twice: `spatialLayout`'s `fit` reserves the room a turned line's near end is magnified by so no glyph crosses the canvas, and its `sway` lowers a long line's own turn so the near end is never set visibly larger than the far one.
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
 * -- And the third rule, which this file shares with `solidScene` -------------
 *
 * **It imports nothing from `three` either.** Every element below is a
 * react-three-fiber INTRINSIC - `<mesh>`, `<planeGeometry>`,
 * `<meshBasicMaterial>`, `<canvasTexture>` are lower-case strings the reconciler
 * resolves at render time, the same way `<div>` is resolved by react-dom. What
 * this component returns is a description of a scene; the canvas that gives
 * those strings a meaning is `ThreeCanvas`, opened by `ComposedSceneVideo`. An
 * import here would take the whole registry out of `blocks.test.js`, which is
 * the one test that keeps the registry and the schema honest in both directions.
 *
 * -- How a word becomes an object -------------------------------------------
 *
 * There is no glyph outline in this container and there is no package that would
 * bring one without also bringing its own typeface - the argument, with the
 * measurements, is at the top of `spatialType.js`. So the browser that is
 * already rendering the frame draws each WORD once, in the project's own font
 * stack, into a small canvas; that canvas becomes the picture on a quad; and the
 * THICKNESS is `SPATIAL_LAYERS` more quads behind it, each carrying the same
 * word dilated by the step it takes so the stack has no seam. Turn the group and
 * the stack slides out from behind the face, which is what an extrusion is.
 *
 * And the line STANDS turned, which is the other half of that sentence and the
 * one this block shipped without: a swing centred on nothing crosses square to
 * the camera once a scene, where the stack is exactly behind the face and the
 * whole block draws a flat title with a coloured edge. It rests at a
 * three-quarter attitude and swings around it, on both axes — up and to the
 * left, which is the one direction no viewer reads as a drop shadow.
 * `SPATIAL_REST_YAW_DEG` carries the measurement.
 *
 * A word and not a letter, and that is the second measurement rather than a
 * taste: per-glyph geometry was measured at eight times what the deadline leaves
 * and refused with its figure, exactly as the wireframe was one block over. What
 * it gives back is the kerning the face was drawn with.
 *
 * The dilation is why a word carries a hairline of the accent around it: the
 * copy behind the face is fractionally larger than the face, so a sliver of it
 * shows all the way round. That is a bevel, it is a treatment
 * rather than an accident, and it is bounded - the stroke stays under a
 * twentieth of the em, so the aperture of an `e` never closes.
 */
import { useMemo } from 'react'
import {
  SPATIAL_BOOST_MAX,
  SPATIAL_CAMERA_Z,
  SPATIAL_FOV,
  SPATIAL_GLYPH_BASELINE,
  SPATIAL_GLYPH_BOX,
  SPATIAL_GLYPH_PAD,
  SPATIAL_LAYERS,
  spatialAdvance,
  spatialGroupEnter,
  spatialGroupTurn,
  spatialGroups,
  spatialLayout,
  spatialFloat,
  spatialRestTurn,
  SPATIAL_NO_SHADE,
  spatialShade,
  spatialSpin,
} from './spatialType.js'

/**
 * The weight every line in this family is set at.
 *
 * 800, the same one `heading` and `logoType` set - a wordmark and a headline are
 * the two things this block draws, and a third weight would be a third answer to
 * a question the flat blocks already answered. It matters more here than there:
 * `palette.display` and `palette.accent` are resolved at the 3:1 floor the audit
 * licences for BOLD type past `BOLD_LARGE_PX`, so a lighter face would be a run
 * painted at a contrast it is no longer entitled to.
 */
const WEIGHT = 800

/**
 * One word, drawn by the browser into a canvas of its own.
 *
 * A WORD and not a letter, and the measurement that decided it is in
 * `SPATIAL_LAYERS`: per-glyph geometry costs about 0.084 s of render per second
 * of film per object on the two-core worker, and a sixteen-letter line is 176 of
 * them against a budget of twenty-eight. What the word buys back is the kerning
 * the face was drawn with — a line placed letter by letter loses every pair.
 *
 * `dilate` is the stroke laid under the fill, in raster pixels: it is what makes
 * `SPATIAL_LAYERS` copies read as one solid side instead of as a staircase, and
 * it is computed from the step the stack actually takes rather than chosen. The
 * padding grows with it so the stroke is never clipped by its own tile.
 *
 * The advance is the BROWSER's, not the estimate's. That is the one place this
 * family reads a real measurement, and the reason is that the estimate exists to
 * bound a size rather than to set one: `GLYPH_CLASS_EM` rounds every class up, so
 * a line placed on it would have visibly loose, uneven word spacing. The estimate
 * still governs the SIZE, through `spatialSize`, which is what keeps the block
 * inside the box the layout divided for it.
 */
function rasterise(words, em, font, color, dilate) {
  // No document means no browser, which means this is Mocky's own suite loading
  // the registry rather than a render. Nothing is drawn - and nothing is the
  // right degradation here (Q1): a row of untextured quads where a title should
  // be reads as a broken renderer, which is worse than a scene that is missing
  // one block.
  if (typeof document === 'undefined') return null
  const face = `${WEIGHT} ${em}px ${font}`
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) return null
  probe.font = face
  // The word space, measured once in the same face: it is what separates two
  // groups, and taking it from the font rather than from a fraction of the em is
  // what keeps a line set in a condensed face from opening up.
  const gap = probe.measureText(' ').width || spatialAdvance(' ', em)

  return {
    gap,
    tiles: words.map((word) => {
      const advance = probe.measureText(word).width || spatialAdvance(word, em)
      const pad = Math.ceil(em * SPATIAL_GLYPH_PAD + dilate)
      const width = Math.max(1, Math.ceil(advance) + 2 * pad)
      const height = Math.max(1, Math.ceil(em * SPATIAL_GLYPH_BOX) + 2 * pad)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.font = face
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = color
        if (dilate > 0) {
          ctx.strokeStyle = color
          ctx.lineWidth = dilate
          ctx.lineJoin = 'round'
          ctx.miterLimit = 2
          ctx.strokeText(word, pad, pad + em * SPATIAL_GLYPH_BASELINE)
        }
        ctx.fillText(word, pad, pad + em * SPATIAL_GLYPH_BASELINE)
      }
      return { canvas, advance, width, height }
    }),
  }
}

/**
 * One quad carrying one picture of one word.
 *
 * `toneMapped` is off and the texture is declared `srgb`, and neither is a
 * detail. react-three-fiber turns tone mapping ON by default, so a colour handed
 * to a material comes back off the renderer somewhere else - which on a block
 * whose colours were chosen by measuring them against a ground is the whole
 * legibility section undone by a renderer's default. The colour space is the
 * same failure from the other end: a canvas holds sRGB bytes, and a texture that
 * does not say so is read as linear and painted several stops out.
 *
 * `depthTest` is off as well, so the order these are drawn in is exactly
 * `renderOrder` and nothing else. A transparent quad sorted by distance is a
 * quad whose place in the stack depends on a floating-point comparison between
 * two nearly equal depths, and two renders of one document have to produce the
 * same bytes.
 */
const Tile = ({ tile, width, height, z, order, shade }) => (
  <mesh position={[0, 0, z]} renderOrder={order}>
    <planeGeometry args={[width, height]} />
    {/*
      `color` is a SHADE and never a colour: white on the face, so the raster
      reaches the frame exactly as `palette.display` painted it, and a grey out of
      `spatialShade` on each copy of the side, so the extrusion darkens as it
      recedes. A basic material multiplies its map by `color`, which is the same
      operation a Lambert term performs on `palette.solid.color` one block over —
      see `spatialShade` for why a ramp that can only darken writes no colour.
    */}
    <meshBasicMaterial color={shade} transparent depthTest={false} depthWrite={false} toneMapped={false}>
      <canvasTexture attach="map" args={[tile.canvas]} colorSpace="srgb" />
    </meshBasicMaterial>
  </mesh>
)

export const ExtrudedType = ({ block, palette, theme, box, unit, progress, life }) => {
  const layout = spatialLayout(block, box, unit)
  const words = spatialGroups(block.text)

  /*
   * How far apart two copies of the stack sit, in raster pixels, and therefore
   * how much each copy has to be dilated to close the seam.
   *
   * Measured on the RESTING angle - the widest this line really turns in this
   * box, plus a word's roll - and not on the entrance, which is wider. A seam shows where the stack is spread
   * furthest across the frame, and during the nine frames of an entrance the
   * group is at the back of its own travel and drawn at three quarters of its
   * size, where the same step projects to a fraction of a pixel. Dilating for the
   * entrance instead would put a stroke of six per cent of the em around a word
   * for the whole scene, which closes the counters of the round letters.
   *
   * The 1.4 is the diagonal - a step is taken in one direction and the stroke has
   * to cover it in every direction a contour runs.
   */
  const dilate = useMemo(() => {
    // `layout.turned` and not `spatialLineTurn`: the keystone bound may have
    // lowered this line's attitude, and dilating for an angle the frame does not
    // show is a bevel the whole scene carries for a seam that never opens.
    const swing = Math.sin(layout.turned + spatialRestTurn(block.spin))
    const stepPx = (layout.depthPx * swing) / SPATIAL_LAYERS
    // `ceil` and not `round`: the whole point of the number is that it is not
    // smaller than the step, and a dilation rounded down is a seam.
    return Math.max(1, Math.ceil(((stepPx * 1.4) / Math.max(1, layout.size)) * layout.rasterEm))
  }, [block.spin, layout.turned, layout.depthPx, layout.size, layout.rasterEm])

  /*
   * The two rasters, memoised on everything they are drawn from.
   *
   * Remotion rebuilds this tree on every one of a film's frames, and rasterising
   * a line of type twice per frame is the CPU half of a render budget spent on
   * an image that never changes. Nothing in the dependency list is a frame: the
   * words, their size, their font and their two inks are the whole of what a tile
   * depends on, which is what makes one raster serve all 3600 frames.
   */
  const faces = useMemo(
    () => rasterise(words, layout.rasterEm, theme.headingFont, palette.display.color, 0),
    [block.text, layout.rasterEm, theme.headingFont, palette.display.color],
  )
  const sides = useMemo(
    () => rasterise(words, layout.rasterEm, theme.headingFont, palette.accent.color, dilate),
    [block.text, layout.rasterEm, theme.headingFont, palette.accent.color, dilate],
  )

  if (!faces || !sides || faces.tiles.length === 0) return null

  /*
   * WHAT THE TYPE REALLY MEASURES, AND WHY THE BLOCK SCALES UP TO ITS CLAIM.
   *
   * `spatialSize` solves against the estimate — `GLYPH_CLASS_EM` rounds every
   * class up and `LINE_SAFETY` adds six per cent on top — and the estimate is
   * deliberately conservative, because under-counting is a line off the edge of
   * the frame and over-counting is a line a little small. On a run that WRAPS
   * that difference disappears into the wrap; on this block it cannot, and a
   * rendered frame is what said what it costs: `MOTION EN RELIEF` filled 74% of
   * the measure its box had been divided on, with a quarter of the frame empty
   * beside it. That is the small element in a large void, arriving through an
   * estimate instead of through a fraction of the frame.
   *
   * So the line is scaled up until it fills what `blockExtent` claims for it,
   * and never past that: the claim is what `stackIn` divided the zone on, so
   * this can only ever recover slack the estimate left and never take a pixel
   * from the block's neighbours. `SPATIAL_BOOST_MAX` is the guard on a
   * measurement this file did not make — a font that reported an absurd advance
   * would otherwise scale a title through the frame.
   */
  const perRaster = layout.size / layout.rasterEm
  const spreadPx = (faces.tiles.reduce((sum, tile) => sum + tile.advance, 0) + faces.gap * (faces.tiles.length - 1)) * perRaster
  // The two rooms, each a multiplier on what the block would draw at its solved
  // size: the width against the line the browser really set, the height against
  // the line box the estimate already agrees with. The height term is `fit`'s own
  // — nothing about the vertical was ever an estimate — so taking the smaller of
  // the three is `fit` with the horizontal slack given back, and never more than
  // the claim on either axis.
  const widthRoom = layout.claim.width / Math.max(1, spreadPx * layout.magnify)
  const heightRoom = layout.claim.height / Math.max(1, layout.needHeight * layout.magnify)
  const drawn = Math.min(SPATIAL_BOOST_MAX, widthRoom, heightRoom)
  // Pixels of the frame per pixel of raster, and world units per pixel of frame.
  // Every length below is one of the two applied to a number the browser or
  // `spatialLayout` produced; nothing here invents a size.
  const scale = perRaster * layout.worldPerPx * drawn
  // The move, at the shares of its yaw this box allows - see `spatialLayout`'s
  // two budgets. A line given the whole safe area of a 16:9 frame is thirty world
  // units wide, and seven degrees on that is a near end 7% larger than the far
  // one: one line set at two sizes. The SWING keeps its floor and the resting
  // attitude is what yields, which is why a full-frame line still reads as thick
  // - the pitch is not bounded by a measure.
  const spin = spatialSpin(block.spin, life, layout.turn)
  const depth = layout.depthPx * layout.worldPerPx * drawn

  // The line is centred on its own real measure rather than on the estimate, so
  // a line the browser set narrower than `textWidth` predicted is still centred
  // in its box. The estimate is conservative by `LINE_SAFETY` and by every
  // rounding in `GLYPH_CLASS_EM`, so this only ever moves the line inwards.
  let pen = -(spreadPx / perRaster) * scale / 2

  return (
    <group rotation={[spin.pitch, spin.yaw, 0]}>
      {faces.tiles.map((tile, index) => {
        const width = tile.width * scale
        const height = tile.height * scale
        // The pen is at the word's left edge; the quad is centred, and the tile
        // is padded on both sides, so the two corrections cancel to half an
        // advance.
        const x = pen + (tile.advance * scale) / 2
        pen += (tile.advance + faces.gap) * scale
        // Where it still is on its way in, and how far it is still turned. Both
        // are zero once it has landed - a word carrying a fraction of its
        // entrance on the four hundredth frame is a line whose baseline never
        // resolves.
        const enter = spatialGroupEnter(faces.tiles.length, index, progress)
        // The arrival is a depth and so is `float`: they ADD, so a word that has
        // not landed yet floats behind the plane it is on its way to rather than
        // arriving somewhere the move then contradicts.
        const behind = enter.behind + spatialFloat(block.spin, index, life)
        const side = sides.tiles[index] ?? tile
        return (
          <group
            key={index}
            position={[x, 0, -behind * layout.size * layout.worldPerPx * drawn]}
            rotation={[0, enter.turn, 0]}
          >
            {Array.from({ length: SPATIAL_LAYERS }, (_, layer) => (
              <Tile
                key={layer}
                tile={side}
                width={(side.width / tile.width) * width}
                height={(side.height / tile.height) * height}
                // Deepest first, so the one nearest the face is drawn last and
                // the seam between two copies is covered by the nearer of them.
                z={-depth * (1 - layer / SPATIAL_LAYERS)}
                order={layer}
                // And darker the further back it is. The ramp is the whole
                // difference between an extrusion and a drop shadow, which is what
                // one flat copy drew for four exports; `spatialShade` carries the
                // argument for why a grey multiplier is not a colour.
                shade={spatialShade(layer)}
              />
            ))}
            <Tile tile={tile} width={width} height={height} z={0} order={SPATIAL_LAYERS} shade={SPATIAL_NO_SHADE} />
          </group>
        )
      })}
    </group>
  )
}

/**
 * The camera every extruded line is seen from, and the canvas it needs.
 *
 * Read by `blocks/canvases.js`, which is where a block that needs a renderer says
 * so - the same shape `solidScene` answers, so `ComposedSceneVideo` opens one
 * kind of canvas rather than one per block.
 */
export const EXTRUDED_TYPE_CANVAS = (block, box, base, unit) => {
  const layout = spatialLayout(block, box, unit)
  return {
    width: layout.canvas.width,
    height: layout.canvas.height,
    // Stated rather than left to react-three-fiber's own 75-degree default, and
    // for the opposite reason `solidScene` states its own: a wide lens keystones
    // a line of type, so one line comes back set at two sizes. The distance is
    // what makes the canvas exactly two world units tall, which is the whole of
    // the pixel-to-world conversion in `spatialLayout`.
    camera: { position: [0, 0, SPATIAL_CAMERA_Z], fov: SPATIAL_FOV },
  }
}
