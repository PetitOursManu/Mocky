/**
 * `globe` - the world as a shell of dots, turning, with places lighting up on it.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`. Unused here:
 *             this block sets no type and rounds no corner.
 *   box       THIS block's own box in pixels. The canvas is `globeCanvas(box)` and
 *             is opened around this block by `ComposedSceneVideo`, so what arrives
 *             here is already a square of the right number of pixels - which is
 *             why the component below reads `box` for the DOT SIZE and for nothing
 *             else. Inside the canvas there is no box, there is a camera.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge. Used only as the fallback square for a box
 *             this file was handed without one (Q1).
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, through `palette.accent` - the ornament's run, resolved with the veil locked. Both point clouds and every marker are that one colour at an opacity, so a globe is exactly as loud as the accent was allowed to be and never louder. Anchored `full` under a stack this block IS a surface: `FIELD_PAINTS` says it paints the accent, which is what `fieldedGround` then samples, and nothing about that appears here for the reason the equalizer gives - `full` is what makes a block a field, so the rule lives where `full` means something.
 *
 * TWO FIELDS A DOCUMENT FILLS AND A VIEWER COULD NOT READ. `markers` and `connections` were both drawn in the land's own ink at the land's own strength, on a shell of several thousand dots of that ink, and a rendered frame showed neither: six places nobody could find and five arcs indistinguishable from more coastline. A second colour is not available and would be wrong if it were - this block paints `accent`, `FIELD_PAINTS` says so, and a marker in the display ink would be a full-frame surface painted in the ink of the heading standing on it. So the distinction is everything else a drawing has. A marker is never DIMMER than the continent it stands on (`GLOBE_LIMB_BAND` - the near-side fade was dimming every marker that was not dead centre) and it sends out a RIPPLE, a ring of ground inside a ring of ink, laid on the surface and leaving the place as it lights. A connection is a CONTINUITY: its points are spaced so they overlap on the frame, so what a viewer sees is an unbroken stroke crossing a lattice of separated dots. `dataVolume.js` carries both arguments and the arithmetic.
 *
 * LEGIBILITY: No text, and that is a decision rather than an omission. A label on a globe is a label on a moving surface: it is drawn at a size the projection chose, it passes behind the object twice a scene, and it is the one run in this catalogue no measurement could hold still. So the words that belong to a globe are a `kicker` or a `heading` anchored over it, measured against a surface `composedPalette` resolved with the field in it. What this block can still get wrong is spending contrast something else needed, and it cannot: every opacity below is a fraction of a run the palette resolved, and an opacity only ever makes a decoration quieter than what was measured.
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
 * -- And the third rule, which only the GL blocks have to obey ----------------
 *
 * **This file imports nothing from `three` either.** Every element below is a
 * react-three-fiber INTRINSIC - `<points>`, `<bufferGeometry>`, `<mesh>` are
 * lower-case strings the reconciler resolves at render time, the same way `<div>`
 * is resolved by react-dom - and the canvas that gives them a meaning is opened by
 * `ComposedSceneVideo`. `three` lives in `worker/video/package.json` and nowhere
 * else, exactly as Remotion does, so an import here would take the whole registry
 * out of the one test that keeps it honest.
 *
 * `Float32Array` is not an exception to that: it is a JavaScript builtin, and
 * `args` on a `<bufferAttribute>` is the constructor call the reconciler makes.
 *
 * -- Why a globe rather than more of the flat map ----------------------------
 *
 * The flat `map` gave up its sub-regions once already: a plate carree mask fine
 * enough to draw a recognisable Europe is the mask this block reads, and anything
 * below the scale of a country's outline is a border it would get wrong. A sphere
 * has no such problem, because a sphere has no borders to miss - what a viewer
 * reads is the SHAPE of the continents and the fact that they curve away, and both
 * survive at any resolution the box can carry. The same 16 KB of coastline draws
 * both, which is the point of importing it: a globe whose Africa differed from the
 * map's Africa would be two worlds in one film.
 *
 * -- What it costs, and the two things the measurement changed ---------------
 *
 * Measured on the two-core worker at 1080p, full frame: 0.8 s of render per second
 * of film over a plain title, and 3.9 MB for six seconds against that title's 0.73.
 * The deadline leaves about 1.7 s/s spare, so it fits - and it only fits because
 * the first two versions of this block did not.
 *
 * A full SHELL of dots, land over sea, measured 1.8 s/s and 7.5 MB, which is the
 * wireframe's own failure (refused at 2.7 s/s and 9.8 MB) arriving through a
 * different geometry: every dot is high-frequency detail an encoder cannot predict.
 * A translucent sphere in its place was worse still. `globeGraticule` is what
 * replaced it - a dozen meridians of points, which is what says "sphere" - and the
 * numbers are in `dataVolume.js` beside the code they justify.
 *
 * The second thing it changed is the number of BUFFERS. A cloud costs about fifteen
 * milliseconds a frame whatever is in it, because the positions are rebuilt on every
 * one of a scene's frames and the geometry behind them with it: the same globe at
 * 7854 dots and at 2827 took 23.8 s and 24.4 s, while dropping one cloud of three
 * took 2.7 s off. So the connections travel in the land's buffer and there are TWO,
 * which is also why the dot count is nearly free and the pitch is chosen for the
 * encoder rather than for the rasteriser.
 *
 * The bill is fill rate over a disc that is at most the block's own box, and the box
 * is a share of a safe area: a scene naming eight globes measured what one does.
 */

