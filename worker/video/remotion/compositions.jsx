import { AnimatedTitlesVideo } from './AnimatedTitlesVideo.jsx'
import { ComposedSceneVideo } from './ComposedSceneVideo.jsx'
import { ImageSequenceVideo } from './ImageSequenceVideo.jsx'
import { OverlayBandVideo } from './OverlayBandVideo.jsx'
import { ProductSpotlightVideo } from './ProductSpotlightVideo.jsx'
import { VerticalStoryVideo } from './VerticalStoryVideo.jsx'
import { COMPOSITIONS } from './composition.js'
import { withInstalledFonts } from './fonts/load.jsx'
import { withLoop } from './Looped.jsx'

/*
 * Every composition wrapped ONCE, at module scope: the wrapper holds the first
 * frame until the direction's typefaces are in, and a wrapper built inside the
 * tree would be a new component on every render — a remount per frame.
 *
 * Its own module since there are two engines: `Root.jsx` registers these with
 * Remotion, `hyperframes/entry.jsx` mounts one of them under HyperFrames' clock,
 * and a wrapper chain written twice is the one that drifts.
 */
const Slideshow = withLoop(withInstalledFonts(ImageSequenceVideo))
const Overlay = withLoop(withInstalledFonts(OverlayBandVideo))
const Vertical = withLoop(withInstalledFonts(VerticalStoryVideo))
const Titles = withLoop(withInstalledFonts(AnimatedTitlesVideo))
const Product = withLoop(withInstalledFonts(ProductSpotlightVideo))
const Composed = withLoop(withInstalledFonts(ComposedSceneVideo))

/** The component for each composition id `compositionIdFor` can return. */
export const COMPONENTS = {
  [COMPOSITIONS.slideshow]: Slideshow,
  [COMPOSITIONS.overlay]: Overlay,
  [COMPOSITIONS.vertical]: Vertical,
  [COMPOSITIONS.titles]: Titles,
  [COMPOSITIONS.product]: Product,
  [COMPOSITIONS.composed]: Composed,
}
