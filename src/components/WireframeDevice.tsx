import { useLayoutEffect, useRef, type ReactNode, type SVGProps } from 'react'
import { CAPTION_ROOM, type DeviceFrame, type Point, type Rect } from '../lib/deviceFrames'

/**
 * A device drawn as a line drawing around a screen: laptop, tablet or phone.
 *
 * The style is a blueprint, on purpose. The photoreal iPhone (`DeviceChrome`)
 * is metal and glass, and a metal laptop next to it would be a second product
 * shot competing with the mockup for the eye. A stroke drawing says "this is
 * the device" and then gets out of the way — and it can be drawn in the shell's
 * own tokens, so it is paper and ink in the light theme and the reverse in the
 * dark one, where a photoreal frame is the same grey slab in both.
 *
 * All the geometry comes from `lib/deviceFrames.ts` in body pixels; this
 * component multiplies by `scale` and draws nothing it computed itself, except
 * the keyboard's row lines, which are an ornament on a shape already tested.
 * The strokes use `vector-effect: non-scaling-stroke`, so a laptop shown at a
 * fifth of its size on a narrow window keeps the same hairline as a phone shown
 * at full size: "thin, even strokes" is a CSS-pixel promise, not a body one.
 */

const INK = 'rgb(var(--ink))'
const MUTED = 'rgb(var(--ink-muted))'
const FAINT = 'rgb(var(--ink-faint))'
const PAPER = 'rgb(var(--surface))'

const hairline = { vectorEffect: 'non-scaling-stroke' } as const

function R({ box, ...props }: { box: Rect } & Omit<SVGProps<SVGRectElement>, 'ref'>) {
  return <rect x={box.x} y={box.y} width={Math.max(0, box.w)} height={Math.max(0, box.h)} rx={box.r} ry={box.r} {...hairline} {...props} />
}

function Poly({ pts, ...props }: { pts: Point[] } & Omit<SVGProps<SVGPolygonElement>, 'ref'>) {
  return <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} {...hairline} {...props} />
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Blueprint corner marks just outside the device, in CSS px (converted to body units). */
function Ticks({ frame, scale }: { frame: DeviceFrame; scale: number }) {
  // Gap + length stay under the narrow window's 12 px margin, so the marks are
  // never cut by the edge of the play area.
  const g = 5 / scale
  const l = 7 / scale
  const { width: w, height: h } = frame
  const d = [
    `M${-g - l},${-g}H${-g}V${-g - l}`,
    `M${w + g + l},${-g}H${w + g}V${-g - l}`,
    `M${-g - l},${h + g}H${-g}V${h + g + l}`,
    `M${w + g + l},${h + g}H${w + g}V${h + g + l}`,
  ].join('')
  return <path d={d} fill="none" stroke={FAINT} strokeWidth={1} {...hairline} />
}

function Body({ frame }: { frame: DeviceFrame }) {
  // The screen's own contour. The preview covers the inside of it, so what
  // shows is the half of the stroke that falls on the bezel — a clean edge
  // where the glass would meet the frame.
  return <R box={frame.body} fill="none" stroke={INK} strokeWidth={1} />
}

function PhoneDrawing({ frame, systemUi }: { frame: Extract<DeviceFrame, { kind: 'phone' }>; systemUi: boolean }) {
  return (
    <>
      {frame.buttons.map((b, i) => (
        <R key={i} box={b} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      ))}
      <R box={frame.shell} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      <R box={frame.rail} fill="none" stroke={FAINT} strokeWidth={1} />
      {!systemUi && (
        <circle cx={frame.camera.cx} cy={frame.camera.cy} r={frame.camera.r} fill="none" stroke={MUTED} strokeWidth={1} {...hairline} />
      )}
      <Body frame={frame} />
    </>
  )
}

function TabletDrawing({ frame }: { frame: Extract<DeviceFrame, { kind: 'tablet' }> }) {
  return (
    <>
      {frame.buttons.map((b, i) => (
        <R key={i} box={b} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      ))}
      <R box={frame.shell} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      <R box={frame.rail} fill="none" stroke={FAINT} strokeWidth={1} />
      <circle cx={frame.camera.cx} cy={frame.camera.cy} r={frame.camera.r} fill="none" stroke={MUTED} strokeWidth={1} {...hairline} />
      <Body frame={frame} />
    </>
  )
}

