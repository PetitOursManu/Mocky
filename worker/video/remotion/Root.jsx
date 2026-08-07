import { Composition } from 'remotion'
import { TestCard } from './TestCard.jsx'
import { TEST_CARD } from './composition.js'

/**
 * Every composition the worker can render, which in phase 1 is one.
 *
 * `render.js` selects by id and refuses anything else, so this list is the
 * whole surface a caller can reach. That is the same shape the timeline schema
 * has on the Mocky side: what cannot be named cannot be asked for.
 */
export const RemotionRoot = () => (
  <Composition
    id={TEST_CARD.id}
    component={TestCard}
    durationInFrames={TEST_CARD.durationInFrames}
    fps={TEST_CARD.fps}
    width={TEST_CARD.width}
    height={TEST_CARD.height}
  />
)
