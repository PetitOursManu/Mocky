import { Composition } from 'remotion'
import { AnimatedTitlesVideo } from './AnimatedTitlesVideo.jsx'
import { ImageSequenceVideo } from './ImageSequenceVideo.jsx'
import { OverlayBandVideo } from './OverlayBandVideo.jsx'
import { ProductSpotlightVideo } from './ProductSpotlightVideo.jsx'
import { VerticalStoryVideo } from './VerticalStoryVideo.jsx'
import { COMPOSITIONS, FPS, dimensionsFor, planTimeline } from './composition.js'

/**
 * A one-pixel grey PNG, so that opening this bundle in Remotion Studio shows
 * compositions instead of exceptions.
 *
 * It is inline rather than staged because `defaultProps` are evaluated with no
 * request in flight — there is nothing on disk to point at. It is also the only
 * image address in this project that is not built from a validated hash, and it
 * is a constant written here, which is why that is fine.
 */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const PLACEHOLDER_ID = '0'.repeat(64)
const PLACEHOLDER_SRC = { [PLACEHOLDER_ID]: PLACEHOLDER }

/**
 * The geometry and the length come from `calculateMetadata`, never from the
 * attributes on the element.
 *
 * They have to: a 9:16 timeline is 1080×1920 and a 16:9 one is 1920×1080, and
 * the frame count is the sum of the scenes minus their transitions. The
 * attributes are the fallback Remotion needs before it has any props, and they
 * are never what a real render uses. One function rather than five copies,
 * because a composition whose metadata was computed differently from its
 * neighbours is a film in the wrong shape, discovered by watching it.
 */
const metadata = ({ props }) => {
  const plan = planTimeline(props.timeline)
  return { durationInFrames: plan.totalFrames, width: plan.width, height: plan.height, fps: plan.fps }
}

/**
 * Every composition the worker can render, which is five.
 *
 * `render.js` selects by the id `compositionIdFor` returns, so this list is the
 * whole surface a caller can reach — the same shape the timeline schema has on
 * the Mocky side: what cannot be named cannot be asked for. Adding a sixth look
 * means a component, an entry in `COMPOSITIONS`, a reader in `validate.js` and a
 * normal code review. It is never a string a model got to write.
 */
export const RemotionRoot = () => (
  <>
    <Composition
      id={COMPOSITIONS.slideshow}
      component={ImageSequenceVideo}
      fps={FPS}
      width={dimensionsFor('16:9').width}
      height={dimensionsFor('16:9').height}
      durationInFrames={FPS}
      defaultProps={{
        timeline: {
          template: 'slideshow',
          scenes: [
            { imageId: PLACEHOLDER_ID, durationMs: 2000, kenBurns: 'zoom-in', transitionOut: 'none', textOverlay: null },
          ],
          outputFormat: 'mp4',
          aspectRatio: '16:9',
        },
        imageSrc: PLACEHOLDER_SRC,
      }}
      calculateMetadata={metadata}
    />

    <Composition
      id={COMPOSITIONS.overlay}
      component={OverlayBandVideo}
      fps={FPS}
      width={dimensionsFor('16:9').width}
      height={dimensionsFor('16:9').height}
      durationInFrames={FPS}
      defaultProps={{
        timeline: {
          template: 'overlay',
          scenes: [
            {
              imageId: PLACEHOLDER_ID,
              durationMs: 3000,
              band: { title: 'Mocky', subtitle: 'A screen, and what it is', position: 'bottom' },
              transitionOut: 'none',
            },
          ],
          outputFormat: 'mp4',
          aspectRatio: '16:9',
        },
        imageSrc: PLACEHOLDER_SRC,
      }}
      calculateMetadata={metadata}
    />

    <Composition
      id={COMPOSITIONS.vertical}
      component={VerticalStoryVideo}
      fps={FPS}
      // The only composition whose fallback geometry is portrait, because the
      // schema types its ratio as the literal `9:16` and a landscape preview
      // would be the one shape a real render can never have.
      width={dimensionsFor('9:16').width}
      height={dimensionsFor('9:16').height}
      durationInFrames={FPS}
      defaultProps={{
        timeline: {
          template: 'vertical',
          scenes: [
            {
              imageId: PLACEHOLDER_ID,
              durationMs: 2000,
              kenBurns: 'zoom-in',
              transitionOut: 'none',
              textOverlay: { content: 'Mocky', position: 'bottom' },
            },
          ],
          outputFormat: 'mp4',
          aspectRatio: '9:16',
        },
        imageSrc: PLACEHOLDER_SRC,
      }}
      calculateMetadata={metadata}
    />

    <Composition
      id={COMPOSITIONS.titles}
      component={AnimatedTitlesVideo}
      fps={FPS}
      width={dimensionsFor('16:9').width}
      height={dimensionsFor('16:9').height}
      durationInFrames={FPS}
      // No `imageSrc` at all, and that is the template: a film nobody needs a
      // media library for.
      defaultProps={{
        timeline: {
          template: 'titles',
          scenes: [
            {
              headline: 'Designed in the browser',
              subtitle: 'Rendered here',
              durationMs: 3000,
              animation: 'stagger',
              transitionOut: 'none',
            },
          ],
          outputFormat: 'mp4',
          aspectRatio: '16:9',
        },
      }}
      calculateMetadata={metadata}
    />

    <Composition
      id={COMPOSITIONS.product}
      component={ProductSpotlightVideo}
      fps={FPS}
      width={dimensionsFor('16:9').width}
      height={dimensionsFor('16:9').height}
      durationInFrames={FPS}
      defaultProps={{
        timeline: {
          template: 'product',
          scenes: [
            {
              imageId: PLACEHOLDER_ID,
              durationMs: 4000,
              headline: 'One screen, one film',
              bullets: ['No Remotion in the model', 'Your own colours', 'Two minutes at most'],
              cta: 'Try it',
              transitionOut: 'none',
            },
          ],
          outputFormat: 'mp4',
          aspectRatio: '16:9',
        },
        imageSrc: PLACEHOLDER_SRC,
      }}
      calculateMetadata={metadata}
    />
  </>
)
