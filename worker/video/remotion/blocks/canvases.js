// Which blocks need a GL canvas opened around them, how big it is, and what
// camera looks into it.
//
// ── Why this is a file of its own ────────────────────────────────────────────
//
// `ComposedSceneVideo` used to ask the question inline — `if (layer.kind !==
// 'solidScene') return drawn` — with the camera and the canvas size imported
// beside it. That was right while one block drew in GL and wrong the moment a
// second did: every 3D block would have added a branch to the same twenty lines
// of the same composition, which is exactly the arrangement `blocks/index.js`
// exists to avoid one directory over. Here a block that needs a renderer adds
// ONE line, and the composition keeps one way of opening a canvas rather than
// one per kind.
//
// It is not `index.js` itself, and not because the map would not fit: that file
// says in its own header that it is a map and nothing more, so that a person
// owning one `.jsx` never edits a line somebody else owns. A canvas descriptor
// is a small function, and a file of small functions is a different kind of file.
//
// ── What a descriptor answers, and what it must not decide ───────────────────
//
// A size in pixels and a camera. Nothing else: the geometry, the lights, the
// colours and the motion are the block's and the palette's, exactly as they are
// for a block drawn with divs. The size is a share of the block's own BOX and
// never of the frame — this is the family whose wasted pixels are measured in
// render seconds rather than in bytes, so a canvas larger than the drawing is a
// cost every frame of every scene pays for nothing.
//
// The whole file loads inside Mocky's own vitest suite, like everything else
// under `blocks/`: nothing here imports `three`, `@remotion/three` or `remotion`.
import { EXTRUDED_TYPE_CANVAS } from './extrudedType.jsx'
import { FIELD_CAMERA, fieldCanvas } from './field.js'
import { GLOBE_CANVAS } from './globe.jsx'
import { SOLID_CHART_CANVAS } from './solidChart.jsx'
import { SOLID_CAMERA } from './solidScene.jsx'
import { solidCanvas } from './setPiece.js'
import { photoRingCanvas, photoStageCanvas, stageImages } from './stage.js'

/**
 * The three FIELDS, which are the one family drawn SMALLER than its box.
 *
 * Every other descriptor here answers a shape — a solid is square, a picture is
 * its box, a chart leaves room for its captions. This one answers a COST. A
 * field fills its box on both axes, so at full frame it covers 2.4 times the
 * pixels the largest square solid does, and a lit sheet at that size measured
 * +1.7 s of render per second of film against the ~1.7 s/s the duration-scaled
 * deadline leaves spare — one block spending a whole film's margin. Drawn inside
 * `FIELD_PIXEL_BUDGET` and painted back over its box it is +1.0 s/s, which is a
 * `solidScene`, and none of the three has an edge on it finer than the gradient
 * across it. `field.js` carries the measurement; `docs/video-export.md` carries
 * the table.
 *
 * A field in a CELL pays nothing at all: a third of a zone is already under the
 * budget, `fieldCanvas` returns its box unscaled and `stretch` is a scale of one.
 */
const FIELD_CANVAS = (block, box) => {
  const drawn = fieldCanvas(box)
  return { width: drawn.width, height: drawn.height, camera: FIELD_CAMERA, stretch: true, frame: drawn.box }
}

/**
 * One entry per block drawn in GL. The keys are block kinds, and
 * `tests/video-3d-permission.test.js` is what keeps this list, the components
 * that render react-three-fiber intrinsics, and `server/video/three-d.js`'s
 * permission from ever disagreeing.
 *
 * @type {Record<string, (block: object, box: object, base: number, unit: number) => {width:number,height:number,camera:object}>}
 */
export const BLOCK_CANVASES = {
  /**
   * A square, on the smaller side of the box: a solid is drawn to one bounding
   * radius whichever solid it is, so the canvas that contains it is square by
   * construction. `SOLID_BOUND` carries that argument.
   */
  solidScene: (block, box, base) => {
    const side = solidCanvas(box, block?.size, base)
    return { width: side, height: side, camera: SOLID_CAMERA }
  },
  /** A line of type, so a wide short canvas: `spatialLayout` works out both sides. */
  extrudedType: EXTRUDED_TYPE_CANVAS,
  /** A ball, so a square canvas, for the same reason a solid's is square. */
  globe: GLOBE_CANVAS,
  /**
   * The one entry that answers the two optional questions: it is drawn under a
   * PARALLEL projection, which is what makes its columns comparable, and its
   * canvas is shorter than its frame because a row of flat captions is drawn
   * under it. See `SOLID_CHART_CANVAS`.
   */
  solidChart: SOLID_CHART_CANVAS,
  /**
   * The whole box, in the box's own shape: a picture is a rectangle, and a square
   * canvas would throw away the entire difference between a landscape box and a
   * landscape photograph. `stageCanvas` and `frustumScale` carry that argument.
   */
  photoStage: photoStageCanvas,
  /** The same, through a longer lens: `RING_CAMERA` says why a carousel needs one. */
  photoRing: photoRingCanvas,
  /**
   * The three fields, all on one descriptor: they differ in what they draw and
   * not at all in what they are drawn ON. See `FIELD_CANVAS` for the measurement
   * that makes them the one family with a canvas smaller than its box.
   */
  particleField: FIELD_CANVAS,
  waveMesh: FIELD_CANVAS,
  depthGrid: FIELD_CANVAS,
}

