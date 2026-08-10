/**
 * `photoStage` - one picture from the library, standing in real perspective.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`. Unused here:
 *             this block sets no type and a corner radius is not something a
 *             box geometry has.
 *   box       THIS block's own box in pixels. Read for its SHAPE and for nothing
 *             else: the canvas is sized by `photoStageStage(box)` and opened
 *             around this block by `ComposedSceneVideo`, so what arrives here is
 *             already a rectangle of the right number of pixels — but the frustum
 *             is as wide as that rectangle, so the fit has to know which
 *             rectangle it is. `stageAspect` reads it through the same rounding
 *             the canvas was built with. Inside the canvas there is no box; there
 *             is a camera, and `frustumScale` is the box's stand-in.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge. Unused, for the same reason as `box`.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Read only for the count; the pixels arrive
 *             through `textures`.
 *   textures  the same pictures as GL textures, loaded by `ComposedSceneVideo`
 *             and held by a `delayRender` until they have decoded. Only the two
 *             blocks of this family read it.
 *
 * SURFACE: the ground, through `palette.solid` - a material colour and an ambient share, resolved by `solidShading`. The body of the panel is painted with it and nothing else in this file chooses a colour. Anchored `full` under a stack this block IS a surface, and `FIELD_PAINTS` is where that is written down.
 *
 * LEGIBILITY: This block sets no type, and it is a SURFACE rather than a run. Two halves, and only one of them is closed. The body — the rim, the mount, the case, the back of the card — is `palette.solid`: the ornament's run resolved on the bare ground, shaded on the Lambert segment `solidShading` measured, so every face of it clears the display floor against the ground it stands on. `FIELD_PAINTS` names this block `solid` for that reason, and `fieldColors` samples the two ends of that segment when a stack is laid over it. The other half is the PICTURE, and it used to be the honest gap `gallery`, `carousel` and `imageFrame` also carried: what a heading standing on it was measured against was the accent rather than the pixels, and a real export of this exact scene put white type on pale wood at 1.68:1. It is closed. `FIELD_PAINTS` names this block `solid` AND `picture`, because it paints both, and `fieldedGround` bounds a photograph at black and at white with the zone density as what cedes. Nothing here paints text over a photograph, which is the part this file can decide: a caption belongs to a `kicker` in a zone of its own, measured against a surface somebody computed.
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** A hex
 *      value in this file is a colour nobody measured; a curve is a sixth notion
 *      of how things move. Both arrive as props, out of `composition.js` and
 *      `stage.js`, where a test can reach them.
 *   2. **No `remotion` import, ever.** Nothing here needs a frame hook - the
 *      frame arrives as `progress` and `life` - and staying free of it is what
 *      lets `blocks.test.js` load the whole registry inside Mocky's own suite,
 *      where Remotion is not installed.
 *
 * -- And the third rule, which only this family and `solidScene` obey ---------
 *
 * **This file imports nothing from `three` either.** `blocks/index.js` imports
 * every block and `blocks.test.js` loads that registry inside Mocky's own vitest
 * suite; `three` is installed in `worker/video/package.json` and nowhere else, so
 * one import here would take the whole registry out of the test that keeps it
 * honest.
 *
 * It does not need one. Every element below is a react-three-fiber INTRINSIC —
 * `<mesh>`, `<boxGeometry>`, `<meshBasicMaterial>` are lower-case strings the
 * reconciler resolves at render time, the same way `<div>` is resolved by
 * react-dom. The canvas that gives those strings a meaning is `ThreeCanvas`,
 * opened by `ComposedSceneVideo` around this block, with the camera
 * `photoStageStage` named. The renderer is the composition's business, as the
 * frame, the layout and the palette already are.
 *
 * -- Why the picture is fitted rather than cropped ---------------------------
 *
 * The panel takes the PICTURE's own shape. A `cover` crop would need the texture's
 * `repeat` and `offset` nudged, which is a mutation of an object several meshes
 * share, and it would throw away part of a photograph somebody chose — in a block
 * whose whole subject is that photograph. Fitted, the enlargement is bounded by
 * the box exactly as it is for a flat `imageFrame`, and `stage.test.js` states
 * that as arithmetic: a stage never magnifies a source more than the same box
 * would flat. A soft texture is as ugly in three dimensions as in two.
 */