import {
  GLOBE_CAMERA,
  GLOBE_LAND_ALPHA,
  GLOBE_GRID_ALPHA,
  GLOBE_RIPPLE_WIDTH,
  globeArcs,
  globeCanvas,
  globeDotPx,
  globeFaceRotation,
  globeField,
  globeGraticule,
  joinPoints,
  globeMarkerLight,
  globeMarkerRadius,
  globeMarkerRipple,
  globeMarkers,
  globeOrientation,
  globePointCount,
  globeScale,
  globeShell,
  globeVisible,
} from './dataVolume.js'
import { SPRITE_ARGS } from './pointSprite.js'

/**
 * One cloud of dots.
 *
 * `frustumCulled` is off, and that is the one line here that is not obvious. The
 * positions are rebuilt on every frame - half a lattice, chosen by which side of
 * the sphere it is on - so the geometry's own bounding sphere is computed once,
 * from whichever half happened to be facing the camera first, and then never
 * again. Culled against a stale bound, the whole shell disappears for the part of
 * the scene where the globe has turned away from it.
 */
const Dots = ({ positions, color, size, opacity }) => {
  if (positions.length === 0) return null
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      {/*
        Size attenuation OFF, so `size` is device pixels and is the number
        `globeDotPx` states. With it on, a point's size is computed in the vertex
        shader from a scale factor that belongs to the renderer rather than to
        this scene - which would make "how big is a dot" a question nobody in
        this repository could answer. See `globeDotPx`.

        The dot is ROUND, for the reason `particleField` gives at length: a
        five-to-nine-pixel hard-edged square is not a dot, it is a pixel, and a
        globe made of them is the "everything is pixelated" complaint drawn at
        the scale of a continent. `pointSprite.js` is a white alpha mask, so
        `color` still decides the colour and this file still writes none.

        `depthWrite` off, and here it is doing real work rather than avoiding a
        square hole. Three clouds are drawn in order — graticule, then land and
        arcs, then the markers — and that order is what puts the land over the
        grid. With a soft edge and depth writing on, a graticule dot drawn first
        would punch its own square out of the land dot behind it. Nothing is lost:
        this block culls its own far side (`globeVisible`) rather than leaving it
        to the depth buffer, which is why the order can be the whole answer.
      */}
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation={false}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      >
        {SPRITE_ARGS ? <canvasTexture attach="map" args={SPRITE_ARGS} /> : null}
      </pointsMaterial>
    </points>
  )
}

