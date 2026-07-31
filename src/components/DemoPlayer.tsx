import { useEffect, useRef, useState } from 'react'
import { FRAME_HEADER, type Screen } from '../lib/project'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'

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
  const t = useT()
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
    <div className="fixed inset-0 z-top flex flex-col bg-sunken">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <Button size="sm" onClick={onExit}>
          <Icon name="close" size={15} />
          {t('canvas.demoExit')}
        </Button>
        <Button
          size="sm"
          disabled={stack.length <= 1}
          onClick={() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st))}
        >
          <Icon name="chevronLeft" size={15} />
          {t('canvas.demoBack')}
        </Button>
        <Button size="sm" onClick={() => setStack([startId])}>
          <Icon name="refresh" size={15} />
          {t('canvas.demoRestart')}
        </Button>
        <span className="kicker ml-3 shrink-0">{t('mode.demo')}</span>
        <span className="truncate text-body text-ink-muted">{current.name}</span>
        <span className="ml-auto hidden text-body-sm text-ink-faint sm:inline">{t('canvas.demoHint')}</span>
      </div>

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {scale > 0 && (
          <div className="relative" style={{ width: boxW, height: boxH }}>
            <div className="absolute inset-0">
              {current.device === 'iphone' ? (
                <DeviceChrome>
                  <Preview code={current.code} caps={current.caps} demoLinks={demoLinks} onNavigate={navigate} hideScrollbars radius={SCREEN_RADIUS} />
                </DeviceChrome>
              ) : (
                <Preview code={current.code} caps={current.caps} demoLinks={demoLinks} onNavigate={navigate} />
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
                  title={t('canvas.demoGoToScreen')}
                  aria-label={t('canvas.demoGoToScreen')}
                  className="absolute rounded transition hover:bg-accent/20"
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
