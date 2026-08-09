import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  CUE_ENTER_FRAMES,
  CUE_TAIL_GAP_FRAMES,
  EMPHASIS_ENTER_FRAMES,
  KICKER_SIZE,
  KICKER_TRACKING,
  cueFrames,
  cueProgress,
  entranceStyle,
  frameBase,
  hairlineTexture,
  kenBurnsTransform,
  ordinalLabel,
  planTimeline,
  productLayout,
  productPalette,
  PICTURE_SHARE,
  resolveTheme,
  withAlpha,
} from './composition.js'

/**
 * `product` — one picture, a headline, up to three arguments and a call to
 * action.
 *
 * The scene kind is the busiest in the catalogue, which is why its floor is
 * three seconds: five pieces of text have to arrive, be read and still be on
 * screen when the scene ends. `cueFrames` is what enforces the last part —
 * see `MIN_CUE_TAIL_FRAMES`, which exists because of exactly this template.
 *
 * `bullets` is one to three, never exactly three, so the column below lays out
 * whatever arrived rather than reserving a slot for a missing argument.
 *
 * Written by hand, reading its props as hostile: every string is a React child,
 * the image address comes from a validated hash, and every colour is a hex value
 * `resolveTheme` accepted.
 *
 * ── The two things a card of arguments has to get right ──────────────────────
 *
 * **The list has to enumerate.** Three lines that fade in one after another, each
 * behind a dot, is a paragraph broken into three. What makes a list read as a
 * list is that its items are COUNTED and that each one closes: a numeral in the
 * project's colour, a rule under the line, and an entrance that comes from the
 * margin rather than from below, so the eye is pulled along the column instead of
 * watching three identical arrivals in place.
 *
 * **The call to action has to conclude.** It used to be the fifth element of an
 * evenly spaced cascade, which is to say the fourth argument. Three things make
 * it an ending instead, and none of them is size — the pill is already the
 * loudest object on the card: a beat of silence before it (`tailGap`), a rule
 * that closes the list, and an entrance of its own, since everything that arrived
 * in the four hundred milliseconds before it rose and this one grows.
 */

// `PICTURE_SHARE` used to live here. It moved next to `productLayout` in
// `composition.js` when Mocky's own panel had to read it — see the note there.

/** The accent rule in the gutter between the picture and the card. */
const GUTTER_RULE_PX = 5

/** The hairline that closes each argument, as a fraction of its own ink. */
const BULLET_RULE_ALPHA = 0.22

/** How far an argument travels in from the margin, as a fraction of the short edge. */
const BULLET_SLIDE = 0.028

/** The pill grows into place from here, where everything above it rose into place. */
const CTA_SCALE_FROM = 0.94

