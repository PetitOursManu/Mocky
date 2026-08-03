import { useEffect, useMemo, useRef, useState } from 'react'
import { FRAME_HEADER, type Screen } from '../lib/project'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'

/**
 * How long a screen is held before the walkthrough moves on.
 *
 * Counted from the moment the screen has RENDERED, not from the navigation, so
 * a heavy screen gets its full turn rather than flashing past while it compiles.
 * Long enough to read a headline and see what changed; short enough that nobody
 * reaches for the Next button.
 */
const DWELL_MS = 2600

/**
 * Prototype player: renders one screen at a time and lets the user click the
 * hotspot links to navigate between screens, like a clickable prototype.
 */
export default function DemoPlayer({
  screens,
  startId,
  flow,
  animations,
  onExit,
}: {
  screens: Screen[]
  startId: string
  /**
   * An ordered walkthrough, when the user asked to play the screens rather than
   * follow their own hotspots. Ephemeral on purpose: writing it into
   * `Screen.links` would sync it, list it in the Links panel and draw it on the
   * canvas as if the user had wired it themselves.
   */
  flow?: string[]
  /** The project's animation switch, so a screen set to hold still does. */
  animations?: boolean
  onExit: () => void
}) {
  const t = useT()
  const [stack, setStack] = useState<string[]>([startId])
  const currentId = stack[stack.length - 1]
  const current = screens.find((s) => s.id === currentId) ?? screens.find((s) => s.id === startId) ?? screens[0]

  // ---- walkthrough ----
  //
  // The step is derived from the current screen rather than held separately, so
  // a hotspot click inside a walkthrough cannot leave the two disagreeing.
  const step = flow ? flow.indexOf(currentId) : -1
  const [autoplay, setAutoplay] = useState(false)
  const [shown, setShown] = useState(false)

  const goTo = (index: number) => {
    if (!flow) return
    const id = flow[index]
    if (!id || !screens.some((s) => s.id === id)) return
    setShown(false)
    setStack((st) => [...st, id])
  }

  /*
   * Auto-advance waits for the screen to have RENDERED, not for a fixed delay.
   *
   * Every step swaps the code, which rebuilds the iframe's srcDoc after a debounce
   * and recompiles it inside the frame. A timer alone would march past screens
   * that had not finished booting, and a walkthrough of blank rectangles is worse
   * than no walkthrough. `shown` is raised by Preview's onReady; the dwell only
   * starts counting from there.
   */
  useEffect(() => {
    if (!autoplay || !flow || step < 0 || !shown) return
    const id = setTimeout(() => {
      if (step + 1 < flow.length) goTo(step + 1)
      else setAutoplay(false)
    }, DWELL_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, shown, step, flow])

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
      if (e.key === 'Escape') {
        onExit()
        return
      }
      // Arrows only in a walkthrough. In hotspot mode there is no "next" to go
      // to, and stealing the arrow keys would break scrolling the screen.
      if (!flow || step < 0) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setAutoplay(false)
        goTo(step + 1)
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setAutoplay(false)
        goTo(step - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, flow, step])

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

  /*
   * Memoised, and that is load-bearing rather than tidy.
   *
   * Rebuilt on every render, this array reaches Preview with a new identity each
   * time, which re-runs the effects that own the iframe and drops `ready` back
   * to false. The iframe does not reload, so the "ok" it is now waiting for can
   * never come — and twenty seconds later a perfectly rendered screen accuses
   * itself of a render timeout. That is the exact failure Preview's own comment
   * at the bottom of its message effect warns about.
   *
   * It never mattered before because DemoPlayer had no state and never
   * re-rendered after mount. Adding the walkthrough gave it some.
   */
  const demoLinks = useMemo(
    () =>
      current.links
        .filter((h) => h.selector)
        .map((h) => ({ selector: h.selector as string, target: h.target })),
    [current.links],
  )

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
        <Button size="sm" onClick={() => { setAutoplay(false); setStack([startId]) }}>
          <Icon name="refresh" size={15} />
          {t('canvas.demoRestart')}
        </Button>

        {/* ---- walkthrough controls ---- */}
        {flow && step >= 0 && (
          <>
            <span className="mx-1 h-5 w-px bg-line-soft" aria-hidden />
            <Button
              size="sm"
              disabled={step + 1 >= flow.length && !autoplay}
              onClick={() => (autoplay ? setAutoplay(false) : step + 1 < flow.length ? setAutoplay(true) : undefined)}
            >
              <Icon name={autoplay ? 'pause' : 'play'} size={15} />
              {autoplay ? t('canvas.demoPause') : t('canvas.demoAuto')}
            </Button>
            <Button
              size="sm"
              disabled={step + 1 >= flow.length}
              onClick={() => { setAutoplay(false); goTo(step + 1) }}
            >
              {t('canvas.demoNext')}
              <Icon name="chevronRight" size={15} />
            </Button>
            <span className="shrink-0 font-mono text-caption tabular-nums text-ink-faint">
              {step + 1}/{flow.length}
            </span>
          </>
        )}

        <span className="kicker ml-3 shrink-0">{t('mode.demo')}</span>
        <span className="truncate text-body text-ink-muted">{current.name}</span>
        <span className="ml-auto hidden text-body-sm text-ink-faint sm:inline">
          {flow && step >= 0 ? t('canvas.demoFlowHint') : t('canvas.demoHint')}
        </span>
      </div>

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        {scale > 0 && (
          <div className="relative" style={{ width: boxW, height: boxH }}>
            <div className="absolute inset-0">
              {current.device === 'iphone' ? (
                <DeviceChrome>
                  <Preview code={current.code} caps={current.caps} demoLinks={demoLinks} onNavigate={navigate} onReady={(r) => r && setShown(true)} animations={current.animations ?? animations} hideScrollbars radius={SCREEN_RADIUS} />
                </DeviceChrome>
              ) : (
                <Preview code={current.code} caps={current.caps} demoLinks={demoLinks} onNavigate={navigate} onReady={(r) => r && setShown(true)} animations={current.animations ?? animations} />
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
