import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from '../ui'

/**
 * A palette to pick a colour from, beside the hex field — the person asked for
 * "a palette like Canva's": a hex is the exact answer, but only once you know
 * it, and a native colour input is a different dialog on every system.
 *
 * Three groups, in the order a person reaches for them: the design's own
 * colours (re-using one is the commonest change), a grid of hues by shade, and
 * a custom colour through the system's picker. The grid is computed, not a
 * list of hexes copied from somewhere: twelve hues round the wheel, five
 * lightnesses each, and a row of greys from black to white.
 *
 * And a pipette, for a colour already ON the screen (a screen's own blue, a
 * photograph's tone): the browser's EyeDropper samples the pixel under the
 * pointer anywhere in the window, the sandboxed previews included — which no
 * script of Mocky's could read, the frames' origin being opaque. Chromium has
 * it; elsewhere the button is simply absent.
 */

/** The EyeDropper API (Chromium 95+), not yet in TypeScript's DOM library. */
interface EyeDropperApi {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>
}
function eyeDropper(): (new () => EyeDropperApi) | null {
  const ctor = typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper : undefined
  return ctor ?? null
}

/** `rgb(r, g, b)` — what some builds answer instead of a hex — or a hex, as a hex. */
export function sampledHex(value: string): string {
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value.trim())
  if (rgb) return '#' + rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')
  return norm(value)
}

const HUES = [0, 22, 40, 52, 95, 140, 172, 192, 212, 235, 268, 318] as const
const SHADES: readonly (readonly [number, number])[] = [
  // [saturation, lightness] — light tints first, as a palette is read downwards.
  [85, 86],
  [80, 72],
  [78, 56],
  [80, 42],
  [75, 28],
]

function hslHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const GREYS = Array.from({ length: HUES.length }, (_, i) => hslHex(0, 0, Math.round((i / (HUES.length - 1)) * 100)))

/** The default grid: a row of greys, then each shade across the twelve hues. */
export const DEFAULT_PALETTE: readonly (readonly string[])[] = [
  GREYS,
  ...SHADES.map(([s, l]) => HUES.map((h) => hslHex(h, s, l))),
]

function norm(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return ''
  const v = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return `#${v.toLowerCase()}`
}

/** Whether a check mark on this swatch should be dark (the swatch is light). */
function lightSwatch(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

function Swatch({ hex, selected, onPick, onApply }: { hex: string; selected: boolean; onPick: (hex: string) => void; onApply?: (hex: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(hex)}
      onDoubleClick={onApply ? () => onApply(hex) : undefined}
      aria-label={hex.toUpperCase()}
      aria-pressed={selected}
      title={hex.toUpperCase()}
      className={`relative aspect-square w-full rounded-[4px] border border-ink/15 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? 'ring-2 ring-accent ring-offset-1 ring-offset-raised' : ''
      }`}
      style={{ background: hex }}
    >
      {selected && (
        <span
          aria-hidden
          className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${lightSwatch(hex) ? 'text-black' : 'text-white'}`}
        >
          ✓
        </span>
      )}
    </button>
  )
}

export default function ColorPalette({
  value,
  onPick,
  onApply,
  designColors = [],
}: {
  value: string
  /** A swatch was chosen: the draft follows it. */
  onPick: (hex: string) => void
  /** A swatch was double-clicked: chosen and applied at once. */
  onApply?: (hex: string) => void
  /** The design's own colours, offered first. */
  designColors?: readonly string[]
}) {
  const t = useT()
  const current = norm(value)
  const own = [...new Set(designColors.map(norm).filter(Boolean))]
  const native = /^#[0-9a-f]{6}$/.test(current) ? current : '#000000'
  const Dropper = eyeDropper()
  const [sampling, setSampling] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {own.length > 0 && (
        <div>
          <p className="mb-1 text-caption text-ink-faint">{t('design.spec.paletteDesign')}</p>
          <div className="grid grid-cols-8 gap-1">
            {own.map((hex) => (
              <Swatch key={hex} hex={hex} selected={hex === current} onPick={onPick} onApply={onApply} />
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1 text-caption text-ink-faint">{t('design.spec.paletteDefault')}</p>
        <div className="grid grid-cols-12 gap-1">
          {DEFAULT_PALETTE.flat().map((hex, i) => (
            <Swatch key={`${i}-${hex}`} hex={hex} selected={hex === current} onPick={onPick} onApply={onApply} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* The system's own picker, behind a rainbow tile: its value is the hex
          field's, so the ways of choosing never disagree. */}
      <label className="flex cursor-pointer items-center gap-2 text-caption text-ink-muted hover:text-ink">
        <span
          aria-hidden
          className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-[4px] border border-ink/15"
          style={{ background: 'conic-gradient(#f43f5e, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f43f5e)' }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-body-sm font-bold text-white [text-shadow:0_0_3px_rgba(0,0,0,0.6)]">+</span>
        </span>
        <input
          type="color"
          value={native}
          onChange={(e) => onPick(e.target.value)}
          className="sr-only"
        />
        {t('design.spec.paletteCustom')}
      </label>
      {Dropper && (
        <button
          type="button"
          className="flex items-center gap-2 text-caption text-ink-muted hover:text-ink disabled:opacity-50"
          disabled={sampling}
          title={t('design.spec.eyedropperTitle')}
          onClick={async () => {
            setSampling(true)
            try {
              const hex = sampledHex((await new Dropper().open()).sRGBHex)
              if (hex) onPick(hex)
            } catch {
              // Escape, or a click the browser refused: nothing was picked.
            } finally {
              setSampling(false)
            }
          }}
        >
          <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-ink/15">
            <Icon name="eyedropper" size={14} />
          </span>
          {t('design.spec.eyedropper')}
        </button>
      )}
      </div>
    </div>
  )
}
