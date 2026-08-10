// The staged pictures, as GL textures — the one bridge between Mocky's image
// library and a block drawn by a renderer.
//
// ── Why this is a file of its own, next to the compositions ──────────────────
//
// Because it is the only part of the 3D family that needs `three`, and `three` is
// installed in `worker/video/package.json` and nowhere else. `blocks/index.js`
// imports every component and `blocks.test.js` loads that registry inside Mocky's
// own vitest suite to prove it matches the schema in both directions — so a block
// that imported a texture loader would take the registry out of the one test that
// keeps it honest. That is the same rule `solidScene.jsx` obeys by returning bare
// intrinsics, applied to the one thing intrinsics cannot express: a `map` is an
// OBJECT, not a tag.
//
// So the loading happens where the canvas is opened. `ComposedSceneVideo` already
// imports `remotion` and `@remotion/three`; adding `three` there is not a new
// question, and the blocks stay loadable.
//
// ── The race this exists to close, which is the whole of the file ────────────
//
// A texture loads asynchronously. Remotion's answer to that is `delayRender`: hold
// the frame until the picture is in. That alone is NOT enough here, and the reason
// is specific to a 3D block: the panel's GEOMETRY is derived from the picture's
// own shape, so a component that rendered before the image decoded computed its
// slab from a fallback aspect. Continuing the render at that moment captures a
// frame whose material is right and whose dimensions are wrong.
//
// Worse, it would be intermittent. Remotion renders many frames per page and the
// pages start at different frames under concurrency, so the fallback would land on
// whichever frame happened to be first — a film that differs between two runs of
// one document, which the content-addressed export store files as two films.
//
// The fix is to release the frame only from an EFFECT that runs after a render in
// which the images are present: load, mark ready, re-render, then continue. The
// `total === 0` branch is what keeps a scene with no pictures from waiting for
// nothing.
import { useEffect, useMemo, useState } from 'react'
import { continueRender, delayRender } from 'remotion'
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, TextureLoader } from 'three'

/**
 * How obliquely a texture is still sampled properly — and the one number in this
 * family that was chosen by measuring rather than by reading.
 *
 * A panel of this family spends most of its scene turned away from the camera,
 * which is exactly the case a mipmapped texture without anisotropy renders as a
 * blurred smear along one axis: the "mou" this feature already has a
 * `resolution.ts` about, arriving through a sampler instead of through a source
 * that was too small.
 *
 * It is not free, and the cost is not where it looks. On the two-core container
 * a `photoStage` at an ORBIT is within the noise at every setting — the panel is
 * near square to the camera and the cheap path is taken. A `turn` is not: it
 * sweeps through the grazing angles where the full tap count fires, and six
 * seconds of one measured 20.1 s at sixteen taps, 16.0 s at four and 13.4 s with
 * anisotropy off, against a 12.3 s control. Four is where that curve stops being
 * worth it: it keeps the sharpness through the angles a picture is actually read
 * at, and gives up the ones where the panel is nearly edge-on and nobody is
 * reading it.
 *
 * `three` clamps this to the device maximum, so it is a request rather than an
 * assumption.
 */
export const STAGE_ANISOTROPY = 4

/**
 * The pictures a scene's 3D blocks need, as textures, keyed by image id.
 *
 * @param {string[]} ids       image ids, in any order; duplicates are one texture
 * @param {Record<string,string>} imageSrc  the staged paths, from `staging.js`
 */
export function useStageTextures(ids, imageSrc) {
  // A stable key, so a scene that names the same pictures in the same order
  // resolves one texture set for the whole of its life rather than one per frame.
  // Remotion re-renders this tree for each of a film's frames, and a loader that
  // ran again on every one of them would upload the same picture 3600 times.
  const key = ids.join('|')
  const [handle] = useState(() => delayRender(`Mocky: decoding the pictures a 3D block stands on`))
  const [ready, setReady] = useState(false)

  const loaded = useMemo(() => {
    const textures = {}
    const state = { total: 0, left: 0 }
    const loader = new TextureLoader()
    for (const id of new Set(ids)) {
      const src = imageSrc?.[id]
      // A picture with no staged path is one the worker refused long before a
      // frame. The block draws its body and no face, which is a panel with
      // nothing on it rather than a render that died half a minute in (Q1).
      if (!src) continue
      state.total += 1
      state.left += 1
      const done = () => {
        state.left -= 1
        if (state.left === 0) setReady(true)
      }
      const texture = loader.load(src, done, undefined, done)
      // sRGB, or the picture renders visibly washed out: `three` has treated a
      // texture's colour space as linear-by-default since r152, and a photograph
      // is not linear data. This is the same class of mistake as `LIGHT_UNIT` one
      // file over — a renderer's units quietly disagreeing with the arithmetic.
      texture.colorSpace = SRGBColorSpace
      texture.anisotropy = STAGE_ANISOTROPY
      // Mipmapped down, sharp up. A panel is almost always drawn SMALLER than its
      // source — `resolution.ts` asks a provider for 1344 px and a block gets a
      // fraction of a 1920 px frame — so minification is the case that matters,
      // and an unmipmapped minified texture shimmers from frame to frame.
      texture.minFilter = LinearMipmapLinearFilter
      texture.magFilter = LinearFilter
      textures[id] = texture
    }
    return { textures, state }
    // `imageSrc` is deliberately not a dependency: it is rebuilt object-identical
    // on every frame by the composition, and depending on it would defeat the
    // memo entirely. The paths behind a given set of ids do not change during a
    // render — `staging.js` writes them once, before the bundle is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    // Nothing to wait for, or everything is in AND this render is the one that
    // saw it. Releasing the frame anywhere else is the race in the header.
    if (loaded.state.total === 0 || ready) continueRender(handle)
  }, [handle, loaded, ready])

  return loaded.textures
}
