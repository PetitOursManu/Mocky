/**
 * Can this line of text be read on the pixels that are really behind it?
 *
 * The accessibility audit measures text against a background COLOUR, read from
 * the classes. Over a photograph or a living backdrop there is no such colour:
 * the ground is thousands of pixels, and the audit has nothing to measure. A
 * real Motion Ultra run showed what slips through — a small eyebrow set in pale
 * type on the sunlit wall of a cinematic hero, invisible, with every check green.
 *
 * So this reads the RENDERED frame. The capture shell draws the screen with
 * html2canvas (the thumbnail machinery) with every glyph and icon made
 * transparent — the layout does not move, only the ink goes — and hands this
 * function the pixels that were under one run of text, plus the run's colour.
 * No model call, no network.
 *
 * Two earlier designs were measured and dropped. Sampling the text's own box
 * with the glyphs in it confused glyph edges with ground; sampling a band AROUND
 * it caught the icon next to a figure, in the figure's own colour, and flagged a
 * perfectly readable "+12 %" at 1.08:1. Only the ground with no ink on it answers
 * the question.
 *
 * A UNIFORM ground returns null. A flat colour is the audit's job, measured
 * there from the classes, and reporting it twice — once exactly, once from a
 * raster — would bury the one thing only this can see.
 *
 * SELF-CONTAINED ON PURPOSE: it is injected into the capture frame as source
 * (`legibilityVerdict.toString()`), where nothing from this module exists. No
 * imports, no helpers outside it, no closure over anything.
 */
export function legibilityVerdict(
  pixels: ArrayLike<number>,
  text: [number, number, number],
  large: boolean,
): { ratio: number; need: number } | null {
  function lum(r: number, g: number, b: number): number {
    const c = [r, g, b].map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const need = large ? 3 : 4.5
  const textL = lum(text[0], text[1], text[2])
  const ground: number[] = []
  for (let i = 0; i + 3 < pixels.length; i += 4) ground.push(lum(pixels[i], pixels[i + 1], pixels[i + 2]))
  if (ground.length < 24) return null
  ground.sort((a, b) => a - b)
  const low = ground[Math.floor(ground.length * 0.1)]
  const high = ground[Math.floor(ground.length * 0.9)]
  // Flat ground: the audit's case, not this one. Measured as a contrast ratio,
  // not a luminance difference, because luminance crushes dark tones — a dark
  // photograph read as flat that way.
  if ((high + 0.05) / (low + 0.05) < 1.1) return null
  // The WORST tenth of the ground — the patch of wall behind a pale eyebrow —
  // not the average, which a dark corner elsewhere in the box would flatter.
  const worst = textL >= ground[Math.floor(ground.length / 2)] ? high : low
  const hi = Math.max(textL, worst)
  const lo = Math.min(textL, worst)
  return { ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, need }
}

export interface LegibilityFinding {
  /** The text, clipped — enough for the user to find it on the screen. */
  text: string
  ratio: number
  need: number
}
