import { memo, useEffect, useMemo, useState } from 'react'
import { arrowHead, grow, intersects, labelVisible, type Cable, type Pt, type Rect } from '../lib/cables'
import { Icon } from '../ui'
import { useT } from '../i18n'

/**
 * The cables between screens, drawn in WORLD space inside the canvas's
 * transformed layer — so a pan moves them for free, with the frames, and they
 * are never recomputed for one. The geometry is `lib/cables.ts`; this file only
 * paints it.
 *
 * Two modes, and they are placed differently by the canvas:
 *
 *  - `map`, outside link mode: drawn BEHIND the frames, faint, and deaf to the
 *    pointer. It is the map of the prototype, not a control — a cable that took
 *    clicks would steal them from the frames it runs under. Behind is also what
 *    makes it read as a map: the cable leaves one screen's edge and enters the
 *    other's, and the stretch across the source's own content is hidden.
 *  - `edit`, in link mode: drawn ABOVE the frames, because there the element a
 *    cable leaves from is the whole point, and it is inside a frame. Cables can
 *    be hovered, selected and deleted; the socket at the target end can be
 *    dragged onto another screen to reconnect the link.
 *
 * Everything that must look the same at every zoom — strokes, dots, labels — is
 * sized in screen pixels divided by the scale. The CURVES are not: see the
 * header of `lib/cables.ts`.
 */

export type CableMode = 'map' | 'edit'

const ACCENT = 'rgb(var(--accent))'
const FAINT = 'rgb(var(--ink-faint))'
const SURFACE = 'rgb(var(--raised))'

/** True when a key press is typing, not a command to the canvas. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
  )
}

function points(ps: Pt[]): string {
  return ps.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(' ')
}

interface ItemProps {
  cable: Cable
  inv: number
  mode: CableMode
  emphasised: boolean
  /**
   * Draw the element's outline — link mode only, and never for a whole-screen
   * source, where it would be a second frame drawn around the frame.
   */
  outline: boolean
  onEnter?: (id: string) => void
  onLeave?: (id: string) => void
  onSelect?: (id: string) => void
  onRetargetStart?: (cable: Cable, e: React.PointerEvent) => void
  retargetTitle: string
}

/**
 * One cable. Memoised on its own props, so hovering one cable repaints one
 * cable: in a project of forty links that is the difference between a hover and
 * a stutter.
 */
