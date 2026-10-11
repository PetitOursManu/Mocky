import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import Preview from './Preview'
import DocumentPages from './DocumentPages'
import type { Screen } from '../lib/project'

/**
 * One screen, laid out at its OWN viewport and scaled down to fit a box.
 *
 * Handing `Preview` a smaller box would re-lay the page at that width — a
 * desktop screen compared in a 600-px column would show its mobile layout,
 * which is a different design from the one being compared. So the frame is
 * rendered at the screen's real `w × h` and the whole thing is scaled with a
 * transform, the way the canvas zooms. A DOCUMENT is shown as its pages, by the
 * component the demo uses for them.
 *
 * `overlay` is laid over the scaled screen in the same box, so something drawn
 * at a fraction of it — a comment's pin — lands on the same pixel at any size.
 */
export default function ScreenFit({
  screen,
  overlay,
  onOverlayClick,
  animations = true,
  demoLinks,
  onNavigate,
  flow,
}: {
  screen: Pick<Screen, 'id' | 'name' | 'code' | 'caps' | 'w' | 'h' | 'page' | 'componentName'> & Partial<Screen>
  overlay?: ReactNode
  /** A click on the screen's box, as fractions of it (0..1). */
  onOverlayClick?: (at: { x: number; y: number }) => void
  animations?: boolean
  /** The screen's links, followed as in the demo (see `Preview`). */
  demoLinks?: { selector: string; target: string }[]
  onNavigate?: (target: string) => void
  /** A page of a working prototype — see `Preview`'s prop of the same name. */
  flow?: ComponentProps<typeof Preview>['flow']
}) {
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

  if (screen.page) {
    const full: Screen = {
      prompt: '',
      createdAt: 0,
      x: 0,
      y: 0,
      device: 'none',
      links: [],
      ...screen,
      caps: screen.caps ?? [],
    } as Screen
    return (
      <div ref={areaRef} className="relative h-full w-full overflow-hidden">
        {size.w > 0 && <DocumentPages screen={full} page={screen.page} width={size.w} height={size.h} />}
      </div>
    )
  }

  const w = Math.max(1, screen.w || 1440)
  const h = Math.max(1, screen.h || 900)
  // A box with no height yet (a parent with only a minimum) fits on the width
  // alone rather than drawing nothing.
  const scale = size.w > 0 ? Math.min(size.w / w, size.h > 0 ? size.h / h : Infinity, 1) : 0

  return (
    <div ref={areaRef} className="relative flex h-full w-full items-start justify-center overflow-hidden">
      {scale > 0 && (
        <div className="relative border border-line-soft" style={{ width: w * scale, height: h * scale }}>
          <div className="absolute left-0 top-0" style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <Preview
              key={screen.id}
              code={screen.code}
              caps={screen.caps}
              animations={animations}
              demoLinks={demoLinks}
              onNavigate={onNavigate}
              flow={flow}
            />
          </div>
          {onOverlayClick && (
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="absolute inset-0 cursor-crosshair"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                onOverlayClick({
                  x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
                  y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
                })
              }}
            />
          )}
          {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
        </div>
      )}
    </div>
  )
}
