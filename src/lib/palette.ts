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
