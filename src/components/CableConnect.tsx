import { useEffect, useRef, useState } from 'react'
import {
  arrowHead,
  connectPressHolds,
  connectRelease,
  elementRect,
  pointerCable,
  portOn,
  routeCables,
  screenAt,
  type Cable,
  type Pt,
  type Rect,
} from '../lib/cables'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'

/**
 * Plugging a cable into a screen — the "connecting" state of link mode.
 *
 * It starts in one of two ways: an element was just picked inside a preview
 * (a new link), or the socket of an existing cable was grabbed (reconnecting
 * it). Either way a live cable follows the pointer from the element, a screen
 * under the pointer lights up as the place it would land, and a click — or a
 * release, for a drag — plugs it in.
 *
 * The overlay covers the whole canvas and that is not a styling choice. Every
 * screen is an iframe, and an iframe swallows the pointer: over a screen, the
 * canvas stops receiving `pointermove`, so the cable would freeze at the edge
 * of the first screen it crossed — exactly the screens it is being drawn to.
 * A layer over them receives every event, and the frames are hit-tested by
 * arithmetic on their live boxes (`screenAt`), which is also cheaper than
 * asking the DOM. Middle-button and wheel still reach the canvas underneath, so
 * the board can be panned and zoomed while a cable is in hand.
 *
 * Drawn in SCREEN space, unlike the settled cables: this one changes on every
 * pointer move anyway, and a 2 px line here is simply 2 px.
 */
