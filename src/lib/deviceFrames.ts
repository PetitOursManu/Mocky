import type { DeviceKind } from './presets'

/**
 * The wireframe devices the demo player draws around a screen.
 *
 * Everything here is arithmetic, and everything is in BODY pixels — the
 * screen's own coordinate space, before the player scales it to fit. The
 * component multiplies by one scale and draws; it decides nothing. That split
 * exists because the two ways this goes wrong are both numbers: a screen that
 * does not sit exactly in the opening (so a hotspot lands beside the element
 * it was drawn on), and a Dynamic Island that covers the top of a mobile screen
 * the generation prompt was told to keep clear. Neither can be seen in a test
 * of a drawing; both can be asserted here.
 *
 * Coordinates are relative to the DEVICE's bounding box: (0, 0) is its top-left
 * corner, and the screen opening is `body` inside it.
 */

export type FrameKind = 'phone' | 'tablet' | 'computer'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
  /** Corner radius. */
  r: number
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Point {
  x: number
  y: number
}

interface Common {
  bodyW: number
  bodyH: number
  /** Device bounding box. */
  width: number
  height: number
  /** From each edge of the screen to the edge of the device's bounding box. */
  insets: Insets
  /** The screen opening; the preview is laid exactly over it. */
  body: Rect
}

export interface PhoneFrame extends Common {
  kind: 'phone'
  shell: Rect
  /** A second contour inside the shell — the rail — so the body reads as an object with a thickness. */
  rail: Rect
  buttons: Rect[]
  island: Rect
  /** The home indicator: a line segment, with its thickness. */
  home: { x1: number; x2: number; y: number; thickness: number }
  /** Where the status bar's glyphs sit: vertical centre, and the two inner x limits. */
  status: { y: number; left: number; right: number; size: number }
  /**
   * A camera dot in the top bezel: what a phone chosen by WIDTH shows instead
   * of the island, because that screen was never told to keep its top band
   * clear (MOBILE_HINT only reaches `device: 'iphone'`).
   */
  camera: { cx: number; cy: number; r: number }
}

export interface TabletFrame extends Common {
  kind: 'tablet'
  shell: Rect
  rail: Rect
  buttons: Rect[]
  camera: { cx: number; cy: number; r: number }
}

export interface ComputerFrame extends Common {
  kind: 'computer'
  lid: Rect
  camera: { cx: number; cy: number; r: number }
  hinge: Rect
  /** The keyboard deck seen from slightly above: far edge, then near edge. */
  deck: Point[]
  keyboard: Point[]
  trackpad: Point[]
  /** The front lip, with the thumb notch as a separate shape. */
  lip: Rect
  notch: { cx: number; y: number; w: number; depth: number }
}

export type DeviceFrame = PhoneFrame | TabletFrame | ComputerFrame

/*
 * Choosing the device.
 *
 * A screen made from the mobile preset carries `device: 'iphone'`, and that is
 * the only statement anybody made — so it wins. Everything else is a frame the
 * user may have resized to any size, and the frame is read off the width the
 * screen was designed at, which is what decides its layout anyway.
 *
 * - Under PHONE_MAX_W (600) it is a phone. 600 is the compact/medium boundary
 *   Android's window-size classes use, and it sits comfortably above the widest
 *   phone viewport (430) and under the narrowest tablet in portrait (744).
 * - Under TABLET_MAX_W (1100) it is a tablet: that covers every iPad in
 *   portrait (744–1032) and Tailwind's `lg` breakpoint (1024) with some room,
 *   and stops before the laptop widths (1280 and up).
 * - Wider, it is a computer — UNLESS it is a landscape tablet. An iPad on its
 *   side is 1133–1366 wide, which the width alone would call a laptop; what
 *   tells them apart is the shape. Tablets are 4:3 to 1.44:1, laptops 16:10
 *   (1.6) or 16:9 (1.78), and TABLET_LANDSCAPE_MAX_RATIO (1.5) falls between.
 *   The width bound keeps a 1920×1440 (4:3 desktop) a computer.
 */
export const PHONE_MAX_W = 600
export const TABLET_MAX_W = 1100
export const TABLET_LANDSCAPE_MAX_W = 1366
export const TABLET_LANDSCAPE_MAX_RATIO = 1.5

export function frameKindFor(device: DeviceKind | undefined, bodyW: number, bodyH: number): FrameKind {
  if (device === 'iphone') return 'phone'
  if (bodyW < PHONE_MAX_W) return 'phone'
  if (bodyW < TABLET_MAX_W) return 'tablet'
  const landscape = bodyW > bodyH
  if (landscape && bodyW <= TABLET_LANDSCAPE_MAX_W && bodyW / bodyH < TABLET_LANDSCAPE_MAX_RATIO) return 'tablet'
  return 'computer'
}

