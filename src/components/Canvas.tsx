import { useCallback, useEffect, useRef, useState } from 'react'
import { MIN_H, MIN_W, slotPosition, type Screen } from '../lib/project'
import { downloadTsx } from '../lib/export'
import Preview, { type PickInfo } from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'

interface ViewState {
  x: number
  y: number
  scale: number
}
interface Box {
  x: number
  y: number
  w: number
  h: number
}

const MIN_SCALE = 0.05
const MAX_SCALE = 1.5

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

type Gesture =
  | { type: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { type: 'move'; sx: number; sy: number; origins: Record<string, { x: number; y: number }> }
  | { type: 'resize'; id: string; handle: Handle; sx: number; sy: number; box: Box }
  | { type: 'marquee'; sx: number; sy: number; additive: boolean; base: string[] }
  | { type: 'annotate'; screenId: string; sx: number; sy: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function capture(el: HTMLElement | null, pointerId: number) {
  try {
    el?.setPointerCapture(pointerId)
  } catch {
    /* ignore — capture is best-effort */
  }
}

function computeResize(handle: Handle, b: Box, dx: number, dy: number): Box {
  let { x, y, w, h } = b
  if (handle.includes('e')) w = b.w + dx
  if (handle.includes('s')) h = b.h + dy
  if (handle.includes('w')) {
    w = b.w - dx
    x = b.x + dx
  }
  if (handle.includes('n')) {
    h = b.h - dy
    y = b.y + dy
  }
  if (w < MIN_W) {
    if (handle.includes('w')) x = b.x + (b.w - MIN_W)
    w = MIN_W
  }
  if (h < MIN_H) {
    if (handle.includes('n')) y = b.y + (b.h - MIN_H)
    h = MIN_H
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

export default function Canvas({
  screens,
  selectedIds,
  onSelectionChange,
  onMoveScreens,
  onResizeScreen,
  onRenameScreen,
  onDeleteScreen,
  linkMode,
  interactAll,
  showFrame,
  onPickElement,
  onRemoveHotspot,
  highlightedHotspotId,
  focusScreenId,
  focusNonce,
  annotateMode,
  onCaptureRegion,
  captureReq,
  onCaptureRect,
  onError,
  onRevertScreen,
  generatingIds,
}: {
  screens: Screen[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onMoveScreens: (updates: Array<{ id: string; x: number; y: number }>) => void
  onResizeScreen: (id: string, box: Box) => void
  onRenameScreen: (id: string, name: string) => void
  onDeleteScreen: (id: string) => void
  linkMode: boolean
  interactAll: boolean
  showFrame: boolean
  onPickElement: (screenId: string, info: PickInfo) => void
  onRemoveHotspot: (screenId: string, hotspotId: string) => void
  highlightedHotspotId?: string | null
  focusScreenId?: string | null
  focusNonce?: number
  annotateMode: boolean
  onCaptureRegion: (screenId: string, clientRect: { left: number; top: number; width: number; height: number }) => void
  captureReq: { screenId: string; id: string; clientRect: { left: number; top: number; width: number; height: number } } | null
  onCaptureRect: (id: string, rect: { x: number; y: number; w: number; h: number }) => void
  onError?: (screenId: string, error: string) => void
  onRevertScreen?: (screenId: string) => void
  generatingIds?: Set<string>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ViewState>({ x: 80, y: 80, scale: 0.4 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [moveDelta, setMoveDelta] = useState<{ dx: number; dy: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<(Box & { id: string }) | null>(null)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [annotateRect, setAnnotateRect] = useState<Box | null>(null)
  const gesture = useRef<Gesture | null>(null)

  const local = (e: { clientX: number; clientY: number }) => {
    const r = containerRef.current!.getBoundingClientRect()
    return { lx: e.clientX - r.left, ly: e.clientY - r.top }
  }

  const fitAll = useCallback(() => {
    const el = containerRef.current
    if (!el || screens.length === 0) {
      setView({ x: 80, y: 80, scale: 0.5 })
      return
    }
    const minX = Math.min(...screens.map((s) => s.x))
    const minY = Math.min(...screens.map((s) => s.y))
    const maxX = Math.max(...screens.map((s) => s.x + s.w))
    const maxY = Math.max(...screens.map((s) => s.y + s.h))
    const w = maxX - minX
    const h = maxY - minY
    const pad = 80
    const scale = clamp(Math.min((el.clientWidth - pad * 2) / w, (el.clientHeight - pad * 2) / h), MIN_SCALE, 1)
    setView({
      x: (el.clientWidth - w * scale) / 2 - minX * scale,
      y: (el.clientHeight - h * scale) / 2 - minY * scale,
      scale,
    })
  }, [screens])

  const didFit = useRef(false)
  useEffect(() => {
    if (!didFit.current && screens.length > 0) {
      didFit.current = true
      fitAll()
    }
  }, [screens, fitAll])

  // Center the canvas on a screen when the links panel requests focus.
  useEffect(() => {
    if (!focusScreenId) return
    const s = screens.find((x) => x.id === focusScreenId)
    const el = containerRef.current
    if (!s || !el) return
    const scale = clamp(Math.min((el.clientWidth - 160) / s.w, (el.clientHeight - 160) / s.h), MIN_SCALE, 0.9)
    setView({
      x: el.clientWidth / 2 - (s.x + s.w / 2) * scale,
      y: el.clientHeight / 2 - (s.y + s.h / 2) * scale,
      scale,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusScreenId, focusNonce])

  // Space = temporary pan mode (ignored while typing in a field).
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isField(e.target)) {
        setSpaceDown(true)
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  function startPan(e: React.PointerEvent) {
    const { lx, ly } = local(e)
    gesture.current = { type: 'pan', sx: lx, sy: ly, ox: view.x, oy: view.y }
    capture(containerRef.current, e.pointerId)
  }

  function onBackgroundDown(e: React.PointerEvent) {
    if (gesture.current) return
    if (e.button === 1 || spaceDown) return startPan(e)
    if (e.button !== 0) return
    if (linkMode || annotateMode) return // empty-canvas drag does nothing in these modes
    const { lx, ly } = local(e)
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    gesture.current = { type: 'marquee', sx: lx, sy: ly, additive, base: selectedIds }
    setMarquee({ x: lx, y: ly, w: 0, h: 0 })
    capture(containerRef.current, e.pointerId)
  }

  function onFrameDown(e: React.PointerEvent, s: Screen) {
    e.stopPropagation()
    if (e.button === 1 || spaceDown) return startPan(e)
    if (e.button !== 0) return
    const { lx, ly } = local(e)
    if (annotateMode) {
      gesture.current = { type: 'annotate', screenId: s.id, sx: lx, sy: ly }
      setAnnotateRect({ x: lx, y: ly, w: 0, h: 0 })
      capture(containerRef.current, e.pointerId)
      return
    }
    // In link mode, the frame body is interactive so the preview iframe can pick
    // elements; the header still drives select/move here.
    if (e.ctrlKey || e.metaKey) {
      onSelectionChange(
        selectedIds.includes(s.id) ? selectedIds.filter((i) => i !== s.id) : [...selectedIds, s.id],
      )
      return
    }
    const ids = selectedIds.includes(s.id) ? selectedIds : [s.id]
    if (!selectedIds.includes(s.id)) onSelectionChange(ids)
    const origins: Record<string, { x: number; y: number }> = {}
    screens.forEach((sc) => {
      if (ids.includes(sc.id)) origins[sc.id] = { x: sc.x, y: sc.y }
    })
    gesture.current = { type: 'move', sx: lx, sy: ly, origins }
    capture(containerRef.current, e.pointerId)
  }

  function onHandleDown(e: React.PointerEvent, s: Screen, handle: Handle) {
    e.stopPropagation()
    if (e.button !== 0) return
    const { lx, ly } = local(e)
    if (!selectedIds.includes(s.id)) onSelectionChange([s.id])
    gesture.current = { type: 'resize', id: s.id, handle, sx: lx, sy: ly, box: { x: s.x, y: s.y, w: s.w, h: s.h } }
    setResizePreview({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h })
    capture(containerRef.current, e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return
    const { lx, ly } = local(e)
    if (g.type === 'pan') {
      setView((v) => ({ ...v, x: g.ox + (lx - g.sx), y: g.oy + (ly - g.sy) }))
    } else if (g.type === 'move') {
      setMoveDelta({ dx: (lx - g.sx) / view.scale, dy: (ly - g.sy) / view.scale })
    } else if (g.type === 'resize') {
      setResizePreview({ id: g.id, ...computeResize(g.handle, g.box, (lx - g.sx) / view.scale, (ly - g.sy) / view.scale) })
    } else if (g.type === 'marquee') {
      setMarquee({ x: Math.min(g.sx, lx), y: Math.min(g.sy, ly), w: Math.abs(lx - g.sx), h: Math.abs(ly - g.sy) })
    } else if (g.type === 'annotate') {
      setAnnotateRect({ x: Math.min(g.sx, lx), y: Math.min(g.sy, ly), w: Math.abs(lx - g.sx), h: Math.abs(ly - g.sy) })
    }
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    if (g?.type === 'move' && moveDelta) {
      if (Math.abs(moveDelta.dx) > 1 || Math.abs(moveDelta.dy) > 1) {
        onMoveScreens(
          Object.entries(g.origins).map(([id, o]) => ({
            id,
            x: Math.round(o.x + moveDelta.dx),
            y: Math.round(o.y + moveDelta.dy),
          })),
        )
      }
    } else if (g?.type === 'resize' && resizePreview) {
      const { x, y, w, h } = resizePreview
      onResizeScreen(g.id, { x, y, w, h })
    } else if (g?.type === 'marquee' && marquee) {
      if (marquee.w < 4 && marquee.h < 4) {
        // a plain click on empty space clears selection
        if (!g.additive) onSelectionChange([])
      } else {
        const hit = screens
          .filter((s) => {
            const sx = s.x * view.scale + view.x
            const sy = s.y * view.scale + view.y
            const sw = s.w * view.scale
            const sh = s.h * view.scale
            return sx < marquee.x + marquee.w && sx + sw > marquee.x && sy < marquee.y + marquee.h && sy + sh > marquee.y
          })
          .map((s) => s.id)
        onSelectionChange(g.additive ? Array.from(new Set([...g.base, ...hit])) : hit)
      }
    } else if (g?.type === 'annotate' && annotateRect) {
      if (annotateRect.w > 6 && annotateRect.h > 6) {
        const cr = containerRef.current?.getBoundingClientRect()
        if (cr) {
          onCaptureRegion(g.screenId, {
            left: cr.left + annotateRect.x,
            top: cr.top + annotateRect.y,
            width: annotateRect.w,
            height: annotateRect.h,
          })
        }
      }
    }
    setMoveDelta(null)
    setResizePreview(null)
    setMarquee(null)
    setAnnotateRect(null)
  }

  function onWheel(e: React.WheelEvent) {
    const { lx, ly } = local(e)
    setView((v) => {
      const newScale = clamp(v.scale * (1 + -e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE)
      const wx = (lx - v.x) / v.scale
      const wy = (ly - v.y) / v.scale
      return { x: lx - wx * newScale, y: ly - wy * newScale, scale: newScale }
    })
  }

  function zoomBy(factor: number) {
    const el = containerRef.current
    if (!el) return
    const lx = el.clientWidth / 2
    const ly = el.clientHeight / 2
    setView((v) => {
      const newScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      const wx = (lx - v.x) / v.scale
      const wy = (ly - v.y) / v.scale
      return { x: lx - wx * newScale, y: ly - wy * newScale, scale: newScale }
    })
  }

  const effBox = (s: Screen): Box => {
    if (resizePreview && resizePreview.id === s.id) {
      return { x: resizePreview.x, y: resizePreview.y, w: resizePreview.w, h: resizePreview.h }
    }
    if (moveDelta && gesture.current?.type === 'move' && gesture.current.origins[s.id]) {
      const o = gesture.current.origins[s.id]
      return { x: o.x + moveDelta.dx, y: o.y + moveDelta.dy, w: s.w, h: s.h }
    }
    return { x: s.x, y: s.y, w: s.w, h: s.h }
  }

  const gap = 26 * view.scale
  const bgStyle: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle, var(--dot) 1.2px, transparent 1.2px)`,
    backgroundSize: `${gap}px ${gap}px`,
    backgroundPosition: `${view.x}px ${view.y}px`,
    cursor: spaceDown ? 'grab' : linkMode || annotateMode ? 'crosshair' : 'default',
  }
  const hs = 11 / view.scale // handle size in world units (constant on screen)
  const inv = 1 / view.scale // scale-invariant unit for labels
  const singleSelected = selectedIds.length === 1

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden bg-slate-900"
      style={bgStyle}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {screens.map((s) => {
          const b = effBox(s)
          const selected = selectedIds.includes(s.id)
          const interactive = interactAll && !linkMode && !annotateMode && !spaceDown
          const pickable = linkMode && !annotateMode && !spaceDown
          const bw = b.w
          const bh = b.h
          const useFrame = s.device === 'iphone' && showFrame
          return (
            <div
              key={s.id}
              className={`absolute ${useFrame ? '' : 'frame-shadow'} ${
                selected ? 'ring-2 ring-indigo-500' : useFrame ? '' : 'ring-1 ring-slate-700'
              }`}
              style={{
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                background: useFrame ? 'transparent' : 'white',
                borderRadius: useFrame ? '13% / 6%' : '1rem',
              }}
              onPointerDown={(e) => onFrameDown(e, s)}
            >
              {/* Floating name label + selection actions (also the move handle) */}
              <div
                className="absolute left-0 flex items-center whitespace-nowrap"
                style={{ bottom: '100%', paddingBottom: 5 * inv, gap: 5 * inv, fontSize: 12 * inv, maxWidth: b.w }}
              >
                {editingLabelId === s.id ? (
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={() => {
                      onRenameScreen(s.id, draftLabel)
                      setEditingLabelId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRenameScreen(s.id, draftLabel)
                        setEditingLabelId(null)
                      }
                      if (e.key === 'Escape') setEditingLabelId(null)
                    }}
                    className="rounded border border-slate-500 bg-slate-900 text-slate-100 outline-none"
                    style={{ fontSize: 12 * inv, padding: `${1 * inv}px ${4 * inv}px`, width: b.w * 0.7 }}
                  />
                ) : (
                  <span className={`truncate ${selected ? 'text-indigo-300' : 'text-slate-400'}`}>{s.name}</span>
                )}
                {selected && singleSelected && editingLabelId !== s.id && (
                  <span
                    className="flex items-center rounded-md bg-slate-900/90 text-slate-200"
                    style={{ gap: 2 * inv, padding: `${1 * inv}px ${2 * inv}px` }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <LabelBtn inv={inv} title="Rename" onClick={() => { setDraftLabel(s.name); setEditingLabelId(s.id) }}>✎</LabelBtn>
                    <LabelBtn inv={inv} title="Download .tsx" onClick={() => downloadTsx(s)}>⬇</LabelBtn>
                    {s.previousCode && (
                      <LabelBtn inv={inv} title="Revert to previous version" onClick={() => onRevertScreen?.(s.id)}>↺</LabelBtn>
                    )}
                    <LabelBtn inv={inv} title="Delete screen" danger onClick={() => onDeleteScreen(s.id)}>🗑</LabelBtn>
                  </span>
                )}
              </div>

              {/* Live preview fills the frame. Interactive when in interact/link mode. */}
              <div
                className="h-full w-full overflow-hidden"
                style={{ pointerEvents: interactive || pickable ? 'auto' : 'none', borderRadius: useFrame ? '13% / 6%' : '1rem' }}
              >
                {useFrame ? (
                  <DeviceChrome>
                    <Preview
                      code={s.code}
                      pickMode={pickable}
                      onPick={(info) => onPickElement(s.id, info)}
                      hideScrollbars={s.device === 'iphone'}
                      radius={SCREEN_RADIUS}
                      captureRequest={captureReq?.screenId === s.id ? { id: captureReq.id, clientRect: captureReq.clientRect } : null}
                      onCaptureRect={onCaptureRect}
                      onError={(err) => onError?.(s.id, err)}
                      generating={generatingIds?.has(s.id)}
                    />
                  </DeviceChrome>
                ) : (
                  <Preview
                    code={s.code}
                    pickMode={pickable}
                    onPick={(info) => onPickElement(s.id, info)}
                    hideScrollbars={s.device === 'iphone'}
                    radius="1rem"
                    captureRequest={captureReq?.screenId === s.id ? { id: captureReq.id, clientRect: captureReq.clientRect } : null}
                    onCaptureRect={onCaptureRect}
                    onError={(err) => onError?.(s.id, err)}
                    generating={generatingIds?.has(s.id)}
                  />
                )}
              </div>

              {/* Interaction-link hotspots (shown while linking) */}
              {linkMode &&
                s.links.map((h) => {
                  const targetName = screens.find((t) => t.id === h.target)?.name ?? '(missing)'
                  const hi = highlightedHotspotId === h.id
                  return (
                    <div
                      key={h.id}
                      className={`pointer-events-none absolute rounded border-2 ${
                        hi
                          ? 'border-amber-400 bg-amber-400/30 ring-4 ring-amber-400/40'
                          : 'border-indigo-500 bg-indigo-500/20'
                      }`}
                      style={{ left: h.x * bw, top: h.y * bh, width: h.w * bw, height: h.h * bh }}
                    >
                      <div
                        className="pointer-events-auto absolute left-0 top-0 flex max-w-full items-center gap-1 rounded bg-indigo-500 px-1 font-medium text-white"
                        style={{ fontSize: 10 / view.scale, transform: `translateY(-100%)` }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">
                          {h.label ? `"${h.label}" ` : ''}→ {targetName}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveHotspot(s.id, h.id)}
                          className="rounded px-0.5 hover:bg-indigo-700"
                          title="Remove link"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}

              {/* Resize handles (only on the selected frame) */}
              {selected && !linkMode &&
                HANDLES.map((handle) => {
                  const pos: React.CSSProperties = { width: hs, height: hs, position: 'absolute' }
                  const half = hs / 2
                  if (handle.includes('n')) pos.top = -half
                  if (handle.includes('s')) pos.bottom = -half
                  if (handle.includes('w')) pos.left = -half
                  if (handle.includes('e')) pos.right = -half
                  if (handle === 'n' || handle === 's') {
                    pos.left = b.w / 2 - half
                  }
                  if (handle === 'e' || handle === 'w') {
                    pos.top = b.h / 2 - half
                  }
                  const cursor =
                    handle === 'n' || handle === 's'
                      ? 'ns-resize'
                      : handle === 'e' || handle === 'w'
                        ? 'ew-resize'
                        : handle === 'ne' || handle === 'sw'
                          ? 'nesw-resize'
                          : 'nwse-resize'
                  return (
                    <div
                      key={handle}
                      onPointerDown={(e) => onHandleDown(e, s, handle)}
                      style={{ ...pos, cursor, borderRadius: 2 }}
                      className="border border-white bg-indigo-500"
                    />
                  )
                })}

              {/* Dimension label under a single selected frame */}
              {selected && singleSelected && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-indigo-500 px-2 font-medium text-white"
                  style={{ top: b.h + 6 / view.scale, fontSize: 11 / view.scale, paddingTop: 1 / view.scale, paddingBottom: 1 / view.scale }}
                >
                  {Math.round(b.w)} × {Math.round(b.h)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Marquee selection rectangle */}
      {marquee && (marquee.w > 0 || marquee.h > 0) && (
        <div
          className="pointer-events-none absolute border border-indigo-400 bg-indigo-400/15"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {/* Annotation capture rectangle */}
      {annotateRect && (annotateRect.w > 0 || annotateRect.h > 0) && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-amber-400 bg-amber-400/15"
          style={{ left: annotateRect.x, top: annotateRect.y, width: annotateRect.w, height: annotateRect.h }}
        />
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-1 shadow-lg">
        <CtrlBtn onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
          −
        </CtrlBtn>
        <span className="w-12 text-center text-xs text-slate-400">{Math.round(view.scale * 100)}%</span>
        <CtrlBtn onClick={() => zoomBy(1.2)} title="Zoom in">
          +
        </CtrlBtn>
        <div className="mx-1 h-5 w-px bg-slate-700" />
        <CtrlBtn onClick={fitAll} title="Fit all">
          ⤢
        </CtrlBtn>
        <CtrlBtn
          onClick={() => {
            onMoveScreens(screens.map((s, i) => ({ id: s.id, ...slotPosition(i) })))
            setTimeout(fitAll, 0)
          }}
          title="Arrange in a grid"
        >
          ▦
        </CtrlBtn>
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute right-4 top-3 text-right text-xs text-slate-500">
        {linkMode ? (
          <span className="text-indigo-300">
            🔗 Link mode — click a button/element inside a screen, then pick the target screen
          </span>
        ) : annotateMode ? (
          <span className="text-amber-300">
            ✂ Annotate — drag a rectangle over a screen to snip it into the chat as a numbered reference
          </span>
        ) : (
          <>Drag to select · Space/middle-drag to pan · scroll to zoom</>
        )}
      </div>
    </div>
  )
}

function LabelBtn({
  children,
  onClick,
  title,
  inv,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  inv: number
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded hover:bg-white/10 ${danger ? 'text-rose-300' : 'text-slate-200'}`}
      style={{ padding: `${2 * inv}px ${4 * inv}px`, lineHeight: 1, fontSize: `${13 * inv}px` }}
    >
      {children}
    </button>
  )
}

function CtrlBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-700/60"
    >
      {children}
    </button>
  )
}
