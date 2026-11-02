/**
 * The colours actually present in a picture.
 *
 * WHY MEASURE INSTEAD OF ASKING THE MODEL
 *
 * When Muse is handed the user's own image, the tempting move is to show it to
 * a vision model and let it describe the palette. That fails in two ordinary
 * situations at once: half the models people run here have no vision at all,
 * and the ones that do return colour *names* — "warm terracotta", "muted sage"
 * — which then have to be guessed back into hex, badly.
 *
 * Sampling the pixels costs nothing, works on every model, and is exact. The
 * vision pass still happens when the model supports it, but it is asked about
 * composition and mood — the things a histogram cannot see — while the palette
 * comes from here.
 *
 * The pure function is separated from the canvas so it can be tested against
 * known pixels rather than against a browser.
 */

export interface Swatch {
  hex: string
  /** Share of the sampled pixels, 0..1. */
  weight: number
}

export interface MediaPalette {
  swatches: Swatch[]
  /**
   * The swatch a design system should use as its accent: the most saturated one
   * that is not a rounding error. A palette needs something to point with, and
   * the dominant colour of a photograph is usually its background.
   */
  accent: string | null
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

/** Saturation in HSL terms, 0..1 — how far the colour is from grey. */
export function saturationOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2 / 255
  const d = (max - min) / 255
  return l > 0.5 ? d / (2 - max / 255 - min / 255) : d / (max / 255 + min / 255)
}

const dist = (a: number[], b: number[]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

/**
 * Reduce raw RGBA pixels to a small palette.
 *
 * Two passes, and both are needed. The histogram alone returns six shades of
 * the same sky, because a 4-bit-per-channel bucket is narrower than the eye:
 * merging anything closer than `minDistance` afterwards is what turns them into
 * one swatch with the weight of six.
 *
 * @param data RGBA quadruplets, as ImageData.data gives them
 */
export function paletteFromPixels(
  data: Uint8ClampedArray | number[],
  { max = 6, minDistance = 48 }: { max?: number; minDistance?: number } = {},
): MediaPalette {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  let counted = 0

  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue // transparent pixels are not part of the picture
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const cur = buckets.get(key)
    if (cur) {
      cur.n++
      cur.r += r
      cur.g += g
      cur.b += b
    } else {
      buckets.set(key, { n: 1, r, g, b })
    }
    counted++
  }
  if (!counted) return { swatches: [], accent: null }

  // Average colour of each bucket, heaviest first.
  const raw = [...buckets.values()]
    .map((v) => ({ n: v.n, rgb: [Math.round(v.r / v.n), Math.round(v.g / v.n), Math.round(v.b / v.n)] }))
    .sort((x, y) => y.n - x.n)

  const merged: { n: number; rgb: number[] }[] = []
  for (const c of raw) {
    const near = merged.find((m) => dist(m.rgb, c.rgb) < minDistance)
    if (near) {
      // Weighted mean, so the merged swatch sits where the mass is.
      const total = near.n + c.n
      near.rgb = near.rgb.map((v, k) => Math.round((v * near.n + c.rgb[k] * c.n) / total))
      near.n = total
    } else {
      merged.push({ n: c.n, rgb: [...c.rgb] })
    }
  }
  merged.sort((x, y) => y.n - x.n)

  const swatches = merged.slice(0, max).map((m) => ({
    hex: toHex(m.rgb[0], m.rgb[1], m.rgb[2]),
    weight: Math.round((m.n / counted) * 1000) / 1000,
  }))

  // The accent: most saturated among swatches that actually appear. The 2%
  // floor keeps a stray JPEG artefact from being promoted to brand colour.
  let accent: string | null = null
  let best = 0
  for (const m of merged.slice(0, max)) {
    const share = m.n / counted
    if (share < 0.02) continue
    const s = saturationOf(m.rgb[0], m.rgb[1], m.rgb[2])
    if (s > best) {
      best = s
      accent = toHex(m.rgb[0], m.rgb[1], m.rgb[2])
    }
  }
  // A picture with no colour in it at all: the heaviest swatch is the honest
  // answer, and a monochrome brief is a legitimate one.
  if (!accent && swatches.length) accent = swatches[0].hex

  return { swatches, accent }
}