/*
 * The proportions.
 *
 * Phone and tablet are measured on the SHORT side of the screen (`m`), because
 * a bezel is the same width all the way round and a phone resized taller does
 * not grow a thicker bezel. At the 390 × 844 preset the phone's numbers come
 * out at the real device's own points: a 55 pt display corner, a 126 × 37
 * island 11 pt from the top, a 134 pt home indicator 8 pt from the bottom. That
 * is not decoration — the mobile preset tells the model to keep the top 54 px
 * and the bottom 24 px clear (MOBILE_HINT), and an island that grew past 54
 * would sit on the first line of every generated screen.
 *
 * The laptop's deck is measured on the WIDTH of the lid, because it is the
 * keyboard of a machine that wide; its bezel on `m`, like the others.
 */
const PHONE = {
  bezel: 0.045,
  screenRadius: 0.141,
  buttonReach: 0.012,
  rail: 0.35, // of the bezel
  island: { w: 0.323, h: 0.095, top: 0.028 },
  home: { w: 0.345, bottom: 0.021, thickness: 0.013 },
  // Left: action button, volume up, volume down. Right: side button. [top, height] in m from the shell's top.
  left: [
    [0.4, 0.08],
    [0.62, 0.16],
    [0.87, 0.16],
  ],
  right: [[0.66, 0.25]],
  statusSize: 0.036,
  camera: 0.22, // radius, of the bezel
}

/*
 * The island, the home indicator and the status bar are sized on the preset's
 * short side AT MOST, not on the screen's. They are fixed-size objects on the
 * real device, and MOBILE_HINT promises the model a fixed 54 px top and 24 px
 * bottom: sized on the screen, an iPhone frame resized to 600 wide grew its
 * island to a bottom edge at 74 px — on the first line of a screen that had
 * kept exactly 54 clear. The bezel and the corners still follow the screen;
 * they are the device's, not the page's.
 */
export const PHONE_SYSTEM_UI_MAX_M = 390

const TABLET = {
  bezel: 0.04,
  screenRadius: 0.022,
  buttonReach: 0.008,
  rail: 0.3,
  camera: 0.006,
}

const COMPUTER = {
  side: 0.028,
  top: 0.045,
  chin: 0.05,
  lidRadius: 0.025,
  camera: 0.004,
  // In units of the lid's width.
  hinge: 0.008,
  hingeWidth: 0.94,
  deckTop: 0.98,
  deckBottom: 1.14,
  deckDepth: 0.06,
  lip: 0.01,
  notch: 0.12,
}

function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d, r: Math.max(0, r.r - d) }
}

function phone(bodyW: number, bodyH: number): PhoneFrame {
  const m = Math.min(bodyW, bodyH)
  const bezel = PHONE.bezel * m
  const reach = PHONE.buttonReach * m
  const screenRadius = Math.min(PHONE.screenRadius * m, m / 2)
  const insets = { top: bezel, right: bezel + reach, bottom: bezel, left: bezel + reach }
  const width = bodyW + insets.left + insets.right
  const height = bodyH + insets.top + insets.bottom
  const body = { x: insets.left, y: insets.top, w: bodyW, h: bodyH, r: screenRadius }
  const shell = { x: reach, y: 0, w: bodyW + 2 * bezel, h: height, r: screenRadius + bezel }

  // A button is kept only if it fits on the straight part of the side: on a
  // phone resized short and wide, the lower ones would otherwise hang off the
  // rounded corner, or off the device altogether.
  const straightEnd = shell.h - shell.r
  const button = (side: 'left' | 'right', [top, h]: number[]): Rect | null => {
    const y = top * m
    const bh = h * m
    if (y < shell.r || y + bh > straightEnd) return null
    // The button starts inside the shell by half its reach so the two strokes
    // meet; the shell is drawn over it.
    const w = reach * 1.5
    return { x: side === 'left' ? 0 : width - w, y, w, h: bh, r: reach * 0.6 }
  }
  const buttons = [
    ...PHONE.left.map((b) => button('left', b)),
    ...PHONE.right.map((b) => button('right', b)),
  ].filter((b): b is Rect => b !== null)

  const u = Math.min(m, PHONE_SYSTEM_UI_MAX_M)
  const islandW = PHONE.island.w * u
  const islandH = PHONE.island.h * u
  const island = {
    x: body.x + (bodyW - islandW) / 2,
    y: body.y + PHONE.island.top * u,
    w: islandW,
    h: islandH,
    r: islandH / 2,
  }
  const homeW = PHONE.home.w * u
  const thickness = PHONE.home.thickness * u
  const home = {
    x1: body.x + (bodyW - homeW) / 2,
    x2: body.x + (bodyW + homeW) / 2,
    // The centre of the line, so its bottom edge is `home.bottom` above the screen's.
    y: body.y + bodyH - PHONE.home.bottom * u - thickness / 2,
    thickness,
  }
  // The status bar shares the island's band, as on the device: the time on one
  // side, the radios on the other, never under the island.
  const status = {
    y: island.y + islandH / 2,
    left: body.x + Math.max(screenRadius * 0.55, 0.06 * m),
    right: body.x + bodyW - Math.max(screenRadius * 0.55, 0.06 * m),
    size: PHONE.statusSize * u,
  }
  return {
    kind: 'phone',
    bodyW,
    bodyH,
    width,
    height,
    insets,
    body,
    shell,
    rail: inset(shell, bezel * PHONE.rail),
    buttons,
    island,
    home,
    status,
    camera: { cx: body.x + bodyW / 2, cy: bezel / 2, r: Math.max(PHONE.camera * bezel, 1) },
  }
}

