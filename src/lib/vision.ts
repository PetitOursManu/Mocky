/**
 * The canvas seen through other eyes: the three dichromacies, the total loss of
 * colour, and a blur standing for low acuity. A way of LOOKING at the board,
 * like the zoom and the cables beside it — nothing here touches a screen.
 *
 * Three decisions, each of which was the other way round in a first sketch:
 *
 * 1. **The filter is put on the `<iframe>` ELEMENT, from outside.** Inside the
 *    srcDoc it would have to join `buildSrcDoc`'s inputs, and every change of
 *    mode would rebuild the frame — the screen's state lost, the ready timeout
 *    re-armed (I5) — and the generated code could undo it with a rule of its
 *    own. From outside, neither the sandbox nor the CSP is touched (I2, I3),
 *    and the captures and exports, which render the code again in frames of
 *    their own (`capture.ts`), cannot see it. A simulation that leaked into a
 *    PNG would be a file nobody asked for.
 *
 * 2. **Per browser, never on the Screen.** It says something about the person
 *    looking, not about the design: on the Screen it would be synced to every
 *    device, saved in every version and shown to a client on a review link.
 *
 * 3. **No audit rule.** These matrices nearly keep relative luminance, so a
 *    WCAG contrast check run on simulated colours almost never changes its
 *    verdict; a rule that never fires is a promise the audit does not keep.
 *    What a dichromat loses is the DISTINCTION between hues — the red and the
 *    green of a status — and that is what the view is for: to be looked at.
 */

export type VisionMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia' | 'blur'

export const VISION_MODES: readonly VisionMode[] = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
  'blur',
]

/**
 * Machado, Oliveira & Fernandes (2009), severity 1.0 — the full dichromacy.
 * Row-major 3×3, applied in linear RGB, which is an SVG filter's own default
 * (`color-interpolation-filters="linearRGB"`) and the space the model was
 * written in. Every row sums to 1, so white stays white and grey stays grey:
 * the simulation moves hues, never the light.
 */
export const DICHROMACY: Record<'protanopia' | 'deuteranopia' | 'tritanopia', readonly number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

/**
 * The blur, in the design's own CSS pixels. Measured on the screen and not on
 * the monitor: the filter sits inside the canvas's scaled world, so at 100 %
 * it is what a reader with roughly 6/18 acuity loses on a phone held at arm's
 * length, and at any other zoom it is that same loss, enlarged or reduced with
 * the page — which is what makes two zoom levels comparable.
 */
export const BLUR_PX = 3

/** The id of a dichromacy's `<filter>` in Mocky's own document. */
export function visionFilterId(mode: VisionMode): string {
  return `mocky-vision-${mode}`
}

/** The 4×5 matrix an `<feColorMatrix type="matrix">` takes, alpha untouched. */
export function feColorMatrixValues(m: readonly number[]): string {
  const row = (i: number) => `${m[i * 3]} ${m[i * 3 + 1]} ${m[i * 3 + 2]} 0 0`
  return [row(0), row(1), row(2), '0 0 0 1 0'].join(' ')
}

/** The CSS `filter` value for a mode, or undefined for the plain view. */
export function visionFilterCss(mode: VisionMode): string | undefined {
  switch (mode) {
    case 'protanopia':
    case 'deuteranopia':
    case 'tritanopia':
      return `url(#${visionFilterId(mode)})`
    case 'achromatopsia':
      return 'grayscale(1)'
    case 'blur':
      return `blur(${BLUR_PX}px)`
    default:
      return undefined
  }
}

/** Apply a dichromacy to one linear-RGB colour — for the tests, and the legend. */
export function simulate(mode: keyof typeof DICHROMACY, rgb: readonly [number, number, number]): [number, number, number] {
  const m = DICHROMACY[mode]
  return [0, 1, 2].map((r) => m[r * 3] * rgb[0] + m[r * 3 + 1] * rgb[1] + m[r * 3 + 2] * rgb[2]) as [number, number, number]
}

const KEY = 'mocky.vision'

/**
 * Per browser, off by default. Storage can throw (private mode, blocked site
 * data) — then the plain view holds, which is the only safe default for a
 * filter: a board that loads already grey looks broken to whoever forgot.
 */
export function readVision(): VisionMode {
  try {
    const v = localStorage.getItem(KEY)
    return VISION_MODES.includes(v as VisionMode) ? (v as VisionMode) : 'none'
  } catch {
    return 'none'
  }
}

export function writeVision(mode: VisionMode): void {
  try {
    if (mode === 'none') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    // Not remembered for next time — the view still changes for this session.
  }
}
