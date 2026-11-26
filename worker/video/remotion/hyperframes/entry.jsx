// The page HyperFrames renders: one composition, mounted under the clock, and
// driven by the engine's seeks.
//
// Compiled by `render.hyperframes.js` (esbuild, with `../clock.js` swapped for
// `./clock.jsx`) and loaded by the page that file writes. The props arrive as
// JSON in `#mocky-film`, the same `{ timeline, imageSrc }` Remotion receives as
// `inputProps`, so the compositions cannot tell the two engines apart.
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { compositionIdFor, filmMetadata } from '../composition.js'
import { COMPONENTS } from '../compositions.jsx'
import { ClockProvider, continueRender, delayRender, failRender, whenSettled } from './clock.jsx'

const input = JSON.parse(document.getElementById('mocky-film').textContent)
const meta = filmMetadata(input.timeline)
const id = compositionIdFor(input.timeline.template)
const Component = COMPONENTS[id]
const config = { ...meta, id, defaultProps: {}, props: input }

/*
 * Every picture of the film decoded before the first frame, and kept.
 *
 * A scene's `<Img>` mounts only when its scene begins, and holds that frame
 * until it has decoded — correct, and a stall in the middle of a render. Decoding
 * them all here moves the wait to the start, where the typefaces are already
 * being waited for, and the references kept on `window` stop the browser from
 * dropping a decoded bitmap it believes nobody needs.
 */
window.__mockyPictures = Object.values(input.imageSrc || {}).map((src) => {
  const hold = delayRender(`preloading ${src}`)
  const picture = new Image()
  picture.src = src
  picture.decode().then(
    () => continueRender(hold),
    () => failRender(new Error(`mocky-video-worker: could not load the picture ${src}`)),
  )
  return picture
})

let setFrame = () => {}

function Film() {
  const [frame, set] = useState(0)
  setFrame = set
  return (
    <ClockProvider frame={frame} config={config}>
      <Component {...input} />
    </ClockProvider>
  )
}

const root = createRoot(document.getElementById('mocky-stage'))
// Synchronous, so the tree exists before the runtime's first seek arrives.
flushSync(() => root.render(<Film />))

/*
 * And the runtime told to wait for what the first frame needs — the typefaces,
 * the pictures, a GL canvas — before it publishes the page as ready.
 * `__hf.buildReady` is the runtime's own registry for setup no adapter can see;
 * without it the first seek can land on a page still drawing in the fallback
 * face, and frame 0 would be the one frame of the film in Liberation Sans.
 */
window.__hf = window.__hf || {}
window.__hf.buildReady = { ...(window.__hf.buildReady || {}), 'mocky-film': whenSettled() }

/*
 * The seek. `hf-seek` is the event HyperFrames dispatches on every seek, with a
 * `waitUntil` that joins a promise to the barrier the capture waits on; it must
 * be called synchronously from the listener, which is why the frame is committed
 * with `flushSync` first and the promise registered on the next line.
 *
 * The time is converted back to a whole frame: the engine computes it as
 * `frame / fps`, and every composition here is arithmetic on integer frames.
 */
window.addEventListener('hf-seek', (event) => {
  const { time, waitUntil } = event.detail
  const frame = Math.min(meta.durationInFrames - 1, Math.max(0, Math.round(Number(time) * meta.fps)))
  flushSync(() => setFrame(frame))
  waitUntil(whenSettled())
})
