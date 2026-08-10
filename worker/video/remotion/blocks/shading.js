/**
 * The one conversion between the space the palette MEASURED a colour in and the
 * space the renderer SHADES it in.
 *
 * No React, no Remotion, no `three` — same rule as every arithmetic module in
 * this directory. What is here is a transfer curve and one ratio.
 *
 * ── The defect this file is named after ─────────────────────────────────────
 *
 * A rendered `waveMesh` was measured across its whole sheet: **39 levels of
 * luminance out of 255**, on a theme whose material is a near-white. A lit
 * surface with a fortieth of the range is not a surface, it is a wash — and the
 * first place anybody looks is the ambient floor, `SOLID_SHADES[0] = 0.55`,
 * which does look like it is spending three fifths of the range on nothing.
 *
 * It is not. The arithmetic in `composition.js` is right, the geometry is right
 * — `field.test.js` shows the sheet sweeping `n·l` from 0 to 1 — and the sheet
 * still came back flat, because between the number and the frame the colour goes
 * through TWO unit conversions nobody had written down. Both were measured
 * before either was believed, on a material of `#f2f2f2` at the shipped floor:
 *
 *     what the arithmetic measured (`fieldColors` samples it)   133 … 242   109
 *     what a linear-light renderer paints from the same share   186 … 242    56
 *     what it paints once ACES tone mapping has had it          163 … 200    37
 *
 * The last line is what shipped, and it is the 39 the sheet was measured at.
 *
 * ── The first conversion: a share of WHAT ───────────────────────────────────
 *
 * `solidShading` returns `ambient` as a multiplier on the material's BYTES —
 * `scaleColor` multiplies each channel of a hex value, and the colour it makes is
 * the one `fieldColors` hands to `legibleOn`. A renderer does not shade in bytes.
 * `three` decodes a material colour to linear light, multiplies THERE, and
 * encodes the result back on the way out; the sRGB curve is concave, so
 * `encode(decode(c) · a)` is a long way ABOVE `c · a`. Handing 0.55 to a light
 * paints a darkest face of 186 where 133 was measured, cleared and paid for:
 * half the segment the palette had already bought was simply never drawn.
 *
 * `litAmbient` is that conversion. It answers the share a LIGHT needs so that the
 * darkest face lands exactly on the colour the palette measured — no lower, which
 * would be a face outside the segment, and no higher, which is the defect above.
 * It is the same kind of number as `LIGHT_UNIT` and it is a function rather than
 * a constant because it depends on the colour: the ratio runs from 0.26 on a
 * near-white to 0.55 on a near-black, where the curve is straight and the two
 * spaces agree.
 *
 * ── The second conversion: the renderer's own look ──────────────────────────
 *
 * react-three-fiber turns TONE MAPPING on by default — ACES Filmic, a curve whose
 * whole purpose is to be non-linear so that highlights roll off. `extrudedType`
 * has always known this and says so in its header; every other block drawn in GL
 * shipped without it, so nine blocks painted a colour that was neither the ink
 * the palette resolved nor a shade of it. It is not a look question. ACES lowers
 * every value — a near-white material comes off the renderer at 200 rather than
 * 242 — and on a dark ground lower means LESS contrast than what was measured,
 * which is the one direction the guarantee cannot absorb. A dark material on
 * paper is worse the other way: `#1a4d2e`'s green channel renders at 4 out of 77,
 * a black silhouette where the arithmetic asked for a lit object.
 *
 * So every material in this directory declares `toneMapped={false}`, and
 * `blocks.test.js` is what keeps that true of the next one. What is left is
 * exactly `material × (ambient + directional · n·l)` in linear light, encoded to
 * sRGB — which is the expression `solidShading`'s proof is written about.
 *
 * ── What this does NOT do, and why ──────────────────────────────────────────
 *
 * It does not lower the floor. The obvious repair is to notice that the
 * guarantee protects what a TEXT crosses and that a lit surface with nothing
 * standing on it carries no text — so it could be shaded deeper than a field.
 * That is true, and it buys nothing here: the two conversions above give the
 * sheet back 109 levels of the 133…242 the palette had ALREADY measured and
 * cleared, three times what shipped. A decoration should not be made to pay a
 * second time for a bill the renderer was quietly tearing up. The floor stays
 * where `SOLID_SHADES` put it, the segment stays the segment `fieldColors`
 * samples, and every face the frame carries is inside it — which is the first
 * time that sentence has been true.
 */
import { channels } from '../contrast.js'

