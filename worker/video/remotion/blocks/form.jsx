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
 *   box       **the box THIS block was given**, in pixels. Every size drawn here
 *             comes off it - see the rule at the top of `composition.js`, and
 *             `blockExtent`, which is what a block owes the box it is handed.
 *   unit      the type unit its STACK agreed on, so two blocks in one zone are
 *             two steps of one scale rather than two fractions of a frame.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             named in `CONSTANT_METRICS` - here, the rules around the fields.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: a PANEL - `palette.panel` painted, `palette.panelDisplay` and `palette.panelBody` for its text. The submit is the accent fill, so its label is `palette.onFill`.
 *
 * LEGIBILITY: A panel is opaque `theme.surface` and therefore its OWN surface: a run on it measured against the ground would be measured against a colour it never touches. That is why the palette resolves the card separately from the field it sits on - and why `panelEdge` then asks the question the palette does not: whether the card can be told apart from the ground at all.
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
 * -- The card is the box, and the fields run its measure ---------------------
 *
 * `BLOCK_APPETITE` puts a form in the `both` row: a card with a quarter of its
 * box empty has nothing else in that box. So the card takes the box on both
 * axes and every field runs the card's whole measure. What was there before is
 * the defect this pass is about - `min(base * 0.42, 100%)` drew the same 454 px
 * card in a zone of 1688 px and in one of 530, so a form alone on a scene was a
 * small panel in the middle of a large void, with rows a third of its width.
 *
 * `formGeometry` is where the arithmetic lives, for the reason everything else
 * in this directory lives outside its component: a `.jsx` cannot be tested, and
 * "does this card fill the box it was given" is a question a number answers and
 * an mp4 does not.
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

import { constantMetric, controlClock, formCadence, formGeometry, panelEdge, panelInks, restOffset } from './interface.js'

/**
 * How much of its ink a row that has not had its turn keeps.
 *
 * Applied to a row with no glyph in it - see the header. It reads as a field
 * waiting rather than a field disabled, which is the difference between a form
 * being filled in and a form half of which is broken.
 */
const ROW_REST = 0.45

export const Form = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const clock = controlClock(progress, life)
  const { fields, caret, submit } = formCadence(block.fields.length, clock)
  const card = formGeometry(block, box, base, unit)
  const edge = panelEdge(palette.panel, palette.ground, panelInks(palette))
  const radius = constantMetric(theme.radiusPx, box)
  const submitPad = `${card.submitPadY}px ${card.submitPadX}px`

  return (
    <div
      style={{
        // The box, whole, on both axes - `fills: 'both'` in the weight table.
        // `border-box` because the padding and the edge below are drawn INSIDE
        // the allotment `composedLayout` measured against the safe area.
        width: card.width,
        height: card.height,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        // The staircase's leftover is air inside the card rather than a card
        // shorter than its box: a line count is an integer, so the type stops one
        // tread below the height, and the card is what fills the difference.
        justifyContent: 'center',
        gap: card.gap,
        opacity: progress,
        // The card keeps closing the last half-percent of its own arrival for the
        // whole scene and lands on its mark at the cut. It is the family's answer
        // to a control that reaches its position and freezes, and it only ever
        // approaches: see `restOffset`.
        transform: `translateY(${(1 - progress) * card.travel}px) scale(${1 - restOffset(clock)})`,
        padding: card.pad,
        borderRadius: radius,
        backgroundColor: palette.panel.color,
        // A card that cannot be told apart from the ground behind it is a
        // rectangle of text floating on the frame - the export that named this
        // put a white panel on a `#f7f5f0` ground with neither border nor
        // shadow. `panelEdge` measures it, and the house's own answer is a rule
        // rather than a blur.
        ...(edge ? { border: `${card.border}px solid ${edge.color}` } : null),
      }}
    >
      {block.title ? (
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: card.title,
            // The house's own break, and the one `textLines` assumes: the estimate
            // packs characters against the measure, so a run that will only break
            // between words puts more type on a line than the layout reserved room
            // for. An export shipped `photographie` reading `photograph`, clipped by
            // the `overflow: hidden` this block reveals its type from.
            wordBreak: 'break-word',
            lineHeight: 1.14,
            fontWeight: 700,
            color: palette.panelDisplay.color,
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
              // The card's whole measure, which is the half of "inhabit your box"
              // a form fails one level down: a field narrower than the card it
              // sits in is the same small-element-in-a-void, inside the element.
              width: '100%',
              boxSizing: 'border-box',
              // Fixed against its own type size, so a row does not grow as it
              // fills and push the submit down the panel on every frame.
              minHeight: Math.round(card.row * 1.4) + 2 * card.rowPadY,
              padding: `${card.rowPadY}px ${card.rowPadX}px`,
              borderRadius: constantMetric(theme.radiusPx * 0.6, { width: card.measure, height: card.row }),
              border: `${card.border}px solid ${palette.panelAccent.color}`,
              fontFamily: theme.bodyFont,
              fontSize: card.row,
              // The house's own break, and the one `textLines` assumes: the estimate packs
              // characters against the measure, so a run that will only break between words
              // puts more type on a line than the layout reserved room for. An export shipped
              // `photographie` reading `photograph`, clipped by the mask its type rises from.
              wordBreak: 'break-word',
              lineHeight: 1.4,
              color: palette.panelBody.color,
              opacity: typed === 0 && !focused ? ROW_REST : 1,
            }}
          >
            {shown}
            {focused ? (
              <span
                style={{
                  display: 'inline-block',
                  width: card.caret,
                  height: card.row,
                  marginLeft: card.caret * 2,
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
            // The control is as wide as its own label and no wider: it is the one
            // element of the card that is a conclusion rather than a field, and a
            // submit stretched across the measure is a fifth row.
            alignSelf: 'flex-start',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              boxSizing: 'border-box',
              padding: submitPad,
              borderRadius: radius,
              border: `${card.border}px solid ${palette.panelAccent.color}`,
              fontFamily: theme.bodyFont,
              fontSize: card.row,
              // The house's own break, and the one `textLines` assumes: the estimate packs
              // characters against the measure, so a run that will only break between words
              // puts more type on a line than the layout reserved room for. An export shipped
              // `photographie` reading `photograph`, clipped by the mask its type rises from.
              wordBreak: 'break-word',
              lineHeight: 1.4,
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
              padding: submitPad,
              borderRadius: radius,
              border: `${card.border}px solid ${palette.fill.color}`,
              backgroundColor: palette.fill.color,
              fontFamily: theme.bodyFont,
              fontSize: card.row,
              // The house's own break, and the one `textLines` assumes: the estimate packs
              // characters against the measure, so a run that will only break between words
              // puts more type on a line than the layout reserved room for. An export shipped
              // `photographie` reading `photograph`, clipped by the mask its type rises from.
              wordBreak: 'break-word',
              lineHeight: 1.4,
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