function ComputerDrawing({ frame }: { frame: Extract<DeviceFrame, { kind: 'computer' }> }) {
  const [kl, kr, kbr, kbl] = frame.keyboard
  const rows = [0.25, 0.5, 0.75].map((t) => [lerp(kl, kbl, t), lerp(kr, kbr, t)] as const)
  const { notch } = frame
  return (
    <>
      <R box={frame.hinge} fill={PAPER} stroke={MUTED} strokeWidth={1} />
      <Poly pts={frame.deck} fill={PAPER} stroke={INK} strokeWidth={1.25} strokeLinejoin="round" />
      <R box={frame.lip} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      <path
        d={`M${notch.cx - notch.w / 2},${notch.y} Q${notch.cx},${notch.y + notch.depth * 2} ${notch.cx + notch.w / 2},${notch.y}`}
        fill="none"
        stroke={MUTED}
        strokeWidth={1}
        {...hairline}
      />
      <Poly pts={frame.keyboard} fill="none" stroke={FAINT} strokeWidth={1} strokeLinejoin="round" />
      {rows.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={FAINT} strokeWidth={1} strokeDasharray="2 3" {...hairline} />
      ))}
      <Poly pts={frame.trackpad} fill="none" stroke={MUTED} strokeWidth={1} strokeLinejoin="round" />
      <R box={frame.lid} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      <circle cx={frame.camera.cx} cy={frame.camera.cy} r={frame.camera.r} fill="none" stroke={MUTED} strokeWidth={1} {...hairline} />
      <Body frame={frame} />
    </>
  )
}

/**
 * What the phone draws ON the screen: the island, the home indicator and the
 * status bar. The mobile preset tells the model the frame draws these (and to
 * keep the bands clear), so a wireframe phone without them would leave an
 * empty strip the generated screen was told somebody else would fill.
 *
 * The converse holds too, which is why it takes `systemUi`: a screen that is a
 * phone only by WIDTH (a free frame resized to 480) was generated with no such
 * promise, has its nav bar exactly where the island would go, and gets a
 * camera dot in the bezel instead.
 *
 * The island and the indicator carry their own background — paper under ink,
 * like the device — so they read over any screen. The status bar is glyphs
 * only and uses `difference` blending, as `DeviceChrome`'s does: a fixed ink
 * disappears on a screen whose top happens to be that ink.
 */
function PhoneOverlay({ frame, scale }: { frame: Extract<DeviceFrame, { kind: 'phone' }>; scale: number }) {
  const { island, home, status } = frame
  const size = Math.max(7, status.size * scale)
  const glyph = size * 0.8
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-visible"
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        preserveAspectRatio="none"
      >
        <R box={island} fill={PAPER} stroke={INK} strokeWidth={1} />
        <line x1={home.x1} y1={home.y} x2={home.x2} y2={home.y} stroke={PAPER} strokeLinecap="round" strokeWidth={home.thickness * scale + 2} {...hairline} />
        <line x1={home.x1} y1={home.y} x2={home.x2} y2={home.y} stroke={INK} strokeLinecap="round" strokeWidth={Math.max(1.5, home.thickness * scale)} {...hairline} />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute flex items-center justify-between font-mono"
        style={{
          left: status.left * scale,
          width: (status.right - status.left) * scale,
          top: status.y * scale - size / 2,
          height: size,
          fontSize: size,
          lineHeight: 1,
          color: '#fff',
          mixBlendMode: 'difference',
        }}
      >
        <span style={{ width: (island.x - status.left) * scale * 0.8, textAlign: 'center' }}>9:41</span>
        <span className="flex items-center" style={{ gap: glyph * 0.35 }}>
          {/* Signal, wifi and battery as outlines — the wireframe's own vocabulary. */}
          <svg width={glyph * 1.3} height={glyph} viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
            <path d="M1.5 9V7.5M4.5 9V5.5M7.5 9V3.5M10.5 9V1.5" />
          </svg>
          <svg width={glyph * 1.3} height={glyph} viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
            <path d="M1 3.8a8 8 0 0 1 11 0M3 6a5 5 0 0 1 7 0M5.2 8.2a1.9 1.9 0 0 1 2.6 0" />
          </svg>
          <svg width={glyph * 2} height={glyph} viewBox="0 0 20 10" fill="none" stroke="currentColor" strokeWidth={1.1}>
            <rect x="0.6" y="0.6" width="16.4" height="8.8" rx="2.4" />
            <rect x="2.6" y="2.6" width="10" height="4.8" rx="1" />
            <path d="M18.6 3.6v2.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </>
  )
}

