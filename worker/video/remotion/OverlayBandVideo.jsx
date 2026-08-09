import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  CUE_ENTER_FRAMES,
  EMPHASIS_ENTER_FRAMES,
  KICKER_SIZE,
  KICKER_TRACKING,
  OVERLAY_DRIFT_PERCENT,
  OVERLAY_DRIFT_SCALE,
  bandInset,
  cueFrames,
  cueProgress,
  entranceStyle,
  frameBase,
  overlayPalette,
  planTimeline,
  progressAt,
  resolveTheme,
  sceneLabel,
  withAlpha,
} from './composition.js'

/**
 * `overlay` — a screenshot with a block of text on it.
 *
 * This is the template the feature is mostly for: showing a screen somebody has
 * just generated, with a sentence saying what it is. Everything in it follows
 * from that one sentence having to be legible over a picture nobody previewed,
 * and from the capture staying recognisable underneath.
 *
 * Written by hand like every composition here. Nothing from the document becomes
 * markup, a class name, a style string or a URL: the band's two strings are React
 * children, the image address is built by `render.js` from a validated hash, and
 * the colours come from `resolveTheme`, which refuses anything that is not a hex
 * value. `dangerouslySetInnerHTML` does not appear in this directory.
 *
 * ── Why the band stops where its text stops ──────────────────────────────────
 *
 * It used to run the full width of the frame and touch three of its sides, which
 * is a lower third from a news bulletin. Two things are wrong with that here and
 * both are about the picture: the band covers the capture edge to edge whatever
 * the sentence on it is, and a four-word title then sits in the middle of a bar
 * with two thirds of it empty — so the film gives up the widest strip of the
 * screenshot it exists to show, in exchange for nothing.
 *
 * A block that stops where its text stops reads as something somebody placed. It
 * needs an edge to be placed AGAINST, which is what the margin and the accent
 * rule down the leading side are for: `bandInset` keeps it off all four sides,
 * the rule gives the type an assise, and the block wipes in from that same edge
 * so the first thing on screen is the mark rather than the paint.
 *
 * None of it touches the legibility promise. The band is the same colour at the
 * same density as before, measured the same way over both extremes of what the
 * capture can composite it to — it simply covers less.
 */

/** The accent rule down the band's leading edge — the one thing that says whose film this is. */
const RULE_PX = 6

/** How long the band takes to wipe in: a third of a second, ahead of its own text. */
const BAND_REVEAL_FRAMES = 10

/** The hairline between the title and its subtitle, as a fraction of the subtitle's ink. */
const HAIRLINE_ALPHA = 0.34

