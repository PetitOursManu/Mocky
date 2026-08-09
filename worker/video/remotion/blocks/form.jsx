/**
 * `form` - a short form: a title, up to four fields, and a submit.
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
 * SURFACE: a PANEL - `palette.panel` painted, `palette.panelDisplay` and `palette.panelBody` for its text. The submit is the accent fill, so its label is `palette.onFill`.
 *
 * LEGIBILITY: A panel is opaque `theme.surface` and therefore its OWN surface: a run on it measured against the ground would be measured against a colour it never touches. That is why the palette resolves the card separately from the field it sits on.
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
 * -- It is a mockup of a form, and that decides three things ------------------
 *
 * A form nobody fills in is a list of empty boxes: the row is the one element in
 * this catalogue whose whole meaning is that something happens IN it. So the
 * fields fill one after another, a caret sits in the one being typed, and the
 * submit lights up when the last of them is full - `formCadence` owns that
 * sequence, and it is arithmetic rather than taste precisely because "the button
 * activates at the END" is a claim a test can hold to the letter.
 *
 * **The line the schema gives a field is what gets typed into it.** There is one
 * string per field and no second one, and a label typed into its own box is the
 * only reading under which anything happens at all - the alternative is a label
 * that appears instantly beside a box that stays empty for the whole scene,
 * which is a picture of a form.
 *
 * **A row that has not had its turn is DIMMED, and it is empty while it is.**
 * That ordering is the legibility rule and not a detail: `formCadence` leaves a
 * row at zero characters until the caret reaches it, so the reduced opacity only
 * ever lands on a rounded rectangle. The moment a glyph exists in that row the
 * row is at full strength, on the ink `composedPalette` measured against the
 * panel.
 *
 * **The caret is solid.** `caretOn` in `animatedText.js` argues it for the whole
 * directory - a blink competing with characters arriving reads as a stutter - and
 * a form's caret is only ever in the state that rule covers, since `formCadence`
 * takes it away the frame the last field fills.
 *
 * **The submit is two whole controls, swept.** An inert outline on the panel and
 * the accent fill over it, both carrying the same label in the same box, the
 * second revealed from its leading edge. Cross-fading the two would put every
 * glyph of that label on a blend of two surfaces for a third of a second, and a
 * blend is the one thing `legibleOn` cannot be asked about.
 */

import { controlClock, formCadence, restOffset } from './interface.js'

/**
 * How much of its ink a row that has not had its turn keeps.
 *
 * Applied to a row with no glyph in it - see the header. It reads as a field
 * waiting rather than a field disabled, which is the difference between a form
 * being filled in and a form half of which is broken.
 */
const ROW_REST = 0.45

export const Form = ({ block, palette, theme, base, progress, life }) => {
  const clock = controlClock(progress, life)
  const { fields, caret, submit } = formCadence(block.fields.length, clock)
  const rowFont = Math.round(base * 0.026)
  const pad = `${Math.round(base * 0.014)}px ${Math.round(base * 0.028)}px`

  return (
    <div
      style={{
        opacity: progress,
        // The card keeps closing the last half-percent of its own arrival for the
        // whole scene and lands on its mark at the cut. It is the family's answer
        // to a control that reaches its position and freezes, and it only ever
        // approaches: see `restOffset`.
        transform: `translateY(${(1 - progress) * base * 0.02}px) scale(${1 - restOffset(clock)})`,
        padding: Math.round(base * 0.028),
        borderRadius: theme.radiusPx,
        backgroundColor: palette.panel.color,
        // A measure a form needs to be readable, or the zone it was given if that
        // is narrower - a plain `minWidth` wins against `maxWidth` in CSS, so the
        // pair on its own is a panel that hangs over the safe margin in a
        // three-column portrait cell rather than a panel that fits.
        minWidth: `min(${Math.round(base * 0.42)}px, 100%)`,
        maxWidth: '100%',
      }}
    >
      {block.title ? (
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: Math.round(base * 0.034),
            fontWeight: 700,
            color: palette.panelDisplay.color,
            marginBottom: Math.round(base * 0.02),
          }}
        >
          {block.title}
        </div>
      ) : null}

      {block.fields.map((field, i) => {
        const typed = fields[i] ?? 0
        const shown = field.slice(0, Math.round(typed * field.length))
        const focused = caret === i
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              // Fixed against its own type size, so a row does not grow as it
              // fills and push the submit down the panel on every frame.
              minHeight: Math.round(rowFont * 1.5),
              marginBottom: Math.round(base * 0.014),
              padding: `${Math.round(base * 0.014)}px ${Math.round(base * 0.016)}px`,
              borderRadius: Math.max(2, Math.round(theme.radiusPx * 0.6)),
              border: `1px solid ${palette.panelAccent.color}`,
              fontFamily: theme.bodyFont,
              fontSize: rowFont,
              lineHeight: 1,
              color: palette.panelBody.color,
              opacity: typed === 0 && !focused ? ROW_REST : 1,
            }}
          >
            {shown}
            {focused ? (
              <span
                style={{
                  display: 'inline-block',
                  width: Math.max(2, Math.round(base * 0.003)),
                  height: rowFont,
                  marginLeft: Math.round(base * 0.004),
                  backgroundColor: palette.panelBody.color,
                }}
              />
            ) : null}
          </div>
        )
      })}

      {block.submit ? (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            marginTop: Math.round(base * 0.02),
          }}
        >
          <span
            style={{
              display: 'inline-block',
              boxSizing: 'border-box',
              padding: pad,
              borderRadius: theme.radiusPx,
              border: `2px solid ${palette.panelAccent.color}`,
              fontFamily: theme.bodyFont,
              fontSize: rowFont,
              fontWeight: 700,
              color: palette.panelBody.color,
              whiteSpace: 'nowrap',
            }}
          >
            {block.submit}
          </span>
          {/* The same control in the accent, revealed from its leading edge. Same
              box to the pixel - same padding, same border weight, the border in
              the fill's own colour - so the two labels sit on exactly the same
              glyph positions and the sweep crosses letters rather than moving
              them. */}
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              boxSizing: 'border-box',
              width: '100%',
              height: '100%',
              padding: pad,
              borderRadius: theme.radiusPx,
              border: `2px solid ${palette.fill.color}`,
              backgroundColor: palette.fill.color,
              fontFamily: theme.bodyFont,
              fontSize: rowFont,
              fontWeight: 700,
              color: palette.onFill.color,
              whiteSpace: 'nowrap',
              clipPath: `inset(0 ${(1 - submit) * 100}% 0 0)`,
            }}
          >
            {block.submit}
          </span>
        </span>
      ) : null}
    </div>
  )
}
