/**
 * `barChart` - a column chart, drawn from percentages the document states.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       **this block's own box**, in pixels, out of `composedLayout`. The
 *             plot, the columns, the axis and the labels all come off it.
 *   unit      the type unit this block's STACK solved. The labels are a STEP on
 *             that scale (`caption`), never a fraction of the frame.
 *   base      the frame's SHORT edge. For the constant metrics named in
 *             `CONSTANT_METRICS`: here the axis and the reading mark.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: the bars are the accent FILL, so any number ON a bar takes `palette.onFill`; labels under the baseline are running text on the ground and take `palette.body`. The axis is a hairline in `palette.body` and the reading mark is `palette.accent` - both decorations on the ground, neither carrying a glyph.
 *
 * LEGIBILITY: The trap here is a label printed inside its own bar. That glyph sits on `palette.fill`, not on the ground, and it needs `palette.onFill` - the one measured against the accent. Under the baseline, `palette.body` is the right entry. This block prints nothing on a bar, which is why `onFill` is named above and unused: the day somebody puts the value on the column, that is the run to reach for.
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
 * -- The plot is the box, and a label that does not fit disappears ------------
 *
 * The plot used to be `base * 0.3` and the labels `base * 0.02`, so a chart given
 * the safe area drew three tenths of the frame's short edge in the middle of it
 * and captioned it at a size decided by the frame rather than by the column the
 * caption sits under. Both are the box's now: `barChartLayout` takes what is left
 * of the height after the axis and the labels, and the label size is the
 * `caption` step of the stack's own unit.
 *
 * The label is the case worth reading. Its measure is one COLUMN and not the
 * block, so eight twelve-character labels in a cell are asking for eight 26 px
 * measures - and the rule is that a caption **shortens or disappears, it never
 * overflows**. `labelBand` shrinks it to fit its column, and below `LABEL_FLOOR`
 * of the caption step the whole row goes, all of them together: one label present
 * and seven missing reads as a bug rather than as a decision.
 *
 * -- What moves, and what must not -------------------------------------------
 *
 * The bars grow in a cascade (`barGrowths`) and then STOP. A column's height is
 * the number the document stated, so a bar that keeps breathing after it has
 * arrived is a value that wobbles - the one animation a chart is not allowed to
 * have. The continuous motion is therefore the reading mark: a guide that scrubs
 * across the figure on `axisTick`, plainly an ornament, saying nothing about the
 * data. It is drawn whatever `baseline` says, because a chart with its axis
 * turned off would otherwise hold perfectly still for the rest of its scene.
 */

import { axisTick, barChartLayout, barGrowths, barHeight } from './dataFigures.js'

export const BarChart = ({ block, palette, theme, box, unit, base, progress, life }) => {
  // Percentages and not data: a chart in a film has no axis anybody can read at
  // a glance, so the schema bounds the values to 0-100 and the height is the
  // shape. An outlier would otherwise flatten every other bar to a hairline.
  const layout = barChartLayout(block, box, { base, unit, radiusPx: theme.radiusPx })
  const growths = barGrowths(block.values.length, progress)
  const axisAt = layout.plot + layout.axis.gap

  return (
    <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
      {block.values.map((value, i) => {
        const bar = layout.bars[i]
        if (!bar) return null
        // Rooted on the axis and grown upward, which is why the height is
        // computed once and the top read off it: two expressions of one quantity
        // is how a column ends up a pixel off the rule it is measured from.
        const grown = barHeight(value, growths[i], layout.plot)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: bar.start,
              width: bar.size,
              top: layout.plot - grown,
              height: grown,
              backgroundColor: palette.fill.color,
              // The top corners only. A bar is rooted on its axis, and a rounded
              // foot is a column floating a pixel above the line it is measured
              // from.
              borderRadius: `${layout.radius}px ${layout.radius}px 0 0`,
            }}
          />
        )
      })}

      {layout.axis.thickness > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: axisAt,
            width: layout.width,
            height: layout.axis.thickness,
            backgroundColor: palette.body.color,
            // A rule under a figure is the house's own device and it is not a
            // run: nothing sits on it, so an opacity here spends no contrast
            // anybody measured. Full strength would make the axis the loudest
            // thing in the block.
            opacity: 0.45 * progress,
          }}
        />
      ) : null}

      {/*
        The reading mark. Absolute over the bars and the axis both, so it reads as
        an eye crossing the figure rather than as a twelfth column - and hanging
        past the rule, because a guide that stopped exactly on it reads as one
        more bar.
      */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          height: Math.min(layout.height, axisAt + layout.axis.thickness + layout.mark.overhang),
          left: `${axisTick(life) * 100}%`,
          transform: 'translateX(-50%)',
          width: layout.mark.thickness,
          backgroundColor: palette.accent.color,
          opacity: 0.34 * progress,
        }}
      />

      {layout.label.shown
        ? block.values.map((_, i) => {
            const lane = layout.lanes[i]
            if (!lane) return null
            return (
              <div
                key={`label-${i}`}
                style={{
                  position: 'absolute',
                  left: lane.start,
                  width: lane.size,
                  top: layout.height - layout.label.height,
                  height: layout.label.height,
                  textAlign: 'center',
                  fontFamily: theme.bodyFont,
                  fontSize: layout.label.size,
                  lineHeight: `${layout.label.height}px`,
                  color: palette.body.color,
                  // Sized to fit its own column by `labelBand`; this is the belt,
                  // and it is what makes "it never overflows" true of a face whose
                  // real metrics differ from the estimate.
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  // With its own bar rather than with the block: a caption that
                  // arrived before the column it names reads as a label looking
                  // for one.
                  opacity: growths[i],
                }}
              >
                {/* The two arrays are allowed to differ in length - see the schema
                    - so this draws the pairs it has and never invents a caption. */}
                {block.labels?.[i] ?? ''}
              </div>
            )
          })
        : null}
    </div>
  )
}
