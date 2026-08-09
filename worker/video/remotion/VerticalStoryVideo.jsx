import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  VERTICAL_SAFE_BOTTOM_PERCENT,
  VERTICAL_SAFE_SIDE_PERCENT,
  VERTICAL_SAFE_TOP_PERCENT,
  entranceStyle,
  frameBase,
  overlayAlignment,
  planTimeline,
  railSegments,
  resolveTheme,
  sceneMotion,
  verticalCaptionSize,
  verticalPalette,
  withAlpha,
  words,
} from './composition.js'

/**
 * `vertical` — 9:16, full bleed, short beats, large type.
 *
 * The schema types this template's `aspectRatio` as the literal `9:16` rather
 * than defaulting it, so there is no landscape document to handle here: the
 * layout below assumes a portrait frame and the schema is what makes that
 * assumption true.
 *
 * Written by hand, like every composition here, and reading its props as
 * hostile: the caption is a React child, the image address comes from a
 * validated hash, and every colour is a hex value `resolveTheme` accepted.
 *
 * ── What the format needs, and what a slideshow rotated 90° does not have ────
 *
 * The first version was the slideshow in a portrait frame: one picture, one
 * caption, one fade. Three things were missing, and all three are about a format
 * watched in cuts on a device held in one hand.
 *
 *   1. **The cut has to land.** A picture that changes and then sits still reads
 *      as a stall. `punchTransform` gives every scene four frames of push-in —
 *      over before a viewer could name it, and the one thing that makes
 *      `transitionOut: "none"` look like an edit instead of an omission.
 *   2. **The type has to be the message.** A fixed size tuned so the LONGEST
 *      legal caption fits renders three words at the size a paragraph needed.
 *      `verticalCaptionSize` ramps it, so a short caption fills the frame the way
 *      this format is watched and a long one still lands inside the safe area.
 *   3. **Something has to survive the cut.** Six full-bleed pictures with nothing
 *      constant between them are six pictures; the eye finds its place again at
 *      every one. The rail is the film's own structure, drawn once above every
 *      scene — the same bar a feed application draws, for the same reason.
 */

/**
 * The gradient behind the caption, as a fraction of the frame height.
 *
 * A scrim rather than a panel, because this template is full bleed and a box
 * around the text would undo that. It has to be tall enough to darken the whole
 * caption block; 45% covers the safe area plus the type above it.
 *
 * It no longer carries the legibility promise, and it never could: what sits
 * under a glyph in a gradient depends on where the line broke and how tall the
 * caption ran, and a caption positioned `center` landed on the raw photograph
 * with this ramp already faded to nothing. The promise moved to the uniform dim
 * `verticalPalette` computes — one value everywhere, therefore measurable — and
 * this gradient stays on top of it as framing. It only ever adds density, so it
 * cannot invalidate a guarantee made on the dim alone.
 */
const SCRIM_HEIGHT = 0.45

/**
 * The gradient's own peak, lowered from 0.85 because it is now the SECOND layer.
 *
 * Composited over a dim the palette typically lands near 0.45, the two together
 * come to roughly the same density at the anchored edge as the single 0.85 ramp
 * used to — which is the point: the edge of a story frame should not visibly
 * change, only the middle of it, where the caption used to be unprotected.
 */
const SCRIM_EDGE = 0.55

/** Where the rail sits, and how big it is. Inside the top safe area, never against the edge. */
const RAIL_TOP_PERCENT = 5
const RAIL_SIDE_PERCENT = VERTICAL_SAFE_SIDE_PERCENT / 2
const RAIL_HEIGHT = 0.005
const RAIL_GAP = 0.008

/**
 * The one element of the film that is not inside a `Sequence`.
 *
 * It has to be: a rail that restarted at every cut would be six rails, which is
 * the opposite of the thing it is for. Rendered as a sibling AFTER the scenes so
 * that DOM order puts it on top, and reading `useCurrentFrame()` outside every
 * sequence so the frame it sees is the film's rather than a scene's.
 *
 * A single-scene film still gets one, and it is still worth having: it is the
 * only thing on screen that says how much is left.
 */
