/**
 * `progressBar` - a bar filling to a stated percentage, with a ruler marching
 * across it.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       THIS block's own box in pixels, off `composedLayout`. The bar's
 *             length is its width and nothing here reads the frame.
 *   unit      the type unit its stack agreed on. The label is a step on that one
 *             scale and the bar's thickness a share of the same number, so a bar
 *             beside a heading is not two fractions of a frame.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground for the track, the accent FILL for the bar. The label and the value are running text on the GROUND and take `palette.body`.
 *
 * LEGIBILITY: The value is printed beside the bar and not inside it, deliberately: inside, the glyph would sit on `palette.fill` and need `palette.onFill`, and a block whose ink depends on how far the bar has filled is a block that changes surface mid-scene. The ruler is the mirror of that rule rather than an exception to it - it crosses both surfaces, so it takes the run each half of the track was measured for, `accent` on the ground and `onFill` on the fill, and every layer is painted BELOW the strength the palette measured (`TRACK_QUIET`, `TICK_QUIET`, `FILL_TICK_QUIET`).
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** A hex
 *      value in this file is a colour nobody measured; a curve is a sixth notion
 *      of how things move. Both arrive as props, out of `composition.js`, where
 *      a test can reach them.
 *   2. **No `remotion` import, ever.** Nothing here needs a frame hook - the
 *      frame arrives as `progress` and `life` - and staying free of it is what
 *      lets `blocks.test.js` load the whole registry inside Mocky's own suite,
 *      where Remotion is not installed.
 *
 * WHAT MOVES. The fill walks `progress`, so it eases with everything else and
 * the value counts up alongside it - one quantity read twice, which is why both
 * come out of `progressBarGeometry` and are asserted equal by a test rather than
 * computed twice here. And once the bar has reached its value the RULER is what
 * is left moving: a bar frozen for the rest of its scene is the defect
 * `DEFAULT_KEN_BURNS` argues about at length, one element down.
 *
 * The ruler crosses the whole track, and that is the part worth reading twice. A
 * march living in the remainder stops at `to: 100`; one living in the fill stops
 * at `to: 0`. Both are values this schema accepts, so it is one ruler over two
 * layers - the phase is shared and both layers start at the track's left edge,
 * which is what makes the ticks line up across the boundary instead of two
 * patterns meeting at a seam.
 *
 * And its PITCH comes from the thickness, which comes from the box. It used to be
 * 1.4% of the frame's short edge on a track that was 1.2% of it - a step 1.15
 * times the thickness of the bar it crossed - and at 1080p the result was not a
 * ruler at all: a hatched band, in which the ticks ate the fill and the eye
 * counted stripes instead of measuring a length, which is the one thing this
 * block exists to show. See `HATCH_PITCH_TRACKS` and `HATCH_MIN_TICKS`.
 */
import { FILL_TICK_QUIET, TICK_QUIET, TRACK_QUIET, progressBarGeometry } from './misc.js'

export const ProgressBar = ({ block, palette, theme, box, unit, progress, life }) => {
  const bar = progressBarGeometry(block, box, unit, progress, life, theme.radiusPx)

  /**
   * The ruler, in whichever ink the surface underneath it takes.
   *
   * Hard stops and no ramp, so the ticks are ticks: a `transparent` keyword in a
   * gradient is the one way to say "nothing here" without writing a colour, and
   * `Ground` says it the same way one level up.
   */
  const ruler = (color) => ({
    backgroundImage: `repeating-linear-gradient(to right, ${color} 0 ${bar.tick}px, transparent ${bar.tick}px ${bar.hatchPitch}px)`,
    backgroundPosition: `${bar.hatchOffset}px 0`,
  })

  return (
    /*
     * The block draws exactly `BLOCK_APPETITE.progressBar.fixed` units of
     * furniture plus its label — the height `stackIn` divided the zone by — and
     * the slack goes above and below the group rather than inside it. See the
     * note on `gap` and `pad`: left INSIDE it, a bar capped in a narrow column
     * put half a frame of nothing between the label and the rule, which is the
     * same void the whole pass is about arriving through a margin.
     */
    <div style={{ width: '100%', opacity: progress, paddingTop: bar.pad, paddingBottom: bar.pad }}>
      {block.label ? (
        <div
          style={{
            marginBottom: bar.gap,
            fontFamily: theme.bodyFont,
            fontSize: bar.labelSize,
            // The LAST resort, and not the wrapping model this file measures with.
            // `wordCeiling` bounds the type so the longest word of a run fits the
            // measure, so this only ever fires under `WORD_FIT_FLOOR_PX` — a word no
            // legible size can hold, where breaking is the decided lesser evil. Left
            // out, that word would run out of the box instead. A rendered frame showed
            // the other half of it, back when nothing bounded the size at all:
            // `NEUF S` / `EIZIEME` / `S`.
            wordBreak: 'break-word',
            lineHeight: bar.labelLeading,
            color: palette.body.color,
          }}
        >
          {block.label}
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: bar.valueGap, height: bar.track }}>
        <div
          style={{
            flex: '1 1 auto',
            height: bar.track,
            borderRadius: bar.radius,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* The track is the accent quietened, and the quietening is on the
              TRACK rather than on the pair: an opacity on the parent would take
              the fill down with it, which is a bar the palette measured at full
              strength and the frame draws at a quarter of it. */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: palette.accent.color, opacity: TRACK_QUIET }} />
          <div style={{ position: 'absolute', inset: 0, ...ruler(palette.accent.color), opacity: TICK_QUIET }} />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: `${bar.fill}%`,
              borderRadius: bar.radius,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, backgroundColor: palette.fill.color }} />
            {/* `inset: 0` inside a box that also starts at the track's left edge:
                same origin, same pitch, so the two halves of the ruler are one
                ruler. Offsetting this layer by the fill's own width instead is
                how the ticks come to meet at a seam that walks. */}
            <div style={{ position: 'absolute', inset: 0, ...ruler(palette.onFill.color), opacity: FILL_TICK_QUIET }} />
          </div>
        </div>
        {block.showValue ? (
          <span
            style={{
              fontFamily: theme.bodyFont,
              // The bar's own height, not the label's: the value sits BESIDE the
              // track, so its line is what would decide the row's height, and a
              // row taller than the track is height the block never asked the
              // layout for. `lineHeight: 1` for the same reason - a leading of
              // 1.35 around a numeral is a third of a line of air nobody sees.
              fontSize: bar.valueSize,
              lineHeight: 1,
              // Tabular figures, so a value counting from 0 to 100 does not
              // change the width of the line it is on twice on its way there.
              fontVariantNumeric: 'tabular-nums',
              color: palette.body.color,
            }}
          >
            {bar.value}%
          </span>
        ) : null}
      </div>
    </div>
  )
}
