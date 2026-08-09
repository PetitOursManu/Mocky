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
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
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

import { axisTick, barGrowths } from './dataFigures.js'

export const BarChart = ({ block, palette, theme, base, progress, life }) => {
  // Percentages and not data: a chart in a film has no axis anybody can read at
  // a glance, so the schema bounds the values to 0-100 and the height is the
  // shape. An outlier would otherwise flatten every other bar to a hairline.
  const height = Math.round(base * 0.3)
  const gap = Math.round(base * 0.012)
  const growths = barGrowths(block.values.length, progress)
  // The top corners only. A bar is rooted on its axis, and a rounded foot is a
  // column floating a pixel above the line it is measured from.
  const radius = Math.max(0, Math.round(theme.radiusPx * 0.3))
  // How far the reading mark hangs below the axis. A guide that stopped exactly
  // on the rule reads as a thirteenth bar; one that crosses it reads as a mark.
  const overhang = Math.round(base * 0.018)

  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap, height }}>
          {block.values.map((value, i) => (
            <div
              key={i}
              style={{
                flex: '1 1 0',
                height: Math.round((height * value * growths[i]) / 100),
                backgroundColor: palette.fill.color,
                borderRadius: `${radius}px ${radius}px 0 0`,
              }}
            />
          ))}
        </div>

        {block.baseline ? (
          <div
            style={{
              height: 1,
              backgroundColor: palette.body.color,
              marginTop: Math.round(base * 0.006),
              // A rule under a figure is the house's own device and it is not a
              // run: nothing sits on it, so an opacity here spends no contrast
              // anybody measured. Full strength would make the axis the loudest
              // thing in the block.
              opacity: 0.45 * progress,
            }}
          />
        ) : null}

        {/*
          The reading mark. Absolute over the bars and the axis both, so it reads
          as an eye crossing the figure rather than as a twelfth column - and
          positioned in percent because a block never learns how wide its box is:
          `composedLayout` owns the boxes and hands a component only `base`.
        */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: -overhang,
            left: `${axisTick(life) * 100}%`,
            transform: 'translateX(-50%)',
            width: Math.max(2, Math.round(base * 0.003)),
            backgroundColor: palette.accent.color,
            opacity: 0.34 * progress,
          }}
        />
      </div>

      {block.labels ? (
        <div style={{ display: 'flex', gap, marginTop: Math.round(base * 0.014) }}>
          {block.values.map((_, i) => (
            <div
              key={i}
              style={{
                flex: '1 1 0',
                textAlign: 'center',
                fontFamily: theme.bodyFont,
                fontSize: Math.round(base * 0.02),
                color: palette.body.color,
                // With its own bar rather than with the block: a caption that
                // arrived before the column it names reads as a label looking for
                // one.
                opacity: growths[i],
              }}
            >
              {/* The two arrays are allowed to differ in length - see the schema -
                  so this draws the pairs it has and never invents a caption. */}
              {block.labels[i] ?? ''}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