export const Globe = ({ block, palette, box, base, progress, life }) => {
  const side = globeCanvas(box, base)
  const count = globePointCount(side)
  const field = globeField(count)
  const { yaw, tilt } = globeOrientation(block.region, life)
  const dot = globeDotPx(side, count)
  // The radius the DOTS sit at, which is not the radius the canvas was sized
  // for. A connection bows 16% off the surface, a marker stands proud of it and
  // a ripple lies across it, and a real export came back with the whole bundle
  // sliced by a vertical line at the right edge of the frame. `globeShell` is
  // the closed-form bound and carries the argument; a globe with no ornament on
  // it gets `GLOBE_RADIUS` back unchanged.
  const shell = globeShell(block, side, dot)
  const ink = palette.accent.color

  const markers = globeMarkers(field, block.markers)
  const lit = markers.map((point, i) => globeMarkerLight(point, yaw, tilt, life, i))
  // The canvas and the dot, so an arc is drawn with enough points to be a STROKE
  // rather than a second lattice of the same dots in the same ink. That is the
  // whole distinction a connection has on this block - see `globeArcSteps`.
  const arcs = block.connections
    ? globeArcs(markers, yaw, tilt, shell, life, { side, dot })
    : new Float32Array(0)

  return (
    <group scale={globeScale(progress)}>
      {/* The graticule first and the land over it. It is a dozen meridians and a
          handful of parallels rather than a shell of sea, and the difference is a
          measurement: a full second lattice cost twice the render budget this
          block is allowed and ten times the bitrate of a plain title.
          `globeField` carries the numbers. */}
      <Dots
        positions={globeVisible(globeGraticule(), yaw, tilt, shell)}
        color={ink}
        size={Math.max(1, Math.round(dot * 0.6))}
        opacity={GLOBE_GRID_ALPHA * progress}
      />
      {/* The land and the connections in ONE buffer: a cloud costs about fifteen
          milliseconds a frame whatever is in it, so a third one would be almost a
          second of render per second of film for an ink the land is already
          painted in. `joinPoints` carries the measurement, and it is also what
          makes a dense arc free: the bill is per BUFFER, so the points that turn
          a trail into a stroke are added to a buffer already being rebuilt. */}
      <Dots
        positions={joinPoints(globeVisible(field.land, yaw, tilt, shell), arcs)}
        color={ink}
        size={dot}
        opacity={GLOBE_LAND_ALPHA * progress}
      />

      {lit.map((marker, i) => {
        if (!marker.shown) return null
        const place = [marker.x * shell, marker.y * shell, marker.z * shell]
        const radius = globeMarkerRadius(side, dot)
        const ripple = globeMarkerRipple(life, i)
        return (
          <group key={i}>
            <mesh position={place}>
              {/*
                Coarse on purpose: a marker is a few pixels across, so segments past
                this buy nothing an encoder keeps and cost the one budget this block
                spends. `sphereGeometry` and not a point, and the reason is no longer
                the one written here — it used to say a round sprite needed a file,
                which `pointSprite.js` disproved. What is left is that a marker is
                its OWN object: `globeMarkerLight` gives each one its own opacity
                and the ripple below gives each one its own geometry, and a
                per-point alpha is the one thing `<points>` cannot be given without
                vertex colours, which is a second material at a density nobody
                measured.
              */}
              <sphereGeometry args={[radius, 10, 8]} />
              {/*
                Basic and not Lambert: there is no light in this scene at all. A
                shell of points is unlit by construction, and a lit marker beside
                unlit dots would be the one object in the block painted at a
                brightness the palette did not resolve.
              */}
              <meshBasicMaterial color={ink} transparent opacity={marker.light * progress} toneMapped={false} />
            </mesh>
            {/*
              THE RIPPLE, and it is the answer to a field a viewer could not read.
              A marker is the accent on a shell of the accent, so brightness is
              worth a tenth and no more - see `GLOBE_LIMB_BAND`. What a single ink
              still has is a SHAPE that moves: a ring of ground inside a ring of
              ink, leaving the place as it lights. Laid on the surface rather than
              facing the camera, so it turns into an ellipse towards the limb and
              reads as being ON the world; `globeFaceRotation` is that orientation,
              and it is arithmetic because `lookAt` is a `three` import this
              directory may not make.
            */}
            <mesh position={place} rotation={globeFaceRotation(marker)}>
              <ringGeometry args={[radius * ripple.at * (1 - GLOBE_RIPPLE_WIDTH), radius * ripple.at, 24]} />
              <meshBasicMaterial
                color={ink}
                transparent
                depthWrite={false}
                opacity={ripple.light * marker.light * progress}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/**
 * The canvas this block needs, for `BLOCK_CANVASES` in `blocks/canvases.js`.
 *
 * Square, on the smaller side of the box: the drawing is bounded by
 * `GLOBE_RADIUS`, which is the radius at which a ball about the origin touches
 * the edge of its canvas and never crosses it. There is no `size` to divide it
 * by — a globe is the subject of its scene when it is in one, and a document that
 * wants a smaller one anchors it to a smaller zone.
 *
 * The SPHERE is not that radius, and the difference is the whole of `globeShell`:
 * an arc bows off the surface, a marker stands on it and a ripple lies across it,
 * so the ball yields whatever those three need and the DRAWING is what touches
 * the edge. The canvas is unchanged by it, which is why this function is: what a
 * globe is entitled to is still the minor side of its box.
 */
export const GLOBE_CANVAS = (block, box, base) => {
  const side = globeCanvas(box, base)
  return { width: side, height: side, camera: GLOBE_CAMERA }
}
