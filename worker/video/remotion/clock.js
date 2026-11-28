// The nine things a composition asks of the engine that renders it, and the one
// door they come through.
//
// Every composition, wrapper and loader under `remotion/` imports these from
// here and never from `remotion` itself, because there are now two engines that
// can answer them. This file is Remotion's answer, and it is what the Remotion
// bundler (`render.js`) compiles. `hyperframes/clock.jsx` is HyperFrames' answer
// to the same nine names, and `render.hyperframes.js` swaps it in at build time
// (`ENGINE_ALIASES` there). The compositions are written once; the clock is the
// only thing that differs.
//
// Kept to exactly the surface the compositions use. A tenth name added here
// without its counterpart in `hyperframes/clock.jsx` would build under one
// engine and fail at import under the other, and `tests/video-engine-clock.test.js`
// is what refuses that.
export {
  AbsoluteFill,
  Freeze,
  Img,
  Sequence,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
