import { Composition } from 'remotion'
import { ImageSequenceVideo } from './ImageSequenceVideo.jsx'
import { FPS, IMAGE_SEQUENCE, dimensionsFor, planTimeline } from './composition.js'

/**
 * A one-pixel grey PNG, so that opening this bundle in Remotion Studio shows a
 * composition instead of an exception.
 *
 * It is inline rather than staged because `defaultProps` are evaluated with no
 * request in flight — there is nothing on disk to point at. It is also the only
 * image address in this project that is not built from a validated hash, and it
 * is a constant written here, which is why that is fine.
 */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const PLACEHOLDER_ID = '0'.repeat(64)

/**
 * Every composition the worker can render, which is one.
 *
 * `render.js` selects by id, so this list is the whole surface a caller can
 * reach — the same shape the timeline schema has on the Mocky side: what cannot
 * be named cannot be asked for.
 *
 * The geometry and the length come from `calculateMetadata`, not from the
 * attributes below. They have to: a 9:16 timeline is 1080×1920 and a 16:9 one
 * is 1920×1080, and the frame count is the sum of the scenes minus their
 * transitions. The attributes are the fallback Remotion needs before it has any
 * props, and they are never what a real render uses.
 */
export const RemotionRoot = () => (
  <Composition
    id={IMAGE_SEQUENCE.id}
    component={ImageSequenceVideo}
    fps={FPS}
    width={dimensionsFor('16:9').width}
    height={dimensionsFor('16:9').height}
    durationInFrames={FPS}
    defaultProps={{
      timeline: {
        scenes: [{ imageId: PLACEHOLDER_ID, durationMs: 2000, kenBurns: 'zoom-in', transitionOut: 'none', textOverlay: null }],
        outputFormat: 'mp4',
        aspectRatio: '16:9',
      },
      imageSrc: { [PLACEHOLDER_ID]: PLACEHOLDER },
    }}
    calculateMetadata={({ props }) => {
      const plan = planTimeline(props.timeline)
      return { durationInFrames: plan.totalFrames, width: plan.width, height: plan.height, fps: plan.fps }
    }}
  />
)