/**
 * Measure the palette of an image URL, in the browser.
 *
 * Downsampled to 64×64 first: a hero photograph is two million pixels and the
 * answer does not change, while the cost does.
 */
export function extractPalette(url: string, opts?: { max?: number }): Promise<MediaPalette> {
  return new Promise((resolve) => {
    const img = new Image()
    // Same-origin in practice (every URL here is served by Mocky), but a
    // tainted canvas throws on getImageData and would take the run down.
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve({ swatches: [], accent: null })
        ctx.drawImage(img, 0, 0, size, size)
        resolve(paletteFromPixels(ctx.getImageData(0, 0, size, size).data, opts))
      } catch {
        // Tainted canvas, zero-sized image… never fatal: Muse simply runs
        // without a measured palette, exactly as it did before.
        resolve({ swatches: [], accent: null })
      }
    }
    img.onerror = () => resolve({ swatches: [], accent: null })
    img.src = url
  })
}

/** A reference picture's palette: the swatches, plus what a design reads off them. */
export interface ReferencePalette extends MediaPalette {
  /**
   * The darkest colour that is really drawn — the ink of the headline. Thin
   * type is a fraction of a percent of the pixels, so a palette sorted by weight
   * dropped it, and the card's terracotta lettering never reached the dossier.
   */
  ink: string | null
  /**
   * The plain colour round the picture, left out of the swatches: a product
   * shot's backdrop is the photographer's, not the design's.
   */
  backdrop: string | null
}