/**
 * The pictures a GL block needs DECODED before its first frame, per kind.
 *
 * A second table rather than a field on the descriptor above, because it answers
 * a different question at a different moment: a canvas is worked out per block
 * inside the layout, and a texture has to be loaded once for the whole scene,
 * before any of it renders. Two blocks naming the same photograph are one upload.
 *
 * Empty for every kind that draws a shape rather than a picture, which is why
 * this is a table and not a rule: `solidScene` and `globe` need a renderer and no
 * pictures at all, and asking them for image ids would be asking a question they
 * have no field to answer with.
 */
export const BLOCK_CANVAS_IMAGES = {
  photoStage: stageImages,
  photoRing: stageImages,
}

/**
 * Every picture the GL blocks of one scene need, deduplicated, in the document's
 * own order.
 *
 * The order is the document's and not a set's iteration order because it is what
 * decides the order the loads are STARTED in, and a film that decoded its
 * pictures in a different order on two runs would still be the same film — but
 * the reason to keep it stable costs nothing and the reason to check it is that
 * this store is content-addressed.
 */
export function sceneCanvasImages(scene) {
  const out = []
  for (const layer of Array.isArray(scene?.layers) ? scene.layers : []) {
    const kind = String(layer?.kind ?? '')
    if (!Object.hasOwn(BLOCK_CANVAS_IMAGES, kind)) continue
    for (const id of BLOCK_CANVAS_IMAGES[kind](layer)) if (!out.includes(id)) out.push(id)
  }
  return out
}

/**
 * The canvas a block needs, or `null` for the twenty-six that need none.
 *
 * `Object.hasOwn` and not a plain lookup, for the reason `blockComponent` spells
 * out next door: a lookup answers for the prototype chain, so `kind:
 * "constructor"` hands back a function — and a function is exactly what this
 * caller is looking for, so nothing downstream notices until a `div` is asked to
 * be a WebGL context.
 *
 * The dimensions are floored at one pixel and rounded, because a canvas of zero
 * or of half a pixel is a GL context that fails to initialise and takes the
 * whole frame with it — and a block drawn small beats a render that dies half a
 * minute in (Q1).
 */
export function blockCanvas(block, box, base, unit) {
  const kind = String(block?.kind ?? '')
  if (!Object.hasOwn(BLOCK_CANVASES, kind)) return null
  const asked = BLOCK_CANVASES[kind](block, box, base, unit)
  const width = Math.max(1, Math.round(Number(asked?.width) || 0))
  const height = Math.max(1, Math.round(Number(asked?.height) || 0))
  return {
    width,
    height,
    camera: asked?.camera,
    /**
     * Whether the projection is PARALLEL. Absent means perspective, which is
     * what every one of these was until a chart needed otherwise: two equal
     * columns at two depths project to two different heights under a vanishing
     * point, and a chart whose values cannot be compared is a decoration.
     * `SOLID_CHART_CANVAS` carries the argument.
     */
    orthographic: asked?.orthographic === true,
    /**
     * The area the block occupies in its box, which is the canvas itself unless
     * the block draws something FLAT beside it. Only `solidChart` does — its
     * captions are type, and type belongs to the one scale rather than to a
     * renderer — so the default is the canvas and no existing caller moves.
     *
     * Never smaller than the canvas: a frame that did not contain its own GL
     * surface would clip the drawing and nothing would say so.
     */
    frame: {
      width: Math.max(width, Math.round(Number(asked?.frame?.width) || 0)),
      height: Math.max(height, Math.round(Number(asked?.frame?.height) || 0)),
    },
    /** The DOM half of a block whose other half is GL, drawn over the frame. */
    overlay: typeof asked?.overlay === 'function' ? asked.overlay : null,
    /**
     * Whether the GL surface is PAINTED OVER its frame rather than placed in it.
     *
     * Absent for every descriptor that answers a shape, which is all of them but
     * the fields: a canvas smaller than its frame is deliberate there — a chart
     * leaves the band under it for captions — and stretching it would put the
     * captions inside the drawing. A field's canvas is smaller for a completely
     * different reason, a measured render cost, and its drawing really does have
     * to end up covering the box; see `FIELD_CANVAS`.
     *
     * `ComposedSceneVideo` reads it and applies the two scales, one per axis, so
     * the rounding of an integer backing store cannot leave a hairline of the
     * ground down the right edge of a full-frame block.
     */
    stretch: asked?.stretch === true,
  }
}
