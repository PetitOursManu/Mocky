/**
 * The project's creative mode (`Project.creative`): Normal or Créatif.
 *
 * Two modes and not four, decided with the user: a brief proposed Balanced,
 * Creative, Experimental and a per-stage Custom panel, and the only choice a
 * person actually makes before a screen is "as usual" or "dare more".
 *
 * Créatif acts in two places, and NEVER on a correction pass. Repair, Polish,
 * Audit fix and Fit are told not to restyle; a higher temperature there buys
 * nothing but a rewrite nobody asked for. Off, every request is the one it
 * always was — same prompt, same 0.4 — which is what makes it safe to ship off.
 *
 * Temperature alone is not creativity: it changes which token is drawn, not
 * which layout is chosen. So the section below is the half that asks for a
 * different composition; the temperature only gives the model room to find one.
 * `server/text/dialect.js` already drops `temperature` for the models that
 * refuse it, so a value sent here is never an error.
 */

/** The generation's temperature in Créatif. Normal stays at generate.ts's 0.4. */
export const CREATIVE_TEMPERATURE = 0.75

/**
 * The instruction a Créatif generation receives, AFTER the direction: it asks
 * for bolder composition inside that direction, never for a new one. Reading
 * the direction first is what keeps the identity stable across screens.
 */
export const CREATIVE_SECTION = [
  'CREATIVE MODE — this project asked for bolder design:',
  '- Compose, do not stack: avoid the reflex structure (hero with text left and picture right, then a row of three identical cards, then a CTA band). Use it only when the content truly calls for it.',
  '- Vary the rhythm between sections: asymmetric grids, an oversized headline, a full-bleed picture, an editorial column, overlapping layers — choose what serves THIS subject.',
  '- Expressive typography is welcome (scale contrast, a display face used large), within the typefaces the direction sets.',
  '- Keep the direction: palette, typefaces and tone stay exactly as given. Be bold in layout, not in identity.',
  '- Never at the cost of the basics: readable contrast, real hierarchy, working responsive layout, accessible markup.',
].join('\n')
