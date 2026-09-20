import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  KICKER_SIZE,
  KICKER_TRACKING,
  entranceStyle,
  frameBase,
  hairlineTexture,
  planTimeline,
  resolveTheme,
  sceneMotion,
  titlesPalette,
  withAlpha,
  words,
} from './composition.js'

/**
 * `titles` — words on the project's own background, and no picture at all.
 *
 * The only composition in this directory that never touches `imageSrc`, which is
 * the point of the template rather than an omission: it is what an instance with
 * an empty media library can still export, and it is by a wide margin the
 * cheapest thing this worker renders — no image decode, no `cover` recomposite,
 * just type on a flat fill.
 *
 * `TitleSceneSchema` has no `imageId`, so `timelineImageIds` returns nothing for
 * one of these documents and `/render` never looks a picture up. A composition
 * that reached for `entry.scene.imageId` anyway would fail on a document that is
 * perfectly valid — which is the failure `timelineImageIds` exists to have
 * already prevented one layer up.
 *
 * Written by hand, reading its props as hostile: the headline and the subtitle
 * are React children and every colour is a hex value `resolveTheme` accepted.
 *
 * ── What a title sequence needs that "a title and a rule" did not ────────────
 *
 * The first version put the headline on the centre line, faded it in, drew a
 * short bar under it and stopped. Nothing in it was wrong and nothing in it was
 * designed: one arrival, one ornament, one flat fill, and a viewer with three
 * seconds and nothing to look at. Four things changed, and each is a device
 * Mocky's own interface already uses rather than an effect invented here.
 *
 *   1. **A margin instead of a centre line.** Left-aligned on a generous
 *      gutter is what `.page` does, and it gives every element the same edge to
 *      start from — which is the whole of "affiche suisse plutôt que tableau de
 *      bord". A centred block has no edge, so nothing can be aligned to
 *      anything and the rule under it could only ever be a floating bar.
 *   2. **A kicker.** `.kicker` is the most-used device in the interface for the
 *      price of one line, and the film already knows what to put in it: which
 *      scene of how many. See `sceneLabel` for why that beats a schema field.
 *   3. **An accented last word.** The oldest stress mark in typography, and the
 *      only one available here — there is one weight in this container and no
 *      italic. It arrives more slowly than the words before it, so the emphasis
 *      is in the timing as well as in the colour.
 *   4. **A ground that is not a flat fill**: a field of hairlines, and a rule
 *      that runs the measure once the headline has landed. Both are 1 px, both
 *      are the house's own vocabulary, and the texture is part of what the
 *      palette MEASURES rather than a layer painted over a guarantee — see
 *      `groundTint`.
 */

// `BLOCK_DRIFT` used to live here. It moved to `composition.js` as
// `TITLE_BLOCK_DRIFT` when the motion of every template did, for the reason that
// file gives: a drift computed inside a `.jsx` is a drift no test can prove is
// still there.

/** How much of the running rule is the accent's, before the hairline takes over. */
const RULE_ACCENT_SHARE = 0.14

/** The hairline half of the rule, as a fraction of the headline's own ink. */
const RULE_HAIRLINE_ALPHA = 0.3

/**
 * How far a word sits below its mask before it arrives, as a percentage of its
 * own line box.
 *
 * Past 100 on purpose. The box is padded below the baseline so that descenders
 * are not clipped at rest, which also means a word translated by exactly its own
 * height still shows a sliver of itself in that padding — one row of pixels
 * under every word of a headline, on the frames before it arrives.
 */
const MASK_TRAVEL_PERCENT = 135