const CableItem = memo(function CableItem({
  cable: c,
  inv,
  mode,
  emphasised,
  outline,
  onEnter,
  onLeave,
  onSelect,
  onRetargetStart,
  retargetTitle,
}: ItemProps) {
  const edit = mode === 'edit'
  const colour = c.missing ? FAINT : ACCENT
  const stroke = (edit ? (emphasised ? 3 : 2) : 1.5) * inv
  const dash = c.missing ? `${6 * inv} ${5 * inv}` : undefined
  const portR = (edit ? (emphasised ? 6 : 4.5) : 3) * inv
  const socketR = (edit ? (emphasised ? 7 : 5) : 3.5) * inv
  const arrow = c.missing ? null : arrowHead(c.p3, c.in, (edit ? 9 : 7) * inv, socketR)

  return (
    <g
      data-cable=""
      onPointerEnter={edit ? () => onEnter?.(c.id) : undefined}
      onPointerLeave={edit ? () => onLeave?.(c.id) : undefined}
    >
      {outline && (
        <rect
          x={c.element.x}
          y={c.element.y}
          width={c.element.w}
          height={c.element.h}
          rx={3 * inv}
          fill={ACCENT}
          fillOpacity={emphasised ? 0.25 : 0.12}
          stroke={ACCENT}
          strokeWidth={(emphasised ? 2.5 : 1.5) * inv}
        />
      )}
      {edit && emphasised && (
        // The glow: a wide, faint copy underneath. A filter blur would cost a
        // rasterisation per repaint; a second stroke costs nothing.
        <path d={c.path} fill="none" stroke={colour} strokeOpacity={0.2} strokeWidth={10 * inv} strokeLinecap="round" />
      )}
      <path
        d={c.path}
        fill="none"
        stroke={colour}
        strokeWidth={stroke}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      {edit && (
        // The hit area: a wide invisible stroke, because a 2 px line is a
        // target nobody can hit, least of all on a touch screen. Only the part
        // OUTSIDE the source frame (`hitPath`): over the source screen the
        // stroke lay on its own elements, and a press meant to pick one of
        // them selected the cable instead.
        <path
          d={c.hitPath}
          fill="none"
          stroke="transparent"
          strokeWidth={16 * inv}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.(c.id)
          }}
        />
      )}
      {/* The port: where the cable leaves its element. */}
      <circle cx={c.p0.x} cy={c.p0.y} r={portR} fill={SURFACE} stroke={colour} strokeWidth={2 * inv} />
      {/* The socket on the target's edge, and the arrow plugged into it. */}
      {arrow && <polygon points={points(arrow)} fill={colour} />}
      {!c.missing && (
        <circle cx={c.p3.x} cy={c.p3.y} r={socketR} fill={emphasised ? ACCENT : SURFACE} stroke={colour} strokeWidth={2 * inv} />
      )}
      {c.missing && <circle cx={c.p3.x} cy={c.p3.y} r={3 * inv} fill={colour} />}
      {/* Grabbable on a dead link too: plugging it into another screen is how
          it is repaired rather than deleted and redrawn. */}
      {edit && onRetargetStart && (
        <circle
          cx={c.p3.x}
          cy={c.p3.y}
          r={14 * inv}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            e.preventDefault()
            onRetargetStart(c, e)
          }}
        >
          <title>{retargetTitle}</title>
        </circle>
      )}
    </g>
  )
})

