/**
 * `particleField` - dust in real space, drifting.
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
 *             by `ComposedSceneVideo`, so what arrives here is already a viewport
 *             of the right number of pixels. Inside it there is no box - there is
 *             a camera, and `FIELD_VIEW` is the box's stand-in.
 *   unit      the type unit its stack agreed on. This block sets no type.
 *   base      the frame's SHORT edge. Unused here, for the same reason as `box`.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, through `palette.accent` - the ornament's own run, resolved on the bare ground with the veil locked, which is what every decoration in this catalogue carries. Anchored `full` under a stack this block IS a surface: `FIELD_PAINTS` says it paints the accent, `stackedField` is what measures whatever stands on it, and the density it cedes is `palette.field.alpha` applied to the ZONE by `ComposedSceneVideo`. Nothing about that appears below, for the reason the equalizer gives - the rule lives where `full` means something, so the twenty-eighth block cannot forget it.
 *
 * LEGIBILITY: No text. The dust is drawn in ONE colour - the accent - and the only thing that varies is how much of it is there, which runs from nothing at the block's cue to full once it has arrived. Every value in between is a blend of the ground and the accent, and those two are exactly the pair `fieldColors` samples for this kind, so nothing this block paints lands outside what was measured. It would have been easy to fade the FAR particles for depth as well, and that is refused on purpose: a per-point alpha is not something `<points>` can be given without vertex colours, so what it would really mean is a second material at a density nobody measured - and the depth cue is already there in `sizeAttenuation`, since the near dust is larger, which is what perspective does to a speck. The one thing this block must never do is paint in the ink of the words standing on it; it does not, because the ornament's run and the display ink are two different resolutions and `solidShading`'s note is where that mistake is written down.
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
 * **This file imports nothing from `three` either, and that is not a style
 * choice.** `blocks/index.js` imports every block, and `blocks.test.js` loads
 * that registry inside Mocky's own vitest suite to prove it matches the schema in
 * both directions. `three` is installed in `worker/video/package.json` and
 * nowhere else, exactly as Remotion is - so an import here would take the whole
 * registry out of the one test that keeps it honest.
 *
 * It does not need one. `<points>`, `<bufferGeometry>` and `<pointsMaterial>` are
 * lower-case strings the reconciler resolves at render time, the same way
 * `<div>` is resolved by react-dom, and the buffer they are handed is a plain
 * `Float32Array` out of `field.js`. What this component returns is a description
 * of a scene; the canvas that gives those strings a meaning is `ThreeCanvas`,
 * opened by `ComposedSceneVideo`.
 *
 * -- Determinism, which is this family's whole difficulty ---------------------
 *
 * There is no `Math.random` here and there is nowhere for one to hide: every
 * particle's place comes from its INDEX and the frame, through `particlePositions`,
 * and `field.test.js` proves two calls return the same bytes. A scattered field is
 * exactly the sentence that gets a die written, and the export store is
 * content-addressed - a film that differs by a pixel between two runs is two films
 * on the disk budget.
 *
 * -- What this block costs ---------------------------------------------------
 *
 * Measured on the two-core worker at 1080p, full frame: +0.25 s of render per
 * second of film at the count a silent document gets, +0.37 s/s at the schema's
 * ceiling, against the ~1.7 s/s the duration-scaled deadline leaves spare. That
 * is the cheapest of the three fields by a factor of four, and the ceiling on the
 * count is where it is because of the ENCODER rather than the renderer - see
 * `particleSize`, and `docs/video-export.md` for the numbers.
 */
import { particlePositions, particleSize, particleSpin } from './field.js'
import { SPRITE_ARGS } from './pointSprite.js'
import { useLayoutEffect, useMemo, useRef } from 'react'

export const ParticleField = ({ block, palette, progress, life }) => {
  const count = block.count
  // Allocated once and refilled in place. A film is nine hundred frames and a
  // fresh buffer on each of them is nine hundred allocations of the same size,
  // which is the one part of this block that is not the renderer's cost.
  const buffer = useMemo(() => particlePositions(count, block.drift, 0), [count, block.drift])
  const attribute = useRef(null)

  useLayoutEffect(() => {
    const target = attribute.current
    if (!target) return
    particlePositions(count, block.drift, life, target.array)
    target.needsUpdate = true
  })

  return (
    <points rotation={[0, particleSpin(block.drift, life), 0]}>
      <bufferGeometry>
        <bufferAttribute ref={attribute} attach="attributes-position" args={[buffer, 3]} />
      </bufferGeometry>
      {/*
        `sizeAttenuation` is the depth cue and it is the reason this is a field
        rather than a texture: a speck near the camera is drawn larger than one
        behind it, which is the only thing on the frame that says the dust has a
        volume.

        The dot is ROUND, and the sentence that used to stand here said it could
        not be: "a round one needs a texture or a shader — the first is an asset
        nobody staged and the second is a colour nobody measured — and at these
        sizes a square reads as a mote." A rendered frame said otherwise. At
        1080p these are eight to fourteen device pixels of hard-edged
        axis-aligned square, and what that reads as is a PIXEL — the one word the
        user of this feature used about the whole family. `pointSprite.js` is the
        answer to both halves of the objection: nothing is staged, because the
        mask is arithmetic handed to `<dataTexture>` (a lower-case intrinsic, the
        same way `<points>` is one), and nothing is coloured, because every texel
        is white and `PointsMaterial` multiplies the map by `color` — so what
        lands on the frame is still exactly `palette.accent.color`.

        `depthWrite` off, which the square never needed. An opaque square either
        covers a farther point or does not; a sprite with a soft edge writes
        depth over its own transparent corners, so the dust behind it is punched
        out in a square — the defect coming back through the fix. Nothing here
        depends on depth between two motes: the cloud is one draw call in one
        colour.

        The arrival is the material's opacity and not a scale, which is the one
        place this block differs from the solid next door: a cloud that grows out
        of the origin is a cloud converging on a point, and a field has no centre
        to converge on. See the legibility note above for why an opacity is free
        here and a second colour would not have been.

        `toneMapped` off, and it is the same class of thing as the colour
        space: react-three-fiber turns ACES tone mapping ON by default, so an
        ink chosen by measuring it against a ground comes off the renderer
        somewhere else - lower at every value, which on a dark ground is less
        contrast than what was cleared. `shading.js` carries the measurement,
        and `blocks.test.js` is what keeps the next material from forgetting it.
      */}
      <pointsMaterial
        size={particleSize(count)}
        color={palette.accent.color}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={progress}
        toneMapped={false}
      >
        {SPRITE_ARGS ? <canvasTexture attach="map" args={SPRITE_ARGS} /> : null}
      </pointsMaterial>
    </points>
  )
}
