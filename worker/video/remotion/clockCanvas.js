// The GL canvas a 3D block is drawn in, behind the same door as `clock.js` and
// for the same reason: Remotion's `ThreeCanvas` here, `hyperframes/clockCanvas.jsx`
// under the other engine.
//
// A file of its own rather than a tenth name in `clock.js`, because only the two
// files that open a canvas should pull `three` into the import graph.
export { ThreeCanvas } from '@remotion/three'
