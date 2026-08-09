import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  entranceStyle,
  kenBurnsTransform,
  overlayAlignment,
  planTimeline,
  resolveTheme,
  slideshowPalette,
  withAlpha,
} from './composition.js'

/**
 * The composition that consumes a `slideshow` document. Written by hand, like
 * every composition in this directory, and that is the founding rule of the
 * feature rather than a phase: THE MODEL NEVER WRITES REMOTION CODE. It writes
 * one JSON object, validated twice, and this file decides what any of it looks
 * like.
 *
 * Read the props as hostile and the rule follows on its own. Nothing arriving
 * in `timeline` is ever interpolated into markup, a class name, a style string
 * or a URL. The overlay text is a React child — escaped by React, and by
 * nothing else. The image addresses are built by `render.js` from a validated
 * 64-character hash, never taken from the document. `dangerouslySetInnerHTML`
 * does not appear in this directory and must not start.
 *
 * The arithmetic — the frame plan, the Ken Burns transform, the entrance — is in
 * `composition.js` and not here, because four other compositions need the same
 * answers and because nothing in a `.jsx` file can be tested without Remotion.
 */

const SceneLayer = ({ entry, src, theme, palette, overlayFontSize }) => {
  const frame = useCurrentFrame()
  const { scene } = entry

  if (!src) {
    // Loud, not blank. A scene with no picture would otherwise render as black
    // and be encoded, delivered and stored as a successful export — the exact
    // outcome the validator, the image staging and this line all exist to make
    // impossible. Throwing inside a Remotion render fails the job with this
    // sentence attached.
    throw new Error(`No image was staged for scene image ${scene.imageId}.`)
  }

  return (
    <AbsoluteFill
      style={{
        // The theme's background rather than black, and it is visible for a few
        // frames of a wipe. A film cut from a project on a pale direction used
        // to flash to black at every transition.
        backgroundColor: theme.background,
        ...entranceStyle(entry.enterTransition, frame, entry.enterFrames),
      }}
    >
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
          transform: kenBurnsTransform(scene.kenBurns, frame, entry.durationInFrames),
        }}
      />
      {scene.textOverlay ? (
        <AbsoluteFill
          style={{
            justifyContent: overlayAlignment(scene.textOverlay.position),
            alignItems: 'center',
            // Kept off the edges: a broadcast still crops the outer 5%, and a
            // frame with text against its own border reads as a mistake.
            padding: '6%',
          }}
        >
          <div
            style={{
              maxWidth: '82%',
              textAlign: 'center',
              // Measured against the panel at both ends of what the photograph
              // can composite it to. The picture is not in the theme, so the
              // guarantee is made over a backdrop that is all white as well as
              // one that is all black — and the panel is made denser, never the
              // ink lighter, as long as the theme's own colours can still carry.
              color: palette.caption.color,
              fontFamily: theme.headingFont,
              fontSize: overlayFontSize,
              fontWeight: 700,
              lineHeight: 1.25,
              padding: `${Math.round(overlayFontSize * 0.45)}px ${Math.round(overlayFontSize * 0.72)}px`,
              borderRadius: theme.radiusPx,
              // Both a panel and a shadow, because either alone loses. A
              // caption over a bright sky vanishes without the panel; the panel
              // alone still bleeds into a dark photograph. Only the panel is
              // measurable, so only the panel carries the promise — the shadow
              // is a bonus nothing depends on.
              backgroundColor: withAlpha(palette.panel.color, palette.panel.alpha),
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
  const theme = resolveTheme(timeline?.theme)
  const palette = slideshowPalette(theme)

  // Proportional to the frame, not a fixed pixel size: the same caption has to
  // read on a 1080-tall landscape export and a 1920-tall portrait one, and a
  // size chosen for either looks wrong in the other.
  const overlayFontSize = Math.round(height * 0.052)

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {plan.scenes.map((entry, index) => (
        <Sequence
          // The index, deliberately. A timeline may name the same image in
          // several scenes — that is the common shape, not an edge case — so
          // imageId is not a key, and the position in the plan is.
          key={index}
          from={entry.from}
          durationInFrames={entry.durationInFrames}
        >
          <SceneLayer
            entry={entry}
            src={imageSrc?.[entry.scene.imageId]}
            theme={theme}
            palette={palette}
            overlayFontSize={overlayFontSize}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
