// The test card's dimensions, in plain JavaScript with no JSX and no React
// import.
//
// It is a separate file for one mechanical reason: `render.js` runs in Node and
// has to name the composition it wants, while `Root.jsx` is compiled by
// Remotion's bundler. Node cannot import a `.jsx` file, so putting the id next
// to the component would force `render.js` to hard-code the string 'TestCard' —
// and a composition renamed on one side and not the other fails at render time,
// inside a container, as "No composition with the ID TestCard found".
export const TEST_CARD = {
  id: 'TestCard',

  /*
   * 720p, 30 fps, three seconds.
   *
   * Deliberately cheap. The only thing this phase has to prove is that a
   * request reaches Chromium and comes back as bytes, and Mocky's queue gives
   * up on a job after 120 seconds (JOB_TIMEOUT_MS). A test card that pushes a
   * small VPS anywhere near that limit would make a working chain look broken
   * on exactly the machines this feature is built for.
   */
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 90,

  backgroundColor: '#1b1b3a',
  foregroundColor: '#f5f3ff',
}