/** Relative luminance, 0..1, for "which colour is darkest" — not for contrast. */
function lightness(rgb: number[]): number {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

/** The darkest share of a reference's pixels that is read as the core of its lettering. */
const INK_SHARE = 0.002

/** Within this distance of the border's mean colour, a pixel touching the backdrop IS the backdrop. */
const BACKDROP_TOLERANCE = 16

/**
 * The palette of a picture someone wants a design to be INSPIRED by — a flyer,
 * a card, a poster, often photographed as a mock-up on a plain backdrop.
 *
 * `paletteFromPixels` was written for a hero photograph, and on a reference it
 * failed three ways at once, measured on the thank-you card that prompted this:
 * the light grey backdrop of the mock-up weighed 92% of the swatches; merging
 * anything closer than 48 folded cream, beige, blush and white into that grey;
 * and the terracotta lettering — the one strong colour on the card — was too
 * thin to survive a sort by weight. The dossier was told to build its colours
 * FROM a grey and two pale pinks, and it did.
 *
 * So: the backdrop is flood-filled from the border and left out (only when it is
 * plain, near-neutral, and a part of the picture rather than all of it — a
 * full-bleed design keeps its own background), the merge is finer, and the ink
 * is kept whatever its weight.
 */
export function referencePaletteFromPixels(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  { max = 8, minDistance = 24 }: { max?: number; minDistance?: number } = {},
): ReferencePalette {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
  const opaque = (i: number) => data[i * 4 + 3] >= 128

  // The border's mean colour, and whether the border is plain at all.
  const border: number[] = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1)
  const edge = border.filter(opaque)
  let backdrop: number[] | null = null
  if (edge.length) {
    const mean = [0, 1, 2].map((k) => Math.round(edge.reduce((s, i) => s + px(i)[k], 0) / edge.length))
    const plain = edge.filter((i) => dist(px(i), mean) < BACKDROP_TOLERANCE).length / edge.length
    // Chroma, not HSL saturation: HSL inflates every near-white, and the grey
    // backdrop of the card that prompted this read as 17% saturated.
    const chroma = (Math.max(...mean) - Math.min(...mean)) / 255
    if (plain >= 0.85 && chroma < 0.08) backdrop = mean
  }

  // Flood the backdrop from the border, so the same colour INSIDE the design
  // (a white card on a white table) is kept.
  const drop = new Uint8Array(w * h)
  if (backdrop) {
    const stack = edge.filter((i) => dist(px(i), backdrop!) < BACKDROP_TOLERANCE)
    for (const i of stack) drop[i] = 1
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w
      const y = (i - x) / w
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || drop[j] || !opaque(j) || dist(px(j), backdrop) >= BACKDROP_TOLERANCE) continue
        drop[j] = 1
        stack.push(j)
      }
    }
    const share = drop.reduce((s, v) => s + v, 0) / (w * h)
    // All of it is a full-bleed design's own ground; a sliver is a frame line.
    if (share < 0.12 || share > 0.85) {
      backdrop = null
      drop.fill(0)
    }
  }

  const kept: number[] = []
  for (let i = 0; i < w * h; i++) {
    if (drop[i]) continue
    kept.push(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3])
  }
  const base = paletteFromPixels(kept, { max: 64, minDistance })
  const all = base.swatches
  // The accent with a 1% floor, not 2%: on a quiet design the strong colour is
  // small, and it is the one worth pointing with. By CHROMA, for the backdrop's
  // reason: by HSL saturation the card's white (#fffefe) out-pointed its orange.
  let accent: string | null = null
  let best = 0
  for (const s of all) {
    if (s.weight < 0.01) continue
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(s.hex.slice(k, k + 2), 16))
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
    if (sat > best) {
      best = sat
      accent = s.hex
    }
  }
  // The ink: the mean of the darkest pixels, not the darkest SWATCH — lettering
  // is anti-aliased into lighter shades, and its swatch weighs less than the
  // rounding of a weight. The darkest INK_SHARE of the picture is the core of
  // its strokes; it is ink only when clearly darker than the ground.
  const rgbOf = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))
  const ground = all[0]
  let ink: string | null = null
  const count = kept.length / 4
  if (ground && count) {
    const order: number[] = []
    for (let i = 0; i < count; i++) if (kept[i * 4 + 3] >= 128) order.push(i)
    const lum = (i: number) => lightness([kept[i * 4], kept[i * 4 + 1], kept[i * 4 + 2]])
    order.sort((a, b) => lum(a) - lum(b))
    const core = order.slice(0, Math.max(3, Math.round(order.length * INK_SHARE)))
    const mean = [0, 1, 2].map((k) => Math.round(core.reduce((sum, i) => sum + kept[i * 4 + k], 0) / core.length))
    if (lightness(rgbOf(ground.hex)) - lightness(mean) > 0.25) ink = toHex(mean[0], mean[1], mean[2])
  }
  const swatches = all.slice(0, max)
  if (ink && !swatches.some((s) => dist(rgbOf(s.hex), rgbOf(ink!)) < minDistance)) {
    swatches[Math.min(swatches.length, max - 1)] = { hex: ink, weight: 0.001 }
  }
  return {
    swatches,
    accent: accent ?? base.accent,
    ink,
    backdrop: backdrop ? toHex(backdrop[0], backdrop[1], backdrop[2]) : null,
  }
}

/** The side a reference is sampled at: sixteen times `extractPalette`'s pixels, for type a few pixels thick. */
const REFERENCE_SAMPLE = 256

/** Measure a reference picture in the browser (`referencePaletteFromPixels`). */
export function extractReferencePalette(url: string): Promise<ReferencePalette> {
  const none: ReferencePalette = { swatches: [], accent: null, ink: null, backdrop: null }
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const scale = Math.min(1, REFERENCE_SAMPLE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(none)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(referencePaletteFromPixels(ctx.getImageData(0, 0, w, h).data, w, h))
      } catch {
        resolve(none)
      }
    }
    img.onerror = () => resolve(none)
    img.src = url
  })
}
