import { useEffect, useRef, useState } from 'react'
import { FRAME_HEADER, type Screen } from '../lib/project'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'

/**
 * Prototype player: renders one screen at a time and lets the user click the
 * hotspot links to navigate between screens, like a clickable prototype.
 */
export default function DemoPlayer({
  screens,
  startId,
  onExit,
}: {
  screens: Screen[]
  startId: string
  onExit: () => void
}) {
  const [stack, setStack] = useState<string[]>([startId])
  const currentId = stack[stack.length - 1]
  const current = screens.find((s) => s.id === currentId) ?? screens.find((s) => s.id === startId) ?? screens[0]

  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  if (!current) return null

  const bodyW = current.w
  const bodyH = Math.max(1, current.h - FRAME_HEADER)
  const pad = 28
  const scale = size.w > 0 ? Math.min((size.w - pad * 2) / bodyW, (size.h - pad * 2) / bodyH) : 0
  const boxW = bodyW * scale
  const boxH = bodyH * scale

  function navigate(target: string) {
    if (screens.some((s) => s.id === target)) setStack((st) => [...st, target])
  }

  const demoLinks = current.links
    .filter((h) => h.selector)
    .map((h) => ({ selector: h.selector as string, target: h.target }))

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <button type="button" className="btn-ghost text-sm" onClick={onExit}>
          ✕ Exit demo
        </button>
        <button
          type="button"
          className="btn-ghost text-sm disabled:opacity-40"
          disabled={stack.length <= 1}
          onClick={() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st))}
        >
          ← Back
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={() => setStack([startId])}>
          ↺ Restart
        </button>
        <span className="ml-2 truncate text-sm text-slate-300">{current.name}</span>
        <span className="ml-auto hidden text-xs text-slate-500 sm:inline">
          Demo · click linked areas to navigate · Esc to exit
        </span>
      </div>

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {scale > 0 && (
          <div className="relative" style={{ width: boxW, height: boxH }}>
            <div className="absolute inset-0">
              {current.device === 'iphone' ? (
                <DeviceChrome>
                  <Preview code={current.code} demoLinks={demoLinks} onNavigate={navigate} hideScrollbars radius={SCREEN_RADIUS} />
                </DeviceChrome>
              ) : (
                <Preview code={current.code} demoLinks={demoLinks} onNavigate={navigate} />
              )}
            </div>
            {/* Fallback overlays for legacy links without an element selector */}
            {current.links
              .filter((h) => !h.selector)
              .map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => navigate(h.target)}
                  title="Go to linked screen"
                  className="absolute rounded transition hover:bg-indigo-400/20"
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    width: `${h.w * 100}%`,
                    height: `${h.h * 100}%`,
                  }}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