function tablet(bodyW: number, bodyH: number): TabletFrame {
  const m = Math.min(bodyW, bodyH)
  const bezel = TABLET.bezel * m
  const reach = TABLET.buttonReach * m
  const screenRadius = TABLET.screenRadius * m
  // The buttons are on the top edge and the right edge (as on an iPad held in
  // portrait), so those two insets carry their reach and the other two do not.
  const insets = { top: bezel + reach, right: bezel + reach, bottom: bezel, left: bezel }
  const width = bodyW + insets.left + insets.right
  const height = bodyH + insets.top + insets.bottom
  const body = { x: insets.left, y: insets.top, w: bodyW, h: bodyH, r: screenRadius }
  const shell = { x: 0, y: reach, w: bodyW + 2 * bezel, h: bodyH + 2 * bezel, r: screenRadius + bezel }
  const w = reach * 1.5
  const top = { x: shell.x + shell.w - shell.r - 0.12 * m - 0.09 * m, y: 0, w: 0.09 * m, h: w, r: reach * 0.6 }
  const volUp = { x: width - w, y: shell.y + shell.r + 0.04 * m, w, h: 0.07 * m, r: reach * 0.6 }
  const volDown = { ...volUp, y: volUp.y + volUp.h + 0.02 * m }
  // Same rule as the phone's: a button lives on the straight part of its edge.
  const onTop = top.x >= shell.x + shell.r ? [top] : []
  const onSide = [volUp, volDown].filter((b) => b.y + b.h <= shell.y + shell.h - shell.r)
  const buttons = [...onTop, ...onSide]
  return {
    kind: 'tablet',
    bodyW,
    bodyH,
    width,
    height,
    insets,
    body,
    shell,
    rail: inset(shell, bezel * TABLET.rail),
    buttons,
    camera: { cx: body.x + bodyW / 2, cy: shell.y + bezel / 2, r: Math.max(TABLET.camera * m, 1) },
  }
}

/*
 * A laptop rather than a monitor on a stand. Both read as "a computer"; what
 * decides is where the extra drawing goes. A stand hangs below the screen and
 * costs a quarter of its height, and height is exactly what a 16:10 screen is
 * short of in a landscape window under a toolbar. A deck seen from slightly
 * above costs about a tenth and spends the rest sideways, where a wide
 * window has room.
 */