export interface WireframeScreenProps {
  /**
   * Corner radius for the preview iframe, which is what actually clips it — in
   * BODY px, because the children are laid out at the design size and scaled.
   */
  radius: string | undefined
  /** Touch devices have overlay scrollbars; a laptop shows its own. */
  hideScrollbars: boolean
}

export default function WireframeDevice({
  frame,
  scale,
  caption,
  systemUi,
  children,
}: {
  frame: DeviceFrame
  scale: number
  caption: string
  /**
   * The screen was generated with the mobile safe areas (MOBILE_HINT), so the
   * phone may draw its island, status bar and home indicator ON it.
   */
  systemUi: boolean
  children: (screen: WireframeScreenProps) => ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastKind = useRef(frame.kind)

  // Moving from a phone to a laptop changes the whole drawing in one frame.
  // A short settle — the new device fading up from slightly smaller — is what
  // tells the eye that the device CHANGED rather than that the page jumped.
  // The global reduced-motion reset in index.css covers CSS animations, not
  // the Web Animations API, so the preference is read here as well; and an
  // engine without `animate` simply shows the new device.
  // A LAYOUT effect: a demo link arrives as a window `message`, which React 18
  // renders at default priority, so a passive effect ran after the browser had
  // painted the new device at full opacity — one frame of the jump, then a
  // fade from nothing.
  useLayoutEffect(() => {
    if (lastKind.current === frame.kind) return
    lastKind.current = frame.kind
    const el = wrapRef.current
    if (!el || typeof el.animate !== 'function') return
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      el.animate(
        [
          { opacity: 0, transform: 'scale(0.97)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    } catch {
      /* no transition, same result */
    }
  }, [frame.kind])

  const W = frame.width * scale
  const H = frame.height * scale
  const { body } = frame
  const clip = body.r > 0 ? `${body.r * scale}px` : undefined
  const radius = body.r > 0 ? `${body.r}px` : undefined

  return (
    <div ref={wrapRef} className="relative" style={{ width: W, height: H + CAPTION_ROOM }}>
      <div className="relative" style={{ width: W, height: H }}>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          preserveAspectRatio="none"
        >
          <Ticks frame={frame} scale={scale} />
          {frame.kind === 'phone' && <PhoneDrawing frame={frame} systemUi={systemUi} />}
          {frame.kind === 'tablet' && <TabletDrawing frame={frame} />}
          {frame.kind === 'computer' && <ComputerDrawing frame={frame} />}
        </svg>
        {/* The screen opening. Everything interactive lives in here, in the
            screen's own box, so a hotspot placed as a fraction of the screen
            lands on the same element whatever device is drawn around it.
            The screen is laid out at its DESIGN size and scaled, as the canvas
            does, never sized to the scaled box: the laptop's deck and caption
            cost a fifth of the height, so a 1440 screen fitted by size laid out
            at ~900 px, under Tailwind's lg, and the drawing captioned
            "Ordinateur" showed the tablet layout. */}
        <div
          className="absolute overflow-hidden"
          style={{ left: body.x * scale, top: body.y * scale, width: body.w * scale, height: body.h * scale, borderRadius: clip }}
        >
          <div
            className="absolute left-0 top-0"
            style={{ width: body.w, height: body.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
          >
            {children({ radius, hideScrollbars: frame.kind !== 'computer' })}
          </div>
        </div>
        {frame.kind === 'phone' && systemUi && <PhoneOverlay frame={frame} scale={scale} />}
      </div>
      <p
        className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-caption tabular-nums text-ink-faint"
        style={{ lineHeight: `${CAPTION_ROOM}px` }}
      >
        {caption}
      </p>
    </div>
  )
}