const StoryRail = ({ plan, palette }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const base = frameBase(width, height)
  const fills = railSegments(plan, frame)

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        paddingTop: `${RAIL_TOP_PERCENT}%`,
        paddingLeft: `${RAIL_SIDE_PERCENT}%`,
        paddingRight: `${RAIL_SIDE_PERCENT}%`,
      }}
    >
      <div style={{ display: 'flex', gap: Math.round(base * RAIL_GAP), width: '100%' }}>
        {fills.map((fill, index) => (
          <div
            key={index}
            style={{
              flex: '1 1 0',
              height: Math.max(3, Math.round(base * RAIL_HEIGHT)),
              borderRadius: Math.max(3, Math.round(base * RAIL_HEIGHT)),
              overflow: 'hidden',
              // The track is a surface of its own rather than the picture,
              // because the picture under it changes six times. Its density was
              // computed against both extremes of what an unknown photograph can
              // composite it to, exactly like the dim.
              backgroundColor: withAlpha(palette.rail.track.color, palette.rail.track.alpha),
            }}
          >
            <div
              style={{
                width: `${fill * 100}%`,
                height: '100%',
                // Measured on that track at the 3:1 floor a rule takes — the
                // same floor Mocky's own design system gives a filet or an icon.
                backgroundColor: palette.rail.fill.color,
              }}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

const StoryScene = ({ entry, src, theme, palette }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const { scene } = entry

  if (!src) {
    throw new Error(`No image was staged for scene image ${scene.imageId}.`)
  }

  const base = frameBase(width, height)
  const overlay = scene.textOverlay
  const position = overlay?.position ?? 'bottom'
  const parts = words(overlay?.content)

  // The punch, the document's own move, every word, then the rule under them. A
  // caption that arrives whole is a caption; a caption that arrives word by word
  // is somebody speaking, which is what this format is watched as.
  const motion = sceneMotion('vertical', entry, frame)
  const ruleProgress = motion.rule

  // The scrim follows the caption. A gradient anchored to the bottom while the
  // text sits at the top darkens the wrong half of the picture and leaves the
  // words on whatever was up there.
  const scrimEdge = position === 'top' ? 'to bottom' : 'to top'

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        ...entranceStyle(entry.enterTransition, frame, entry.enterFrames),
      }}
    >
      {/*
        The push-in, on a wrapper rather than on the picture: the Ken Burns move
        below is the DOCUMENT's and this one is the template's, and multiplying
        them in one string would make a scene that asked for `static` impossible
        to leave alone. `overflow: hidden` because the wrapper is what the
        overscale is clipped by.
      */}
      <AbsoluteFill style={{ overflow: 'hidden', transform: motion.punch }}>
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: motion.picture,
          }}
        />
      </AbsoluteFill>

      {overlay ? (
        <>
          {/*
            The uniform dim, and the only surface this caption's legibility is
            computed on. Built from the theme's own background, so the darkening
            matches the film rather than adding a colour nobody declared, and its
            density comes from `verticalPalette` — enough that the caption clears
            its floor over a photograph that is all white as well as one that is
            all black, since the picture is not in the theme and cannot be
            measured. `withAlpha` is the only way a hex token becomes a
            translucent value, and it validates the hex again on the way through.
          */}
          <AbsoluteFill style={{ backgroundColor: withAlpha(palette.dim.color, palette.dim.alpha) }} />
          {/* The directional ramp, as framing. It only ever adds density. */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(${scrimEdge}, ${withAlpha(theme.background, SCRIM_EDGE)}, ${withAlpha(theme.background, 0)} ${SCRIM_HEIGHT * 100}%)`,
            }}
          />
          <AbsoluteFill
            style={{
              justifyContent: overlayAlignment(position),
              alignItems: 'center',
              /*
                The safe areas, and the comment that explains them lives on the
                constants: a feed application draws its own interface OVER the
                video — the caption and the sound row along the bottom, the
                action rail up the right, the tabs across the top — so text
                placed there is not close to the edge, it is behind a button.
              */
              paddingTop: `${VERTICAL_SAFE_TOP_PERCENT}%`,
              paddingBottom: `${VERTICAL_SAFE_BOTTOM_PERCENT}%`,
              paddingLeft: `${VERTICAL_SAFE_SIDE_PERCENT}%`,
              paddingRight: `${VERTICAL_SAFE_SIDE_PERCENT}%`,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: Math.round(base * 0.026),
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  columnGap: Math.round(base * 0.022),
                  rowGap: 0,
                  color: palette.caption.color,
                  fontFamily: theme.headingFont,
                  // Ramped by how much caption there is, and larger at both ends
                  // than the slideshow's fixed size. A vertical film is watched
                  // on a phone held at arm's length, often without sound, and
                  // the title is the whole message.
                  fontSize: verticalCaptionSize(overlay.content, base),
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: '-0.03em',
                  textShadow: '0 2px 18px rgba(0, 0, 0, 0.6)',
                }}
              >
                {parts.map((word, index) => {
                  const arrived = motion.words[index]
                  return (
                    <span
                      key={index}
                      style={{
                        display: 'inline-block',
                        opacity: arrived,
                        transform: `translateY(${(1 - arrived) * base * 0.03}px)`,
                      }}
                    >
                      {/* Model-written text as a React child: escaped here and nowhere else. */}
                      {word}
                    </span>
                  )
                })}
              </div>
              {/* The accent, as the one mark of the project on an otherwise full-bleed frame. */}
              <div
                style={{
                  width: Math.round(base * 0.18 * ruleProgress),
                  height: Math.max(3, Math.round(base * 0.008)),
                  borderRadius: theme.radiusPx,
                  // The measured accent and not the raw token: this rule sits on
                  // the same dim the caption does, and an accent that matched the
                  // dim used to draw nothing at all.
                  backgroundColor: palette.accented.color,
                }}
              />
            </div>
          </AbsoluteFill>
        </>
      ) : null}
    </AbsoluteFill>
  )
}

/**
 * @param {{timeline: object, imageSrc: Record<string, string>}} props
 */
export const VerticalStoryVideo = ({ timeline, imageSrc }) => {
  const plan = planTimeline(timeline)
  const theme = resolveTheme(timeline?.theme)
  const palette = verticalPalette(theme)

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {plan.scenes.map((entry, index) => (
        <Sequence key={index} from={entry.from} durationInFrames={entry.durationInFrames}>
          <StoryScene entry={entry} src={imageSrc?.[entry.scene.imageId]} theme={theme} palette={palette} />
        </Sequence>
      ))}
      {/* After the scenes, so DOM order paints it above every one of them. */}
      <StoryRail plan={plan} palette={palette} />
    </AbsoluteFill>
  )
}
