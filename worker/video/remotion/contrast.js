// WCAG relative luminance and contrast, mirrored by hand for the render worker.
//
// ── Why a second implementation exists at all ────────────────────────────────
//
// `src/lib/audit/colors.ts` already computes this, and it is written, reviewed
// and tested for the accessibility audit. It cannot be reached from here: it is
// TypeScript, it imports the audit's `inspect` module, and this directory is
// bundled by Remotion inside a container that has neither. Same wall that makes
// `server/video/timeline.js` a hand-kept copy of `timeline.ts` — and the same
// discipline follows from it: `contrast.test.js` runs a corpus through BOTH and
// requires identical answers, so the mirror cannot drift in silence.
//
// The copy is deliberately the contrast HALF and nothing else. The audit module
// also resolves Tailwind class names, `rgb()`, `hsl()` and a dozen reasons a
// colour cannot be read; none of that exists in a video theme, where every
// colour arrived as a hex value the schema accepted twice. What is shared is the
// arithmetic, and the arithmetic is the part a test can hold in place.
//
// ── Why it accepts hex spellings the theme can never contain ─────────────────
//
// `ThemeColorSchema` emits `#rgb` and `#rrggbb` only, so the four- and
// eight-digit forms below are unreachable from a real document. They are here
// because a mirror is only worth having if it is a mirror: a narrower port turns
// the parity test into a test of the corpus somebody chose rather than of the
// port, and the first person to add `#0f0f0fff` to that corpus would find a
// difference the suite was supposed to have prevented.

/** The hex spellings `parseCssColor` reads, and nothing else. */
const HEX_BODY = /^[0-9a-f]+$/

/**
 * A hex colour as `{ hex, alpha }`, or null.
 *
 * The alpha is returned rather than applied, because a translucent colour has no
 * luminance of its own — it has whatever is behind it — and the caller above
 * turns that into NaN. Exactly the shape `parseCssColor` has on the other side.
 */
function parseHex(input) {
  if (typeof input !== 'string') return null
  const value = input.trim().toLowerCase()
  if (!value.startsWith('#')) return null
  const body = value.slice(1)
  if (!body || !HEX_BODY.test(body)) return null
  const expand = (s) => s + s
  if (body.length === 3 || body.length === 4) {
    const hex = '#' + [0, 1, 2].map((i) => expand(body[i])).join('')
    return { hex, alpha: body.length === 4 ? parseInt(expand(body[3]), 16) / 255 : 1 }
  }
  if (body.length === 6 || body.length === 8) {
    return { hex: '#' + body.slice(0, 6), alpha: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1 }
  }
  return null
}

/** A validated hex colour as three 0–255 channels. Null for anything else. */
export function channels(color) {
  const parsed = parseHex(color)
  if (!parsed) return null
  return [1, 3, 5].map((i) => parseInt(parsed.hex.slice(i, i + 2), 16))
}

/**
 * Relative luminance, WCAG 2.x definition.
 *
 * NaN for anything not fully opaque, because the luminance of a translucent
 * colour is a property of what is behind it and nothing here knows that. The
 * expression is written in the same order as its twin on purpose: two spellings
 * of the same formula agree to about fifteen digits, and the parity test
 * compares numbers, not intentions.
 */
export function relativeLuminance(color) {
  const parsed = parseHex(color)
  if (!parsed || parsed.alpha < 1) return NaN
  const raw = [1, 3, 5].map((i) => parseInt(parsed.hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = raw.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * The WCAG 2.x contrast ratio between two colours, from 1 to 21.
 *
 * **NaN when either colour cannot be read**, and that is the safety mechanism
 * rather than an oversight: every comparison against NaN is false, so a caller
 * that forgets to check cannot produce `ratio >= 4.5` and declare a pair legible
 * that nobody measured. A throw would have been the other option and it would
 * have cost an export over a colour (Q1).
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (!Number.isFinite(la) || !Number.isFinite(lb)) return NaN
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG AA's two floors, the same pair `src/lib/audit/rules.ts` holds screens to.
 *
 * One bar for the whole product: a film cut from a project should not be allowed
 * a contrast the audit would report as a finding on the screen it was cut from.
 *
 * Which of the two applies is decided by the composition's own type ROLE, not by
 * a pixel count, and the split is deliberately stricter than the audit in one
 * direction and identical in the other:
 *
 * - Display type and bold labels — a headline, a caption, the label on a call to
 *   action — take 3. `rules.ts` would say the same of them: its `isLargeText` is
 *   24 px, or 18 px when bold, and these are 37 px and up.
 * - Running text — a subtitle, an argument in a list — takes 4.5, even though
 *   that same rule would call it large. Every glyph in a 1080p frame is past 24
 *   px and the rule read literally would hand the lenient floor to everything,
 *   on a frame watched from a sofa rather than at reading distance.
 *
 * The bold-label case is not a loophole and it is load-bearing: `#6366f1`, the
 * accent a film falls back to, carries white at 4.47:1. Held to 4.5 the default
 * call to action has no legible ink at all — not white, not black, and not any
 * colour in the theme — so the strict reading buys a failed search and paints
 * the same white anyway.
 */
export const CONTRAST_MIN = 4.5
export const CONTRAST_MIN_LARGE = 3

/**
 * `fg` painted at `alpha` over `bg`, as a hex colour.
 *
 * A straight per-channel mix of the gamma-encoded values, because that is what
 * the browser does: CSS alpha compositing happens in the device colour space,
 * not in linear light. Compositing "correctly" in linear space here would answer
 * a shade off from the frame Chromium actually screenshots, which is the one
 * thing a legibility calculation must not do.
 *
 * An unreadable colour on either side answers null, never a guess — the callers
 * all treat that as "cannot measure" and fall back to a value a human chose.
 */
export function blend(fg, bg, alpha) {
  const front = channels(fg)
  const back = channels(bg)
  if (!front || !back) return null
  const a = Math.min(1, Math.max(0, Number(alpha)))
  if (!Number.isFinite(a)) return null
  const mix = front.map((c, i) => Math.round(c * a + back[i] * (1 - a)))
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('')
}
