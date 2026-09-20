// The loop, as a wrapper around a whole composition.
//
// A film placed in a page — a band behind a heading, a hero's backdrop — plays
// forever beside somebody reading, so its seam is the frame a viewer sees most
// often. `loop` is what the document asks for and `composition.js` is where the
// arithmetic lives; this file is the twenty lines of React that apply it, once,
// around all six compositions rather than inside any of them.
//
// Time is remapped with Remotion's `<Freeze>`, whose `frame` prop may differ on
// every frame: it sets the timeline context its children read, so every
// Sequence, every cue and every GL canvas inside sees the film frame this file
// names. Nothing in the compositions knows a loop exists.
import { AbsoluteFill, Freeze, useCurrentFrame } from 'remotion'
import { loopBlend, loopBlendFrames, loopModeOf, mirrorFrame, planTimeline } from './composition.js'

export const withLoop = (Component) => {
  const Looped = (props) => {
    const frame = useCurrentFrame()
    const mode = loopModeOf(props.timeline)
    if (mode === 'none') return <Component {...props} />

    const { totalFrames } = planTimeline(props.timeline)
    if (mode === 'mirror') {
      return (
        <Freeze frame={mirrorFrame(frame, totalFrames)}>
          <Component {...props} />
        </Freeze>
      )
    }

    const blend = loopBlend(frame, totalFrames, loopBlendFrames(totalFrames))
    // Outside the dissolve the film plays as it always did, and the tree is the
    // one it always was: a Freeze on every frame would be a second instance of
    // every GL canvas and every Lottie player for nothing.
    if (!blend) return <Component {...props} />
    return (
      <AbsoluteFill>
        {/* The tail, continuing the playthrough that is ending. */}
        <Freeze frame={blend.tail}>
          <Component {...props} />
        </Freeze>
        {/* And the head coming up under it — the frames the film starts on. */}
        <AbsoluteFill style={{ opacity: blend.opacity }}>
          <Freeze frame={blend.head}>
            <Component {...props} />
          </Freeze>
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }
  return Looped
}