export default function CableConnect({
  source,
  retarget,
  pressed: startPressed,
  boxes,
  order,
  names,
  view,
  reducedMotion,
  spaceDown = false,
  onDrop,
  onCancel,
  onChooseList,
}: {
  /** The element the cable leaves from: its screen and its normalised rectangle. */
  source: { screenId: string; rect: Rect; label?: string }
  /** Set when an existing cable is being moved: the screen it was plugged into. */
  retarget?: { targetId: string }
  /** The button is already down (a drag started on a socket). */
  pressed: boolean
  boxes: ReadonlyMap<string, Rect>
  order: ReadonlyArray<string>
  names: ReadonlyMap<string, string>
  view: { x: number; y: number; scale: number }
  reducedMotion: boolean
  /** Space is held: a press pans the canvas instead of taking the cable. */
  spaceDown?: boolean
  onDrop: (targetId: string) => void
  onCancel: () => void
  /** The keyboard path, and the fallback: the list of screens. Absent when reconnecting. */
  onChooseList?: () => void
}) {
  const t = useT()
  const layerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<Pt | null>(null)
  const pressed = useRef(startPressed)

  // Refs so the window listeners below are attached once per connection, not
  // once per pointer move (each move changes `pointer`, and re-attaching three
  // listeners sixty times a second is how a drag starts to lag).
  const live = useRef({ view, boxes, order, onDrop, onCancel, retarget })
  live.current = { view, boxes, order, onDrop, onCancel, retarget }

  const toWorld = (p: Pt, v = view): Pt => ({ x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale })
  const toScreen = (p: Pt): Pt => ({ x: p.x * view.scale + view.x, y: p.y * view.scale + view.y })

  useEffect(() => {
    const local = (e: PointerEvent): Pt | null => {
      const el = layerRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const move = (e: PointerEvent) => {
      const p = local(e)
      if (p) setPointer(p)
    }
    const up = (e: PointerEvent) => {
      const p = local(e)
      const { view: v, boxes: b, order: o, onDrop: drop, onCancel: cancel, retarget: re } = live.current
      const outcome = connectRelease({
        button: e.button,
        pressed: pressed.current,
        point: p && { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale },
        order: o,
        boxes: b,
        sourceId: source.screenId,
        current: re?.targetId,
      })
      if (outcome.kind === 'ignore') return
      pressed.current = false
      if (outcome.kind === 'drop') drop(outcome.targetId)
      else cancel()
    }
    // A cancelled gesture ends like a finished one — the canvas's own rule
    // (`onPointerCancel` there). The browser takes the pointer back on a touch
    // turned scroll or an alt-tab mid-drag, and `pointerup` never comes: a
    // socket being dragged stayed frozen in hand. It has no position, so it
    // cannot plug anything in: a reconnection lets go (it only exists while the
    // button is down), and a new link keeps its cable in hand for the next click.
    const cancelled = () => {
      if (!pressed.current) return
      pressed.current = false
      if (live.current.retarget) live.current.onCancel()
    }
    const key = (e: KeyboardEvent) => {
      // An Escape something else already consumed — the type menu, a context
      // menu — closed THAT, and dropping the cable in hand as well lost a link
      // half made. React's root listener runs before this window one, so its
      // preventDefault is already visible here.
      if (e.defaultPrevented) return
      if (e.key === 'Escape') {
        e.preventDefault()
        live.current.onCancel()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancelled)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancelled)
      window.removeEventListener('keydown', key)
    }
  }, [source.screenId])

  // Focus comes back to the page. The pick happened INSIDE a preview's iframe,
  // which keeps the keyboard focus — and a key pressed in an iframe never
  // reaches this window, so Escape did nothing until the user clicked somewhere.
  // The BAR takes it: it announces what is happening, the list is the next Tab,
  // and it is marked so the canvas still reads Space as "pan" there (a focused
  // button would take Space for itself and open the list).
  //
  // ONCE per connection — the component is keyed per connection. It ran on
  // every change of `onChooseList`, which the parent passes as a fresh arrow on
  // each render: typing in the composer with a cable in hand pulled the focus
  // back here after the first character.
  useEffect(() => {
    barRef.current?.focus({ preventScroll: true })
  }, [])

  const frame = boxes.get(source.screenId)
  const world = pointer ? toWorld(pointer) : null
  const hover = world ? screenAt(world, order, boxes, source.screenId) : null

  let cable: Cable | null = null
  if (frame && hover) {
    cable = routeCables([{ id: '', sourceId: source.screenId, targetId: hover, rect: source.rect }], boxes)[0] ?? null
  } else if (frame && world) {
    cable = pointerCable(frame, source.rect, world)
  }

  const s = cable ? { p0: toScreen(cable.p0), c1: toScreen(cable.c1), c2: toScreen(cable.c2), p3: toScreen(cable.p3) } : null
  const path = s
    ? `M${s.p0.x} ${s.p0.y}C${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.p3.x} ${s.p3.y}`
    : ''
  // Before the pointer has moved there is no cable yet, but the element it
  // will leave from is already known — show where.
  const port = s ? s.p0 : frame ? toScreen(portOn(elementRect(frame, source.rect), 'right')) : null
  const targetBox = hover ? boxes.get(hover) : undefined
  const tb = targetBox
    ? { ...toScreen(targetBox), w: targetBox.w * view.scale, h: targetBox.h * view.scale }
    : null
  const arrow = cable && hover && s ? arrowHead(s.p3, cable.in, 10, 9) : null
  const sameTarget = !!retarget && hover === retarget.targetId

  const title = retarget
    ? t('canvas.retargetHint')
    : source.label
      ? t('canvas.connectFrom', { label: source.label })
      : t('canvas.connectFromElement')

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      // No touch-action of the browser's own: a finger dragging a socket must
      // produce pointer moves, not a page scroll that cancels the drag.
      style={{ cursor: spaceDown ? 'grab' : hover ? 'copy' : 'crosshair', touchAction: 'none' }}
      onPointerDown={(e) => {
        // A press that does not hold the cable falls through to the canvas,
        // which pans on it — see `connectPressHolds`.
        if (!connectPressHolds(e.button, spaceDown)) return
        e.stopPropagation()
        pressed.current = true
      }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {tb && (
          <rect
            x={tb.x - 4}
            y={tb.y - 4}
            width={tb.w + 8}
            height={tb.h + 8}
            rx={14}
            fill="rgb(var(--accent) / 0.07)"
            stroke="rgb(var(--accent))"
            strokeWidth={3}
            strokeOpacity={sameTarget ? 0.4 : 0.9}
          />
        )}
        {s && (
          <>
            <path d={path} fill="none" stroke="rgb(var(--accent))" strokeOpacity={0.22} strokeWidth={10} strokeLinecap="round" />
            <path
              d={path}
              fill="none"
              stroke="rgb(var(--accent))"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={hover ? undefined : '8 6'}
            >
              {/* Marching dashes while the cable is loose: it reads as a signal
                  looking for somewhere to go. Solid once it has found it. SMIL,
                  not CSS, so no stylesheet is needed — and therefore gated by
                  hand on reduced motion, which the global CSS reset cannot reach. */}
              {!hover && !reducedMotion && (
                <animate attributeName="stroke-dashoffset" from="28" to="0" dur="0.8s" repeatCount="indefinite" />
              )}
            </path>
          </>
        )}
        {port && <circle cx={port.x} cy={port.y} r={6} fill="rgb(var(--raised))" stroke="rgb(var(--accent))" strokeWidth={2.5} />}
        {s && hover && arrow && (
          <>
            {/* The glowing socket the cable is about to plug into. */}
            <circle cx={s.p3.x} cy={s.p3.y} r={14} fill="rgb(var(--accent))" fillOpacity={0.18}>
              {!reducedMotion && <animate attributeName="r" values="11;17;11" dur="1.4s" repeatCount="indefinite" />}
            </circle>
            <polygon points={arrow.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgb(var(--accent))" />
            <circle cx={s.p3.x} cy={s.p3.y} r={7} fill="rgb(var(--accent))" stroke="rgb(var(--raised))" strokeWidth={2} />
          </>
        )}
        {s && !hover && <circle cx={s.p3.x} cy={s.p3.y} r={5} fill="rgb(var(--accent))" />}
      </svg>

      {tb && (
        <div
          className="pointer-events-none absolute whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-body-sm font-medium text-on-accent shadow-sm"
          style={{ left: tb.x, top: Math.max(4, tb.y - 30) }}
        >
          → {names.get(hover!) ?? ''}
        </div>
      )}

      {/*
        The bar: what is happening, and the two ways out of it that are not a
        gesture. Below the zoom controls on a narrow window (they sit at top-14
        there) and just under the toolbar on a wide one.
      */}
      <div
        ref={barRef}
        role="group"
        aria-label={title}
        tabIndex={-1}
        data-canvas-keys=""
        className="absolute left-1/2 top-28 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-accent bg-raised px-3 py-1.5 text-body-sm text-ink shadow-lg outline-hidden xl:top-14"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Icon name="link" size={15} className="shrink-0 text-accent-ink" />
        <span className="min-w-0 truncate font-medium">{title}</span>
        <span className="hidden text-ink-muted sm:inline">
          {retarget ? t('canvas.retargetHow') : t('canvas.connectHow')}
        </span>
        {onChooseList && (
          <Button variant="ghost" size="sm" onClick={onChooseList}>
            <Icon name="list" size={15} />
            {t('canvas.connectList')}
          </Button>
        )}
        <Button variant="quiet" size="sm" onClick={onCancel} title={t('canvas.connectCancelTitle')}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}
