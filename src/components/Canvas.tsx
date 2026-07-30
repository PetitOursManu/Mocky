import { useCallback, useEffect, useRef, useState } from 'react'
import { MIN_H, MIN_W, slotPosition, type Screen } from '../lib/project'
import Preview, { type PickInfo } from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import { Icon, IconButton } from '../ui'

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

/**
 * What the Muse image beside a frame was for.
 *
 * The badge used to read "Image Muse" whatever the image was, so there was no
 * way to tell a reference the model merely looked at from a picture actually
 * placed in the screen — and therefore no way to check that inspiration mode was
 * doing anything. Screens generated before the role was recorded fall back to
 * 'unknown', which says so rather than guessing.
 */
const IMAGE_ROLE: Record<
  'content' | 'inspiration' | 'both' | 'unknown',
  { label: string; icon: 'image' | 'sparkle' | 'wand'; title: string }
> = {
  content: {
    label: 'Insérée',
    icon: 'image',
    title: 'Image de CONTENU — elle est placée dans l’écran comme une vraie <img>. Cliquer pour l’ouvrir en grand.',
  },
  inspiration: {
    label: 'Inspiration',
    icon: 'sparkle',
    title:
      'Image d’INSPIRATION — elle n’est PAS dans l’écran : elle a été montrée au modèle comme référence d’art direction (palette, lumière, composition). Cliquer pour l’ouvrir en grand.',
  },
  both: {
    label: 'Insérée + réf.',
    icon: 'wand',
    title:
      'Image de CONTENU ET référence — elle est placée dans l’écran, et le modèle l’a vue pour composer autour. Cliquer pour l’ouvrir en grand.',
  },
  unknown: {
    label: 'Image Muse',
    icon: 'image',
    title: 'Image Muse — son rôle n’a pas été enregistré (écran généré avant cette distinction).',
  },
}

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
  onOpenImage,
  linkMode,
  modifyMode,
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
  generatingIds,
  regeneratingIds,
  fixingIds,
  regenLabel,
  referenceScreenId,
  onScreenContextMenu,
  onContentHeight,
}: {
  screens: Screen[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onMoveScreens: (updates: Array<{ id: string; x: number; y: number }>) => void
  onResizeScreen: (id: string, box: Box) => void
  onRenameScreen: (id: string, name: string) => void
  onDeleteScreen: (id: string) => void
  /** Open the Muse image of a screen full size. */
  onOpenImage?: (hash: string) => void
  linkMode: boolean
  /** No-code "Modify" mode (Lot C): clicking an element in a screen picks it for a targeted edit. */
  modifyMode: boolean
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
  generatingIds?: Set<string>
  /** Screens with an in-place op running: keep the existing render, show a small badge only. */
  regeneratingIds?: Set<string>
  /** Screens whose render error is currently being auto-repaired — shows a calm "Repairing…" state instead of the red error. */
  fixingIds?: Set<string>
  /** Badge label for regeneratingIds frames (e.g. "Regenerating…", "Updating…"). */
  regenLabel?: string
  /** The screen pinned as the project's shared-layout reference, if any. */
  referenceScreenId?: string
  /** Open the per-screen context menu at client coords (right-click or the label's More button). */
  onScreenContextMenu?: (screenId: string, x: number, y: number) => void
  /** Reports a screen's rendered content height (px) for the "Full height" format. */
  onContentHeight?: (screenId: string, height: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ViewState>({ x: 80, y: 80, scale: 0.4 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  /** Screen whose original prompt is currently displayed (the comment button). */
  const [promptShownId, setPromptShownId] = useState<string | null>(null)
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

  // Space = temporary pan mode.
  //
  // This listener sits on `window`, and Canvas stays mounted underneath every
  // panel, dialog and menu the app opens. Swallowing Space for anything that is
  // not an input therefore broke Space on every button and checkbox in the whole
  // product — you could Tab to a control but never activate it, and the
  // Bibliothèque checkboxes (whose only activation key IS Space) became
  // impossible to tick. So: never intercept Space while focus is on an
  // interactive element.
  useEffect(() => {
    const isInteractive = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      Boolean(t.closest('input, textarea, select, button, a, [role="button"], [contenteditable], [tabindex]'))
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isInteractive(e.target)) {
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
    if (linkMode || annotateMode || modifyMode) return // empty-canvas drag does nothing in these modes
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
    cursor: spaceDown ? 'grab' : linkMode || annotateMode || modifyMode ? 'crosshair' : 'default',
  }
  const hs = 11 / view.scale // handle size in world units (constant on screen)
  const inv = 1 / view.scale // scale-invariant unit for labels
  const singleSelected = selectedIds.length === 1

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden bg-sunken"
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
          const interactive = interactAll && !linkMode && !modifyMode && !annotateMode && !spaceDown
          const pickable = (linkMode || modifyMode) && !annotateMode && !spaceDown
          const bw = b.w
          const bh = b.h
          const useFrame = s.device === 'iphone' && showFrame
          return (
            <div
              key={s.id}
              className={`absolute ${useFrame ? '' : 'frame-shadow'} ${
                selected ? 'ring-2 ring-accent' : useFrame ? '' : 'ring-1 ring-line-soft'
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
              onContextMenu={(e) => {
                e.preventDefault()
                onScreenContextMenu?.(s.id, e.clientX, e.clientY)
              }}
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
                    className="rounded border border-line bg-raised text-ink outline-none"
                    style={{ fontSize: 12 * inv, padding: `${1 * inv}px ${4 * inv}px`, width: b.w * 0.7 }}
                  />
                ) : (
                  <span className={`truncate ${selected ? 'text-accent' : 'text-ink-muted'}`}>
                    {referenceScreenId === s.id && (
                      <span title="Shared-layout reference for new screens" style={{ marginRight: 3 * inv }}>
                        <Icon
                          name="pin"
                          size={11 * inv}
                          className="inline-block"
                          style={{ verticalAlign: '-0.15em' }}
                        />
                      </span>
                    )}
                    {s.name}
                  </span>
                )}
                {selected && singleSelected && editingLabelId !== s.id && (
                  <span
                    className="flex items-center rounded-md border border-line bg-raised/90 text-ink"
                    style={{ gap: 2 * inv, padding: `${1 * inv}px ${2 * inv}px` }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <LabelBtn inv={inv} title="Rename" onClick={() => { setDraftLabel(s.name); setEditingLabelId(s.id) }}>
                      <Icon name="pencil" size={13 * inv} />
                    </LabelBtn>
                    <LabelBtn
                      inv={inv}
                      title={s.prompt ? 'Voir le prompt qui a créé cet écran' : 'Aucun prompt enregistré'}
                      onClick={() => setPromptShownId((id) => (id === s.id ? null : s.id))}
                    >
                      <Icon name="comment" size={13 * inv} />
                    </LabelBtn>
                    <button
                      type="button"
                      title="More options (or right-click the screen)"
                      aria-label="More options"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        onScreenContextMenu?.(s.id, r.left, r.bottom)
                      }}
                      className="flex items-center rounded text-ink hover:bg-ink/5"
                      style={{ padding: `${2 * inv}px ${5 * inv}px`, lineHeight: 1 }}
                    >
                      <Icon name="more" size={14 * inv} />
                    </button>
                    <LabelBtn inv={inv} title="Delete screen" danger onClick={() => onDeleteScreen(s.id)}>
                      <Icon name="trash" size={13 * inv} />
                    </LabelBtn>
                  </span>
                )}
              </div>

              {/* Prompt of this screen — opened from the comment button. Sits just
                  under the label, scale-invariant so it stays readable at any zoom. */}
              {promptShownId === s.id && selected && (
                <div
                  className="absolute left-0 z-20 rounded-lg border border-line bg-raised/95 text-ink shadow-xl backdrop-blur"
                  style={{
                    top: -2 * inv,
                    width: Math.min(s.w, 420) ,
                    padding: `${8 * inv}px ${10 * inv}px`,
                    fontSize: `${12 * inv}px`,
                    transform: `translateY(-100%) translateY(${-22 * inv}px)`,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between" style={{ gap: 6 * inv, marginBottom: 4 * inv }}>
                    <span
                      className="flex items-center font-medium text-muse"
                      style={{ fontSize: `${11 * inv}px`, gap: 4 * inv }}
                    >
                      <Icon name="comment" size={11 * inv} />
                      Prompt d’origine
                    </span>
                    <span className="flex items-center" style={{ gap: 2 * inv }}>
                      {s.prompt && (
                        <LabelBtn inv={inv} title="Copier le prompt" onClick={() => navigator.clipboard?.writeText(s.prompt)}>
                          <Icon name="copy" size={12 * inv} />
                        </LabelBtn>
                      )}
                      <LabelBtn inv={inv} title="Fermer" onClick={() => setPromptShownId(null)}>
                        <Icon name="close" size={12 * inv} />
                      </LabelBtn>
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words leading-snug text-ink-muted">
                    {s.prompt || 'Aucun prompt enregistré pour cet écran (créé avant cette fonctionnalité, ou importé).'}
                  </p>
                </div>
              )}

              {/* Muse image that backs this screen — sits in the grid beside the
                  frame (outside its bounds) so you can see it without opening
                  the library. Click to view it full size. */}
              {s.imageHash && (
                <button
                  type="button"
                  className="absolute overflow-hidden rounded-xl border border-muse/60 bg-raised shadow-xl transition hover:border-muse"
                  style={{ left: `calc(100% + ${24 * inv}px)`, top: 0, width: 200 * inv, cursor: 'pointer' }}
                  title={IMAGE_ROLE[s.imageRole ?? 'unknown'].title}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenImage?.(s.imageHash as string)
                  }}
                >
                  <img src={`/api/images/${s.imageHash}`} alt="" className="block w-full object-cover" />
                  <span
                    className="flex items-center bg-muse/15 text-muse"
                    style={{ padding: `${4 * inv}px ${6 * inv}px`, fontSize: `${11 * inv}px`, gap: 4 * inv }}
                  >
                    <Icon name={IMAGE_ROLE[s.imageRole ?? 'unknown'].icon} size={11 * inv} />
                    {IMAGE_ROLE[s.imageRole ?? 'unknown'].label}
                  </span>
                </button>
              )}

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
                      pickOutlineOnly={modifyMode}
                      pickPrecise={modifyMode}
                      onPick={(info) => onPickElement(s.id, info)}
                      hideScrollbars={s.device === 'iphone'}
                      radius={SCREEN_RADIUS}
                      captureRequest={captureReq?.screenId === s.id ? { id: captureReq.id, clientRect: captureReq.clientRect } : null}
                      onCaptureRect={onCaptureRect}
                      onError={(err) => onError?.(s.id, err)}
                      generating={generatingIds?.has(s.id)}
                      retrying={fixingIds?.has(s.id)}
                      caps={s.caps}
                      onContentHeight={(h) => onContentHeight?.(s.id, h)}
                    />
                  </DeviceChrome>
                ) : (
                  <Preview
                    code={s.code}
                    pickMode={pickable}
                    pickOutlineOnly={modifyMode}
                    pickPrecise={modifyMode}
                    onPick={(info) => onPickElement(s.id, info)}
                    hideScrollbars={s.device === 'iphone'}
                    radius="1rem"
                    captureRequest={captureReq?.screenId === s.id ? { id: captureReq.id, clientRect: captureReq.clientRect } : null}
                    onCaptureRect={onCaptureRect}
                    onError={(err) => onError?.(s.id, err)}
                    generating={generatingIds?.has(s.id)}
                    retrying={fixingIds?.has(s.id)}
                    caps={s.caps}
                  />
                )}
              </div>

              {/* Animated multicolor ring while regenerating/updating this frame */}
              {regeneratingIds?.has(s.id) && (
                <div
                  className="mocky-regen-ring pointer-events-none absolute z-10"
                  style={{ inset: -5 * inv, padding: 7 * inv, borderRadius: useFrame ? '13% / 6%' : '1rem' }}
                />
              )}

              {/* Regenerating badge — the existing preview stays visible underneath */}
              {regeneratingIds?.has(s.id) && (
                <div
                  className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-accent font-medium text-on-accent shadow-lg"
                  style={{ marginTop: 8 * inv, paddingLeft: 10 * inv, paddingRight: 12 * inv, paddingTop: 4 * inv, paddingBottom: 4 * inv, fontSize: 12 * inv, gap: 6 * inv }}
                >
                  <span
                    className="animate-spin rounded-full border-on-accent/40 border-t-on-accent"
                    style={{ width: 12 * inv, height: 12 * inv, borderWidth: 2 * inv }}
                  />
                  {regenLabel || 'Regenerating…'}
                </div>
              )}

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
                          ? 'border-warn bg-warn/30 ring-4 ring-warn/40'
                          : 'border-accent bg-accent/20'
                      }`}
                      style={{ left: h.x * bw, top: h.y * bh, width: h.w * bw, height: h.h * bh }}
                    >
                      <div
                        className="pointer-events-auto absolute left-0 top-0 flex max-w-full items-center gap-1 rounded bg-accent px-1 font-medium text-on-accent"
                        style={{ fontSize: 10 / view.scale, transform: `translateY(-100%)` }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">
                          {h.label ? `"${h.label}" ` : ''}→ {targetName}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveHotspot(s.id, h.id)}
                          className="flex shrink-0 items-center rounded px-0.5 hover:bg-on-accent/20"
                          title="Remove link"
                          aria-label="Remove link"
                        >
                          <Icon name="close" size={10 / view.scale} />
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
                      className="border border-surface bg-accent"
                    />
                  )
                })}

              {/* Dimension label under a single selected frame */}
              {selected && singleSelected && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-accent px-2 font-mono font-medium text-on-accent"
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
          className="pointer-events-none absolute border border-accent bg-accent/15"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {/* Annotation capture rectangle */}
      {annotateRect && (annotateRect.w > 0 || annotateRect.h > 0) && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-warn bg-warn/15"
          style={{ left: annotateRect.x, top: annotateRect.y, width: annotateRect.w, height: annotateRect.h }}
        />
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-line bg-raised/90 p-1 shadow-lg">
        <IconButton variant="toolbar" label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <Icon name="zoomOut" size={16} />
        </IconButton>
        <span className="w-12 text-center font-mono text-body-sm text-ink-muted">{Math.round(view.scale * 100)}%</span>
        <IconButton variant="toolbar" label="Zoom in" onClick={() => zoomBy(1.2)}>
          <Icon name="zoomIn" size={16} />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-line-soft" />
        <IconButton variant="toolbar" label="Fit all" onClick={fitAll}>
          <Icon name="fit" size={16} />
        </IconButton>
        <IconButton
          variant="toolbar"
          label="Arrange in a grid"
          onClick={() => {
            onMoveScreens(screens.map((s, i) => ({ id: s.id, ...slotPosition(i) })))
            setTimeout(fitAll, 0)
          }}
        >
          <Icon name="grid" size={16} />
        </IconButton>
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute right-4 top-3 text-right text-body-sm text-ink-faint">
        {linkMode ? (
          <span className="flex items-center justify-end gap-1.5 text-accent">
            <Icon name="link" size={15} />
            Link mode — click a button/element inside a screen, then pick the target screen
          </span>
        ) : modifyMode ? (
          <span className="flex items-center justify-end gap-1.5 text-muse">
            <Icon name="pencil" size={15} />
            Modify mode — click any element inside a screen, then describe the change
          </span>
        ) : annotateMode ? (
          <span className="flex items-center justify-end gap-1.5 text-warn">
            <Icon name="crop" size={15} />
            Annotate — drag a rectangle over a screen to snip it into the chat as a numbered reference
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
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  inv: number
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex items-center rounded hover:bg-ink/5 ${
        active ? 'bg-warn/20 text-warn' : danger ? 'text-danger' : 'text-ink'
      }`}
      style={{ padding: `${2 * inv}px ${4 * inv}px`, lineHeight: 1, fontSize: `${13 * inv}px` }}
    >
      {children}
    </button>
  )
}