const BandScene = ({ entry, index, total, src, theme, palette }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const { scene } = entry

  if (!src) {
    // Loud, not blank, for the reason the slideshow gives: a scene with no
    // picture encodes as a coloured rectangle and is delivered as a successful
    // export of something nobody described.
    throw new Error(`No image was staged for scene image ${scene.imageId}.`)
  }

  const base = frameBase(width, height)
  const atTop = scene.band.position === 'top'
  const inset = bandInset(width, height)
  const label = sceneLabel(index, total)

  // Four cues: the block arrives, then its kicker, then the title, then the
  // subtitle. One arrival carrying everything reads as a caption; four read as
  // somebody putting a card down and then saying what is on it.
  const [bandCue, kickerCue, titleCue, subtitleCue] = cueFrames(4, entry.durationInFrames, { offset: 2, step: 5 })

  const bandProgress = cueProgress(frame, bandCue, BAND_REVEAL_FRAMES)
  const kickerProgress = cueProgress(frame, kickerCue)
  // The title takes the long entrance, because it is the one line of the scene
  // that has to be read: see `EMPHASIS_ENTER_FRAMES`.
  const titleProgress = cueProgress(frame, titleCue, EMPHASIS_ENTER_FRAMES)
  const subtitleProgress = cueProgress(frame, subtitleCue, CUE_ENTER_FRAMES)

  // Percent of the picture's own height, from +drift to −drift over the scene.
  const drift = OVERLAY_DRIFT_PERCENT * (1 - 2 * progressAt(frame, Math.max(1, entry.durationInFrames - 1)))

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        ...entranceStyle(entry.enterTransition, frame, entry.enterFrames),
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // A capture is read from its top. `cover` centres by default, which on
          // a tall screenshot of a page shows the middle of it and cuts off the
          // header the film exists to show.
          objectPosition: 'center top',
          transform: `scale(${OVERLAY_DRIFT_SCALE}) translateY(${drift}%)`,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: atTop ? 'flex-start' : 'flex-end',
          alignItems: 'flex-start',
          padding: `${inset.marginPercent}%`,
        }}
      >
        <div
          style={{
            maxWidth: `${inset.maxWidthPercent}%`,
            backgroundColor: withAlpha(palette.band.color, palette.band.alpha),
            // The rule sits on the leading edge, where the block starts and
            // where the type is aligned. Along the inner horizontal edge it read
            // as a stripe against the picture; down the side it reads as the
            // margin of a printed column, which is what the type needs to sit
            // against.
            borderLeft: `${RULE_PX}px solid ${palette.accented.color}`,
            padding: `${Math.round(base * 0.04)}px ${Math.round(base * 0.05)}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: Math.round(base * 0.016),
            // The block draws itself in from the same edge the rule is on. An
            // `inset()` shrinking on the RIGHT uncovers leftwards-to-rightwards,
            // so the accent rule is the first pixel on screen.
            clipPath: `inset(0 ${(1 - bandProgress) * 100}% 0 0)`,
            // A shadow away from the capture, so the block has an edge even when
            // the theme's surface and the screenshot happen to be the same
            // colour — which for a film cut from the project that made the
            // screenshot is the common case, not the odd one.
            boxShadow: atTop ? '0 12px 40px rgba(0,0,0,0.35)' : '0 -12px 40px rgba(0,0,0,0.35)',
          }}
        >
          {label ? (
            <div
              style={{
                opacity: kickerProgress,
                fontFamily: theme.bodyFont,
                fontSize: Math.round(base * KICKER_SIZE),
                fontWeight: 700,
                letterSpacing: KICKER_TRACKING,
                // Measured on the band, at the same density as the title and the
                // subtitle, at the display floor its size and weight licence.
                color: palette.accented.color,
              }}
            >
              {label}
            </div>
          ) : null}

          {/*
            The title, revealed from behind its own edge rather than faded in.
            The mask is the block's own bottom edge for a band at the top of the
            frame and its top edge otherwise, so the line always arrives from the
            side the picture is on.
          */}
          <div style={{ overflow: 'hidden', paddingTop: '0.06em', marginTop: '-0.06em' }}>
            <div
              style={{
                transform: `translateY(${(1 - titleProgress) * (atTop ? -100 : 100)}%)`,
                // Measured against the band at BOTH ends of what the capture can
                // composite it to — a white dashboard and a black terminal —
                // since the picture is not in the theme and cannot be measured
                // directly.
                color: palette.title.color,
                fontFamily: theme.headingFont,
                fontSize: Math.round(base * 0.062),
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: '-0.015em',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {/* Model-written text as a React child: escaped here and nowhere else. */}
              {scene.band.title}
            </div>
          </div>

          {scene.band.subtitle ? (
            <div
              style={{
                opacity: subtitleProgress,
                // The hairline that separates the two lines, drawn out with the
                // subtitle rather than sitting there waiting for it. A relative
                // of the subtitle's own ink, for the reason the subtitle is a
                // relative of the title's: no direction states a token for "the
                // quiet line".
                borderTop: `1px solid ${withAlpha(palette.subtitle.color, HAIRLINE_ALPHA * subtitleProgress)}`,
                paddingTop: Math.round(base * 0.016),
              }}
            >
              <div
                style={{
                  transform: `translateY(${(1 - subtitleProgress) * base * 0.014}px)`,
                  // Not a second colour from the theme — a direction states four
                  // and none of them is "the quieter text". A 76% mix of the ink
                  // over the band keeps the pair related whatever it is, where a
                  // hard-coded grey would fight a pale direction. Mixed to a solid
                  // rather than left as an alpha so it can be measured at all.
                  color: palette.subtitle.color,
                  fontFamily: theme.bodyFont,
                  fontSize: Math.round(base * 0.036),
                  fontWeight: 400,
                  lineHeight: 1.35,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {scene.band.subtitle}
              </div>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/**
 * @param {{timeline: object, imageSrc: Record<string, string>}} props
 */
export const OverlayBandVideo = ({ timeline, imageSrc }) => {
  const plan = planTimeline(timeline)
  const theme = resolveTheme(timeline?.theme)
  const palette = overlayPalette(theme)

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {plan.scenes.map((entry, index) => (
        <Sequence key={index} from={entry.from} durationInFrames={entry.durationInFrames}>
          <BandScene
            entry={entry}
            index={index}
            total={plan.scenes.length}
            src={imageSrc?.[entry.scene.imageId]}
            theme={theme}
            palette={palette}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