import {
  BACK_TURN,
  LIGHT_UNIT,
  STAGE_LIGHT,
  photoStageLayout,
  pictureAspect,
  stageAspect,
  stageEnter,
  stageRotation,
} from './stage.js'
import { litAmbient } from './shading.js'

export const PhotoStage = ({ block, palette, box, base, progress, life, textures }) => {
  const ids = block.imageIds
  const front = textures?.[ids[0]]
  // The second picture is the BACK of the card, and it is absent far more often
  // than it is present. With none, the reverse is the body's own material — a
  // card turned over to show nothing is still a card, which is the calm case.
  const back = ids.length > 1 ? textures?.[ids[1]] : undefined

  const canvas = stageAspect(box, base)
  // A picture that could not be measured takes the CANVAS's shape: the least
  // surprising rectangle to leave empty is the one the layout handed over (Q1).
  const layout = photoStageLayout(block, pictureAspect(front, canvas), canvas)
  const turn = stageRotation(block.move, life)
  const scale = layout.scale * stageEnter(progress)
  // The palette's share, in the space this renderer shades in - `solidShading`
  // measures a multiplier on BYTES and `three` multiplies in linear light, so
  // the body of the panel was painted two thirds of the way back to its own
  // material and the rig stopped reading as light. See `shading.js`.
  const ambient = litAmbient(palette.solid.color, palette.solid.ambient)

  return (
    <>
      {/*
        Two lights and no more, the same rig `solidScene` uses and for the same
        reason: the ambient is the share `solidShading` computed, the directional
        is the rest, and together they are exactly the Lambert term the proof is
        written about. Any third light would put a face outside the segment that
        was measured. They sit OUTSIDE the turning group, or the shading would
        turn with the panel and the object would read as a flat picture being
        squeezed rather than as a panel coming round.
      */}
      <ambientLight intensity={ambient * LIGHT_UNIT} />
      <directionalLight position={STAGE_LIGHT} intensity={(1 - ambient) * LIGHT_UNIT} />
      <group scale={scale} rotation={[turn.pitch, turn.yaw, 0]}>
        <mesh>
          <boxGeometry args={[2 * layout.body.x, 2 * layout.body.y, 2 * layout.body.z]} />
          {/*
            Lambert and not Standard, for `solidScene`'s reason: a physical
            material adds a specular highlight computed from a roughness nobody
            set, which is a face brighter than the material colour — outside the
            segment above, and therefore outside the guarantee. It is also the
            cheaper shader, in a family whose cost is measured in render seconds.

            `toneMapped` off: react-three-fiber turns ACES tone mapping on by
            default, so this body came off the renderer at a value the palette
            never measured - and lower, which on a dark ground is less contrast
            than what was cleared. `shading.js` carries the measurement.
          */}
          <meshLambertMaterial color={palette.solid.color} toneMapped={false} />
        </mesh>
        {front ? (
          <mesh position={[0, layout.offsetY, layout.faceZ]}>
            <planeGeometry args={[2 * layout.picture.x, 2 * layout.picture.y]} />
            {/*
              BASIC and not Lambert on the picture, which is the one place this
              file deliberately steps outside the light rig. A photograph carries
              its own exposure; shading it again would darken a picture the person
              who made it already lit, and it would do it by an amount that
              changes as the panel turns — a photograph whose brightness animates
              reads as a fault. The body is what carries the light and therefore
              the depth. `toneMapped` is off for the same reason it is off on the
              body: a photograph put through a tone curve is not the photograph
              somebody staged, and the bound `fieldedGround` places on an
              unopened picture is a bound on the picture itself.
            */}
            <meshBasicMaterial map={front} toneMapped={false} />
          </mesh>
        ) : null}
        {back ? (
          <mesh position={[0, layout.offsetY, -layout.faceZ]} rotation={[0, BACK_TURN, 0]}>
            <planeGeometry args={[2 * layout.picture.x, 2 * layout.picture.y]} />
            <meshBasicMaterial map={back} toneMapped={false} />
          </mesh>
        ) : null}
      </group>
    </>
  )
}
