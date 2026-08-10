/**
 * `waveMesh` - a lit surface, swelling.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`. Unused: this
 *             block sets no type and has no corner.
 *   box       THIS block's own box in pixels. This component never reads it: the
 *             canvas is sized by `fieldCanvas(box)` and opened around this block
 *             by `ComposedSceneVideo`. Inside it there is no box - there is a
 *             camera, and the sheet is measured against `FIELD_VIEW`.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge. Unused here, for the same reason as `box`.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, through `palette.solid` - a material colour and an ambient share, resolved by `solidShading`. Anchored `full` under a stack this block IS a surface, and `FIELD_PAINTS` is where that is written down; nothing about it appears below, for the reason the equalizer gives - `full` is what makes a block a field, so the rule lives where `full` means something.
 *
 * LEGIBILITY: No text, and the same extension of the guarantee `solidScene` needed rather than the flat one every other field gets. A Lambert face is `material x (ambient + directional . n.l)` with the two intensities summing to one, so every point of this sheet lies on the segment between `material x ambient` and `material`; contrast against a fixed surface is monotone in luminance on each side of it, so measuring the two ENDS measures the whole sheet. That is what `solidShading` returns and what `fieldColors` samples for this kind. The material is the ORNAMENT's run - the accent, resolved on the bare ground - and never the display ink: a surface painted in the ink of the words standing on it meets them at 1:1 wherever they overlap, which is the founding mistake of the whole legibility section and one a full-frame sheet would repeat at the largest possible scale.
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
 * -- And a third rule, which only the three fields and the solid have to obey --
 *
 * **This file imports nothing from `three` either.** `<mesh>`, `<planeGeometry>`
 * and `<meshLambertMaterial>` are lower-case strings the reconciler resolves at
 * render time; the displacement is a plain loop over a `Float32Array` in
 * `field.js`. An import here would take `blocks/index.js` out of Mocky's own
 * vitest suite, where `three` is no more installed than Remotion is, and that
 * suite is the only thing proving the registry matches the schema.
 *
 * -- Why the sheet is this large, and why it must stay that way ---------------
 *
 * A surface that does not cover the frustum draws an EDGE across the frame, and
 * a sheet with a visible edge is an object floating in a void - the defect the
 * whole box rule was written against, arriving through a geometry instead of
 * through a share. `WAVE_WIDTH` and `WAVE_DEPTH` are derived from the camera
 * rather than chosen, and `field.test.js` holds the inequality for both tilts.
 *
 * -- What this block costs, because it is the one that costs ------------------
 *
 * The most expensive block in the catalogue and the reason `FIELD_PIXEL_BUDGET`
 * exists. Drawn at its box's own pixels, a full-frame lit sheet measured +1.7 s of
 * render per second of film on the two-core worker - the whole of the ~1.7 s/s
 * the duration-scaled deadline leaves spare, for one block of one scene. Drawn
 * inside the budget and stretched back over its box it measured +1.0 s/s, which
 * is a `solidScene` and change, and a lit relief has nothing on it finer than
 * the gradient across it. It is still the dearest block in the catalogue and the
 * card in the compose prompt says so. The numbers are in
 * `docs/video-export.md`.
 */
import {
  LIGHT_UNIT,
  WAVE_DEPTH,
  WAVE_LIGHT,
  WAVE_SEGMENTS_X,
  WAVE_SEGMENTS_Y,
  WAVE_WIDTH,
  waveDisplace,
  waveTilt,
} from './field.js'
import { useLayoutEffect, useRef } from 'react'

export const WaveMesh = ({ block, palette, progress, life }) => {
  const geometry = useRef(null)

  useLayoutEffect(() => {
    const sheet = geometry.current
    if (!sheet) return
    const position = sheet.attributes?.position
    if (!position) return
    waveDisplace(position.array, block.swell, life)
    position.needsUpdate = true
    // The normals are what make the swell visible at all: a Lambert face is lit
    // by its normal, and a displaced plane whose normals still point at the
    // camera is a flat rectangle of one colour with the arithmetic running
    // underneath it. Recomputed rather than derived by hand because the
    // derivative of three sines is a fourth place for the wave to be written
    // down, and the two would drift the day a swell is added.
    sheet.computeVertexNormals()
  })

  return (
    <>
      {/*
        Two lights and no more, at the intensities `solidShading` resolved. The
        ambient is the share it computed and the directional is the rest, so the
        sheet lies exactly on the segment that was measured; a third light would
        put a crest outside it. `LIGHT_UNIT` is this renderer's own unit - three
        divides a punctual light by pi since r155 - and without it the arithmetic
        and the picture disagree, which is the one failure this whole section
        exists to prevent, arriving through a renderer rather than through a hex
        value.
      */}
      <ambientLight intensity={palette.solid.ambient * LIGHT_UNIT} />
      {/*
        Placed to the side and high rather than over the camera's shoulder, which
        is where `solidScene` puts its light and where this one had it in the
        first render. A solid turns, so any light angle finds its faces; a sheet
        does not turn — it undulates in place — so a light coming from behind the
        lens meets every crest at nearly the same angle and the sea comes back a
        flat slab with a contour drawn on it. Grazing light is what a relief is
        read by.
      */}
      <directionalLight position={WAVE_LIGHT} intensity={(1 - palette.solid.ambient) * LIGHT_UNIT} />
      {/*
        The arrival is a rake that settles rather than a fade: the sheet swings
        the last few degrees into its tilt as it arrives, which is a camera move
        made of a rotation and costs no second material. It is bounded by the
        tilt itself, so the near edge cannot swing through the camera.
      */}
      <mesh rotation={[waveTilt(block.tilt) * (0.55 + 0.45 * progress), 0, 0]}>
        <planeGeometry ref={geometry} args={[WAVE_WIDTH, WAVE_DEPTH, WAVE_SEGMENTS_X, WAVE_SEGMENTS_Y]} />
        {/*
          Lambert and not Standard, for `solidScene`'s reason: a physical
          material adds a specular highlight computed from a roughness nobody
          set, which is a crest brighter than the material colour - outside the
          segment above, and therefore outside the guarantee. It is also the
          cheaper shader, on the one block whose cost is measured in render
          seconds.

          The opacity is the arrival, and it is what stops the sheet being on
          the frame before its own cue - `cueProgress` answers zero until then,
          and a block visible at zero is a block that did not arrive. Every value
          it passes through is a blend of the ground and the material, which is
          inside the pair `fieldColors` samples for this kind, so arriving costs
          the guarantee nothing.
        */}
        <meshLambertMaterial color={palette.solid.color} transparent={progress < 1} opacity={progress} />
      </mesh>
    </>
  )
}