const TitleScene = ({ entry, theme, palette }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const { scene } = entry
  const base = frameBase(width, height)

  const parts = words(scene.headline)
  const staggered = scene.animation === 'stagger'
  // Off the plan, which is where the film's own structure is known — see
  // `planTimeline`. Computed here as well, it disagreed with `sceneMotion`, and
  // every single-scene card reported a kicker arriving that this branch never
  // drew.
  const label = entry.label

  /*
   * One cascade for the whole scene — the kicker, every word (or the headline as
   * a single beat), then the rule, then the subtitle — plus the block's own slow
   * drift. `titlesMotion` places all of it in one call to `cueFrames`, which is
   * what keeps a twelve-word headline on a 1500 ms scene from putting its
   * subtitle past the end: four separate calls each fit on their own and still
   * overrun together.
   */
  const motion = sceneMotion('titles', entry, frame)
  const { kicker: kickerProgress, rule: ruleProgress, subtitle: subtitleProgress } = motion

  // A fraction of the short edge on the way out of `composition.js`, pixels here:
  // the movement is arithmetic and the size of the frame is layout.
  const drift = motion.drift * base
  const ruleThickness = Math.max(1, Math.round(base * 0.0028))

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.ground.color,
        /*
          The hairline field, as a background image rather than as a layer. Two
          reasons, and the second is the one that would have cost an afternoon:
          its colour and its density are read back off the surface the palette
          MEASURED — see `groundTint`, a texture the palette does not know about
          is a layer painted over a contrast guarantee — and an absolutely
          positioned child paints above its in-flow siblings whatever the DOM
          order, so a texture drawn as a layer covers the headline.
        */
        ...(palette.ground.tint
          ? { backgroundImage: hairlineTexture(palette.ground.tint.color, palette.ground.tint.alpha) }
          : {}),
        justifyContent: 'center',
        alignItems: 'flex-start',
        // The gutter everything on the frame aligns to. Percentages resolve
        // against the frame's WIDTH on both axes, which is what keeps one number
        // reading the same in a landscape export and a portrait one.
        padding: '9% 8%',
        ...entranceStyle(entry.enterTransition, frame, entry.enterFrames),
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          transform: `translateY(${drift}px)`,
        }}
      >
        {label ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(base * 0.016),
              marginBottom: Math.round(base * 0.03),
              opacity: kickerProgress,
            }}
          >
            {/* The kicker's own rule, drawn out from the margin as it arrives. */}
            <div
              style={{
                width: Math.round(base * 0.048 * kickerProgress),
                height: ruleThickness * 2,
                backgroundColor: palette.accented.color,
              }}
            />
            <span
              style={{
                fontFamily: theme.bodyFont,
                fontSize: Math.round(base * KICKER_SIZE),
                fontWeight: 700,
                letterSpacing: KICKER_TRACKING,
                // Measured on the ground like every other run, at the display
                // floor its size and weight licence — see `KICKER_SIZE`.
                color: palette.accented.color,
              }}
            >
              {label}
            </span>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            // The gap replaces the space between words, because each word is its
            // own box once any of them can arrive on its own frame. One layout
            // for the three animations rather than a wrapped block for two of
            // them and spans for the third: two layouts is two sets of line
            // breaks, and only one of them would ever be looked at.
            columnGap: Math.round(base * 0.022),
            rowGap: Math.round(base * 0.006),
            fontFamily: theme.headingFont,
            fontSize: Math.round(base * 0.096),
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            // Measured against the ground it is actually painted on, never the
            // stated ink taken on trust. This is the line the reported defect
            // was on: a dark green headline on a near-black frame, from a
            // direction whose two colours never met outside this file.
            color: palette.headline.color,
          }}
        >
          {parts.map((word, i) => {
            /*
             * The last word of a headline of several, in the accent and taking
             * half a second to arrive where its neighbours take three tenths —
             * `titlesMotion` gives it the longer entrance, this line gives it the
             * colour.
             *
             * The last and not the first, because a headline is a sentence and a
             * sentence lands on its end: "Designed in the BROWSER". A single-word
             * headline is left alone — accenting the whole thing is not an
             * accent, it is a colour change.
             */
            const emphasis = parts.length > 1 && i === parts.length - 1
            const arrived = motion.words[i]
            const color = emphasis ? palette.accented.color : undefined

            // `fade` holds still and only appears; `rise` lifts the whole block
            // into place; `stagger` reveals each word from behind its own mask,
            // which is the one that reads as a title sequence rather than as an
            // element appearing. The enum is the schema's and its three meanings
            // are the schema's — the treatments are this file's business.
            if (staggered) {
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    overflow: 'hidden',
                    // Padding out and margin back in: the visible box is taller
                    // than the line box so descenders survive `overflow: hidden`,
                    // and the layout is exactly what it would have been without
                    // either.
                    paddingTop: '0.08em',
                    paddingBottom: '0.2em',
                    marginTop: '-0.08em',
                    marginBottom: '-0.2em',
                    color,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      transform: `translateY(${(1 - arrived) * MASK_TRAVEL_PERCENT}%)`,
                    }}
                  >
                    {/* Model-written text as a React child: escaped here and nowhere else. */}
                    {word}
                  </span>
                </span>
              )
            }

            const lift = scene.animation === 'fade' ? 0 : (1 - arrived) * base * 0.05
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: arrived,
                  transform: `translateY(${lift}px)`,
                  color,
                }}
              >
                {word}
              </span>
            )
          })}
        </div>

        {/*
          The rule that runs the measure once the headline has landed — the
          double rule of a printed page, a heavy segment and a hairline, drawn
          from the margin outwards rather than grown from the middle. Scaled
          rather than animated on `width`, because a transform is composited and
          a width is a layout pass on every frame of every scene.
        */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            width: '100%',
            marginTop: Math.round(base * 0.042),
            transform: `scaleX(${ruleProgress})`,
            transformOrigin: 'left center',
          }}
        >
          <div
            style={{
              width: `${RULE_ACCENT_SHARE * 100}%`,
              height: ruleThickness * 3,
              backgroundColor: palette.accented.color,
            }}
          />
          <div
            style={{
              flex: '1 1 auto',
              height: ruleThickness,
              // A relative of the ink rather than a grey of its own, for the
              // reason the subtitle is one: no direction states a token for
              // "the quiet line", and a hard-coded grey fights a pale ground.
              backgroundColor: withAlpha(palette.headline.color, RULE_HAIRLINE_ALPHA),
            }}
          />
        </div>

        {scene.subtitle ? (
          <div
            style={{
              marginTop: Math.round(base * 0.032),
              opacity: subtitleProgress,
              transform: `translateY(${(1 - subtitleProgress) * base * 0.024}px)`,
              // A quieter relative of the ink rather than a grey of its own: a
              // direction states four colours and none of them is "the quieter
              // one", and a hard-coded grey fights a pale background. Mixed to
              // a solid over the ground instead of set as an alpha, because an
              // alpha's painted colour depends on what is behind it and cannot
              // be measured — which is how this subtitle shipped invisible.
              color: palette.subtitle.color,
              fontFamily: theme.bodyFont,
              fontSize: Math.round(base * 0.038),
              lineHeight: 1.4,
              maxWidth: '68%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {scene.subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

/**
 * @param {{timeline: object}} props
 */
export const AnimatedTitlesVideo = ({ timeline }) => {
  const plan = planTimeline(timeline)
  const theme = resolveTheme(timeline?.theme)
  // Resolved once for the film rather than once per scene: the theme is the
  // same for all of them, and the search behind it is a search.
  const palette = titlesPalette(theme)

  return (
    <AbsoluteFill style={{ backgroundColor: palette.ground.color }}>
      {plan.scenes.map((entry, index) => (
        <Sequence key={index} from={entry.from} durationInFrames={entry.durationInFrames}>
          {/* The counter is the film's own structure and it rides on the plan
              entry: a scene does not know how many others there are, and a
              component that recomputed it would be right until the day it
              disagreed with the motion that reports its arrival. */}
          <TitleScene entry={entry} theme={theme} palette={palette} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
