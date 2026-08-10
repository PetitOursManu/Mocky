/**
 * `depthGrid` - a floor of rules, running away from the eye.
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
 *             camera, and the floor is measured against `FIELD_VIEW`.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge. Unused here, for the same reason as `box`.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, through `palette.accent` - the ornament's own run, which is what every decoration in this catalogue carries. Anchored `full` under a stack this block IS a surface: `FIELD_PAINTS` says it paints the accent, `stackedField` is what measures whatever stands on it, and the density it cedes is `palette.field.alpha` applied to the ZONE by `ComposedSceneVideo`.
 *
 * LEGIBILITY: No text. Every rule is painted in one colour at an opacity between nothing and one, so what lands on the frame is somewhere between the bare ground and the accent - and those are exactly the two colours `composedPalette` measures for a field of this kind, which is what makes the fade below free rather than a surface nobody sampled. The fade is not decoration: undimmed, the rules converge towards the horizon into a band of alternating pixels, which is the high-frequency detail h264 spends its whole allowance on and precisely what got a wireframe refused at sixteen times the bitrate of a lit solid. A decoration cedes to a word and it also cedes to a bitrate.
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
 * **This file imports nothing from `three` either.** `<group>`, `<mesh>`,
 * `<boxGeometry>` and `<meshBasicMaterial>` are lower-case strings the
 * reconciler resolves at render time. An import here would take
 * `blocks/index.js` out of Mocky's own vitest suite, where `three` is no more
 * installed than Remotion is.
 *
 * -- Why the rules are BOXES and not lines -----------------------------------
 *
 * `<lineSegments>` is the obvious drawing and it is the refused one. A line
 * primitive is one pixel wide whatever its depth, so a floor drawn with them has
 * no perspective in its thickness at all - the near rules and the far ones are
 * the same weight, which is the single strongest cue that a picture is flat. It
 * is also, in this container's software rasteriser, the geometry that got a
 * wireframe torus refused at 2.7 s of render per second of film. A long thin box
 * is a solid: it thins with distance because everything does, and it costs two
 * triangles per face.
 *
 * -- What this block costs ----------------------------------------------------
 *
 * +0.28 s of render per second of film at 1080p full frame on the two-core
 * worker as a `floor`, and +0.85 s/s as the densest `tunnel` the schema allows,
 * against the ~1.7 s/s the deadline leaves spare. What it really spends is
 * BITRATE: 1.3 MB for six seconds as a floor and 4.1 MB as that tunnel, against
 * a lit solid's 0.9. Unfogged and undimmed the same tunnel was 6.0 MB and
 * +1.15 s/s, which is what `GRID_FOG_DENSITY` and the fade are for. The numbers
 * are in `docs/video-export.md`.
 */
import {
  GRID_DEPTH,
  GRID_FOG_DENSITY,
  GRID_LIFT,
  GRID_SPAN,
  GRID_TILT,
  gridRules,
  gridSway,
  gridThickness,
} from './field.js'

/**
 * One half of the floor: the rules, laid out in the plane's own coordinates.
 *
 * `flip` is -1 for the mirrored half of a `tunnel`. It negates the travelling
 * rules' positions rather than scaling the group, because a negative scale turns
 * every box inside out - and a `meshBasicMaterial` draws front faces only, so
 * the ceiling of the tunnel would have been an empty half of the frame.
 */
const Rules = ({ rules, thickness, color, flip, presence }) => (
  <>
    {rules.map((rule, i) =>
      rule.axis === 'depth' ? (
        <mesh key={i} position={[rule.at, 0, 0]}>
          <boxGeometry args={[thickness, GRID_DEPTH, thickness]} />
          <meshBasicMaterial color={color} transparent opacity={rule.opacity * presence} />
        </mesh>
      ) : (
        <mesh key={i} position={[0, rule.at * flip, 0]}>
          <boxGeometry args={[GRID_SPAN, thickness, thickness]} />
          <meshBasicMaterial color={color} transparent opacity={rule.opacity * presence} />
        </mesh>
      ),
    )}
  </>
)

export const DepthGrid = ({ block, palette, progress, life }) => {
  const rules = gridRules(block.lines, block.travel, life)
  const thickness = gridThickness(block.lines)
  const color = palette.accent.color
  const sway = gridSway(block.travel, life)
  // The arrival: the floor drops into place from below the frame and the whole
  // of it fades up. A rule that slid in from one side would be a rule crossing
  // the zone next to it, and this block has no zone - it has the frame.
  const lift = GRID_LIFT + (1 - progress) * GRID_LIFT * 0.35

  return (
    <>
      {/*
        The far end of the floor, dissolved into the ground behind it.

        Attached to the SCENE — `attach="fog"` puts it on the object this tree
        hangs from — because fog is a property of the space and not of a mesh,
        and the alternative is a per-rule opacity that cannot know how far the
        far END of a rule is. It is the one thing in this file that reads a
        colour off the palette other than the accent, and it is the ground's own:
        blending towards it keeps every pixel of this block between the two
        colours the palette measured for it, which is the whole of the guarantee.

        `GRID_FOG_DENSITY` carries the measurement. Without it the densest legal
        floor cost 6.0 MB for six seconds and 1.15 s of render per second of
        film, both of them spent on a band of converging pixels near the horizon.
      */}
      <fogExp2 attach="fog" args={[palette.ground.color, GRID_FOG_DENSITY]} />
      <group rotation={[0, sway, 0]}>
        {/* Below the eye and receding: a floor. */}
        <group position={[0, -lift, 0]} rotation={[GRID_TILT, 0, 0]}>
          <Rules rules={rules} thickness={thickness} color={color} presence={progress} flip={1} />
        </group>
        {/*
          And the same floor mirrored above, when the document asked for a
          tunnel. A floor alone leaves the top of the frame on the bare ground,
          which is a horizon and reads as one - right for a scene about distance,
          wrong for a scene that wanted the whole frame to be this. It is the
          default for that reason: the case a silent document gets has to be the
          good one.
        */}
        {block.form === 'tunnel' ? (
          <group position={[0, lift, 0]} rotation={[-GRID_TILT, 0, 0]}>
            <Rules rules={rules} thickness={thickness} color={color} presence={progress} flip={-1} />
          </group>
        ) : null}
      </group>
    </>
  )
}
