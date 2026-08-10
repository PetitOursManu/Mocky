/**
 * `photoRing` - several pictures standing on a carousel, turning past the camera.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`. Unused: this block sets no type and a box geometry
 *             has no corner radius.
 *   box       THIS block's own box in pixels. Read for its SHAPE and nothing
 *             else — the canvas is the box, so the frustum is as wide as the box
 *             is, and `ringAspect` is how the fit learns which rectangle it is
 *             solving inside. There is no box inside the canvas; there is a
 *             camera, and `frustumScale` is the box's stand-in.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge, for the canvas fallback and nothing else.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene: the ring turns for all of it.
 *   images    staged pictures by id. The pixels arrive through `textures`.
 *   textures  the same pictures as GL textures, loaded by `ComposedSceneVideo`
 *             and held by a `delayRender` until they have decoded.
 *
 * SURFACE: the ground, through `palette.solid` - the material colour and ambient share `solidShading` resolved. Every panel's body is painted with it; nothing else in this file chooses a colour. Anchored `full` under a stack this block IS a surface, and `FIELD_PAINTS` names it `solid`.
 *
 * LEGIBILITY: This block sets no type. As a surface it is `photoStage`'s case exactly, and the sentence is worth repeating rather than cross-referencing because a block that carries no text is the one whose author stops thinking about contrast: the BODIES are `palette.solid`, the ornament's run resolved on the bare ground and shaded along a Lambert segment both of whose ends were measured, so a heading standing on this field is measured against what the field paints. The PICTURES are the honest gap `gallery` and `carousel` already name — nobody in this process has opened them — and nothing here paints text over one. A caption belongs to a `kicker` in a zone of its own, on a surface somebody computed.
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** Both
 *      arrive as props, out of `composition.js` and `stage.js`, where a test can
 *      reach them.
 *   2. **No `remotion` import, ever**, and no `three` import either. The frame
 *      arrives as `progress` and `life`; every element below is a
 *      react-three-fiber intrinsic, and the canvas that gives those strings a
 *      meaning is opened by `ComposedSceneVideo`. One import of either package
 *      would take `blocks/index.js` out of Mocky's own vitest suite, where
 *      neither is installed.
 *
 * -- What a ring is, and the one thing it is allowed to do that no flat block is -
 *
 * It runs past the edges of its own box. The panel at the FRONT is fitted whole —
 * `frustumScale` holds it on both axes — and the ones turned away are held only
 * top and bottom, so they leave through the sides. That is what a carousel does,
 * and it is what the flat `carousel` block already does with `overflow: hidden`;
 * held on all four sides instead, a six-picture ring composes each panel at a
 * tenth of a portrait frame, which is the small element in a large void this
 * feature spent a pass removing. What is never allowed is a picture cut along the
 * top or the bottom: that reads as a layout that overflowed rather than as a
 * carousel, and `stage.test.js` holds the difference.
 *
 * Every panel is the same SLOT and each picture is fitted inside its own, which
 * is what makes a row of pictures read as a set — and what stops one header
 * banner among five screenshots from asking for a ring twice as wide as the rest
 * need. A rendered frame is what settled that: sized on the widest picture, a
 * carousel of five came back as a row of specks in a black frame. `ringSlotAspect`
 * carries the whole argument, and nothing is cropped: what shows around a wide
 * picture is the body, which is a colour the palette measured.
 */
import {
  BACK_TURN,
  LIGHT_UNIT,
  STAGE_LIGHT,
  photoRingLayout,
  pictureAspect,
  ringAspect,
  ringPlacement,
  stageEnter,
} from './stage.js'

export const PhotoRing = ({ block, palette, box, base, progress, life, textures }) => {
  const ids = block.imageIds
  // The RING's own surface and not the box: it is drawn inside a pixel budget
  // and painted back over its box, so the frustum is as wide as the surface.
  const canvas = ringAspect(box, base)
  const shapes = ids.map((id) => pictureAspect(textures?.[id], canvas))
  const layout = photoRingLayout(block, shapes, canvas)
  const scale = layout.scale * stageEnter(progress)

  return (
    <>
      {/*
        The same two lights `photoStage` and `solidScene` use, outside the ring so
        that a panel is lit by where it has turned to rather than carrying its own
        highlight round with it. That swing is the whole depth cue of a carousel:
        the ring's tilt never changes, so without it a turning ring is a row of
        pictures changing width.
      */}
      <ambientLight intensity={palette.solid.ambient * LIGHT_UNIT} />
      <directionalLight position={STAGE_LIGHT} intensity={(1 - palette.solid.ambient) * LIGHT_UNIT} />
      {/* The lean is the LAYOUT's, never a constant read a second time here: the
          fit sampled the panels at it, and a ring drawn at another one is a
          carousel fitted to a frame it is not in. It opens on a portrait canvas
          for the reason `ringTilt` gives — a flat ellipse spends measure and
          leaves height, which is a strip of stamps in a 9:16 column. */}
      <group scale={scale} rotation={[layout.tilt, 0, 0]}>
        {layout.panels.map((panel, index) => {
          const at = ringPlacement(ids.length, index, life, block.direction, layout.radius)
          const texture = textures?.[ids[index]]
          const face = [2 * panel.picture.x, 2 * panel.picture.y]
          return (
            <group key={index} position={at.position} rotation={[0, at.yaw, 0]}>
              <mesh>
                <boxGeometry args={[2 * panel.body.x, 2 * panel.body.y, 2 * panel.body.z]} />
                {/*
                  Lambert and not Standard, for `solidScene`'s reason: a physical
                  material adds a specular highlight from a roughness nobody set,
                  which is a face brighter than the material colour and therefore
                  outside the segment that was measured. It is also the cheaper
                  shader, on the block of this family that draws the most of them.
                */}
                <meshLambertMaterial color={palette.solid.color} />
              </mesh>
              {texture ? (
                <mesh position={[0, panel.offsetY, panel.faceZ]}>
                  <planeGeometry args={face} />
                  {/*
                    Basic and not Lambert on a photograph, for the reason
                    `photoStage` gives at length: a picture carries its own
                    exposure, and shading it again would animate the brightness of
                    something somebody already lit. The body carries the light.
                  */}
                  <meshBasicMaterial map={texture} />
                </mesh>
              ) : null}
              {/*
                THE SAME PICTURE ON THE REVERSE, and it is not a flourish.

                A ring's panels face outward, so at any moment two or three of
                them are showing the camera their BACKS — and a back is the body,
                which is the project's accent at the size of a panel. A rendered
                frame is what said so: a carousel of five came back as two slabs
                of saturated violet either side of one photograph. A double-sided
                print is what a carousel is made of; turned half a turn about its
                own axis, the picture reads the right way round from behind
                instead of mirrored.
              */}
              {texture ? (
                <mesh position={[0, panel.offsetY, -panel.faceZ]} rotation={[0, BACK_TURN, 0]}>
                  <planeGeometry args={face} />
                  <meshBasicMaterial map={texture} />
                </mesh>
              ) : null}
            </group>
          )
        })}
      </group>
    </>
  )
}