function CableLayer({
  cables,
  scale,
  cull,
  mode,
  names,
  highlightedId,
  hiddenId,
  suspended = false,
  onRemove,
  onRetargetStart,
}: {
  cables: Cable[]
  scale: number
  /** World rectangle worth drawing — see `cullWindow`. */
  cull: Rect
  mode: CableMode
  /** Screen id → name, for the labels. */
  names: ReadonlyMap<string, string>
  /** The link the links panel is pointing at. */
  highlightedId?: string | null
  /** A cable being dragged to another screen: the live cable replaces it. */
  hiddenId?: string | null
  /**
   * A cable is in hand (`CableConnect` covers the layer): nothing here may be
   * selected, and a selection made before it is dropped — see below.
   */
  suspended?: boolean
  onRemove?: (sourceId: string, hotspotId: string) => void
  onRetargetStart?: (cable: Cable, e: React.PointerEvent) => void
}) {
  const t = useT()
  const edit = mode === 'edit'
  const inv = 1 / scale
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const selectedCable = selected ? cables.find((c) => c.id === selected) : undefined

  // A selection outlives nothing: leaving link mode, or the cable going away
  // (deleted from the panel, its screen removed), clears it — otherwise the
  // Delete key would later act on something nobody can see selected.
  //
  // And a cable in hand clears it too. Deselecting relies on a press reaching
  // this window, and a pick inside a preview iframe never does: a cable
  // selected, then an element picked to start a new link, left the selection
  // alive under the connecting layer — and Backspace, with the focus on that
  // layer's bar, deleted a link nobody could see was selected.
  useEffect(() => {
    if (selected && (!edit || suspended || !selectedCable)) setSelected(null)
  }, [edit, suspended, selected, selectedCable])

  useEffect(() => {
    if (!edit || suspended || !selectedCable) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.key === 'Escape') setSelected(null)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onRemove?.(selectedCable.sourceId, selectedCable.id)
        setSelected(null)
      }
    }
    // Capture, so a press anywhere outside the cable UI deselects before the
    // canvas starts whatever that press starts.
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-cable]')) return
      setSelected(null)
    }
    // Focus moving into a preview's iframe blurs this window — the one sign a
    // press landed there. Same deselection as a press outside the cable UI.
    const onBlur = () => setSelected(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [edit, suspended, selectedCable, onRemove])

  const visible = useMemo(
    // The pad covers what is drawn around the curve at constant screen size —
    // the dots, the arrow, the glow — which the curve's own box does not.
    () => cables.filter((c) => c.id !== hiddenId && intersects(grow(c.bounds, 24 * inv), cull)),
    [cables, hiddenId, cull, inv],
  )

  const onEnter = useMemo(() => (id: string) => setHovered(id), [])
  const onLeave = useMemo(() => (id: string) => setHovered((cur) => (cur === id ? null : cur)), [])
  const onSelect = useMemo(() => (id: string) => setSelected(id), [])

  if (visible.length === 0) return null

  const isEmph = (id: string) => edit && (id === hovered || id === selected || id === highlightedId)
  // The emphasised cable is painted LAST, so it is on top of the ones it crosses.
  const ordered = edit ? [...visible].sort((a, b) => Number(isEmph(a.id)) - Number(isEmph(b.id))) : visible
  const retargetTitle = t('canvas.cableRetarget')

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: 0, height: 0, opacity: edit ? 1 : 0.5 }}
      aria-hidden={edit ? undefined : true}
    >
      <svg
        width={1}
        height={1}
        className="absolute left-0 top-0"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden
      >
        {ordered.map((c) => (
          <CableItem
            key={c.id}
            cable={c}
            inv={inv}
            mode={mode}
            emphasised={isEmph(c.id)}
            outline={edit && !c.whole}
            onEnter={onEnter}
            onLeave={onLeave}
            onSelect={onSelect}
            onRetargetStart={onRetargetStart}
            retargetTitle={retargetTitle}
          />
        ))}
      </svg>

      {ordered.map((c) => {
        const emph = isEmph(c.id)
        if (!labelVisible(c, scale, { interactive: edit, emphasised: emph })) return null
        const target = c.missing ? t('canvas.missingScreen') : names.get(c.targetId) ?? ''
        const text = c.label ? t('canvas.cableText', { label: c.label, target }) : t('canvas.cableTextBare', { target })
        const pos: React.CSSProperties = {
          left: c.labelAt.x,
          top: c.labelAt.y,
          transform: 'translate(-50%, -50%)',
          fontSize: 11 * inv,
          gap: 4 * inv,
          padding: `${2 * inv}px ${7 * inv}px`,
          maxWidth: 260 * inv,
        }
        if (!edit) {
          return (
            <div
              key={c.id}
              className="absolute flex items-center whitespace-nowrap rounded-full border border-line-soft bg-raised text-ink-muted"
              style={pos}
            >
              <span className="min-w-0 truncate">{text}</span>
            </div>
          )
        }
        const isSelected = c.id === selected
        return (
          <div
            key={c.id}
            data-cable=""
            className={`pointer-events-auto absolute flex items-center whitespace-nowrap rounded-full border font-medium shadow-sm ${
              emph ? 'border-accent bg-accent text-on-accent' : 'border-accent bg-raised text-ink'
            }`}
            style={pos}
            onPointerEnter={() => onEnter(c.id)}
            onPointerLeave={() => onLeave(c.id)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="min-w-0 truncate"
              aria-pressed={isSelected}
              aria-label={t('canvas.cableSelect', { label: text })}
              onFocus={() => onEnter(c.id)}
              onBlur={() => onLeave(c.id)}
              onClick={() => setSelected(isSelected ? null : c.id)}
            >
              {text}
            </button>
            {isSelected && (
              <button
                type="button"
                className="flex shrink-0 items-center rounded-full hover:bg-on-accent/20"
                style={{ padding: 1 * inv }}
                title={t('canvas.cableRemoveTitle')}
                aria-label={t('canvas.removeLink')}
                onClick={() => {
                  onRemove?.(c.sourceId, c.id)
                  setSelected(null)
                }}
              >
                <Icon name="close" size={11 * inv} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default memo(CableLayer)