function computer(bodyW: number, bodyH: number): ComputerFrame {
  const m = Math.min(bodyW, bodyH)
  const side = COMPUTER.side * m
  const top = COMPUTER.top * m
  const chin = COMPUTER.chin * m
  const lidW = bodyW + 2 * side
  const lidH = bodyH + top + chin
  const deckTopW = lidW * COMPUTER.deckTop
  const deckBottomW = lidW * COMPUTER.deckBottom
  const width = deckBottomW
  const hingeH = COMPUTER.hinge * lidW
  const deckH = COMPUTER.deckDepth * lidW
  const lipH = COMPUTER.lip * lidW
  const height = lidH + hingeH + deckH + lipH
  const lidX = (width - lidW) / 2
  const insets = { top, right: lidX + side, bottom: height - top - bodyH, left: lidX + side }
  const body = { x: lidX + side, y: top, w: bodyW, h: bodyH, r: 0 }
  const lid = { x: lidX, y: 0, w: lidW, h: lidH, r: COMPUTER.lidRadius * m }
  const cx = width / 2
  const hingeW = lidW * COMPUTER.hingeWidth
  const hinge = { x: cx - hingeW / 2, y: lidH, w: hingeW, h: hingeH, r: hingeH / 2 }

  // The deck is a trapezoid, so anything drawn on it follows the same
  // convergence: at depth t (0 = hinge, 1 = front) it is this wide.
  const deckY = lidH + hingeH
  const widthAt = (t: number) => deckTopW + (deckBottomW - deckTopW) * t
  const band = (t0: number, t1: number, share: number): Point[] => [
    { x: cx - (widthAt(t0) * share) / 2, y: deckY + deckH * t0 },
    { x: cx + (widthAt(t0) * share) / 2, y: deckY + deckH * t0 },
    { x: cx + (widthAt(t1) * share) / 2, y: deckY + deckH * t1 },
    { x: cx - (widthAt(t1) * share) / 2, y: deckY + deckH * t1 },
  ]
  return {
    kind: 'computer',
    bodyW,
    bodyH,
    width,
    height,
    insets,
    body,
    lid,
    camera: { cx, cy: top / 2, r: Math.max(COMPUTER.camera * m, 1) },
    hinge,
    deck: band(0, 1, 1),
    keyboard: band(0.1, 0.46, 0.84),
    trackpad: band(0.56, 0.9, 0.34),
    lip: { x: 0, y: deckY + deckH, w: deckBottomW, h: lipH, r: lipH / 2 },
    notch: { cx, y: deckY + deckH, w: COMPUTER.notch * lidW, depth: lipH * 0.55 },
  }
}

export function deviceFrame(kind: FrameKind, bodyW: number, bodyH: number): DeviceFrame {
  const w = Math.max(1, bodyW)
  const h = Math.max(1, bodyH)
  if (kind === 'phone') return phone(w, h)
  if (kind === 'tablet') return tablet(w, h)
  return computer(w, h)
}

/*
 * Fitting it in the player.
 *
 * The whole device has to be visible, so the scale divides the room by the
 * device's box and not by the screen's — the screen alone fitting was how a
 * laptop's deck would have run off the bottom of the window. The caption under
 * the device is a fixed number of CSS pixels, not body pixels: it is type, and
 * it does not shrink with the drawing.
 *
 * MAX_FRAME_SCALE is 1. A device drawn larger than its own pixels stops reading
 * as a device and reads as a zoom — a 390-wide phone blown up to fill a 4K
 * window is a poster of a phone. At 1 the screen is what it was designed at,
 * which is the most honest thing a demo can show; a small screen in a big
 * window gets air around it, as a real device on a desk would.
 */
export const MAX_FRAME_SCALE = 1
export const FRAME_PAD = 28
export const FRAME_PAD_NARROW = 12
/** Below this area width the margin shrinks: on a phone, 28 px either side is a seventh of the screen. */
export const NARROW_AREA_W = 640
/** Room for the caption line under the device, in CSS px. */
export const CAPTION_ROOM = 28

export function framePad(areaW: number): number {
  return areaW < NARROW_AREA_W ? FRAME_PAD_NARROW : FRAME_PAD
}

export function fitFrameScale(
  areaW: number,
  areaH: number,
  frame: { width: number; height: number },
  options: { pad?: number; footer?: number; max?: number } = {},
): number {
  const pad = options.pad ?? framePad(areaW)
  const footer = options.footer ?? CAPTION_ROOM
  const max = options.max ?? MAX_FRAME_SCALE
  if (areaW <= 0 || areaH <= 0) return 0
  const s = Math.min((areaW - pad * 2) / frame.width, (areaH - pad * 2 - footer) / frame.height, max)
  return s > 0 ? s : 0
}

/** "1440 × 900" — the size the screen was designed at, not the size it is drawn. */
export function frameDimensions(bodyW: number, bodyH: number): string {
  return `${Math.round(bodyW)} × ${Math.round(bodyH)}`
}

/*
 * Per-browser preference. On by default: the frame is the point of the demo
 * mode, and turning it off gives back the bare preview exactly as it was.
 * Storage can throw (private mode, blocked site data), and a preference that
 * cannot be read is simply the default.
 */
export const FRAME_PREF_KEY = 'mocky.demo.deviceFrame'

/** `window.localStorage` itself throws when site data is blocked, before any read. */
export function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function readFramePref(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(FRAME_PREF_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeFramePref(storage: Pick<Storage, 'setItem'> | undefined, on: boolean): void {
  try {
    storage?.setItem(FRAME_PREF_KEY, on ? '1' : '0')
  } catch {
    /* the toggle still works for this visit */
  }
}