const ProductScene = ({ entry, src, theme, palette }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const { scene } = entry

  if (!src) {
    throw new Error(`No image was staged for scene image ${scene.imageId}.`)
  }

  const base = frameBase(width, height)
  const layout = productLayout(width, height)
  const bullets = Array.isArray(scene.bullets) ? scene.bullets : []
  const hasCta = Boolean(scene.cta)

  /*
   * Headline, then each argument, then — only when there is one — the rule that
   * closes the list and the call to action. One cascade, so the whole card is
   * guaranteed to have landed before the scene ends, and one tail gap, which is
   * the entire difference between a conclusion and a fourth argument.
   */
  const cues = cueFrames(1 + bullets.length + (hasCta ? 2 : 0), entry.durationInFrames, {
    offset: 3,
    step: 7,
    tailGap: CUE_TAIL_GAP_FRAMES,
  })
  const headlineProgress = cueProgress(frame, cues[0], EMPHASIS_ENTER_FRAMES)
  const closingProgress = hasCta ? cueProgress(frame, cues[cues.length - 2]) : 0
  const ctaProgress = hasCta ? cueProgress(frame, cues[cues.length - 1]) : 0

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.ground.color,
        // The hairline field, as a background image rather than a layer: an
        // absolutely positioned child paints above its in-flow siblings whatever
        // the DOM order, so a texture drawn as a layer would cover the card. Its
        // colour and density are read back off the surface the palette measured
        // — see `groundTint` — never chosen here.
        ...(palette.ground.tint
          ? { backgroundImage: hairlineTexture(palette.ground.tint.color, palette.ground.tint.alpha) }
          : {}),
        display: 'flex',
        flexDirection: layout,
        ...entranceStyle(entry.enterTransition, frame, entry.enterFrames),
      }}
    >
      {/*
        A wide frame for the picture: half the width in landscape, a full-width
        band in portrait and square. `cover` because a product shot cropped at
        its edges still shows the product, while a letterboxed one puts two grey
        bars in the middle of an advertisement.
      */}
      <div
        style={{
          flex: `0 0 ${PICTURE_SHARE[layout] * 100}%`,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: theme.surface,
          // The gutter rule, on the edge that faces the card. A picture and a
          // column of type meeting at a raw seam is the one place this layout
          // looked unfinished; the accent there is the same mark the banded
          // template puts down its leading edge.
          [layout === 'row' ? 'borderRight' : 'borderBottom']: `${GUTTER_RULE_PX}px solid ${palette.accented.color}`,
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // The slideshow's own zoom, reused rather than reinvented. This
            // template has no `kenBurns` field — the document does not get to
            // choose — but a product shot held perfectly still beside a cascade
            // of arriving text is the half of the frame that looks broken.
            transform: kenBurnsTransform('zoom-in', frame, entry.durationInFrames),
          }}
        />
      </div>

      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: Math.round(base * 0.028),
          padding: `${Math.round(base * 0.06)}px ${Math.round(base * 0.06)}px`,
        }}
      >
        {/* Revealed from behind its own edge rather than faded in, and over the
            long entrance: the headline is the line that has to be read. */}
        <div style={{ overflow: 'hidden', paddingTop: '0.06em', paddingBottom: '0.16em', marginBottom: '-0.16em' }}>
          <div
            style={{
              transform: `translateY(${(1 - headlineProgress) * 100}%)`,
              // Measured against the card's own ground. The reported defect was
              // here too — a dark green "Porsche 911" on near-black, with the call
              // to action the only thing on screen anybody could read, because the
              // pill was the only element that already measured its ink.
              color: palette.headline.color,
              fontFamily: theme.headingFont,
              fontSize: Math.round(base * 0.064),
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {/* Model-written text as a React child: escaped here and nowhere else. */}
            {scene.headline}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(base * 0.014) }}>
          {bullets.map((bullet, index) => {
            const arrived = cueProgress(frame, cues[index + 1], CUE_ENTER_FRAMES)
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: Math.round(base * 0.01) }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: Math.round(base * 0.02),
                    opacity: arrived,
                    // In from the margin rather than up from below. Everything
                    // else on this card rises; an argument that slides along the
                    // column is what makes three of them read as an enumeration
                    // instead of three copies of the same arrival.
                    transform: `translateX(${(arrived - 1) * base * BULLET_SLIDE}px)`,
                    // A quieter relative of the ink, mixed to a solid over the
                    // ground rather than set as an alpha: an alpha's painted colour
                    // depends on what is behind it, so it cannot be measured, and
                    // these three lines went out unreadable for exactly that reason.
                    color: palette.bullet.color,
                    fontFamily: theme.bodyFont,
                    fontSize: Math.round(base * 0.034),
                    lineHeight: 1.35,
                  }}
                >
                  {/*
                    A numeral rather than a drawn dot. The dot was there because
                    `•` and `–` are not in every face and a glyph this container
                    does not have renders as a hollow box — digits are, in every
                    face there is, and they say something a dot cannot: that this
                    is the second of three arguments rather than another line.
                  */}
                  <span
                    style={{
                      flex: '0 0 auto',
                      fontFamily: theme.bodyFont,
                      fontSize: Math.round(base * KICKER_SIZE),
                      fontWeight: 700,
                      letterSpacing: KICKER_TRACKING,
                      color: palette.accented.color,
                    }}
                  >
                    {ordinalLabel(index)}
                  </span>
                  <span style={{ minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{bullet}</span>
                </div>
                {/* The rule that closes the argument, drawn out with it. */}
                <div
                  style={{
                    height: 1,
                    backgroundColor: withAlpha(palette.bullet.color, BULLET_RULE_ALPHA),
                    transform: `scaleX(${arrived})`,
                    transformOrigin: 'left center',
                  }}
                />
              </div>
            )
          })}
        </div>

        {hasCta ? (
          <>
            {/* The heavier rule that closes the list — the accent, so it reads as
                a different mark from the three hairlines above it. */}
            <div
              style={{
                height: Math.max(2, Math.round(base * 0.004)),
                width: '38%',
                backgroundColor: palette.accented.color,
                transform: `scaleX(${closingProgress})`,
                transformOrigin: 'left center',
              }}
            />
            <div
              style={{
                display: 'flex',
                opacity: ctaProgress,
                // It grows where everything above it rose. One entrance nothing
                // else on the card uses is the cheapest way to say "and this is
                // the last thing".
                transform: `scale(${CTA_SCALE_FROM + (1 - CTA_SCALE_FROM) * ctaProgress})`,
                transformOrigin: 'left center',
              }}
            >
              <div
                style={{
                  backgroundColor: palette.cta.on.color,
                  // The theme's own colours tried first and black or white only if
                  // none of them measures, on the accent the pill is filled with.
                  // An accent is whatever the direction declared — a pale mint and
                  // a deep navy are both plausible — and a label coloured for one
                  // is invisible on the other.
                  color: palette.cta.color,
                  fontFamily: theme.headingFont,
                  fontSize: Math.round(base * 0.034),
                  fontWeight: 700,
                  lineHeight: 1.2,
                  padding: `${Math.round(base * 0.022)}px ${Math.round(base * 0.038)}px`,
                  borderRadius: theme.radiusPx,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {scene.cta}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

/**
 * @param {{timeline: object, imageSrc: Record<string, string>}} props
 */
export const ProductSpotlightVideo = ({ timeline, imageSrc }) => {
  const plan = planTimeline(timeline)
  const theme = resolveTheme(timeline?.theme)
  const palette = productPalette(theme)

  return (
    <AbsoluteFill style={{ backgroundColor: palette.ground.color }}>
      {plan.scenes.map((entry, index) => (
        <Sequence key={index} from={entry.from} durationInFrames={entry.durationInFrames}>
          <ProductScene entry={entry} src={imageSrc?.[entry.scene.imageId]} theme={theme} palette={palette} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