/**
 * The sRGB transfer, both ways.
 *
 * The decode is `relativeLuminance`'s own, one directory up, and it is written
 * here rather than imported because that function answers a LUMINANCE — one
 * number for three channels — and what a face is painted needs the channels
 * back. `shading.test.js` runs a corpus through both and requires the same
 * answer, which is the arrangement `contrast.js` already has with
 * `src/lib/audit/colors.ts`: a mirror is only worth having if a test holds it.
 *
 * The knee is WCAG's 0.03928 and not the 0.04045 the sRGB standard publishes.
 * They are two roundings of the same crossing — the curves differ by four
 * thousandths of one byte, and only on the two darkest values a byte can hold —
 * and matching the file this repository already measures contrast with is worth
 * more than matching a specification nothing here reads.
 */
function decode(channel) {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function encode(light) {
  const l = Math.min(1, Math.max(0, light))
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(c * 255)))
}

/** The WCAG weights, so a luminance computed here is the one `contrast.js` reports. */
const WEIGHTS = [0.2126, 0.7152, 0.0722]

/** Three channels as one number of light. Private: the public answer is a colour or a share. */
function luminance(rgb) {
  return rgb.reduce((sum, channel, i) => sum + WEIGHTS[i] * decode(channel), 0)
}

/** Three channels back to `#rrggbb`. */
function hex(rgb) {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The darkest face the palette MEASURED — `scaleColor(color, ambient)`, which is
 * the colour `fieldColors` samples and `legibleOn` cleared.
 *
 * Recomputed here rather than imported because the palette publishes the two
 * numbers a light needs and not the colour they make: a block is handed
 * `{ color, ambient }` and the far end of its own segment has never been on the
 * wire. The rounding is deliberately the same one — a byte, per channel — so this
 * is the colour that was measured and not a colour near it.
 */
export function litFloor(color, ambient) {
  const rgb = channels(color)
  const share = Number.isFinite(Number(ambient)) ? Math.max(0, Math.min(1, Number(ambient))) : 1
  if (!rgb) return color
  return hex(rgb.map((c) => c * share))
}

/**
 * The ambient share to hand a LIGHT, so the darkest face is painted the colour
 * the palette measured.
 *
 * Luminance and not a channel, because that is what the guarantee is made of:
 * WCAG contrast is a function of relative luminance alone, so a face whose
 * luminance is the measured floor's has, exactly, the contrast the floor was
 * cleared at. A per-channel ratio would have to pick a channel — the darkest, or
 * every face lands under its own floor — and would then paint the other two
 * brighter than the colour that was measured for no gain a test could state.
 *
 * Lambert scales all three channels by one number, so the painted floor's
 * luminance is `share · L(material)`; asking for `L(measured floor)` is one
 * division. Everything between the two ends is that same scaling at a larger
 * factor, so no face is outside the segment.
 *
 * Answers the share it was given for a colour with no light in it at all — a
 * material of `#000000` is black at every shade, and a division by its luminance
 * is a `NaN` that would reach a light intensity and take the frame with it (Q1).
 */
export function litAmbient(color, ambient) {
  const rgb = channels(color)
  const share = Number.isFinite(Number(ambient)) ? Math.max(0, Math.min(1, Number(ambient))) : 1
  if (!rgb || share >= 1) return share
  const full = luminance(rgb)
  if (!(full > 0)) return share
  const floor = luminance(channels(litFloor(color, share)) ?? rgb)
  return Math.max(0, Math.min(1, floor / full))
}

/**
 * What one face is really painted, as a colour — the whole chain, for a test.
 *
 * `dotNL` is the cosine the renderer computes per fragment: 0 on a face turned
 * away from the light, 1 on one square to it. Nothing calls this at render time;
 * it exists so `shading.test.js` can say what a frame carries in the units the
 * defect was reported in, which are bytes.
 */
export function litFace(color, ambient, dotNL) {
  const rgb = channels(color)
  if (!rgb) return color
  const share = litAmbient(color, ambient)
  const at = Math.max(0, Math.min(1, Number(dotNL) || 0))
  const factor = share + (1 - share) * at
  return hex(rgb.map((c) => encode(decode(c) * factor)))
}

/**
 * The two ends of the painted segment and how many levels of grey lie between
 * them — the measurement this file was written from.
 *
 * The span is a MEAN over the three channels rather than the largest of them: a
 * saturated material has one channel that barely moves, and reporting the widest
 * would say a red object is as modelled as a white one when two thirds of it is
 * flat.
 */
export function litSpan(color, ambient) {
  const dark = channels(litFace(color, ambient, 0))
  const light = channels(litFace(color, ambient, 1))
  if (!dark || !light) return { dark: color, light: color, levels: 0 }
  return {
    dark: hex(dark),
    light: hex(light),
    levels: dark.reduce((sum, c, i) => sum + (light[i] - c), 0) / 3,
  }
}
