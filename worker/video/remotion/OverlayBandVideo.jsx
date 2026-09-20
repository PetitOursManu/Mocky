import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  KICKER_SIZE,
  KICKER_TRACKING,
  bandInset,
  entranceStyle,
  frameBase,
  overlayPalette,
  planTimeline,
  resolveTheme,
  sceneMotion,
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
 *
 * ── Why the capture moves, when a camera move would ruin it ──────────────────
 *
 * "No camera move here at all" was written down as this template's discipline and
 * then read as "nothing moves", which is how a film of still screenshots with
 * titles on them got exported and reported as a montage. The discipline was never
 * about movement; it was about AMPLITUDE. A pan spends 4% of travel on a 12%
 * overscale — an eighth of the interface cropped before the first frame — while
 * `overlayDriftTransform` spends 1.2% on 3%, which stays inside the margin the
 * overscale leaves. Every pixel the frame shows at rest, it shows on every frame.
 *
 * Which of the three moves it makes is now the document's to choose (`move`), and
 * the picture is the only thing that moves at all: the band is fixed in the frame,
 * so nothing here can carry a run of text onto a surface `overlayPalette` did not
 * measure.
 */

/** The accent rule down the band's leading edge — the one thing that says whose film this is. */
const RULE_PX = 6

/** The hairline between the title and its subtitle, as a fraction of the subtitle's ink. */
const HAIRLINE_ALPHA = 0.34

const BandScene = ({ entry, src, theme, palette }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const { scene } = entry
  const motion = sceneMotion('overlay', entry, frame)

  if (!src) {
    // Loud, not blank, for the reason the slideshow gives: a scene with no
    // picture encodes as a coloured rectangle and is delivered as a successful
    // export of something nobody described.
    throw new Error(`No image was staged for scene image ${scene.imageId}.`)
  }

  const base = frameBase(width, height)
  const atTop = scene.band.position === 'top'
  const inset = bandInset(width, height)
  // The counter comes off the plan rather than being computed here from an index
  // and a total. It is the film's own structure, `sceneMotion` has to know
  // whether there is one before it reports its arrival, and two computations of
  // one string is how a kicker's entrance was reported on films that draw none.
  const label = entry.label
  const { band: bandProgress, kicker: kickerProgress, title: titleProgress, subtitle: subtitleProgress } = motion

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
          // The drift the document asked for, or the one it got by saying
          // nothing. Never `none`: see `overlayDriftTransform`.
          transform: motion.picture,
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
          <BandScene entry={entry} src={imageSrc?.[entry.scene.imageId]} theme={theme} palette={palette} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
