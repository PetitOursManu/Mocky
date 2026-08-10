/**
 * `solidScene` - a lit solid, turning in real perspective.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       THIS block's own box in pixels. This component never reads it: the
 *             canvas is sized by `solidCanvas(box, size)` and opened around this
 *             block by `ComposedSceneVideo`, so what arrives here is already a
 *             square of the right number of pixels. Inside it there is no box —
 *             there is a camera, and `SOLID_BOUND` is the box's stand-in.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge. Unused here, for the same reason as `box`.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, through `palette.solid` - a material colour and an ambient share, resolved by `solidShading`. Anchored `full` under a stack this block IS a surface, and `FIELD_PAINTS` is where that is written down; nothing about it appears here, for the reason the equalizer gives - `full` is what makes a block a field, so the rule lives where `full` means something.
 *
 * LEGIBILITY: No text. The solid is the one thing in this directory painted at more than one brightness, so the guarantee had to be extended rather than reused: a Lambert face lies on the segment between `material x ambient` and `material`, both ends are measured against the ground, and contrast is monotone between them. `solidShading` carries the proof. A light placed here instead would be the first face of an object nobody could see. TWO THINGS THAT WERE WRONG AND ARE NAMED HERE BECAUSE A RENDERED FILM IS WHAT FOUND THEM. The material used to be `palette.display.color`, the same ink a `heading` standing on this block uses, so the object and the word met at 1:1 wherever they overlapped; it is the ORNAMENT's run now - the accent, which is what a decoration carries everywhere else in this file. And this block anchored `full` under a stack used to escape the measurement entirely: `fieldedGround` sampled a field painted in the accent, which is what `equalizer`, `soundWave`, `map` and the two charts paint and what this one did not, so `field.alpha` walked its whole ladder against a colour nothing on the frame carried and dimmed the solid without ever helping the heading - a flat grey torus behind a title, in a real export. The palette knows which ink a field paints now (`FIELD_PAINTS`), and the two ends of the segment above are what it samples for this one.
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
 * -- And a third rule, which only this file has to obey ----------------------
 *
 * **This file imports nothing from `three` either, and that is not a style
 * choice.** `blocks/index.js` imports every block, and `blocks.test.js` loads
 * that registry inside Mocky's own vitest suite to prove it matches the schema in
 * both directions. `three` is installed in `worker/video/package.json` and
 * nowhere else, exactly as Remotion is — so an import here would take the whole
 * registry out of the one test that keeps it honest, which is a far larger loss
 * than the import was worth.
 *
 * It does not need one. Every element below is a react-three-fiber INTRINSIC —
 * `<mesh>`, `<boxGeometry>`, `<meshLambertMaterial>` are lower-case strings the
 * reconciler resolves at render time, the same way `<div>` is resolved by
 * react-dom. What this component returns is a description of a scene; the canvas
 * that gives those strings a meaning is `ThreeCanvas`, opened by
 * `ComposedSceneVideo` around this block and around no other. The renderer is
 * the composition's business, as the frame, the layout and the palette already
 * are.
 *
 * -- What `size` means, and what it used to mean -----------------------------
 *
 * `small`, `medium` and `large` are shares of the block's own box, and until this
 * pass they were shares of a canvas the four solids then filled by four different
 * amounts: a sphere of radius 1.9 drew 82% of it, a torus of 1.7 + 0.62 drew all
 * of it, a cube of side 2.6 drew barely half. Three documents asking for `large`
 * got three sizes, and the worst of them shipped as a torus at 15% of the frame's
 * height. Every geometry is now built to one bounding radius, `SOLID_BOUND`,
 * which is the exact radius at which the camera's frustum touches the edge of the
 * canvas — so a solid fills the box the layout gave it, whichever solid it is.
 *
 * -- What this block costs, because it is the one that costs ------------------
 *
 * Measured on the two-core worker at 1080p: a full-frame lit sphere added 0.9 s
 * of render per second of film over a plain title, linearly — 14.9 s against 9.2
 * for six seconds, 65.6 against 39.1 for thirty. The duration-scaled deadline
 * leaves about 1.7 s/s spare at the schema's longest film, so it fits with room.
 * A WIREFRAME did not, at 2.7 s/s and sixteen times the bitrate, which is why the
 * schema has no wireframe rather than why this file avoids drawing one.
 */
import { SOLID_CAMERA_FOV, SOLID_CAMERA_Z, SOLID_LIGHT, solidGeometry, solidScale, solidSpin } from './setPiece.js'

/**
 * What "intensity 1" means to this renderer.
 *
 * three has used physically correct light units since r155: a punctual light's
 * radiance is divided by pi, and the migration note is to multiply the old
 * intensities by pi to keep the old look. Without it the first render came back a
 * mid grey where the arithmetic said near-white — a solid whose measured colour
 * and its painted colour disagreed, which is precisely the failure the whole
 * legibility section exists to prevent, arriving through a renderer's units
 * rather than through a hex value.
 *
 * It is here and not in `composition.js` because it is a property of THIS
 * renderer, not of the colour: the two intensities still sum to one before it is
 * applied, which is what keeps `solidShading`'s segment the segment it measured.
 */
const LIGHT_UNIT = Math.PI

/** The intrinsic name for each geometry the arithmetic can name. Strings, never classes. */
const GEOMETRIES = {
  box: 'boxGeometry',
  sphere: 'sphereGeometry',
  torus: 'torusGeometry',
  cylinder: 'cylinderGeometry',
}

export const SolidScene = ({ block, palette, progress, life }) => {
  const { geometry, args } = solidGeometry(block.solid)
  const spin = solidSpin(block.spin, life)
  const scale = solidScale(progress)
  const Geometry = GEOMETRIES[geometry] ?? GEOMETRIES.box

  return (
    <>
      {/*
        Two lights and no more. The ambient is the share `solidShading` computed,
        the directional is the rest, and together they are exactly the Lambert
        term the proof is written about: any third light would put a face outside
        the segment that was measured.
      */}
      <ambientLight intensity={palette.solid.ambient * LIGHT_UNIT} />
      <directionalLight position={SOLID_LIGHT} intensity={(1 - palette.solid.ambient) * LIGHT_UNIT} />
      <mesh rotation={[spin.x, spin.y, spin.z]} scale={scale}>
        <Geometry args={args} />
        {/*
          Lambert and not Standard: a physical material adds a specular highlight
          computed from a roughness nobody set, which is a face brighter than the
          material colour — outside the segment above, and therefore outside the
          guarantee. It is also the cheaper shader, on the one block whose cost is
          measured in render seconds.
        */}
        <meshLambertMaterial color={palette.solid.color} />
      </mesh>
    </>
  )
}

/** The camera every solid is seen from. Read by `ComposedSceneVideo`, which opens the canvas. */
export const SOLID_CAMERA = { position: [0, 0, SOLID_CAMERA_Z], fov: SOLID_CAMERA_FOV }
