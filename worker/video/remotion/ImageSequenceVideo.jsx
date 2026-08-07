import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { KEN_BURNS_ZOOM, PAN_SCALE, PAN_SHIFT_PERCENT, planTimeline } from './composition.js'

/**
 * The composition that consumes a VideoTimeline. Written by hand, like every
 * composition in this directory, and that is the founding rule of the feature
 * rather than a phase: THE MODEL NEVER WRITES REMOTION CODE. It writes one JSON
 * object, validated twice, and this file decides what any of it looks like.
 *
 * Read the props as hostile and the rule follows on its own. Nothing arriving
 * in `timeline` is ever interpolated into markup, a class name, a style string
 * or a URL. The overlay text is a React child — escaped by React, and by
 * nothing else. The image addresses are built by `render.js` from a validated
 * 64-character hash, never taken from the document. `dangerouslySetInnerHTML`
 * does not appear in this directory and must not start.
 */

/** Where the overlay box sits in the frame. */
const OVERLAY_ALIGNMENT = { top: 'flex-start', center: 'center', bottom: 'flex-end' }

/**
 * The alignment for a position, and `center` for anything else.
 *
 * `Object.hasOwn` rather than `OVERLAY_ALIGNMENT[position] || 'center'`: a plain
 * lookup answers for the prototype chain, so `position: "constructor"` returns a
 * function — truthy, so the fallback never fires, and a function is what lands
 * in `justifyContent`. The value is validated twice before it gets here; this is
 * the line that makes reading the props as hostile actually true.
 */
function overlayAlignment(position) {
  return typeof position === 'string' && Object.hasOwn(OVERLAY_ALIGNMENT, position)
    ? OVERLAY_ALIGNMENT[position]
    : 'center'
}

/**
 * The Ken Burns move for one scene, as a CSS transform.
 *
 * `interpolate` is clamped at both ends because the last scene of a timeline is
 * rendered one frame past its own length in some Remotion versions, and an
 * unclamped extrapolation there produces a single frame that jumps — the kind
 * of defect that only appears in the exported file, never in a preview.
 */
function kenBurnsTransform(kind, frame, durationInFrames) {
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  switch (kind) {
    case 'zoom-in':
      return `scale(${1 + KEN_BURNS_ZOOM * progress})`
    case 'zoom-out':
      return `scale(${1 + KEN_BURNS_ZOOM * (1 - progress)})`
    // The picture drifts towards the side it is named after. The other reading —
    // the camera pans left, so the subject slides right — is just as defensible,
    // which is why it is written down here rather than left to whoever reads the
    // switch next.
    case 'pan-left':
      return `scale(${PAN_SCALE}) translateX(${PAN_SHIFT_PERCENT * (1 - 2 * progress)}%)`
    case 'pan-right':
      return `scale(${PAN_SCALE}) translateX(${PAN_SHIFT_PERCENT * (2 * progress - 1)}%)`
    default:
      return 'none'
  }
}

/**
 * How a scene arrives on top of the one it replaces.
 *
 * Only the INCOMING scene animates. A crossfade in which both sides move —
 * the old one fading out while the new one fades in — dips through the
 * background at the midpoint, so a slideshow on a black canvas blinks once per
 * transition. Fading the newcomer in over a predecessor that stays opaque is
 * the same effect without the blink, and it works identically for a wipe, where
 * the arriving frame is simply clipped.
 *
 * The scene order in the DOM is the paint order, so "on top" needs nothing but
 * rendering the scenes in the order the timeline lists them.
 */
function entranceStyle(kind, frame, enterFrames) {
  if (!enterFrames || kind === 'none') return null
  const progress = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const hidden = (1 - progress) * 100
  switch (kind) {
    case 'crossfade':
      return { opacity: progress }
    // `inset()` reads top / right / bottom / left. A shrinking LEFT inset
    // uncovers the frame from its right edge, so the revealing edge travels
    // leftwards — which is what "wipe-left" names.
    case 'wipe-left':
      return { clipPath: `inset(0 0 0 ${hidden}%)` }
    case 'wipe-right':
      return { clipPath: `inset(0 ${hidden}% 0 0)` }
    default:
      return null
  }
}

