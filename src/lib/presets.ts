export type DeviceKind = 'iphone' | 'none'

export interface Preset {
  id: string
  label: string
  /** Short tag for the chip. */
  badge: string
  /** Default frame size (canvas px). */
  w: number
  h: number
  device: DeviceKind
  /** Form-factor guidance prepended to the generation prompt. */
  hint: string
}

const MOBILE_HINT = `FORMAT: Design this as a MOBILE phone screen for a 390×844px iPhone viewport. Use a single-column, mobile-first layout with large touch targets and generous vertical spacing. The root element must fill the screen (use min-h-screen and a full background that extends to all edges). IMPORTANT SAFE AREA: the device frame draws the status bar, notch and home indicator itself, so do NOT draw your own status bar (no time/battery/signal). Keep the TOP ~54px clear (add pt-14 to your first section so nothing sits under the notch) AND keep the BOTTOM ~24px clear (add pb-6 / bottom safe padding so a bottom tab bar or button sits above the home indicator). Prefer a bottom tab bar or a bottom primary button for navigation when it fits. Do NOT produce a wide desktop layout.`

const DESKTOP_HINT = `FORMAT: Design this as a DESKTOP web screen for a ~1440px-wide viewport. Use a full-width responsive layout with a top navigation bar and a centered max-width content container.`

const TABLET_HINT = `FORMAT: Design this as a TABLET screen (~820px wide, portrait). Use a comfortable one- or two-column layout sitting between mobile and desktop, with a top bar.`

export const PRESETS: Preset[] = [
  { id: 'mobile', label: 'Mobile (iPhone)', badge: '📱 Mobile', w: 390, h: 844, device: 'iphone', hint: MOBILE_HINT },
  { id: 'desktop', label: 'Desktop', badge: '🖥 Desktop', w: 1440, h: 900, device: 'none', hint: DESKTOP_HINT },
  { id: 'tablet', label: 'Tablet', badge: '▭ Tablet', w: 820, h: 1180, device: 'none', hint: TABLET_HINT },
]

export const DEFAULT_PRESET_ID = 'mobile'

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

/** Guidance to keep an edited screen in its existing form factor. */
export function hintForDevice(device: DeviceKind): string {
  return device === 'iphone' ? MOBILE_HINT : ''
}