const SceneLayer = ({ scene, src, overlayFontSize }) => {
  const frame = useCurrentFrame()

  if (!src) {
    // Loud, not blank. A scene with no picture would otherwise render as black
    // and be encoded, delivered and stored as a successful export — the exact
    // outcome the validator, the image staging and this line all exist to make
    // impossible. Throwing inside a Remotion render fails the job with this
    // sentence attached.
    throw new Error(`No image was staged for scene image ${scene.imageId}.`)
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', ...entranceStyle(scene.enterTransition, frame, scene.enterFrames) }}>
      {/*
        Remotion's <Img>, not a plain <img>: it holds the frame back until the
        picture has decoded, and cancels the render when it cannot load one. A
        plain tag would let Chromium screenshot an empty box and carry on, which
        is how a staging mistake becomes a video of blank frames rather than a
        failed job with a message.
      */}
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          // The library holds whatever the image provider produced, and a
          // timeline mixes portrait and landscape freely. `cover` crops; the
          // alternative letterboxes every mismatched still, which looks like a
          // broken export rather than a deliberate frame.
          objectFit: 'cover',
          transform: kenBurnsTransform(scene.kenBurns, frame, scene.durationInFrames),
        }}
      />
      {scene.textOverlay ? (
        <AbsoluteFill
          style={{
            justifyContent: overlayAlignment(scene.textOverlay.position),
            alignItems: 'center',
            // Kept off the edges: a phone playing a 9:16 export puts its own
            // controls there, and a broadcast still crops the outer 5%.
            padding: '6%',
          }}
        >
          <div
            style={{
              maxWidth: '82%',
              textAlign: 'center',
              color: '#ffffff',
              // Liberation is what `fonts-liberation` installs in the image. A
              // container with no font renders every glyph as a hollow box, so
              // naming a family that is actually present is the difference
              // between a caption and a row of rectangles.
              fontFamily: '"Liberation Sans", Arial, Helvetica, sans-serif',
              fontSize: overlayFontSize,
              fontWeight: 700,
              lineHeight: 1.25,
              padding: `${Math.round(overlayFontSize * 0.45)}px ${Math.round(overlayFontSize * 0.72)}px`,
              borderRadius: Math.round(overlayFontSize * 0.35),
              // Both a panel and a shadow, because either alone loses. A
              // caption over a bright sky vanishes without the panel; the panel
              // alone still bleeds into a dark photograph. The overlay has to
              // stay readable over an image nobody previewed.
              backgroundColor: 'rgba(12, 12, 16, 0.62)',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.75)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {/*
              Model-written text, rendered as TEXT. A React child is escaped;
              markup in it appears as the characters the model wrote, which is
              the only correct reading of a caption. This is the single place
              where anything from the document reaches the frame.
            */}
            {scene.textOverlay.content}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  )
}

/**
 * @param {{timeline: object, imageSrc: Record<string, string>}} props
 */
export const ImageSequenceVideo = ({ timeline, imageSrc }) => {
  const { height } = useVideoConfig()
  const plan = planTimeline(timeline)

  // Proportional to the frame, not a fixed pixel size: the same caption has to
  // read on a 1080-tall landscape export and a 1920-tall portrait one, and a
  // size chosen for either looks wrong in the other.
  const overlayFontSize = Math.round(height * 0.052)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {plan.scenes.map((scene, index) => (
        <Sequence
          // The index, deliberately. A timeline may name the same image in
          // several scenes — that is the common shape, not an edge case — so
          // imageId is not a key, and the position in the plan is.
          key={index}
          from={scene.from}
          durationInFrames={scene.durationInFrames}
        >
          <SceneLayer scene={scene} src={imageSrc?.[scene.imageId]} overlayFontSize={overlayFontSize} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
